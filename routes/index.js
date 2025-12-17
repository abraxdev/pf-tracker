const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// Home page / Dashboard
router.get('/', async (req, res) => {
    try {
        // Get current month date range
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const dateFrom = firstDayOfMonth.toISOString().split('T')[0];
        const dateTo = lastDayOfMonth.toISOString().split('T')[0];

        // Get transactions for current month
        const { data: transactions, error } = await supabase
            .from('transactions')
            .select('amount_in, amount_out, bank, category')
            .eq('status', 'active')
            .gte('transaction_date', dateFrom)
            .lte('transaction_date', dateTo);

        if (error) throw error;

        // Calculate statistics
        const stats = {
            totalIncome: 0,
            totalExpenses: 0,
            balance: 0,
            transactionCount: transactions?.length || 0,
            byBank: {},
            byCategory: {}
        };

        if (transactions) {
            transactions.forEach(tx => {
                stats.totalIncome += parseFloat(tx.amount_in || 0);
                stats.totalExpenses += parseFloat(tx.amount_out || 0);

                // By bank
                if (!stats.byBank[tx.bank]) {
                    stats.byBank[tx.bank] = { income: 0, expenses: 0 };
                }
                stats.byBank[tx.bank].income += parseFloat(tx.amount_in || 0);
                stats.byBank[tx.bank].expenses += parseFloat(tx.amount_out || 0);

                // By category
                const category = tx.category || 'uncategorized';
                if (!stats.byCategory[category]) {
                    stats.byCategory[category] = 0;
                }
                stats.byCategory[category] += parseFloat(tx.amount_out || 0);
            });
        }

        stats.balance = stats.totalIncome - stats.totalExpenses;

        // Get top categories
        const topCategories = Object.entries(stats.byCategory)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, amount]) => ({ name, amount }));

        res.render('index', {
            title: 'Dashboard - Personal Finance Tracker',
            activePage: 'dashboard',
            stats,
            topCategories,
            currentMonth: now.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
        });
    } catch (error) {
        console.error('Error loading dashboard:', error);
        res.render('index', {
            title: 'Dashboard - Personal Finance Tracker',
            activePage: 'dashboard',
            error: error.message
        });
    }
});

module.exports = router;
