/**
 * Normalize transaction description for cache lookup.
 * Removes dates, numbers, and special characters to maximize cache hits.
 *
 * @param {string} desc - Raw transaction description
 * @returns {string} Normalized description
 */
function normalizeDescription(desc) {
    if (!desc) return '';

    return desc
        .toUpperCase()
        .replace(/\s+/g, ' ')                    // Multi-space → single
        .replace(/[0-9]{4,}/g, '')               // Remove long numbers (IDs, dates)
        .replace(/\d{2}\/\d{2}\/\d{4}/g, '')     // Remove dates DD/MM/YYYY
        .replace(/\d{2}\.\d{2}\.\d{4}/g, '')     // Remove dates DD.MM.YYYY
        .replace(/\d{2}-\d{2}-\d{4}/g, '')       // Remove dates DD-MM-YYYY
        .replace(/ORE \d{2}:\d{2}/g, '')         // Remove times "ORE HH:MM"
        .replace(/DEL \d{2}\/\d{2}\/\d{2,4}/g, '') // Remove "DEL xx/xx/xx"
        .replace(/ID\.\s*\d+/g, '')              // Remove "ID. 123456"
        .replace(/[^\w\sÀ-ÿ€]/g, '')             // Keep only alphanumeric + accented chars + €
        .trim()
        .substring(0, 200);                      // Max length
}

module.exports = { normalizeDescription };
