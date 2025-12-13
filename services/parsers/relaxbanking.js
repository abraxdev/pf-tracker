const fs = require('fs');
const csv = require('csv-parser');
const iconv = require('iconv-lite');
const { parseItalianDate } = require('../../utils/dateUtils');
const { parseItalianAmount } = require('../../utils/amountUtils');

/**
 * Truncate description to max length and append "..." if needed
 * @param {string} description - Description to truncate
 * @param {number} maxLength - Maximum length (default: 490)
 * @returns {string} Truncated description
 */
function truncateDescription(description, maxLength = 490) {
    if (!description) return '';
    const trimmed = description.trim();
    if (trimmed.length <= maxLength) return trimmed;
    return trimmed.substring(0, maxLength - 3) + '...';
}

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
                mapHeaders: ({ header }) => header.trim(),
                // Increase max column length to avoid truncation
                maxRowBytes: 1000000, // 1MB per row
                skipLines: 0,
                strict: false
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
                if (descrizione) descriptionParts.push(descrizione.trim());
                if (note) descriptionParts.push(note.trim());
                const fullDescription = descriptionParts.join(' - ');

                // Truncate description to 490 characters max
                const finalDescription = truncateDescription(fullDescription) || 'N/A';

                // Log if description was truncated
                if (fullDescription.length > 490) {
                    console.log(`[RelaxBanking] Description truncated from ${fullDescription.length} to 490 chars: "${fullDescription.substring(0, 50)}..."`);
                }

                // Create transaction object
                const transaction = {
                    bank: 'relaxbanking',
                    transaction_date: transactionDate,
                    value_date: valueDate,
                    type_raw: '', // RelaxBanking doesn't have a type field
                    description: finalDescription,
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
            console.log(`[RelaxBanking] Successfully parsed ${transactions.length} transactions`);
            resolve(transactions);
        });

        stream.on('error', (error) => {
            reject(new Error(`Failed to parse RelaxBanking file: ${error.message}`));
        });
    });
}

module.exports = { parseRelaxBanking };
