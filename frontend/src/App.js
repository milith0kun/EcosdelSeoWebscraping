import React, { useState, useEffect } from 'react';

function App() {
  const [ciudad, setCiudad] = useState('');
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [jobId, setJobId] = useState(null);
  const [message, setMessage] = useState(null);
  
  // Configuración de búsqueda automática
  const [autoSearch, setAutoSearch] = useState(false);
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleEmail, setScheduleEmail] = useState('');

  const [statusMessage, setStatusMessage] = useState('');

  // Cargar último resultado al montar el componente
  useEffect(() => {
    const loadLastResult = async () => {
      try {
        const response = await fetch('/api/scraping/last');
        const data = await response.json();

        if (data.success && data.hasData && data.job) {
          const job = data.job;

          // Cargar datos si la búsqueda está completada
          if (job.status === 'completado' && job.businesses) {
            setBusinesses(job.businesses);
            setCiudad(job.ciudad || '');
            showMessage('success', `✅ Última búsqueda completada: ${job.businesses.length} negocios en ${job.ciudad}`);
          }
          // Cargar datos parciales si la búsqueda está en progreso
          else if (job.status === 'buscando' && job.businesses && job.businesses.length > 0) {
            setBusinesses(job.businesses);
            setCiudad(job.ciudad || '');
            setProgress(job.progress || 0);
            showMessage('info', `🔄 Búsqueda en progreso: ${job.businesses.length} negocios encontrados en ${job.ciudad}. Puedes cerrar esta página, el proceso continúa.`);
          }
        }
      } catch (error) {
        console.error('Error cargando último resultado:', error);
      }
    };

    loadLastResult();
  }, []);

  // Polling para obtener el estado del trabajo
  useEffect(() => {
    if (!jobId) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/scraping/status/${jobId}`);
        const data = await response.json();

        if (data.success && data.job) {
          setProgress(data.job.progress || 0);
          setStatusMessage(data.job.statusMessage || 'Procesando...');

          // Actualizar negocios en tiempo real si están disponibles
          if (data.job.businesses && data.job.businesses.length > 0) {
            setBusinesses(data.job.businesses);
          }

          if (data.job.status === 'completado') {
            setBusinesses(data.job.businesses);
            setLoading(false);
            setJobId(null);
            showMessage('success', `¡Búsqueda completada! ${data.job.businesses.length} negocios encontrados`);
          } else if (data.job.status === 'error') {
            setLoading(false);
            setJobId(null);
            showMessage('error', `Error: ${data.job.error}`);
          }
        }
      } catch (error) {
        console.error('Error al obtener estado:', error);
      }
    }, 1500); // Actualizar cada 1.5 segundos para tiempo más real

    return () => clearInterval(interval);
  }, [jobId]);

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleSearch = async (e) => {
    e.preventDefault();

    if (!ciudad.trim()) {
      showMessage('error', 'Por favor ingresa una ciudad');
      return;
    }

    setLoading(true);
    setProgress(0);
    setBusinesses([]);

    try {
      const response = await fetch('/api/scraping/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ciudad: ciudad.trim() })
      });

      const data = await response.json();

      if (data.success) {
        setJobId(data.jobId);
        showMessage('info', `Búsqueda iniciada en ${ciudad}`);
      } else {
        setLoading(false);
        showMessage('error', data.message || 'Error al iniciar búsqueda');
      }
    } catch (error) {
      setLoading(false);
      showMessage('error', 'Error de conexión con el servidor');
      console.error('Error:', error);
    }
  };

  const handleExport = async () => {
    if (businesses.length === 0) {
      showMessage('error', 'No hay datos para exportar');
      return;
    }

    try {
      showMessage('info', 'Generando Excel...');

      const response = await fetch('/api/excel/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businesses, ciudad })
      });

      if (!response.ok) {
        throw new Error('Error al generar Excel');
      }

      // Obtener el archivo como blob
      const blob = await response.blob();

      // Extraer nombre del archivo del header Content-Disposition
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `Prospeccion_${ciudad}_${Date.now()}.xlsx`;

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Crear link temporal para descargar
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();

      // Limpiar
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      showMessage('success', `Excel descargado: ${filename}`);
    } catch (error) {
      showMessage('error', 'Error al exportar a Excel');
      console.error('Error:', error);
    }
  };

  const handleScheduleConfig = async () => {
    if (!scheduleTime) {
      showMessage('error', 'Ingresa una hora para la búsqueda automática');
      return;
    }

    try {
      const response = await fetch('/api/scheduler/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ciudad: ciudad.trim(),
          hora: scheduleTime,
          email: scheduleEmail || null
        })
      });

      const data = await response.json();

      if (data.success) {
        showMessage('success', data.message);
      } else {
        showMessage('error', data.message || 'Error al configurar');
      }
    } catch (error) {
      showMessage('error', 'Error al configurar búsqueda automática');
      console.error('Error:', error);
    }
  };

  const clearResults = () => {
    setBusinesses([]);
    setProgress(0);
    showMessage('info', 'Resultados limpiados');
  };

  return (
    <div className="app">
      <div className="container">
        <div className="header">
          <h1>ECOS DEL SEO - Prospección de Negocios</h1>
          <p>Encuentra leads de calidad en cualquier ciudad de Perú</p>
        </div>

        {message && (
          <div className={`alert alert-${message.type}`}>
            {message.text}
          </div>
        )}

        <div className="search-section">
          <form onSubmit={handleSearch} className="search-form">
            <div className="form-group">
              <label htmlFor="ciudad">Ciudad o ubicación</label>
              <input
                type="text"
                id="ciudad"
                value={ciudad}
                onChange={(e) => setCiudad(e.target.value)}
                placeholder="Ej: Cusco, Lima, Arequipa..."
                disabled={loading}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Buscando...' : 'Buscar Negocios'}
            </button>
          </form>

          <div className="scheduler-config">
            <div className="checkbox-group">
              <input
                type="checkbox"
                id="autoSearch"
                checked={autoSearch}
                onChange={(e) => setAutoSearch(e.target.checked)}
              />
              <label htmlFor="autoSearch">Búsqueda automática diaria</label>
            </div>

            {autoSearch && (
              <div className="scheduler-fields">
                <div className="form-group">
                  <label htmlFor="scheduleTime">Hora (24h)</label>
                  <input
                    type="time"
                    id="scheduleTime"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="scheduleEmail">Email para notificaciones (opcional)</label>
                  <input
                    type="email"
                    id="scheduleEmail"
                    value={scheduleEmail}
                    onChange={(e) => setScheduleEmail(e.target.value)}
                    placeholder="tu-email@ejemplo.com"
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={handleScheduleConfig}
                >
                  Guardar configuración
                </button>
              </div>
            )}
          </div>
        </div>

        {loading && (
          <div className="progress-section">
            <div className="progress-info">
              <h3>Buscando negocios en {ciudad}...</h3>
              <p style={{ fontSize: '14px', color: '#666', marginTop: '8px' }}>
                {statusMessage || 'Iniciando búsqueda...'}
              </p>
              {businesses.length > 0 && (
                <p style={{ fontSize: '16px', color: '#28a745', fontWeight: 'bold', marginTop: '12px' }}>
                  ✅ {businesses.length} negocios encontrados
                </p>
              )}
            </div>
            <div className="progress-bar-container">
              <div className="progress-bar" style={{ width: `${progress}%` }}>
                {progress}%
              </div>
            </div>
            <div className="progress-details">
              <p style={{ fontSize: '13px', color: '#555' }}>
                💡 Puedes cerrar esta pestaña. El proceso continuará en segundo plano y los resultados se guardarán automáticamente.
              </p>
              <p style={{ fontSize: '13px', color: '#777' }}>
                Este proceso puede tomar varios minutos. Se están buscando en múltiples categorías de negocios.
              </p>
            </div>
          </div>
        )}

        <div className="results-section">
          {businesses.length > 0 ? (
            <>
              <div className="results-header">
                <div>
                  <h2>Resultados</h2>
                  <span className="results-count">
                    {businesses.length} negocios encontrados
                  </span>
                </div>
                <div className="results-actions">
                  <button className="btn btn-success" onClick={handleExport}>
                    Exportar a Excel
                  </button>
                  <button className="btn btn-secondary" onClick={clearResults}>
                    Limpiar resultados
                  </button>
                </div>
              </div>

              <div className="table-container">
                <table className="results-table">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Categoría</th>
                      <th>Dirección</th>
                      <th>Teléfono</th>
                      <th>Email</th>
                      <th>Tiene Web</th>
                      <th>Estado Web</th>
                      <th>Redes</th>
                      <th>Calificación</th>
                      <th>Reseñas</th>
                      <th>Prioridad</th>
                      <th>Servicios Sugeridos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {businesses.map((business, index) => (
                      <tr key={index}>
                        <td><strong>{business.nombre}</strong></td>
                        <td><span className="category">{business.categoria || '-'}</span></td>
                        <td className="address">{business.direccion || '-'}</td>
                        <td className="phone">{business.telefono || '-'}</td>
                        <td className="email">{business.email || '-'}</td>
                        <td>
                          <span className={`badge ${business.web ? 'badge-yes' : 'badge-no'}`}>
                            {business.web ? 'Sí' : 'No'}
                          </span>
                        </td>
                        <td>{business.estadoWeb || '-'}</td>
                        <td>
                          <div className="social-icons">
                            {business.facebook && <span title="Facebook">FB</span>}
                            {business.instagram && <span title="Instagram">IG</span>}
                            {business.tiktok && <span title="TikTok">TT</span>}
                            {business.linkedin && <span title="LinkedIn">LI</span>}
                            {!business.facebook && !business.instagram && !business.tiktok && !business.linkedin && '-'}
                          </div>
                        </td>
                        <td>
                          <span className="rating">
                            ⭐ {business.calificacion ? business.calificacion.toFixed(1) : '-'}
                          </span>
                        </td>
                        <td className="reviews">{business.resenas || 0}</td>
                        <td>
                          <span className={`priority-badge priority-${(business.prioridad || 'bajo').toLowerCase()}`}>
                            {business.prioridad || 'Bajo'}
                          </span>
                        </td>
                        <td className="services">{business.serviciosSugeridos || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : !loading && (
            <div className="empty-state">
              <h3>Sin resultados</h3>
              <p>Ingresa una ciudad y haz clic en "Buscar Negocios" para comenzar</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
