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

  // Polling para obtener el estado del trabajo
  useEffect(() => {
    if (!jobId) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/scraping/status/${jobId}`);
        const data = await response.json();

        if (data.success && data.job) {
          setProgress(data.job.progress || 0);

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
    }, 2000);

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
      const response = await fetch('/api/excel/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businesses, ciudad })
      });

      const data = await response.json();

      if (data.success) {
        // Descargar el archivo
        window.open(data.downloadUrl, '_blank');
        showMessage('success', 'Excel descargado exitosamente');
      } else {
        showMessage('error', data.message || 'Error al exportar');
      }
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
            </div>
            <div className="progress-bar-container">
              <div className="progress-bar" style={{ width: `${progress}%` }}>
                {progress}%
              </div>
            </div>
            <div className="progress-details">
              Este proceso puede tomar algunos minutos...
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
