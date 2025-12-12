const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const PDF_PARSER_URL = process.env.PDF_PARSER_URL || 'http://localhost:3001';

/**
 * Parse TradeRepublic PDF bank statement via Python microservice
 *
 * @param {string} filePath - Path to PDF file
 * @returns {Promise<Array>} Promise resolving to array of parsed transactions
 */
async function parseTradeRepublic(filePath) {
    try {
        console.log(`[TradeRepublic Parser] Starting parse for file: ${filePath}`);
        console.log(`[TradeRepublic Parser] PDF_PARSER_URL: ${PDF_PARSER_URL}`);

        // Create form data with file
        const form = new FormData();
        form.append('file', fs.createReadStream(filePath));

        // Call Python PDF parser microservice
        console.log(`[TradeRepublic Parser] Calling ${PDF_PARSER_URL}/parse/traderepublic...`);
        const response = await axios.post(
            `${PDF_PARSER_URL}/parse/traderepublic`,
            form,
            {
                headers: {
                    ...form.getHeaders()
                },
                timeout: 30000 // 30 second timeout for PDF processing
            }
        );

        console.log(`[TradeRepublic Parser] Response status: ${response.status}`);
        console.log(`[TradeRepublic Parser] Response data:`, JSON.stringify(response.data, null, 2));

        if (!response.data.success) {
            throw new Error('PDF parser returned unsuccessful response');
        }

        const rawTransactions = response.data.transactions;
        console.log(`[TradeRepublic Parser] Received ${rawTransactions.length} raw transactions`);

        // Transform to our standard format
        const transactions = rawTransactions.map(tx => {
            // Determine amount_in/amount_out
            const amountIn = tx.amount_in || 0;
            const amountOut = tx.amount_out || 0;

            return {
                bank: 'traderepublic',
                transaction_date: tx.date,
                value_date: tx.date, // TradeRepublic doesn't have separate value date
                type_raw: tx.type_raw || '',
                description: tx.description || 'N/A',
                amount_in: amountIn,
                amount_out: amountOut,
                balance: tx.balance // Optional: keep balance for reference
            };
        });

        console.log(`[TradeRepublic Parser] Successfully transformed ${transactions.length} transactions`);
        return transactions;

    } catch (error) {
        console.error(`[TradeRepublic Parser] ERROR:`, error);

        if (error.code === 'ECONNREFUSED') {
            throw new Error(
                `PDF parser service is not running at ${PDF_PARSER_URL}. ` +
                'Please start the Python service: cd pdf-parser && python3 main.py'
            );
        }

        if (error.response) {
            console.error(`[TradeRepublic Parser] HTTP Response Status:`, error.response.status);
            console.error(`[TradeRepublic Parser] HTTP Response Data:`, error.response.data);
        }

        throw new Error(`Failed to parse TradeRepublic PDF: ${error.message}`);
    }
}

module.exports = { parseTradeRepublic };
