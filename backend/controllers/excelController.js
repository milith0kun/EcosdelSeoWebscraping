const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

exports.exportToExcel = async (req, res) => {
  try {
    const { businesses, ciudad } = req.body;

    if (!businesses || !Array.isArray(businesses) || businesses.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No hay datos para exportar'
      });
    }

    // Crear directorio exports si no existe
    const exportsDir = path.join(__dirname, '../exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    // Nombre del archivo
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `Prospeccion_${ciudad}_${timestamp}.xlsx`;
    const filepath = path.join(exportsDir, filename);

    // Crear workbook
    const workbook = XLSX.utils.book_new();

    // HOJA 1: Negocios Recopilados - TODOS LOS 30 CAMPOS
    const businessData = businesses.map(b => ({
      'Nombre del Negocio': b.nombre || '',
      'Categoría': b.categoria || '',
      'Dirección': b.direccion || '',
      'Nombre Contacto': b.nombreContacto || '',
      'Cargo': b.cargo || '',
      'Teléfono Principal': b.telefono || '',
      'Teléfono 2': b.telefono2 || '',
      'WhatsApp': b.whatsapp || b.telefono || '',
      'Email 1': b.email || '',
      'Email 2': b.email2 || '',
      'Tiene Web': b.tieneWeb || (b.web ? 'Sí' : 'No'),
      'URL Web': b.web || '',
      'Estado Web': b.estadoWeb || '',
      'Facebook': b.facebook || '',
      'Instagram': b.instagram || '',
      'TikTok': b.tiktok || '',
      'LinkedIn': b.linkedin || '',
      'Calificación': b.calificacion || 0,
      'Reseñas': b.resenas || 0,
      'Horarios': b.horarios || '',
      'Estado': b.estado || 'Desconocido',
      'Nivel Prioridad': b.prioridad || 'Bajo',
      'Servicios Sugeridos': b.serviciosSugeridos || '',
      'Estado Contacto': b.estadoContacto || 'Pendiente',
      'Fecha 1er Contacto': b.fechaPrimerContacto || '',
      'Último Seguimiento': b.ultimoSeguimiento || '',
      'Observaciones': b.observaciones || '',
      'Fecha Captura': b.fechaCaptura ? new Date(b.fechaCaptura).toLocaleString('es-PE') : new Date().toLocaleString('es-PE'),
      'Ciudad': b.ciudad || ciudad,
      'Coordenadas': b.coordenadas || ''
    }));

    const ws1 = XLSX.utils.json_to_sheet(businessData);
    
    // Aplicar estilo a los encabezados (simulado con ancho de columnas)
    ws1['!cols'] = [
      { wch: 30 }, { wch: 20 }, { wch: 40 }, { wch: 20 }, { wch: 20 },
      { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 30 }, { wch: 30 },
      { wch: 12 }, { wch: 40 }, { wch: 20 }, { wch: 40 }, { wch: 40 },
      { wch: 40 }, { wch: 40 }, { wch: 12 }, { wch: 10 }, { wch: 30 },
      { wch: 15 }, { wch: 15 }, { wch: 40 }, { wch: 15 }, { wch: 18 },
      { wch: 18 }, { wch: 40 }, { wch: 20 }, { wch: 15 }, { wch: 25 }
    ];

    XLSX.utils.book_append_sheet(workbook, ws1, 'Negocios Recopilados');

    // HOJA 2: Resumen Ejecutivo
    const stats = calculateStatistics(businesses, ciudad);
    const ws2 = XLSX.utils.json_to_sheet([stats]);
    XLSX.utils.book_append_sheet(workbook, ws2, 'Resumen Ejecutivo');

    // HOJA 3: Guía de Uso
    const guide = [
      { 'GUÍA DE USO': 'NIVELES DE PRIORIDAD' },
      { 'GUÍA DE USO': 'Premium: No tiene web + más de 50 reseñas (Máxima oportunidad)' },
      { 'GUÍA DE USO': 'Alto: Tiene web con problemas o buenas reseñas sin web' },
      { 'GUÍA DE USO': 'Medio: Tiene web básica o reseñas moderadas' },
      { 'GUÍA DE USO': 'Bajo: Tiene web optimizada' },
      { 'GUÍA DE USO': '' },
      { 'GUÍA DE USO': 'ESTADOS DE CONTACTO' },
      { 'GUÍA DE USO': 'Pendiente: Aún no se ha contactado' },
      { 'GUÍA DE USO': 'Llamado: Se realizó el primer contacto' },
      { 'GUÍA DE USO': 'Interesado: Mostró interés en los servicios' },
      { 'GUÍA DE USO': 'No interesado: Rechazó la propuesta' },
      { 'GUÍA DE USO': 'Contrató: Cliente adquirido' },
      { 'GUÍA DE USO': 'No responde: No contesta llamadas/mensajes' },
      { 'GUÍA DE USO': '' },
      { 'GUÍA DE USO': 'SERVICIOS DE ECOS DEL SEO' },
      { 'GUÍA DE USO': 'Desarrollo Web: Desde S/ 2,500' },
      { 'GUÍA DE USO': 'Tiendas Online: Desde S/ 3,500' },
      { 'GUÍA DE USO': 'SEO: Desde S/ 800/mes' },
      { 'GUÍA DE USO': 'Google Ads: Desde S/ 500/mes' },
      { 'GUÍA DE USO': 'Branding: Desde S/ 1,500' },
      { 'GUÍA DE USO': 'Chatbot WhatsApp: Desde S/ 1,200' },
      { 'GUÍA DE USO': 'Asistente Virtual: Desde S/ 500/mes' },
      { 'GUÍA DE USO': '' },
      { 'GUÍA DE USO': 'Contacto: +51 912 672 008 | contacto@ecosdelseo.com' }
    ];
    const ws3 = XLSX.utils.json_to_sheet(guide);
    ws3['!cols'] = [{ wch: 80 }];
    XLSX.utils.book_append_sheet(workbook, ws3, 'Guía de Uso');

    // Guardar archivo
    XLSX.writeFile(workbook, filepath);

    console.log(`📊 Excel generado: ${filename}`);

    res.json({
      success: true,
      message: 'Excel generado exitosamente',
      filename,
      downloadUrl: `/exports/${filename}`,
      totalBusinesses: businesses.length
    });

  } catch (error) {
    console.error('Error en exportToExcel:', error);
    res.status(500).json({
      success: false,
      message: 'Error al generar Excel',
      error: error.message
    });
  }
};

function calculateStatistics(businesses, ciudad) {
  const total = businesses.length;
  const sinWeb = businesses.filter(b => !b.web).length;
  const premium = businesses.filter(b => b.prioridad === 'Premium').length;
  const alto = businesses.filter(b => b.prioridad === 'Alto').length;
  const medio = businesses.filter(b => b.prioridad === 'Medio').length;
  const bajo = businesses.filter(b => b.prioridad === 'Bajo').length;
  
  const avgRating = businesses.reduce((sum, b) => sum + (b.calificacion || 0), 0) / total;
  
  // Categorías más comunes
  const categories = {};
  businesses.forEach(b => {
    const cat = b.categoria || 'Sin categoría';
    categories[cat] = (categories[cat] || 0) + 1;
  });
  
  const topCategories = Object.entries(categories)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cat, count]) => `${cat}: ${count}`)
    .join(', ');

  return {
    'Total Negocios': total,
    'Sin Página Web': sinWeb,
    'Leads Premium': premium,
    'Leads Alto': alto,
    'Leads Medio': medio,
    'Leads Bajo': bajo,
    'Calificación Promedio': avgRating.toFixed(2),
    'Categorías Principales': topCategories,
    'Ciudad Analizada': ciudad,
    'Fecha de Recopilación': new Date().toISOString().split('T')[0]
  };
}
