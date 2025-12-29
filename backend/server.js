const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const cron = require('node-cron');
const path = require('path');

// Importar rutas
const scrapingRoutes = require('./routes/scraping');
const excelRoutes = require('./routes/excel');
const schedulerRoutes = require('./routes/scheduler');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos
app.use('/exports', express.static(path.join(__dirname, 'exports')));

// Rutas
app.use('/api/scraping', scrapingRoutes);
app.use('/api/excel', excelRoutes);
app.use('/api/scheduler', schedulerRoutes);

// Ruta de prueba
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Servidor de Ecos del SEO funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

// Middleware de manejo de errores global (debe estar al final, después de todas las rutas)
app.use((err, req, res, next) => {
  console.error('❌ Error capturado por middleware global:', err);

  // Asegurar que siempre devolvemos JSON
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Middleware para rutas no encontradas (404)
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada'
  });
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor corriendo en http://0.0.0.0:${PORT}`);
  console.log(`📊 API disponible en http://0.0.0.0:${PORT}/api`);
  console.log(`🌐 Accesible desde: http://18.117.254.75:${PORT}/api`);
});

module.exports = app;
