/**
 * Parse various date formats to ISO format (YYYY-MM-DD)
 */

/**
 * Convert DD/MM/YYYY to YYYY-MM-DD
 * @param {string} dateStr - Date in DD/MM/YYYY format
 * @returns {string} ISO formatted date
 */
function parseItalianDate(dateStr) {
    if (!dateStr) return null;

    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;

    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/**
 * Parse Excel serial date to YYYY-MM-DD
 * @param {number} serial - Excel date serial number
 * @returns {string} ISO formatted date
 */
function parseExcelDate(serial) {
    if (!serial || typeof serial !== 'number') return null;

    // Excel dates start from 1900-01-01 (serial 1)
    // JavaScript dates from 1970-01-01
    const excelEpoch = new Date(1899, 11, 30); // December 30, 1899
    const date = new Date(excelEpoch.getTime() + serial * 86400000);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

/**
 * Ensure date is in ISO format
 * @param {string|Date} date - Date in various formats
 * @returns {string} ISO formatted date
 */
function toISODate(date) {
    if (!date) return null;

    if (date instanceof Date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // Already in ISO format
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return date;
    }

    // Try parsing Italian format
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) {
        return parseItalianDate(date);
    }

    return null;
}

module.exports = {
    parseItalianDate,
    parseExcelDate,
    toISODate
};
