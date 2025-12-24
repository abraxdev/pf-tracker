// app/services/scrapers/yahooFinanceScraper.js
// Servizio per il recupero dati da Yahoo Finance

const YahooFinance = require('yahoo-finance2').default;

class YahooFinanceScraper {
  constructor(logger) {
    this.logger = logger;
    this.yf = new YahooFinance();
  }

  /**
   * Recupera informazioni di una Stock da Yahoo Finance
   * @param {string} ticker - Ticker della stock
   * @returns {Object} Informazioni stock { nome, currency, div_yield, last_price } o null se errore
   */
  async getStockInfo(ticker) {
    try {
      this.logger.info(`  📡 Recupero info da Yahoo Finance per ticker: ${ticker}`);

      // Recupera quote summary che contiene tutte le informazioni
      const quote = await this.yf.quoteSummary(ticker, {
        modules: ['price', 'summaryDetail', 'defaultKeyStatistics']
      });

      if (!quote || !quote.price) {
        throw new Error('Dati non disponibili per questo ticker');
      }

      // Estrai le informazioni
      const nome = quote.price.longName || quote.price.shortName || null;
      const currency = quote.price.currency || null;
      const last_price = quote.price.regularMarketPrice || null;

      // Il dividend yield può essere in diversi formati
      let div_yield = null;
      if (quote.summaryDetail?.dividendYield) {
        // Yahoo restituisce il yield come decimale (es. 0.0234 per 2.34%)
        div_yield = (quote.summaryDetail.dividendYield * 100).toFixed(2) + '%';
      } else if (quote.summaryDetail?.trailingAnnualDividendYield) {
        div_yield = (quote.summaryDetail.trailingAnnualDividendYield * 100).toFixed(2) + '%';
      }

      this.logger.success(`  ✅ Stock trovata: ${nome}`);
      this.logger.info(`     Currency: ${currency}`);
      this.logger.info(`     Last price: ${last_price}`);
      if (div_yield) this.logger.info(`     Dividend yield: ${div_yield}`);

      return {
        nome,
        currency,
        div_yield,
        last_price
      };

    } catch (error) {
      this.logger.error(`  ❌ Errore Yahoo Finance: ${error.message}`);
      throw error;
    }
  }

  /**
   * Recupera solo il prezzo corrente di un titolo
   * @param {string} ticker - Ticker del titolo
   * @returns {number|null} Prezzo corrente o null se errore
   */
  async getLastPrice(ticker) {
    try {
      const quote = await this.yf.quote(ticker);

      if (!quote || !quote.regularMarketPrice) {
        throw new Error('Prezzo non disponibile');
      }

      const price = quote.regularMarketPrice;
      this.logger.info(`  💰 Prezzo per ${ticker}: ${price}`);

      return price;

    } catch (error) {
      this.logger.error(`  ❌ Errore recupero prezzo per ${ticker}: ${error.message}`);
      return null;
    }
  }

  /**
   * Recupera informazioni complete da Yahoo Finance
   * Compatibile sia con ETF che Stock
   * @param {string} ticker - Ticker del titolo
   * @returns {Object} Informazioni complete
   */
  async getFullInfo(ticker) {
    try {
      this.logger.info(`  📡 Recupero info complete da Yahoo Finance per: ${ticker}`);

      const quote = await this.yf.quoteSummary(ticker, {
        modules: ['price', 'summaryDetail', 'defaultKeyStatistics', 'assetProfile']
      });

      if (!quote || !quote.price) {
        throw new Error('Dati non disponibili');
      }

      const nome = quote.price.longName || quote.price.shortName || null;
      const currency = quote.price.currency || null;
      const last_price = quote.price.regularMarketPrice || null;

      let div_yield = null;
      if (quote.summaryDetail?.dividendYield) {
        div_yield = (quote.summaryDetail.dividendYield * 100).toFixed(2) + '%';
      } else if (quote.summaryDetail?.trailingAnnualDividendYield) {
        div_yield = (quote.summaryDetail.trailingAnnualDividendYield * 100).toFixed(2) + '%';
      }

      // Determina il tipo (ETF o Stock)
      const quoteType = quote.price.quoteType; // 'ETF', 'EQUITY', etc.

      this.logger.success(`  ✅ Titolo trovato: ${nome} (${quoteType})`);
      this.logger.info(`     Currency: ${currency}`);
      this.logger.info(`     Last price: ${last_price}`);
      if (div_yield) this.logger.info(`     Dividend yield: ${div_yield}`);

      return {
        nome,
        currency,
        div_yield,
        last_price,
        quoteType
      };

    } catch (error) {
      this.logger.error(`  ❌ Errore Yahoo Finance: ${error.message}`);
      throw error;
    }
  }
}

module.exports = YahooFinanceScraper;
