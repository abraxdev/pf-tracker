const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// Transactions list page
router.get('/', async (req, res) => {
    try {
        // Get recent transactions for initial load
        const { data: transactions, error } = await supabase
            .from('transactions')
            .select('*')
            .eq('status', 'active')
            .order('transaction_date', { ascending: false })
            .limit(100);

        if (error) throw error;

        res.render('transactions', {
            title: 'Transazioni - Personal Finance Tracker',
            transactions: transactions || []
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
