const XLSX = require('xlsx');
const { parseExcelDate, toISODate } = require('../../utils/dateUtils');
const { parseAmount } = require('../../utils/amountUtils');

/**
 * Parse Widiba XLSX bank statement
 *
 * File structure:
 * - Header on row 18 (0-indexed row 17)
 * - Data starts from row 19 (0-indexed row 18)
 * - Columns: DATA CONT., DATA VAL., CAUSALE, DESCRIZIONE, IMPORTO (€)
 * - Amount: single field with sign (negative = outgoing)
 *
 * @param {string} filePath - Path to XLSX file
 * @returns {Array} Array of parsed transactions
 */
function parseWidiba(filePath) {
    try {
        // Read the workbook
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // Convert to array of arrays (raw data)
        const data = XLSX.utils.sheet_to_json(sheet, {
            header: 1,
            raw: false,
            dateNF: 'yyyy-mm-dd'
        });

        // Find header row (looking for "DATA CONT.")
        let headerRowIndex = -1;
        for (let i = 0; i < Math.min(data.length, 25); i++) {
            const row = data[i];
            if (row && row.some(cell =>
                cell && String(cell).toUpperCase().includes('DATA CONT')
            )) {
                headerRowIndex = i;
                break;
            }
        }

        if (headerRowIndex === -1) {
            throw new Error('Header row not found. Looking for "DATA CONT." column.');
        }

        const headerRow = data[headerRowIndex];

        // Find column indices
        const colIndices = {
            dataContabile: -1,
            dataValuta: -1,
            causale: -1,
            descrizione: -1,
            importo: -1
        };

        headerRow.forEach((header, idx) => {
            if (!header) return;
            const headerStr = String(header).toUpperCase().trim();

            if (headerStr.includes('DATA CONT')) colIndices.dataContabile = idx;
            else if (headerStr.includes('DATA VAL')) colIndices.dataValuta = idx;
            else if (headerStr.includes('CAUSALE')) colIndices.causale = idx;
            else if (headerStr.includes('DESCRIZIONE')) colIndices.descrizione = idx;
            else if (headerStr.includes('IMPORTO')) colIndices.importo = idx;
        });

        // Validate required columns
        if (colIndices.dataContabile === -1 || colIndices.importo === -1) {
            throw new Error('Required columns not found (DATA CONT. and IMPORTO are mandatory)');
        }

        const transactions = [];

        // Parse data rows (start from row after header)
        for (let i = headerRowIndex + 1; i < data.length; i++) {
            const row = data[i];

            // Skip empty rows
            if (!row || row.length === 0 || !row[colIndices.dataContabile]) {
                continue;
            }

            const dateContabile = row[colIndices.dataContabile];
            const dateValuta = row[colIndices.dataValuta];
            const causale = row[colIndices.causale] || '';
            const descrizione = row[colIndices.descrizione] || '';
            const importoRaw = row[colIndices.importo];

            // Parse dates
            let transactionDate = null;
            if (typeof dateContabile === 'number') {
                transactionDate = parseExcelDate(dateContabile);
            } else if (typeof dateContabile === 'string') {
                transactionDate = toISODate(dateContabile);
            }

            let valueDate = null;
            if (typeof dateValuta === 'number') {
                valueDate = parseExcelDate(dateValuta);
            } else if (typeof dateValuta === 'string') {
                valueDate = toISODate(dateValuta);
            }

            // Parse amount
            const amount = parseAmount(importoRaw);
            if (amount === null || amount === 0) {
                continue; // Skip rows with invalid/zero amounts
            }

            // Build description
            const descriptionParts = [];
            if (causale) descriptionParts.push(causale);
            if (descrizione) descriptionParts.push(descrizione);
            const fullDescription = descriptionParts.join(' - ');

            // Determine amount_in / amount_out based on sign
            const transaction = {
                bank: 'widiba',
                transaction_date: transactionDate,
                value_date: valueDate || transactionDate,
                type_raw: causale,
                description: fullDescription || 'N/A',
                amount_in: amount > 0 ? Math.abs(amount) : 0,
                amount_out: amount < 0 ? Math.abs(amount) : 0
            };

            if (transaction.transaction_date) {
                transactions.push(transaction);
            }
        }

        return transactions;

    } catch (error) {
        throw new Error(`Failed to parse Widiba file: ${error.message}`);
    }
}

module.exports = { parseWidiba };
