const express = require('express');
const router = express.Router();
const excelController = require('../controllers/excelController');

// POST /api/excel/export - Exportar datos a Excel
router.post('/export', excelController.exportToExcel);

module.exports = router;
