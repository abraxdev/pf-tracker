const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// Get transactions with filters
router.get('/', async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            bank,
            dateFrom,
            dateTo,
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

        if (dateFrom) {
            query = query.gte('transaction_date', dateFrom);
        }

        if (dateTo) {
            query = query.lte('transaction_date', dateTo);
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

        // Pagination
        const offset = (page - 1) * limit;
        query = query
            .order('transaction_date', { ascending: false })
            .range(offset, offset + limit - 1);

        const { data, error, count } = await query;

        if (error) throw error;

        res.json({
            success: true,
            data,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: count,
                totalPages: Math.ceil(count / limit)
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
        const { type, category, merchant, notes, tags, status } = req.body;

        const updates = {};
        if (type) updates.type = type;
        if (category) updates.category = category;
        if (merchant) updates.merchant = merchant;
        if (notes !== undefined) updates.notes = notes;
        if (tags) updates.tags = tags;
        if (status) updates.status = status;

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
