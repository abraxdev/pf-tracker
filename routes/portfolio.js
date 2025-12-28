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
            .select('isin, nome, tipologia, ticker, div_yield, tax_rate, last_price, qty');

        // Apply filters
        if (tipo) {
            const types = tipo.split(',');
            titlesQuery = titlesQuery.in('tipologia', types);
        }

        const { data: titles, error: titlesError } = await titlesQuery;

        if (titlesError) throw titlesError;

        // For each title, calculate tot_investito from transactions
        const enrichedPositions = await Promise.all(titles.map(async (title) => {
            // Get all transactions for this ISIN (only active status)
            const { data: transactions, error: txError } = await supabase
                .from('transactions')
                .select('amount_in, amount_out, type, qty')
                .eq('isin', title.isin)
                .eq('type', 'investment')
                .eq('status', 'active');

            if (txError) {
                console.error(`Error fetching transactions for ${title.isin}:`, txError);
                return {
                    ...title,
                    tot_investito: 0,
                    value: 0,
                    variazione_perc: 0
                };
            }

            // Calculate prezzo medio di carico
            // 1. Somma di tutti gli acquisti (amount_out - amount_in per transazioni con qty > 0)
            // 2. Quantità totale acquistata
            const purchaseTxs = transactions.filter(t => parseFloat(t.qty || 0) > 0);

            const totalPurchaseAmount = purchaseTxs.reduce((sum, tx) => {
                return sum + (parseFloat(tx.amount_out || 0) - parseFloat(tx.amount_in || 0));
            }, 0);

            const totalPurchasedQty = purchaseTxs.reduce((sum, tx) => {
                return sum + parseFloat(tx.qty || 0);
            }, 0);

            // Prezzo medio di carico
            const avgLoadPrice = totalPurchasedQty > 0 ? totalPurchaseAmount / totalPurchasedQty : 0;

            // Tot investito attuale = prezzo medio di carico × quantità attuale
            const currentQty = parseFloat(title.qty || 0);
            const tot_investito = avgLoadPrice * currentQty;

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
                tax_rate: parseFloat(title.tax_rate || 0),
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

        // Calculate global totals
        // 1. Total invested across all positions (sum of all investment transactions)
        const { data: allInvestmentTxs, error: invError } = await supabase
            .from('transactions')
            .select('amount_in, amount_out')
            .eq('type', 'investment')
            .eq('status', 'active');

        const totalInvested = (allInvestmentTxs || []).reduce((sum, tx) => {
            return sum + (parseFloat(tx.amount_out || 0) - parseFloat(tx.amount_in || 0));
        }, 0);

        // 2. Total dividends received
        const { data: allDividendTxs, error: divError } = await supabase
            .from('transactions')
            .select('amount_in')
            .eq('status', 'active');

        const totalDividends = (allDividendTxs || [])
            .filter(tx => tx.amount_in > 0)
            .reduce((sum, tx) => sum + parseFloat(tx.amount_in || 0), 0);

        // 3. Current portfolio value (sum of all positions)
        const currentValue = enrichedPositions.reduce((sum, p) => sum + p.value, 0);

        // 4. Portfolio variation %
        const portfolioVariation = totalInvested > 0
            ? ((currentValue - totalInvested) / totalInvested) * 100
            : 0;

        // 5. Total value including dividends
        const totalValueWithDividends = currentValue + totalDividends;

        res.json({
            positions: enrichedPositions,
            total: enrichedPositions.length,
            summary: {
                currentValue: currentValue,
                totalInvested: totalInvested,
                portfolioVariation: portfolioVariation,
                totalDividends: totalDividends,
                totalValueWithDividends: totalValueWithDividends
            }
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

        // Get all active transactions
        const { data: transactions, error } = await supabase
            .from('transactions')
            .select('id, transaction_date, description, type, category, amount_in, amount_out, qty')
            .eq('isin', isin)
            .eq('status', 'active')
            .order('transaction_date', { ascending: false });

        if (error) throw error;

        // Group by type AND category (investments vs dividends)
        const investments = transactions.filter(t => t.type === 'investment');
        const dividends = transactions.filter(t => t.type === 'dividend' || t.category === 'dividend');

        // Calculate tot_investito using correct logic
        // 1. Get only purchase transactions (qty > 0)
        const purchaseTxs = investments.filter(t => parseFloat(t.qty || 0) > 0);

        const totalPurchaseAmount = purchaseTxs.reduce((sum, tx) => {
            return sum + (parseFloat(tx.amount_out || 0) - parseFloat(tx.amount_in || 0));
        }, 0);

        const totalPurchasedQty = purchaseTxs.reduce((sum, tx) => {
            return sum + parseFloat(tx.qty || 0);
        }, 0);

        // Prezzo medio di carico
        const avgLoadPrice = totalPurchasedQty > 0 ? totalPurchaseAmount / totalPurchasedQty : 0;

        // Get current qty from pf_titles
        const { data: titleData } = await supabase
            .from('pf_titles')
            .select('qty')
            .eq('isin', isin)
            .single();

        const currentQty = parseFloat(titleData?.qty || 0);
        const tot_investito = avgLoadPrice * currentQty;

        // Group dividends by year
        const dividendsByYear = {};
        dividends.forEach(tx => {
            const year = new Date(tx.transaction_date).getFullYear();
            if (!dividendsByYear[year]) {
                dividendsByYear[year] = {
                    year: year,
                    total: 0,
                    count: 0,
                    transactions: []
                };
            }
            const amount = parseFloat(tx.amount_in || 0);
            dividendsByYear[year].total += amount;
            dividendsByYear[year].count += 1;
            dividendsByYear[year].transactions.push(tx);
        });

        // Convert to array and sort by year descending
        const dividendsSummary = Object.values(dividendsByYear).sort((a, b) => b.year - a.year);

        const grouped = {
            investments: investments,
            dividends: dividends,
            dividendsByYear: dividendsSummary,
            tot_investito: tot_investito
        };

        res.json(grouped);
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update title (quantity, ticker, or tax_rate)
router.patch('/:isin', async (req, res) => {
    try {
        const { isin } = req.params;
        const { qty, ticker, tax_rate } = req.body;

        const updates = {};
        if (qty !== undefined) updates.qty = parseFloat(qty);
        if (ticker !== undefined) updates.ticker = ticker;
        if (tax_rate !== undefined) updates.tax_rate = parseFloat(tax_rate);

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
