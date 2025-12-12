const crypto = require('crypto');

/**
 * Generate a unique hash for transaction deduplication.
 * Hash is based on: bank + transaction_date + amount + description_clean
 *
 * @param {Object} transaction - Transaction object
 * @returns {string} SHA256 hash
 */
function generateTransactionHash(transaction) {
    const { bank, transaction_date, amount_in, amount_out, description } = transaction;

    // Create a deterministic string from key fields
    const amount = amount_in || amount_out || 0;
    const hashInput = `${bank}|${transaction_date}|${amount}|${description}`.toLowerCase();

    // Generate SHA256 hash
    return crypto.createHash('sha256').update(hashInput).digest('hex');
}

module.exports = { generateTransactionHash };
