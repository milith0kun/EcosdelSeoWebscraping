const express = require('express');
const router = express.Router();
const schedulerController = require('../controllers/schedulerController');

// POST /api/scheduler/configure - Configurar búsqueda automática
router.post('/configure', schedulerController.configureSchedule);

// GET /api/scheduler/status - Obtener estado de la configuración
router.get('/status', schedulerController.getStatus);

// DELETE /api/scheduler/disable - Desactivar búsqueda automática
router.delete('/disable', schedulerController.disable);

module.exports = router;
