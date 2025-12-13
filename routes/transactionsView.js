const express = require('express');
const router = express.Router();

// Transactions list page
router.get('/', async (req, res) => {
    try {
        // Render empty page - transactions will be loaded via JavaScript for consistent pagination
        res.render('transactions', {
            title: 'Transazioni - Personal Finance Tracker',
            transactions: []
        });
    } catch (error) {
        console.error('Error loading transactions:', error);
        res.render('transactions', {
            title: 'Transazioni - Personal Finance Tracker',
            transactions: [],
            error: error.message
        });
    }
});

module.exports = router;
