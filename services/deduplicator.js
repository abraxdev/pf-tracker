const supabase = require('../config/supabase');
const { generateTransactionHash } = require('../utils/hashUtils');

/**
 * Check for duplicate transactions and mark them
 *
 * @param {Array} transactions - Array of transactions to check
 * @returns {Promise<Array>} Transactions with isDuplicate flag added
 */
async function checkDuplicates(transactions) {
    const results = [];

    for (const tx of transactions) {
        // Generate hash for this transaction
        const hash = generateTransactionHash(tx);

        // Check if this hash already exists in the database
        const { data: existing } = await supabase
            .from('transactions')
            .select('id, transaction_date, description, amount_in, amount_out')
            .eq('hash', hash)
            .limit(1)
            .single();

        results.push({
            ...tx,
            hash,
            isDuplicate: !!existing,
            existingTransaction: existing || null
        });
    }

    return results;
}

/**
 * Save transactions to database (skipping duplicates)
 *
 * @param {Array} transactions - Array of transactions to save
 * @param {string} batchId - Import batch ID
 * @returns {Promise<Object>} Result with counts
 */
async function saveTransactions(transactions, batchId) {
    let imported = 0;
    let duplicates = 0;
    let errors = 0;

    for (const tx of transactions) {
        try {
            // Skip if marked as duplicate
            if (tx.isDuplicate) {
                duplicates++;
                continue;
            }

            // Prepare transaction data
            const transactionData = {
                bank: tx.bank,
                source_file: tx.source_file || null,
                import_batch_id: batchId,
                transaction_date: tx.transaction_date,
                value_date: tx.value_date,
                type: tx.type || 'other',
                category: tx.category || 'uncategorized',
                description: tx.description,
                description_clean: tx.description, // Can be enhanced later
                merchant: tx.merchant || null,
                amount_in: tx.amount_in || 0,
                amount_out: tx.amount_out || 0,
                status: 'active',
                hash: tx.hash
            };

            // Insert into database
            const { error } = await supabase
                .from('transactions')
                .insert(transactionData);

            if (error) {
                // Check if it's a duplicate hash error
                if (error.code === '23505') { // Unique violation
                    duplicates++;
                } else {
                    console.error('Error saving transaction:', error);
                    errors++;
                }
            } else {
                imported++;
            }

        } catch (error) {
            console.error('Error processing transaction:', error);
            errors++;
        }
    }

    return { imported, duplicates, errors };
}

/**
 * Create import batch record
 *
 * @param {string} bank - Bank name
 * @param {string} filename - Original filename
 * @param {number} totalRecords - Total records in file
 * @returns {Promise<string>} Batch ID
 */
async function createImportBatch(bank, filename, totalRecords) {
    const { data, error } = await supabase
        .from('import_batches')
        .insert({
            bank,
            filename,
            records_total: totalRecords,
            status: 'pending'
        })
        .select()
        .single();

    if (error) {
        throw new Error(`Failed to create import batch: ${error.message}`);
    }

    return data.id;
}

/**
 * Update import batch with results
 *
 * @param {string} batchId - Batch ID
 * @param {Object} results - Import results
 */
async function updateImportBatch(batchId, results) {
    await supabase
        .from('import_batches')
        .update({
            records_imported: results.imported,
            records_duplicates: results.duplicates,
            status: 'completed',
            completed_at: new Date().toISOString()
        })
        .eq('id', batchId);
}

module.exports = {
    checkDuplicates,
    saveTransactions,
    createImportBatch,
    updateImportBatch
};
