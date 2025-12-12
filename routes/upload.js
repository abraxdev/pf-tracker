const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Import parsers
const { parseWidiba } = require('../services/parsers/widiba');
const { parseRelaxBanking } = require('../services/parsers/relaxbanking');
const { parseTradeRepublic } = require('../services/parsers/traderepublic');

// Import services
const { classifyWithCache } = require('../services/classificationService');
const {
    checkDuplicates,
    saveTransactions,
    createImportBatch,
    updateImportBatch
} = require('../services/deduplicator');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedExtensions = ['.xlsx', '.xls', '.pdf'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedExtensions.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only .xlsx, .xls, and .pdf files are allowed.'));
        }
    },
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Upload page
router.get('/', (req, res) => {
    res.render('upload', {
        title: 'Upload Files - Personal Finance Tracker'
    });
});

/**
 * Detect bank from filename or file content
 */
function detectBank(filename) {
    const lower = filename.toLowerCase();
    if (lower.includes('widiba')) return 'widiba';
    if (lower.includes('relax')) return 'relaxbanking';
    if (lower.includes('trade') || lower.includes('republic')) return 'traderepublic';
    return null;
}

/**
 * Parse file based on bank type
 */
async function parseFile(filePath, bank, originalName) {
    if (bank === 'widiba') {
        return parseWidiba(filePath);
    } else if (bank === 'relaxbanking') {
        return await parseRelaxBanking(filePath);
    } else if (bank === 'traderepublic') {
        return await parseTradeRepublic(filePath);
    } else {
        // Auto-detect based on file extension
        const ext = path.extname(originalName).toLowerCase();
        if (ext === '.pdf') {
            return await parseTradeRepublic(filePath);
        } else if (ext === '.xlsx') {
            return parseWidiba(filePath);
        } else if (ext === '.xls') {
            return await parseRelaxBanking(filePath);
        }
        throw new Error('Could not determine bank type from filename');
    }
}

// Handle file upload and processing
router.post('/api', upload.array('files', 10), async (req, res) => {
    const processedFiles = [];

    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        // Process each file
        for (const file of req.files) {
            try {
                const bank = detectBank(file.originalname);

                if (!bank) {
                    processedFiles.push({
                        name: file.originalname,
                        status: 'error',
                        error: 'Could not detect bank from filename. Please include bank name (widiba, relaxbanking, or traderepublic) in filename.'
                    });
                    continue;
                }

                // Parse file
                console.log(`Parsing ${file.originalname} as ${bank}...`);
                const transactions = await parseFile(file.path, bank, file.originalname);

                if (transactions.length === 0) {
                    processedFiles.push({
                        name: file.originalname,
                        bank,
                        status: 'warning',
                        message: 'No transactions found in file'
                    });
                    continue;
                }

                // Add source file to each transaction
                transactions.forEach(tx => {
                    tx.source_file = file.originalname;
                });

                // Classify transactions with AI
                console.log(`Classifying ${transactions.length} transactions...`);
                const classifiedTransactions = await classifyWithCache(transactions);

                // Check for duplicates
                console.log('Checking for duplicates...');
                const checkedTransactions = await checkDuplicates(classifiedTransactions);

                // Create import batch
                const batchId = await createImportBatch(bank, file.originalname, transactions.length);

                // Save to database
                console.log('Saving transactions to database...');
                const results = await saveTransactions(checkedTransactions, batchId);

                // Update batch status
                await updateImportBatch(batchId, results);

                processedFiles.push({
                    name: file.originalname,
                    bank,
                    status: 'success',
                    batchId,
                    total: transactions.length,
                    imported: results.imported,
                    duplicates: results.duplicates,
                    errors: results.errors
                });

                // Clean up uploaded file
                fs.unlinkSync(file.path);

            } catch (error) {
                console.error(`Error processing file ${file.originalname}:`, error);
                processedFiles.push({
                    name: file.originalname,
                    status: 'error',
                    error: error.message
                });

                // Clean up file on error
                try {
                    fs.unlinkSync(file.path);
                } catch (e) {
                    // Ignore cleanup errors
                }
            }
        }

        res.json({
            success: true,
            files: processedFiles
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
