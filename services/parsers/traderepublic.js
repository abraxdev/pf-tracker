const { PDFParse } = require('pdf-parse');
const fs = require('fs');

/**
 * Parse Italian date format "01 set 2025" to ISO "2025-09-01"
 */
function parseDate(dateStr) {
    const MONTHS_IT = {
        'gen': '01', 'feb': '02', 'mar': '03', 'apr': '04',
        'mag': '05', 'giu': '06', 'lug': '07', 'ago': '08',
        'set': '09', 'ott': '10', 'nov': '11', 'dic': '12'
    };

    // Match pattern: "01 set 2025" or "01 set\n2025"
    const match = dateStr.replace(/\n/g, ' ').match(/(\d{1,2})\s+(\w{3})\s+(\d{4})/);
    if (match) {
        const [, day, month, year] = match;
        const monthNum = MONTHS_IT[month.toLowerCase()];
        if (monthNum) {
            return `${year}-${monthNum}-${day.padStart(2, '0')}`;
        }
    }
    return null;
}

/**
 * Parse Italian currency format "1.234,56 €" to float 1234.56
 */
function parseAmount(amountStr) {
    if (!amountStr || amountStr.trim() === '' || amountStr === '-') {
        return null;
    }

    // Remove € symbol, thousands separator (.), replace comma with dot
    const cleaned = amountStr
        .replace(/€/g, '')
        .replace(/\./g, '')
        .replace(/,/g, '.')
        .trim();

    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
}

/**
 * Parse TradeRepublic PDF bank statement using pdf-parse
 *
 * @param {string} filePath - Path to PDF file
 * @returns {Promise<Array>} Promise resolving to array of parsed transactions
 */
async function parseTradeRepublic(filePath) {
    try {
        console.log(`[TradeRepublic Parser] Starting parse for file: ${filePath}`);

        // Read PDF file using PDFParse v2
        // Read file as buffer (file:// URLs don't work on macOS)
        const dataBuffer = fs.readFileSync(filePath);
        const parser = new PDFParse({ data: dataBuffer });
        const result = await parser.getText();
        await parser.destroy();
        const text = result.text;

        console.log(`[TradeRepublic Parser] PDF parsed. Text length: ${text.length}`);

        const transactions = [];
        const lines = text.split('\n');

        let inTransactionSection = false;
        let currentTransaction = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Find start of transactions section
            if (line.includes('TRANSAZIONI SUL CONTO')) {
                inTransactionSection = true;
                console.log(`[TradeRepublic Parser] Found transaction section at line ${i}`);
                continue;
            }

            // Stop at end of transactions section
            if (line.includes('PANORAMICA DEL SALDO') || line.includes('PANORAMICA TRANSAZIONI')) {
                inTransactionSection = false;
                break;
            }

            if (!inTransactionSection) continue;

            // Skip header row
            if (line.includes('DATA') && line.includes('TIPO') && line.includes('DESCRIZIONE')) {
                continue;
            }

            // Try to match transaction line pattern
            // Pattern: "01 set" at start (date without year)
            const dateMatch = line.match(/^(\d{1,2}\s+\w{3})\s*$/);
            if (dateMatch && i + 1 < lines.length) {
                const nextLine = lines[i + 1].trim();

                // Check if next line starts with year
                const yearMatch = nextLine.match(/^(\d{4})\s*(.*)/);
                if (yearMatch) {
                    const year = yearMatch[1];
                    const restOfLine = yearMatch[2];
                    const dateStr = `${dateMatch[1]} ${year}`;
                    const parsedDate = parseDate(dateStr);

                    if (!parsedDate) continue;

                    currentTransaction = {
                        date: parsedDate,
                        type_raw: '',
                        description: '',
                        amount_in: null,
                        amount_out: null
                    };

                    // Check if everything is on the same line (format: "2025 Redditi Cash Dividend... 2,74 € 6.464,15 €")
                    const amountMatches = restOfLine.match(/(\d{1,3}(?:\.\d{3})*,\d{2}\s*€)/g);

                    if (amountMatches && amountMatches.length >= 1) {
                        // Format 1: Year + Type + Description + Amounts all on one line
                        const beforeAmounts = restOfLine.substring(0, restOfLine.indexOf(amountMatches[0])).trim();

                        // Extract type and description
                        const typeKeywords = ['Pagamento', 'Redditi', 'Transazione', 'Bonifico', 'Prelievo'];
                        const typeContinuations = {
                            'Pagamento': ['degli interessi'],
                            'Transazione': ['con carta']
                        };
                        let foundType = false;

                        for (const keyword of typeKeywords) {
                            if (beforeAmounts.startsWith(keyword)) {
                                currentTransaction.type_raw = keyword;
                                let description = beforeAmounts.substring(keyword.length).trim();

                                // Remove known type continuations
                                if (typeContinuations[keyword]) {
                                    for (const continuation of typeContinuations[keyword]) {
                                        if (description.startsWith(continuation)) {
                                            description = description.substring(continuation.length).trim();
                                            break;
                                        }
                                    }
                                }

                                currentTransaction.description = description;
                                foundType = true;
                                break;
                            }
                        }

                        if (!foundType) {
                            const words = beforeAmounts.split(/\s+/);
                            if (words.length > 1) {
                                currentTransaction.type_raw = words[0];
                                currentTransaction.description = words.slice(1).join(' ');
                            } else {
                                currentTransaction.description = beforeAmounts;
                            }
                        }

                        // Parse amounts
                        const amounts = amountMatches.map(a => parseAmount(a)).filter(a => a !== null);

                        if (amounts.length === 2) {
                            const isIncome = currentTransaction.type_raw.match(/Pagamento|Redditi|Bonifico/i) ||
                                            currentTransaction.description.match(/dividend|interest|incoming|transfer from/i);
                            if (isIncome) {
                                currentTransaction.amount_in = amounts[0];
                            } else {
                                currentTransaction.amount_out = amounts[0];
                            }
                        } else if (amounts.length >= 3) {
                            currentTransaction.amount_in = amounts[0] || 0;
                            currentTransaction.amount_out = amounts[1] || 0;
                        }

                        if (currentTransaction.amount_in || currentTransaction.amount_out) {
                            transactions.push({
                                bank: 'traderepublic',
                                transaction_date: currentTransaction.date,
                                value_date: currentTransaction.date,
                                type_raw: currentTransaction.type_raw,
                                description: currentTransaction.description,
                                amount_in: currentTransaction.amount_in || 0,
                                amount_out: currentTransaction.amount_out || 0
                            });
                            console.log(`[TradeRepublic Parser] ✓ Added: ${currentTransaction.date} - ${currentTransaction.type_raw} - ${currentTransaction.description.substring(0, 30)}...`);
                        }

                        i++; // Skip year line
                    } else {
                        // Format 2: Multiline (year on its own, then type, then description with amounts)
                        let j = i + 2;
                        let foundAmounts = false;
                        const textParts = [];

                        while (j < lines.length && j < i + 15 && !foundAmounts) {
                            const currentLine = lines[j].trim();

                            // Check for amounts
                            const lineAmountMatches = currentLine.match(/(\d{1,3}(?:\.\d{3})*,\d{2}\s*€)/g);

                            if (lineAmountMatches && lineAmountMatches.length >= 1) {
                                // Extract text before amounts
                                const beforeAmounts = currentLine.substring(0, currentLine.indexOf(lineAmountMatches[0])).trim();
                                if (beforeAmounts) {
                                    textParts.push(beforeAmounts);
                                }

                                // Combine all text parts
                                const fullText = textParts.join(' ');

                                // Extract type and description
                                const typeKeywords = ['Pagamento', 'Redditi', 'Transazione', 'Bonifico', 'Prelievo'];
                                const typeContinuations = {
                                    'Pagamento': ['degli interessi'],
                                    'Transazione': ['con carta']
                                };
                                let foundType = false;

                                for (const keyword of typeKeywords) {
                                    if (fullText.startsWith(keyword)) {
                                        currentTransaction.type_raw = keyword;
                                        let description = fullText.substring(keyword.length).trim();

                                        // Remove known type continuations
                                        if (typeContinuations[keyword]) {
                                            for (const continuation of typeContinuations[keyword]) {
                                                if (description.startsWith(continuation)) {
                                                    description = description.substring(continuation.length).trim();
                                                    break;
                                                }
                                            }
                                        }

                                        currentTransaction.description = description;
                                        foundType = true;
                                        break;
                                    }
                                }

                                if (!foundType) {
                                    const words = fullText.split(/\s+/);
                                    if (words.length > 1) {
                                        currentTransaction.type_raw = words[0];
                                        currentTransaction.description = words.slice(1).join(' ');
                                    } else {
                                        currentTransaction.description = fullText;
                                    }
                                }

                                // Parse amounts
                                const amounts = lineAmountMatches.map(a => parseAmount(a)).filter(a => a !== null);

                                if (amounts.length === 2) {
                                    const isIncome = currentTransaction.type_raw.match(/Pagamento|Redditi|Bonifico/i) ||
                                                    currentTransaction.description.match(/dividend|interest|incoming|transfer from/i);
                                    if (isIncome) {
                                        currentTransaction.amount_in = amounts[0];
                                    } else {
                                        currentTransaction.amount_out = amounts[0];
                                    }
                                } else if (amounts.length >= 3) {
                                    currentTransaction.amount_in = amounts[0] || 0;
                                    currentTransaction.amount_out = amounts[1] || 0;
                                }

                                foundAmounts = true;

                                if (currentTransaction.amount_in || currentTransaction.amount_out) {
                                    transactions.push({
                                        bank: 'traderepublic',
                                        transaction_date: currentTransaction.date,
                                        value_date: currentTransaction.date,
                                        type_raw: currentTransaction.type_raw,
                                        description: currentTransaction.description,
                                        amount_in: currentTransaction.amount_in || 0,
                                        amount_out: currentTransaction.amount_out || 0
                                    });
                                    console.log(`[TradeRepublic Parser] ✓ Added: ${currentTransaction.date} - ${currentTransaction.type_raw} - ${currentTransaction.description.substring(0, 30)}...`);
                                }

                                i = j; // Skip to amounts line
                                break;
                            } else {
                                // Accumulate text
                                if (currentLine && currentLine.length > 0) {
                                    textParts.push(currentLine);
                                }
                            }

                            j++;
                        }
                    }
                }
            }
        }

        console.log(`[TradeRepublic Parser] Successfully extracted ${transactions.length} transactions`);
        return transactions;

    } catch (error) {
        console.error(`[TradeRepublic Parser] ERROR:`, error);
        throw new Error(`Failed to parse TradeRepublic PDF: ${error.message}`);
    }
}

module.exports = { parseTradeRepublic };
