// app/services/scrapers/justEtfScraper.js
// Servizio per lo scraping di informazioni da JustETF

const puppeteer = require('puppeteer');

class JustEtfScraper {
  constructor(logger) {
    this.logger = logger;
    this.browser = null;
  }

  /**
   * Inizializza il browser Puppeteer
   */
  async init() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
  }

  /**
   * Chiude il browser Puppeteer
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Recupera informazioni di un ETF da JustETF
   * @param {string} isin - ISIN dell'ETF
   * @returns {Object} Informazioni ETF { nome, div_yield, currency } o null se errore
   */
  async scrapeEtfInfo(isin) {
    let page = null;

    try {
      await this.init();
      page = await this.browser.newPage();

      // Imposta user agent per evitare blocchi
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      const url = `https://www.justetf.com/en/etf-profile.html?isin=${isin}`;
      this.logger.info(`  📡 Collegamento a JustETF: ${url}`);

      // Naviga alla pagina con timeout di 30 secondi
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Attendi un po' per il caricamento completo
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verifica se la pagina esiste (non è una 404)
      const pageTitle = await page.title();
      this.logger.info(`  📄 Titolo pagina: "${pageTitle}"`);

      if (pageTitle.toLowerCase().includes('404') || pageTitle.toLowerCase().includes('not found')) {
        throw new Error('ETF non trovato su JustETF (404)');
      }

      // Verifica che siamo su una pagina ETF valida cercando h1#etf-title
      let nome = null;
      try {
        // Controlla se esiste h1 con id="etf-title"
        const h1Exists = await page.$('h1#etf-title');

        if (!h1Exists) {
          this.logger.warning(`  ⚠️  <h1 id="etf-title"> non trovato - non è una pagina ETF valida`);
          throw new Error('Pagina ETF non valida - elemento h1#etf-title mancante');
        }

        // Estrai il nome dall'h1 con id corretto
        nome = await page.$eval('h1#etf-title', el => el.textContent.trim());
        this.logger.info(`  🔍 Nome da <h1 id="etf-title">: "${nome}"`);

      } catch (e) {
        this.logger.warning(`  ⚠️  Errore verifica pagina ETF: ${e.message}`);

        // Se non è una pagina ETF valida, potrebbe essere una Stock
        if (e.message.includes('non valida') || e.message.includes('mancante')) {
          throw e; // Rilancia l'errore per far fallire lo scraping ETF
        }

        // Altri errori: prova con fallback meta tag
        try {
          const metaTitle = await page.$eval('meta[property="og:title"]', el => el.content);
          this.logger.info(`  🔍 Meta title trovato: "${metaTitle}"`);
          // Il meta title ha formato: "Nome ETF | Codice | ISIN" - prendiamo solo il nome
          nome = metaTitle.split('|')[0].trim();
          this.logger.info(`  🔍 Nome da meta tag (fallback): "${nome}"`);
        } catch (e2) {
          this.logger.warning(`  ⚠️  Errore lettura meta tag: ${e2.message}`);
          throw new Error('Impossibile estrarre il nome dell\'ETF');
        }
      }

      // Estrai il dividend yield e currency dal body text
      let div_yield = null;
      let currency = null;

      try {
        const bodyText = await page.evaluate(() => document.body.innerText);
        this.logger.info(`  📝 Lunghezza body text: ${bodyText.length} caratteri`);

        // DEBUG: Mostra prime righe che contengono "Fund currency"
        const fundCurrencyLines = bodyText.split('\n').filter(line => line.includes('Fund currency'));
        if (fundCurrencyLines.length > 0) {
          this.logger.info(`  🔍 Righe con "Fund currency": ${JSON.stringify(fundCurrencyLines)}`);
        }

        // Cerca "Fund currency" nella tabella
        const currencyMatch = bodyText.match(/Fund currency[\s\t]+([A-Z]{3})/i);
        if (currencyMatch) {
          currency = currencyMatch[1];
          this.logger.info(`  ✅ Currency trovata: "${currency}"`);
        } else {
          this.logger.warning('  ⚠️  Currency non trovata con regex');
        }

        // Cerca "yield" nella pagina (formato: "yield\t0.95%")
        const yieldLines = bodyText.split('\n').filter(line =>
          line.toLowerCase().includes('yield') && line.includes('%')
        );
        if (yieldLines.length > 0) {
          this.logger.info(`  🔍 Righe con "yield": ${JSON.stringify(yieldLines.slice(0, 3))}`);
        }

        // Cerca pattern "yield" seguito da percentuale
        const divYieldMatch = bodyText.match(/yield[\s\t]+([0-9.]+%)/i);
        if (divYieldMatch) {
          div_yield = divYieldMatch[1];
          this.logger.info(`  ✅ Dividend yield trovato: "${div_yield}"`);
        } else {
          this.logger.info('  ℹ️  Dividend yield non trovato');
        }

        // Controlla Distribution policy (su righe separate o insieme)
        const lines = bodyText.split('\n');
        const policyIdx = lines.findIndex(l => l.includes('Distribution policy'));

        if (policyIdx !== -1) {
          // Controlla la riga successiva
          const nextLine = lines[policyIdx + 1]?.trim();
          this.logger.info(`  🔍 Distribution policy: "${nextLine}"`);

          if (nextLine && nextLine.includes('Accumulating')) {
            this.logger.info('  ℹ️  ETF è Accumulating, div_yield impostato a null');
            div_yield = null;
          } else if (nextLine && nextLine.includes('Distributing')) {
            this.logger.info('  ℹ️  ETF è Distributing, mantiene div_yield');
            // Mantiene il div_yield trovato
          }
        }
      } catch (e) {
        this.logger.warning(`  ⚠️  Errore nell\'estrazione dati aggiuntivi: ${e.message}`);
      }

      if (!nome) {
        if (page && !page.isClosed()) await page.close();
        throw new Error('Impossibile estrarre il nome dell\'ETF');
      }

      this.logger.success(`  ✅ ETF trovato: ${nome}`);
      if (div_yield) this.logger.info(`     Dividend yield: ${div_yield}`);
      if (currency) this.logger.info(`     Currency: ${currency}`);

      // Chiudi la pagina in modo sicuro
      if (page && !page.isClosed()) {
        await page.close();
      }

      return {
        nome,
        div_yield: div_yield || null,
        currency: currency || null
      };

    } catch (error) {
      // Chiudi la pagina in modo sicuro anche in caso di errore
      if (page && !page.isClosed()) {
        try {
          await page.close();
        } catch (closeError) {
          // Ignora errori di chiusura
        }
      }

      // Se l'errore è perché l'ETF non esiste, potrebbe essere una Stock
      if (error.message.includes('404') || error.message.includes('not found')) {
        this.logger.warning(`  ⚠️  ETF non trovato su JustETF, probabilmente è una Stock`);
        return { isNotEtf: true };
      }

      this.logger.error(`  ❌ Errore scraping JustETF: ${error.message}`);
      throw error;
    }
  }
}

module.exports = JustEtfScraper;
