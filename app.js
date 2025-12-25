const express = require('express');
const path = require('path');
const hbs = require('hbs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3000;

// Handlebars configuration
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));
hbs.registerPartials(path.join(__dirname, 'views', 'partials'));

// Register Handlebars helpers
hbs.registerHelper('formatDate', function(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
});

hbs.registerHelper('formatAmount', function(amount) {
    if (amount == null) return '0,00';
    return new Intl.NumberFormat('it-IT', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
});

hbs.registerHelper('percentage', function(value, total) {
    if (!total || total === 0) return 0;
    return Math.round((value / total) * 100);
});

hbs.registerHelper('subtract', function(a, b) {
    return (a || 0) - (b || 0);
});

hbs.registerHelper('gt', function(a, b) {
    return a > b;
});

hbs.registerHelper('eq', function(a, b) {
    return a === b;
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Create uploads directory if it doesn't exist
const fs = require('fs');
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Routes
app.use('/', require('./routes/index'));
app.use('/upload', require('./routes/upload'));
app.use('/transactions', require('./routes/transactionsView'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/portfolio', require('./routes/portfolioView'));
app.use('/api/portfolio', require('./routes/portfolio'));

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).render('404', {
        title: 'Page Not Found'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
