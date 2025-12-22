const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// Get distinct filter values (banks, types, categories)
// IMPORTANT: This must be before the '/:id' route to avoid conflicts
router.get('/filters/values', async (req, res) => {
    try {
        // Get distinct banks
        const { data: banksData, error: banksError } = await supabase
            .from('transactions')
            .select('bank')
            .not('bank', 'is', null);

        if (banksError) throw banksError;

        // Get distinct types
        const { data: typesData, error: typesError } = await supabase
            .from('transactions')
            .select('type')
            .not('type', 'is', null);

        if (typesError) throw typesError;

        // Get distinct categories
        const { data: categoriesData, error: categoriesError } = await supabase
            .from('transactions')
            .select('category')
            .not('category', 'is', null);

        if (categoriesError) throw categoriesError;

        // Extract unique values and sort
        const banks = [...new Set(banksData.map(t => t.bank))].filter(Boolean).sort();
        const types = [...new Set(typesData.map(t => t.type))].filter(Boolean).sort();
        const categories = [...new Set(categoriesData.map(t => t.category))].filter(Boolean).sort();

        res.json({
            success: true,
            data: {
                banks,
                types,
                categories
            }
        });
    } catch (error) {
        console.error('Error fetching filter values:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get transactions with filters
router.get('/', async (req, res) => {
    try {
        const {
            page = 1,
            limit = 100,
            bank,
            dateFrom,
            dateTo,
            dateStart,
            dateEnd,
            month,
            category,
            type,
            status = 'active',
            search
        } = req.query;

        let query = supabase
            .from('transactions')
            .select('*', { count: 'exact' });

        // Apply bank filter (AND logic - if banks selected, restrict to those banks)
        if (bank) {
            const banks = bank.split(',');
            query = query.in('bank', banks);
        }

        // Month filter (YYYY-MM format) - takes precedence
        if (month) {
            const [year, monthNum] = month.split('-');
            const startDate = `${year}-${monthNum}-01`;

            // Calculate last day of month
            const lastDay = new Date(parseInt(year), parseInt(monthNum), 0).getDate();
            const endDate = `${year}-${monthNum}-${String(lastDay).padStart(2, '0')}`;

            query = query.gte('transaction_date', startDate);
            query = query.lte('transaction_date', endDate);
        }
        // Custom date range (only if month filter not active)
        else if (dateStart || dateEnd) {
            if (dateStart) {
                query = query.gte('transaction_date', dateStart);
            }
            if (dateEnd) {
                query = query.lte('transaction_date', dateEnd);
            }
        }
        // Legacy dateFrom/dateTo support
        else {
            if (dateFrom) {
                query = query.gte('transaction_date', dateFrom);
            }
            if (dateTo) {
                query = query.lte('transaction_date', dateTo);
            }
        }

        // Apply type and category filters with OR logic
        // If both type and category are specified, show transactions matching either
        if (type && category) {
            const types = type.split(',');
            const categories = category.split(',');

            // Build OR condition: (type IN types) OR (category IN categories)
            query = query.or(`type.in.(${types.join(',')}),category.in.(${categories.join(',')})`);
        } else if (category) {
            const categories = category.split(',');
            query = query.in('category', categories);
        } else if (type) {
            const types = type.split(',');
            query = query.in('type', types);
        }

        if (status !== 'all') {
            query = query.eq('status', status);
        }

        if (search) {
            query = query.ilike('description', `%${search}%`);
        }

        // Pagination with stable ordering
        // Order by transaction_date DESC, then by id DESC for consistent pagination
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const offset = (pageNum - 1) * limitNum;
        query = query
            .order('transaction_date', { ascending: false })
            .order('id', { ascending: false })
            .range(offset, offset + limitNum - 1);

        const { data, error, count } = await query;

        if (error) throw error;

        // Enrich transactions with ETF names where ISIN is present
        const isins = [...new Set(data.filter(tx => tx.isin).map(tx => tx.isin))];
        let etfMap = {};

        if (isins.length > 0) {
            console.log('ISINs found:', isins);
            const { data: etfData, error: etfError } = await supabase
                .from('etf')
                .select('isin, nome')
                .in('isin', isins);

            console.log('ETF query result:', { etfData, etfError });

            if (!etfError && etfData) {
                etfMap = etfData.reduce((acc, etf) => {
                    acc[etf.isin] = etf;
                    return acc;
                }, {});
                console.log('ETF map:', etfMap);
            }
        } else {
            console.log('No ISINs found in transactions');
        }

        // Add ETF data to transactions
        const enrichedData = data.map(tx => ({
            ...tx,
            etf: tx.isin && etfMap[tx.isin] ? etfMap[tx.isin] : null
        }));

        res.json({
            success: true,
            data: enrichedData,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total: count,
                totalPages: Math.ceil(count / limitNum)
            }
        });
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get single transaction
router.get('/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('transactions')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (error) throw error;

        // Enrich with ETF name if ISIN is present
        if (data.isin) {
            const { data: etfData, error: etfError } = await supabase
                .from('etf')
                .select('isin, nome')
                .eq('isin', data.isin)
                .single();

            if (!etfError && etfData) {
                data.etf = etfData;
            }
        }

        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching transaction:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update transaction
router.patch('/:id', async (req, res) => {
    try {
        const { type, category, merchant, notes, tags, status, description, amount_in, amount_out } = req.body;

        const updates = {};
        if (type) updates.type = type;
        if (category) updates.category = category;
        if (merchant) updates.merchant = merchant;
        if (notes !== undefined) updates.notes = notes;
        if (tags) updates.tags = tags;
        if (status) updates.status = status;
        if (description) updates.description = description;
        if (amount_in !== undefined) updates.amount_in = amount_in;
        if (amount_out !== undefined) updates.amount_out = amount_out;

        const { data, error } = await supabase
            .from('transactions')
            .update(updates)
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, data });
    } catch (error) {
        console.error('Error updating transaction:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete transaction
router.delete('/:id', async (req, res) => {
    try {
        const { error } = await supabase
            .from('transactions')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;

        res.json({ success: true, message: 'Transaction deleted' });
    } catch (error) {
        console.error('Error deleting transaction:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
