const puppeteer = require('puppeteer');

class GoogleMapsScraper {
  constructor() {
    this.browser = null;
    this.page = null;
    this.delay = parseInt(process.env.SCRAPING_DELAY) || 2000;
  }

  async initialize() {
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
    });
    this.page = await this.browser.newPage();
    await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await this.page.setViewport({ width: 1920, height: 1080 });
  }

  async searchBusinesses(ciudad) {
    try {
      if (!this.browser) await this.initialize();

      const searchUrl = `https://www.google.com/maps/search/negocios+en+${encodeURIComponent(ciudad)}+Peru`;
      console.log('🔍 Navegando a:', searchUrl);
      
      await this.page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await this.page.waitForTimeout(4000);

      // Esperar a que cargue el panel de resultados
      try {
        await this.page.waitForSelector('[role="feed"]', { timeout: 10000 });
      } catch (e) {
        console.log('⚠️ No se encontró panel de resultados');
      }

      // Scroll para cargar más resultados
      await this.scrollResults();

      // Extraer toda la información directamente de la lista
      const businesses = await this.extractAllBusinessData();
      console.log(`✅ Se encontraron ${businesses.length} negocios`);

      return businesses;
    } catch (error) {
      console.error('❌ Error en searchBusinesses:', error);
      throw error;
    }
  }

  async scrollResults() {
    try {
      await this.page.waitForSelector('[role="feed"]', { timeout: 10000 });
      
      for (let i = 0; i < 10; i++) {
        await this.page.evaluate(() => {
          const scrollElement = document.querySelector('[role="feed"]');
          if (scrollElement) {
            scrollElement.scrollTop = scrollElement.scrollHeight;
          }
        });
        await this.page.waitForTimeout(2000);
      }
      console.log('📜 Scroll completado');
    } catch (error) {
      console.log('⚠️ Error en scroll:', error.message);
    }
  }

  async extractAllBusinessData() {
    try {
      // Esperar a que carguen los elementos
      await this.page.waitForTimeout(3000);

      const businesses = await this.page.evaluate(() => {
        const results = [];
        const articles = document.querySelectorAll('div[role="article"]');

        articles.forEach((article) => {
          try {
            const data = {};

            // 1. Nombre del negocio
            const nameElement = article.querySelector('div[class*="fontHeadlineSmall"]');
            data.nombre = nameElement ? nameElement.textContent.trim() : 'Sin nombre';

            // 2. Categoría
            const categorySpans = article.querySelectorAll('span[class*="fontBodyMedium"]');
            if (categorySpans.length > 0) {
              data.categoria = categorySpans[0].textContent.trim();
            }

            // 3. Calificación y reseñas
            const ratingElement = article.querySelector('span[role="img"]');
            if (ratingElement) {
              const ariaLabel = ratingElement.getAttribute('aria-label') || '';
              const ratingMatch = ariaLabel.match(/(\d+[.,]\d+)/);
              if (ratingMatch) {
                data.calificacion = parseFloat(ratingMatch[0].replace(',', '.'));
              }
              const reviewMatch = ariaLabel.match(/(\d+)\s+(reseña|opinión)/i);
              if (reviewMatch) {
                data.resenas = parseInt(reviewMatch[1]);
              } else {
                data.resenas = 0;
              }
            } else {
              data.calificacion = 0;
              data.resenas = 0;
            }

            // 4. Dirección (buscar en los spans)
            const allSpans = Array.from(article.querySelectorAll('span'));
            for (let span of allSpans) {
              const text = span.textContent.trim();
              if (text.length > 10 && (text.includes('Calle') || text.includes('Av.') || text.includes('Jr.') || text.match(/\d{5}/))) {
                data.direccion = text;
                break;
              }
            }
            if (!data.direccion) {
              data.direccion = '';
            }

            // 5. Intentar obtener el link para más detalles
            const linkElement = article.closest('a') || article.querySelector('a');
            if (linkElement) {
              const href = linkElement.getAttribute('href');
              if (href) {
                data.url = href.startsWith('http') ? href : 'https://www.google.com' + href;
                
                // Extraer coordenadas de la URL
                const coordMatch = href.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
                if (coordMatch) {
                  data.coordenadas = `${coordMatch[1]}, ${coordMatch[2]}`;
                }
              }
            }

            // 6. Buscar teléfono (a veces visible en la lista)
            const phoneRegex = /(\+51[\s-]?\d{3}[\s-]?\d{3}[\s-]?\d{3}|\d{3}[\s-]?\d{3}[\s-]?\d{3})/;
            const articleText = article.textContent;
            const phoneMatch = articleText.match(phoneRegex);
            if (phoneMatch) {
              data.telefono = phoneMatch[0].trim();
              data.whatsapp = phoneMatch[0].trim();
            }

            // Solo agregar si tiene nombre válido
            if (data.nombre && data.nombre !== 'Sin nombre' && data.nombre.length > 2) {
              results.push(data);
            }

          } catch (error) {
            console.log('Error procesando artículo:', error);
          }
        });

        return results;
      });

      // Ahora intentar obtener detalles adicionales de algunos negocios (máximo 20)
      const enrichedBusinesses = [];
      const maxDetails = Math.min(businesses.length, 20);

      for (let i = 0; i < maxDetails; i++) {
        const business = businesses[i];
        console.log(`🔍 Obteniendo detalles de: ${business.nombre} (${i + 1}/${maxDetails})`);
        
        if (business.url) {
          try {
            const details = await this.getBusinessDetailsQuick(business.url);
            enrichedBusinesses.push({ ...business, ...details });
          } catch (error) {
            console.log(`⚠️ Error en detalles: ${error.message}`);
            enrichedBusinesses.push(business);
          }
        } else {
          enrichedBusinesses.push(business);
        }
        
        await this.page.waitForTimeout(1500);
      }

      // Resto sin detalles adicionales
      for (let i = maxDetails; i < businesses.length; i++) {
        enrichedBusinesses.push(businesses[i]);
      }

      return enrichedBusinesses;

    } catch (error) {
      console.error('❌ Error en extractAllBusinessData:', error);
      return [];
    }
  }

  async getBusinessDetailsQuick(businessUrl) {
    try {
      await this.page.goto(businessUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await this.page.waitForTimeout(2000);

      const details = await this.page.evaluate(() => {
        const data = {};

        // Dirección completa
        const addressButton = document.querySelector('[data-item-id*="address"]');
        if (addressButton) {
          const addressText = addressButton.getAttribute('aria-label') || '';
          data.direccion = addressText.replace('Dirección: ', '').trim();
        }

        // Teléfono principal
        const phoneButton = document.querySelector('[data-item-id*="phone:tel:"]');
        if (phoneButton) {
          const phoneText = phoneButton.getAttribute('aria-label') || phoneButton.textContent || '';
          data.telefono = phoneText.replace('Teléfono: ', '').replace('Llamar por teléfono', '').trim();
          data.whatsapp = data.telefono;
        }

        // Sitio web
        const websiteButton = document.querySelector('[data-item-id*="authority"]');
        if (websiteButton) {
          data.web = websiteButton.getAttribute('href') || '';
          data.tieneWeb = 'Sí';
          data.estadoWeb = 'Activa';
        } else {
          data.tieneWeb = 'No';
          data.web = '';
        }

        // Redes sociales - buscar en todo el contenido
        const allLinks = Array.from(document.querySelectorAll('a[href]'));
        allLinks.forEach(link => {
          const href = link.getAttribute('href') || '';
          if (href.includes('facebook.com')) data.facebook = href;
          if (href.includes('instagram.com')) data.instagram = href;
          if (href.includes('tiktok.com')) data.tiktok = href;
          if (href.includes('linkedin.com')) data.linkedin = href;
        });

        // Horarios de atención
        const hoursButton = document.querySelector('[data-item-id="oh"]');
        if (hoursButton) {
          const hoursText = hoursButton.getAttribute('aria-label') || '';
          data.horarios = hoursText;
          
          if (hoursText.toLowerCase().includes('abierto')) {
            data.estado = 'Abierto';
          } else if (hoursText.toLowerCase().includes('cerrado')) {
            data.estado = 'Cerrado';
          }
        }

        // Email - buscar en el contenido
        const bodyText = document.body.innerText;
        const emailMatch = bodyText.match(/[\w.-]+@[\w.-]+\.\w{2,}/);
        if (emailMatch) {
          data.email = emailMatch[0];
        }

        return data;
      });

      return details;
    } catch (error) {
      console.log('⚠️ Error en detalles rápidos:', error.message);
      return {};
    }
  }

  async getBusinessDetails(businessUrl) {
    return this.getBusinessDetailsQuick(businessUrl);
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

module.exports = GoogleMapsScraper;
