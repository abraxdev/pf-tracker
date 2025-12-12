const fs = require('fs');
const csv = require('csv-parser');
const iconv = require('iconv-lite');
const { parseItalianDate } = require('../../utils/dateUtils');
const { parseItalianAmount } = require('../../utils/amountUtils');

/**
 * Parse RelaxBanking TSV file
 *
 * File structure:
 * - Format: TSV (Tab-Separated Values) with .xls extension
 * - Encoding: latin-1 (ISO-8859-1)
 * - Columns: Data contabile, Data valuta, Importo, Descrizione, Note
 * - Date format: DD/MM/YYYY
 * - Amount format: Italian (-1.234,56)
 *
 * @param {string} filePath - Path to TSV file
 * @returns {Promise<Array>} Promise resolving to array of parsed transactions
 */
function parseRelaxBanking(filePath) {
    return new Promise((resolve, reject) => {
        const transactions = [];

        // Read file with latin-1 encoding and convert to UTF-8
        const stream = fs.createReadStream(filePath)
            .pipe(iconv.decodeStream('latin1'))
            .pipe(csv({
                separator: '\t',
                mapHeaders: ({ header }) => header.trim()
            }));

        stream.on('data', (row) => {
            try {
                // Extract fields (handle case variations)
                const dataContabile = row['Data contabile'] || row['DATA CONTABILE'] || '';
                const dataValuta = row['Data valuta'] || row['DATA VALUTA'] || '';
                const importoRaw = row['Importo'] || row['IMPORTO'] || '';
                const descrizione = row['Descrizione'] || row['DESCRIZIONE'] || '';
                const note = row['Note'] || row['NOTE'] || '';

                // Skip rows without date or amount
                if (!dataContabile || !importoRaw) {
                    return;
                }

                // Parse dates (DD/MM/YYYY format)
                const transactionDate = parseItalianDate(dataContabile);
                const valueDate = parseItalianDate(dataValuta) || transactionDate;

                // Parse amount (Italian format: -1.234,56)
                const amount = parseItalianAmount(importoRaw);

                if (!transactionDate || amount === null || amount === 0) {
                    return; // Skip invalid rows
                }

                // Build description
                const descriptionParts = [];
                if (descrizione) descriptionParts.push(descrizione);
                if (note) descriptionParts.push(note);
                const fullDescription = descriptionParts.join(' - ');

                // Create transaction object
                const transaction = {
                    bank: 'relaxbanking',
                    transaction_date: transactionDate,
                    value_date: valueDate,
                    type_raw: '', // RelaxBanking doesn't have a type field
                    description: fullDescription || 'N/A',
                    amount_in: amount > 0 ? Math.abs(amount) : 0,
                    amount_out: amount < 0 ? Math.abs(amount) : 0
                };

                transactions.push(transaction);

            } catch (error) {
                console.warn('Error parsing RelaxBanking row:', error.message);
                // Continue processing other rows
            }
        });

        stream.on('end', () => {
            resolve(transactions);
        });

        stream.on('error', (error) => {
            reject(new Error(`Failed to parse RelaxBanking file: ${error.message}`));
        });
    });
}

module.exports = { parseRelaxBanking };
