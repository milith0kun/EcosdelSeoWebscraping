const GoogleMapsScraper = require('../services/scraper');

// Almacenamiento temporal de trabajos
const jobs = {};

exports.searchBusinesses = async (req, res) => {
  try {
    const { ciudad } = req.body;

    if (!ciudad || ciudad.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'La ciudad es obligatoria'
      });
    }

    // Crear ID único para el trabajo
    const jobId = Date.now().toString();
    
    // Inicializar estado del trabajo
    jobs[jobId] = {
      status: 'iniciando',
      ciudad,
      progress: 0,
      total: 0,
      businesses: [],
      startTime: new Date(),
      error: null
    };

    // Ejecutar scraping en segundo plano
    (async () => {
      const scraper = new GoogleMapsScraper();
      
      try {
        jobs[jobId].status = 'buscando';
        console.log(`🔍 Iniciando búsqueda en ${ciudad}...`);

        const businesses = await scraper.searchBusinesses(ciudad);
        
        // Enriquecer datos con análisis de prioridad
        const enrichedBusinesses = businesses.map(business => ({
          ...business,
          ciudad,
          prioridad: calculatePriority(business),
          serviciosSugeridos: suggestServices(business),
          estadoContacto: 'Pendiente'
        }));

        jobs[jobId].businesses = enrichedBusinesses;
        jobs[jobId].total = enrichedBusinesses.length;
        jobs[jobId].progress = 100;
        jobs[jobId].status = 'completado';
        jobs[jobId].endTime = new Date();

        console.log(`✅ Búsqueda completada: ${enrichedBusinesses.length} negocios encontrados`);

      } catch (error) {
        console.error('❌ Error en scraping:', error);
        jobs[jobId].status = 'error';
        jobs[jobId].error = error.message;
      } finally {
        await scraper.close();
      }
    })();

    // Responder inmediatamente con el jobId
    res.json({
      success: true,
      message: `Búsqueda iniciada en ${ciudad}`,
      jobId,
      statusUrl: `/api/scraping/status/${jobId}`
    });

  } catch (error) {
    console.error('Error en searchBusinesses:', error);
    res.status(500).json({
      success: false,
      message: 'Error al iniciar búsqueda',
      error: error.message
    });
  }
};

exports.getStatus = (req, res) => {
  try {
    const { jobId } = req.params;

    if (!jobs[jobId]) {
      return res.status(404).json({
        success: false,
        message: 'Trabajo no encontrado'
      });
    }

    res.json({
      success: true,
      job: jobs[jobId]
    });

  } catch (error) {
    console.error('Error en getStatus:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estado',
      error: error.message
    });
  }
};

// Función para calcular prioridad del lead según especificaciones
function calculatePriority(business) {
  const { web, tieneWeb, estadoWeb, resenas, calificacion, facebook, instagram } = business;
  
  // Premium: No tiene web + tiene redes sociales activas + más de 50 reseñas
  const tieneRedes = facebook || instagram;
  if ((tieneWeb === 'No' || !web) && tieneRedes && resenas > 50) {
    return 'Premium';
  }
  
  // Alto: Tiene web desactualizada o problemas técnicos + buenas reseñas
  if ((estadoWeb === 'Inactiva' || estadoWeb === 'No responde') && resenas > 20) {
    return 'Alto';
  }
  
  // Alto: No tiene web pero tiene más de 20 reseñas
  if ((tieneWeb === 'No' || !web) && resenas > 20) {
    return 'Alto';
  }
  
  // Medio: Tiene web básica pero sin optimización SEO (asumimos si tiene web pero pocas reseñas)
  if (web && resenas >= 10 && resenas < 50) {
    return 'Medio';
  }
  
  // Bajo: Tiene web moderna y optimizada (más de 50 reseñas y web activa)
  if (web && estadoWeb === 'Activa' && resenas > 50) {
    return 'Bajo';
  }
  
  // Por defecto
  return resenas > 15 ? 'Medio' : 'Bajo';
}

// Función para sugerir servicios de Ecos del SEO
function suggestServices(business) {
  const services = [];
  const { web, tieneWeb, estadoWeb, resenas, categoria, facebook, instagram, tiktok, linkedin } = business;
  
  const tieneRedes = facebook || instagram || tiktok || linkedin;
  const esGrande = resenas > 50;
  const esTienda = categoria && (
    categoria.toLowerCase().includes('tienda') ||
    categoria.toLowerCase().includes('comercio') ||
    categoria.toLowerCase().includes('boutique') ||
    categoria.toLowerCase().includes('shop')
  );
  
  // Desarrollo Web (si no tiene web o web deficiente)
  if (tieneWeb === 'No' || !web) {
    services.push('Desarrollo Web');
  }
  if (estadoWeb === 'Inactiva' || estadoWeb === 'No responde') {
    services.push('Desarrollo Web (Renovación)');
  }
  
  // E-commerce (si es tienda sin venta online)
  if (esTienda && !web) {
    services.push('E-commerce');
  }
  
  // SEO (si tiene web pero no aparece en búsquedas o tiene pocas reseñas online)
  if (web && resenas < 20) {
    services.push('SEO');
  }
  if (tieneWeb === 'No' && resenas > 10) {
    services.push('SEO');
  }
  
  // Google Ads (si tiene presupuesto aparente - muchas reseñas)
  if (resenas > 30) {
    services.push('Google Ads');
  }
  
  // Redes Sociales (si no tiene presencia)
  if (!tieneRedes) {
    services.push('Gestión de Redes Sociales');
  }
  
  // Branding (si no tiene identidad visual clara - sin web ni redes)
  if (!web && !tieneRedes) {
    services.push('Branding');
  }
  
  // Chatbot WhatsApp (si tiene muchas consultas - muchas reseñas)
  if (resenas > 40) {
    services.push('Chatbot WhatsApp');
  }
  
  // Asistente Virtual (si es negocio grande)
  if (esGrande) {
    services.push('Asistente Virtual');
  }
  
  // Si no hay servicios sugeridos, ofrecer consultoría
  if (services.length === 0) {
    services.push('Consultoría Digital');
  }
  
  return services.join(', ');
}
