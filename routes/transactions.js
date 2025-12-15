const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

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

        // Apply filters
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

        if (category) {
            const categories = category.split(',');
            query = query.in('category', categories);
        }

        if (type) {
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

        res.json({
            success: true,
            data,
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

        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching transaction:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update transaction
router.patch('/:id', async (req, res) => {
    try {
        const { type, category, merchant, notes, tags, status, description } = req.body;

        const updates = {};
        if (type) updates.type = type;
        if (category) updates.category = category;
        if (merchant) updates.merchant = merchant;
        if (notes !== undefined) updates.notes = notes;
        if (tags) updates.tags = tags;
        if (status) updates.status = status;
        if (description) updates.description = description;

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
