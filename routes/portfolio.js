const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// Get distinct filter values
router.get('/filters/values', async (req, res) => {
    try {
        const { data: titles, error } = await supabase
            .from('pf_titles')
            .select('tipologia')
            .order('tipologia');

        if (error) throw error;

        // Get unique types
        const types = [...new Set(titles.map(t => t.tipologia).filter(Boolean))];

        res.json({
            types
        });
    } catch (error) {
        console.error('Error fetching filter values:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get portfolio positions with all calculations
router.get('/positions', async (req, res) => {
    try {
        const { tipo, sortBy = 'value', sortOrder = 'desc' } = req.query;

        // Build query for pf_titles
        let titlesQuery = supabase
            .from('pf_titles')
            .select('isin, nome, tipologia, ticker, div_yield, last_price, qty');

        // Apply filters
        if (tipo) {
            const types = tipo.split(',');
            titlesQuery = titlesQuery.in('tipologia', types);
        }

        const { data: titles, error: titlesError } = await titlesQuery;

        if (titlesError) throw titlesError;

        // For each title, calculate tot_investito from transactions
        const enrichedPositions = await Promise.all(titles.map(async (title) => {
            // Get all transactions for this ISIN
            const { data: transactions, error: txError } = await supabase
                .from('transactions')
                .select('amount_in, amount_out, type')
                .eq('isin', title.isin)
                .in('type', ['investment', 'dividend']);

            if (txError) {
                console.error(`Error fetching transactions for ${title.isin}:`, txError);
                return {
                    ...title,
                    tot_investito: 0,
                    value: 0,
                    variazione_perc: 0
                };
            }

            // Calculate tot_investito (sum of amount_out - amount_in for investments)
            const investmentTxs = transactions.filter(t => t.type === 'investment');
            const tot_investito = investmentTxs.reduce((sum, tx) => {
                return sum + (parseFloat(tx.amount_out || 0) - parseFloat(tx.amount_in || 0));
            }, 0);

            // Calculate current value (qty * last_price)
            const qty = parseFloat(title.qty || 0);
            const last_price = parseFloat(title.last_price || 0);
            const value = qty * last_price;

            // Calculate variazione %
            const variazione_perc = tot_investito > 0
                ? ((value - tot_investito) / tot_investito) * 100
                : 0;

            return {
                isin: title.isin,
                nome: title.nome,
                tipologia: title.tipologia,
                ticker: title.ticker,
                div_yield: parseFloat(title.div_yield || 0),
                qty: qty,
                last_price: last_price,
                value: value,
                tot_investito: tot_investito,
                variazione_perc: variazione_perc
            };
        }));

        // Sort results
        enrichedPositions.sort((a, b) => {
            let aVal = a[sortBy] || 0;
            let bVal = b[sortBy] || 0;

            if (sortOrder === 'asc') {
                return aVal > bVal ? 1 : -1;
            } else {
                return aVal < bVal ? 1 : -1;
            }
        });

        res.json({
            positions: enrichedPositions,
            total: enrichedPositions.length
        });
    } catch (error) {
        console.error('Error fetching portfolio positions:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get transactions for a specific ISIN
router.get('/transactions/:isin', async (req, res) => {
    try {
        const { isin } = req.params;

        const { data: transactions, error } = await supabase
            .from('transactions')
            .select('id, transaction_date, description, type, category, amount_in, amount_out')
            .eq('isin', isin)
            .order('transaction_date', { ascending: false });

        if (error) throw error;

        // Group by type AND category (investments vs dividends)
        // Dividends can be type='dividend' OR category='dividend'
        const investments = transactions.filter(t => t.type === 'investment');
        const dividends = transactions.filter(t => t.type === 'dividend' || t.category === 'dividend');

        // Calculate total invested
        const tot_investito = investments.reduce((sum, tx) => {
            return sum + (parseFloat(tx.amount_out || 0) - parseFloat(tx.amount_in || 0));
        }, 0);

        const grouped = {
            investments: investments,
            dividends: dividends,
            tot_investito: tot_investito
        };

        res.json(grouped);
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update title (quantity or ticker)
router.patch('/:isin', async (req, res) => {
    try {
        const { isin } = req.params;
        const { qty, ticker } = req.body;

        const updates = {};
        if (qty !== undefined) updates.qty = parseFloat(qty);
        if (ticker !== undefined) updates.ticker = ticker;

        const { data, error } = await supabase
            .from('pf_titles')
            .update(updates)
            .eq('isin', isin)
            .select()
            .single();

        if (error) throw error;

        res.json(data);
    } catch (error) {
        console.error('Error updating title:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete title
router.delete('/:isin', async (req, res) => {
    try {
        const { isin } = req.params;

        const { error } = await supabase
            .from('pf_titles')
            .delete()
            .eq('isin', isin);

        if (error) throw error;

        res.json({ success: true, message: 'Title deleted successfully' });
    } catch (error) {
        console.error('Error deleting title:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
