const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.render('portfolio', {
        title: 'Portfolio',
        activePage: 'portfolio'
    });
});

module.exports = router;
