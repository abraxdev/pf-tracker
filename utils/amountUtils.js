/**
 * Parse and convert various amount formats to float
 */

/**
 * Parse Italian amount format to float
 * Examples: "1.234,56" → 1234.56, "-1.234,56" → -1234.56
 *
 * @param {string} amountStr - Amount in Italian format
 * @returns {number|null} Float value or null if parsing fails
 */
function parseItalianAmount(amountStr) {
    if (!amountStr || amountStr === '' || amountStr === '-') return null;

    const str = String(amountStr).trim();

    // Remove € symbol and whitespace
    let cleaned = str.replace(/€/g, '').trim();

    // Replace thousands separator (.) and decimal separator (,)
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');

    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
}

/**
 * Parse standard US format to float
 * Examples: "1,234.56" → 1234.56
 *
 * @param {string} amountStr - Amount in US format
 * @returns {number|null} Float value or null if parsing fails
 */
function parseUSAmount(amountStr) {
    if (!amountStr || amountStr === '' || amountStr === '-') return null;

    const str = String(amountStr).trim();

    // Remove $ symbol, whitespace, and thousands separator
    const cleaned = str.replace(/[$,\s]/g, '');

    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
}

/**
 * Auto-detect format and parse amount
 * @param {string|number} amount - Amount in various formats
 * @returns {number|null} Float value
 */
function parseAmount(amount) {
    // If already a number, return it directly
    if (typeof amount === 'number') {
        return amount;
    }

    if (!amount) return null;

    const str = String(amount).trim();

    const hasComma = str.includes(',');
    const hasDot = str.includes('.');

    // Determine format based on which separators are present
    if (hasComma && hasDot) {
        // Both separators present: check which comes last
        const lastCommaPos = str.lastIndexOf(',');
        const lastDotPos = str.lastIndexOf('.');

        if (lastCommaPos > lastDotPos) {
            // Comma comes after dot: Italian format (1.234,56)
            return parseItalianAmount(str);
        } else {
            // Dot comes after comma: US format (1,234.56)
            return parseUSAmount(str);
        }
    } else if (hasComma && !hasDot) {
        // Only comma: Italian decimal (234,56)
        return parseItalianAmount(str);
    } else {
        // Only dot or no separator: US format (234.56 or 234)
        return parseUSAmount(str);
    }
}

/**
 * Format amount to Italian currency format
 * @param {number} amount - Amount as number
 * @returns {string} Formatted amount
 */
function formatAmount(amount) {
    if (amount == null || isNaN(amount)) return '0,00 €';

    return new Intl.NumberFormat('it-IT', {
        style: 'currency',
        currency: 'EUR'
    }).format(amount);
}

module.exports = {
    parseItalianAmount,
    parseUSAmount,
    parseAmount,
    formatAmount
};
