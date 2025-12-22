const express = require('express');
const router = express.Router();
const scrapingController = require('../controllers/scrapingController');

// POST /api/scraping/search - Iniciar búsqueda de negocios
router.post('/search', scrapingController.searchBusinesses);

// GET /api/scraping/status/:jobId - Obtener estado de un trabajo de scraping
router.get('/status/:jobId', scrapingController.getStatus);

module.exports = router;
