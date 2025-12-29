const puppeteer = require('puppeteer');

class GoogleMapsScraper {
  constructor() {
    this.browser = null;
    this.page = null;
    this.delay = parseInt(process.env.SCRAPING_DELAY) || 2000;
  }

  async initialize() {
    try {
      // Detectar sistema operativo y configurar Puppeteer correctamente
      const isWindows = process.platform === 'win32';
      const isLinux = process.platform === 'linux';

      const launchOptions = {
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      };

      // Solo especificar executablePath en Linux (en Windows usa el bundled Chromium)
      if (isLinux) {
        launchOptions.executablePath = '/usr/bin/chromium-browser';
      }

      console.log(`🖥️  Sistema operativo detectado: ${process.platform}`);
      console.log(`🌐 Iniciando navegador con opciones:`, JSON.stringify(launchOptions, null, 2));

      this.browser = await puppeteer.launch(launchOptions);
      console.log('✅ Navegador iniciado correctamente');

      this.page = await this.browser.newPage();
      await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await this.page.setViewport({ width: 1920, height: 1080 });

      console.log('✅ Página configurada correctamente');
    } catch (error) {
      console.error('❌ Error al inicializar navegador:', error);
      throw new Error(`No se pudo inicializar el navegador: ${error.message}. Asegúrate de que Chrome/Chromium esté instalado.`);
    }
  }

  async searchBusinesses(ciudad, progressCallback = null) {
    try {
      if (!this.browser) await this.initialize();

      this.progressCallback = progressCallback;

      // ESTRATEGIA OPTIMIZADA: Búsqueda por radio desde el centro de la ciudad
      // En lugar de 213 categorías, usamos búsqueda genérica "negocios" en un radio
      const radioKm = 5; // Radio de búsqueda en kilómetros desde el centro

      // Categorías principales (reducidas para eficiencia)
      const categorias = [
        'restaurantes', 'cafeterías', 'bares', 'hoteles', 'tiendas',
        'peluquerías', 'gimnasios', 'farmacias', 'talleres mecánicos',
        'abogados', 'dentistas', 'clínicas', 'agencias de viajes',
        'inmobiliarias', 'construcción', 'servicio técnico', 'fotografía',
        'lavanderías', 'spas', 'academias', 'veterinarias', 'panaderías',
        'ferreterías', 'ópticas', 'librerías', 'joyerías', 'florerías',
        'negocios', 'empresas', 'comercios' // Búsquedas amplias
      ];

      let allBusinesses = [];
      const businessesSet = new Set(); // Para evitar duplicados

      console.log(`📋 Total de categorías a buscar: ${categorias.length}`);
      console.log(`📍 Radio de búsqueda: ${radioKm} km desde el centro de ${ciudad}`);
      console.log(`🎯 Iniciando búsqueda optimizada de negocios en ${ciudad}...\n`);

      for (let i = 0; i < categorias.length; i++) {
        const categoria = categorias[i];
        console.log(`🔍 Buscando categoría: ${categoria} (${i + 1}/${categorias.length})`);

        // Búsqueda con "near" para enfocarse en el centro de la ciudad
        const searchUrl = `https://www.google.com/maps/search/${categoria}+near+${encodeURIComponent(ciudad)}+Peru`;
        console.log('📍 URL:', searchUrl);

        if (this.progressCallback) {
          const baseProgress = Math.floor((i / categorias.length) * 15);
          await this.progressCallback(baseProgress, `Buscando ${categoria} en ${ciudad}...`, allBusinesses.length, allBusinesses);
        }

        await this.page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
        await this.page.waitForTimeout(3000);

        // Esperar a que cargue el panel de resultados
        try {
          await this.page.waitForSelector('[role="feed"]', { timeout: 10000 });
        } catch (e) {
          console.log(`⚠️ No se encontró panel de resultados para ${categoria}`);
          continue;
        }

        // Scroll para cargar más resultados
        await this.scrollResults();

        // Extraer negocios de esta categoría
        const categoryBusinesses = await this.extractBusinessListData();

        console.log(`📊 Encontrados ${categoryBusinesses.length} negocios en ${categoria}`);

        // ENRIQUECER INMEDIATAMENTE con detalles (teléfono, email, redes)
        console.log(`🔍 Obteniendo detalles de ${categoryBusinesses.length} negocios...`);
        const enrichedCategoryBusinesses = await this.enrichBusinessesWithDetails(categoryBusinesses);

        // FILTRAR: Solo los que tienen contacto (teléfono O email)
        const contactableCategoryBusinesses = enrichedCategoryBusinesses.filter(business => {
          const tieneTelefono = business.telefono && business.telefono.length >= 9;
          const tieneEmail = business.email && business.email.includes('@');
          return tieneTelefono || tieneEmail;
        });

        console.log(`✅ ${contactableCategoryBusinesses.length} negocios contactables en ${categoria}`);

        // Agregar solo los que no sean duplicados (basado en nombre + dirección)
        for (const business of contactableCategoryBusinesses) {
          const key = `${business.nombre}-${business.direccion}`;
          if (!businessesSet.has(key)) {
            businessesSet.add(key);
            allBusinesses.push(business);
          }
        }

        console.log(`📊 Total acumulado: ${allBusinesses.length} negocios únicos contactables\n`);

        // Guardar progreso cada 3 categorías
        if ((i + 1) % 3 === 0 && this.progressCallback) {
          await this.progressCallback(
            Math.floor(((i + 1) / categorias.length) * 90),
            `Procesadas ${i + 1}/${categorias.length} categorías`,
            allBusinesses.length,
            allBusinesses
          );
        }
      }

      if (this.progressCallback) {
        await this.progressCallback(95, `Finalizando búsqueda con ${allBusinesses.length} negocios contactables...`, allBusinesses.length, allBusinesses);
      }

      // Ya están enriquecidos y filtrados, solo aplicar filtros adicionales
      console.log(`\n🔍 Aplicando filtros finales...`);

      // FILTRAR negocios internacionales y cadenas grandes
      const localBusinesses = allBusinesses.filter(business => {
        return this.isLocalBusiness(business);
      });

      console.log(`🎯 Filtrados: ${allBusinesses.length - localBusinesses.length} negocios internacionales/cadenas`);

      // FILTRO DE CALIDAD: Verificar datos mínimos
      const contactableBusinesses = localBusinesses.filter(business => {
        return this.hasMinimumRequiredData(business);
      });

      console.log(`🎯 Filtrados por datos incompletos: ${localBusinesses.length - contactableBusinesses.length} negocios`);
      console.log(`✅ TOTAL FINAL: ${contactableBusinesses.length} negocios contactables (con teléfono O email)`);

      // Estadísticas de datos capturados (de los negocios con contacto)
      const conTelefono = contactableBusinesses.filter(b => b.telefono).length;
      const conEmail = contactableBusinesses.filter(b => b.email).length;
      const conAmbos = contactableBusinesses.filter(b => b.telefono && b.email).length;
      const conNombreContacto = contactableBusinesses.filter(b => b.nombreContacto).length;
      const conRedes = contactableBusinesses.filter(b => b.facebook || b.instagram).length;
      const conWeb = contactableBusinesses.filter(b => b.web).length;
      const conDireccion = contactableBusinesses.filter(b => b.direccion && b.direccion.length > 5).length;

      console.log(`\n📊 ESTADÍSTICAS DE CAPTURA (solo negocios contactables):`);
      console.log(`   📞 Teléfonos: ${conTelefono}/${contactableBusinesses.length} (${Math.round(conTelefono / contactableBusinesses.length * 100)}%)`);
      console.log(`   📧 Emails: ${conEmail}/${contactableBusinesses.length} (${Math.round(conEmail / contactableBusinesses.length * 100)}%)`);
      console.log(`   📞📧 Ambos (teléfono + email): ${conAmbos}/${contactableBusinesses.length} (${Math.round(conAmbos / contactableBusinesses.length * 100)}%)`);
      console.log(`   📍 Direcciones: ${conDireccion}/${contactableBusinesses.length} (${Math.round(conDireccion / contactableBusinesses.length * 100)}%) ✅ REQUERIDO`);
      console.log(`   👤 Nombres de contacto: ${conNombreContacto}/${contactableBusinesses.length} (${Math.round(conNombreContacto / contactableBusinesses.length * 100)}%)`);
      console.log(`   🌐 Sitios web: ${conWeb}/${contactableBusinesses.length} (${Math.round(conWeb / contactableBusinesses.length * 100)}%)`);
      console.log(`   📱 Redes sociales: ${conRedes}/${contactableBusinesses.length} (${Math.round(conRedes / contactableBusinesses.length * 100)}%)\n`);

      return contactableBusinesses;
    } catch (error) {
      console.error('❌ Error en searchBusinesses:', error);
      throw error;
    }
  }

  // Función para detectar si es un negocio local peruano (cliente potencial)
  isLocalBusiness(business) {
    const nombre = (business.nombre || '').toLowerCase();
    const web = (business.web || '').toLowerCase();
    const categoria = (business.categoria || '').toLowerCase();

    // Lista de cadenas internacionales y grandes corporaciones que NO son clientes potenciales
    const cadenasInternacionales = [
      // Fast food internacional
      'mcdonald', 'burger king', 'kfc', 'subway', 'pizza hut', 'domino',
      'starbucks', 'dunkin', 'papa john', 'bembos', 'china wok', 'norky',

      // Retail internacional y grandes cadenas peruanas
      'walmart', 'carrefour', 'tottus', 'metro', 'plaza vea', 'wong', 'vivanda',
      'saga falabella', 'ripley', 'oeschle', 'paris', 'promart', 'sodimac',
      'maestro', 'ace home center',

      // Hoteles internacionales y cadenas grandes
      'hilton', 'marriott', 'sheraton', 'hyatt', 'intercontinental', 'westin',
      'holiday inn', 'radisson', 'novotel', 'ibis', 'casa andina', 'costa del sol',

      // Farmacias grandes
      'inkafarma', 'mifarma', 'boticas', 'inka pharma', 'fasa', 'arcangel',

      // Bancos y financieras (no necesitan servicios digitales de agencia)
      'banco', 'bbva', 'interbank', 'scotiabank', 'bcp', 'continental',
      'crediscotia', 'mibanco', 'azteca', 'pichincha', 'citibank',
      'caja', 'cooperativa',

      // Tecnología internacional
      'apple store', 'samsung', 'lg store', 'sony', 'huawei', 'xiaomi',

      // Educación grande
      'universidad', 'upc', 'ulima', 'pucp', 'usil', 'utp', 'certus',
      'senati', 'sencico',

      // Salud grande
      'clinica internacional', 'clinica americana', 'clinica ricardo palma',
      'clinica san felipe', 'essalud', 'minsa',

      // Entretenimiento y servicios grandes
      'cinemark', 'cineplanet', 'claro', 'movistar', 'entel', 'bitel',
      'netflix', 'spotify', 'rappi', 'pedidos ya', 'uber',

      // Gimnasios cadenas
      'gold gym', 'bodytech', 'smart fit', 'sportlife',

      // Otros
      'avianca', 'latam', 'viva air', 'peruvian airlines',
      'cruz del sur', 'oltursa', 'tepsa', 'civa'
    ];

    // Verificar si el nombre contiene alguna cadena internacional
    for (const cadena of cadenasInternacionales) {
      if (nombre.includes(cadena)) {
        console.log(`🚫 Filtrado (cadena internacional): ${business.nombre}`);
        return false;
      }
    }

    // Verificar dominios corporativos internacionales en la web
    const dominiosCorporativos = [
      '.com/pe', '.com/es', 'corporate', 'group', 'international',
      'global', 'worldwide'
    ];

    for (const dominio of dominiosCorporativos) {
      if (web.includes(dominio)) {
        console.log(`🚫 Filtrado (dominio corporativo): ${business.nombre}`);
        return false;
      }
    }

    // Verificar si tiene más de 100 reseñas Y página web corporativa (probablemente cadena)
    if (business.resenas > 500 && web && web.includes('.com')) {
      console.log(`🚫 Filtrado (cadena con muchas reseñas): ${business.nombre} (${business.resenas} reseñas)`);
      return false;
    }

    // Si llegó aquí, es un negocio local peruano ✅
    return true;
  }

  async extractBusinessListData() {
    try {
      await this.page.waitForTimeout(3000);

      const businesses = await this.page.evaluate(() => {
        const results = [];
        const articles = document.querySelectorAll('div[role="article"]');

        console.log(`📋 Encontrados ${articles.length} artículos en la página`);

        articles.forEach((article, index) => {
          try {
            const data = {};

            // ESTRATEGIA MEJORADA: Buscar el enlace principal primero
            const linkElement = article.querySelector('a[href*="/maps/place/"]');
            if (linkElement) {
              const href = linkElement.getAttribute('href');
              data.url = href.startsWith('http') ? href : 'https://www.google.com' + href;

              // Extraer coordenadas
              const coordMatch = href.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
              if (coordMatch) {
                data.coordenadas = `${coordMatch[1]}, ${coordMatch[2]}`;
              }

              // Nombre del negocio - MÉTODOS MÚLTIPLES
              // Método 1: aria-label del enlace
              const ariaLabel = linkElement.getAttribute('aria-label');
              if (ariaLabel && ariaLabel.length > 2 && ariaLabel.length < 100) {
                data.nombre = ariaLabel.trim();
              }

              // Método 2: Buscar en divs con fuente grande
              if (!data.nombre) {
                const nameDiv = article.querySelector('div[class*="fontHeadline"]') ||
                  article.querySelector('div[class*="title"]') ||
                  article.querySelector('[class*="fontBodyLarge"]');
                if (nameDiv) {
                  data.nombre = nameDiv.textContent.trim();
                }
              }

              // Método 3: Primer texto significativo en el artículo
              if (!data.nombre) {
                const textNodes = Array.from(article.querySelectorAll('div, span')).filter(el => {
                  const text = el.textContent.trim();
                  return text.length > 3 && text.length < 100 && !text.match(/^\d+$/);
                });
                if (textNodes.length > 0) {
                  data.nombre = textNodes[0].textContent.trim();
                }
              }
            }

            // CALIFICACIÓN Y RESEÑAS - Métodos mejorados
            // Método 1: Buscar span con role="img" que contenga "estrellas"
            const ratingImgs = article.querySelectorAll('span[role="img"]');
            for (const img of ratingImgs) {
              const ariaLabel = img.getAttribute('aria-label') || '';

              // Buscar calificación (formato: "4.5 estrellas" o "4,5 stars")
              const ratingMatch = ariaLabel.match(/(\d+[.,]\d+)\s*(estrellas|stars)/i);
              if (ratingMatch) {
                data.calificacion = parseFloat(ratingMatch[1].replace(',', '.'));
              }

              // Buscar cantidad de reseñas
              const reviewMatch = ariaLabel.match(/(\d+)\s*(reseñas?|opiniones?|reviews?)/i) ||
                ariaLabel.match(/\((\d+)\)/);
              if (reviewMatch) {
                data.resenas = parseInt(reviewMatch[1]);
              }
            }

            // Método 2: Buscar números en el texto que puedan ser rating/reseñas
            if (!data.calificacion || !data.resenas) {
              const allText = article.textContent;

              // Buscar patrón "4.5 (123)" o "4.5 · 123 reseñas"
              const ratingPattern = /(\d+[.,]\d+)\s*[·•]?\s*\(?(\d+)/;
              const match = allText.match(ratingPattern);
              if (match) {
                if (!data.calificacion) data.calificacion = parseFloat(match[1].replace(',', '.'));
                if (!data.resenas) data.resenas = parseInt(match[2]);
              }
            }

            // Defaults
            if (!data.calificacion) data.calificacion = 0;
            if (!data.resenas) data.resenas = 0;

            // CATEGORÍA - Métodos mejorados
            // Buscar spans que no sean rating ni precio
            const allSpans = Array.from(article.querySelectorAll('span'));
            for (const span of allSpans) {
              const text = span.textContent.trim();
              // Filtrar: no números, no muy corto, no muy largo, no contiene símbolos de precio
              if (text.length > 3 &&
                text.length < 50 &&
                !text.match(/^\d+[.,]?\d*$/) &&
                !text.includes('$') &&
                !text.includes('S/') &&
                !text.match(/\d+\s*(estrellas|stars|reseñas|reviews)/i) &&
                text !== data.nombre) {
                data.categoria = text;
                break;
              }
            }
            if (!data.categoria) data.categoria = '';

            // DIRECCIÓN - Métodos mejorados
            // Método 1: Buscar texto con indicadores de dirección
            const addressIndicators = ['Calle', 'Av.', 'Jr.', 'Jirón', 'Avenida', 'Psje', 'Pasaje', 'Mz', 'Lote', 'N°', 'Nro'];
            for (const span of allSpans) {
              const text = span.textContent.trim();
              if (text.length > 15 && addressIndicators.some(ind => text.includes(ind))) {
                data.direccion = text;
                break;
              }
            }

            // Método 2: Buscar por posición (usualmente está después de la categoría)
            if (!data.direccion) {
              const divs = Array.from(article.querySelectorAll('div'));
              for (const div of divs) {
                const text = div.textContent.trim();
                if (text.length > 15 && text.length < 200 &&
                  (text.includes(',') || text.match(/\d{5}/))) {
                  data.direccion = text;
                  break;
                }
              }
            }

            if (!data.direccion) data.direccion = '';

            // TELÉFONO - Intentar capturar si está visible
            const phonePattern = /(\+51[\s-]?9\d{2}[\s-]?\d{3}[\s-]?\d{3}|9\d{8}|\(01\)[\s-]?\d{7})/;
            const articleText = article.textContent;
            const phoneMatch = articleText.match(phonePattern);
            if (phoneMatch) {
              data.telefono = phoneMatch[0].trim();
              data.whatsapp = phoneMatch[0].trim();
            }

            // Solo agregar si tiene datos mínimos válidos
            if (data.nombre && data.nombre.length > 2 && data.url) {
              results.push(data);
              console.log(`✅ Extraído: ${data.nombre} | ${data.categoria} | Rating: ${data.calificacion} | Reseñas: ${data.resenas}`);
            } else {
              console.log(`⚠️  Datos incompletos en artículo ${index}:`, data.nombre || 'Sin nombre');
            }

          } catch (error) {
            console.log(`❌ Error procesando artículo ${index}:`, error.message);
          }
        });

        console.log(`📊 Total extraídos: ${results.length} de ${articles.length} artículos`);
        return results;
      });

      return businesses;

    } catch (error) {
      console.error('❌ Error en extractBusinessListData:', error);
      return [];
    }
  }

  async enrichBusinessesWithDetails(businesses) {
    const enrichedBusinesses = [];
    const totalBusinesses = businesses.length;

    console.log(`📊 Total de negocios a enriquecer: ${totalBusinesses}`);

    for (let i = 0; i < totalBusinesses; i++) {
      const business = businesses[i];
      console.log(`🔍 [${i + 1}/${totalBusinesses}] ${business.nombre}`);

      if (business.url) {
        try {
          const details = await this.getBusinessDetailsComplete(business.url);
          enrichedBusinesses.push({ ...business, ...details });
        } catch (error) {
          console.log(`⚠️ Error en detalles de ${business.nombre}: ${error.message}`);
          // Continuar con el negocio básico sin detalles
          enrichedBusinesses.push(business);
        }
      } else {
        enrichedBusinesses.push(business);
      }

      // Actualizar progreso con negocios enriquecidos parcialmente
      if (this.progressCallback) {
        const detailProgress = 20 + Math.floor(((i + 1) / totalBusinesses) * 70);
        await this.progressCallback(
          detailProgress,
          `Procesando ${i + 1} de ${totalBusinesses}: ${business.nombre.substring(0, 30)}...`,
          enrichedBusinesses.length,
          enrichedBusinesses
        );
      }

      // Pequeña pausa entre negocios
      try {
        await this.page.waitForTimeout(1000);
      } catch (error) {
        console.log(`⚠️ Error en pausa: ${error.message}`);
      }
    }

    if (this.progressCallback) {
      await this.progressCallback(95, `Finalizando...`, enrichedBusinesses.length, enrichedBusinesses);
    }

    return enrichedBusinesses;
  }

  async scrollResults() {
    try {
      await this.page.waitForSelector('[role="feed"]', { timeout: 10000 });

      let previousHeight = 0;
      let unchangedCount = 0;

      // Hacer scroll hasta cargar más resultados (hasta 25 veces o hasta que no carguen más)
      // Reducido de 50 a 25 para optimizar el tiempo con 96+ categorías
      for (let i = 0; i < 25; i++) {
        const currentHeight = await this.page.evaluate(() => {
          const scrollElement = document.querySelector('[role="feed"]');
          if (scrollElement) {
            scrollElement.scrollTop = scrollElement.scrollHeight;
            return scrollElement.scrollHeight;
          }
          return 0;
        });

        await this.page.waitForTimeout(1500); // Reducido de 2000 a 1500ms para optimización

        // Si la altura no cambia, intentar 2 veces más antes de terminar
        if (currentHeight === previousHeight) {
          unchangedCount++;
          if (unchangedCount > 2) { // Reducido de 3 a 2 para optimizar
            console.log('📜 No hay más resultados para cargar');
            break;
          }
        } else {
          unchangedCount = 0;
        }

        previousHeight = currentHeight;
        console.log(`📜 Scroll ${i + 1}/25 - Altura: ${currentHeight}`);
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

      // Obtener detalles de TODOS los negocios (no limitar a 20)
      const enrichedBusinesses = [];
      const totalBusinesses = businesses.length;

      console.log(`📊 Total de negocios encontrados: ${totalBusinesses}`);
      console.log(`🔍 Obteniendo detalles completos de todos...`);

      for (let i = 0; i < totalBusinesses; i++) {
        const business = businesses[i];
        console.log(`🔍 [${i + 1}/${totalBusinesses}] ${business.nombre}`);

        // Actualizar progreso (20% al 90%, el resto del 90-100 es para finalizar)
        if (this.progressCallback) {
          const detailProgress = 20 + Math.floor(((i + 1) / totalBusinesses) * 70);
          this.progressCallback(detailProgress, `Procesando negocio ${i + 1} de ${totalBusinesses}: ${business.nombre.substring(0, 30)}...`);
        }

        if (business.url) {
          try {
            const details = await this.getBusinessDetailsComplete(business.url);
            enrichedBusinesses.push({ ...business, ...details });
          } catch (error) {
            console.log(`⚠️ Error en detalles: ${error.message}`);
            enrichedBusinesses.push(business);
          }
        } else {
          enrichedBusinesses.push(business);
        }

        // Reducir el delay para ir más rápido
        await this.page.waitForTimeout(1000);
      }

      if (this.progressCallback) {
        this.progressCallback(95, `Finalizando...`);
      }

      return enrichedBusinesses;

    } catch (error) {
      console.error('❌ Error en extractAllBusinessData:', error);
      return [];
    }
  }

  async getBusinessDetailsComplete(businessUrl) {
    try {
      console.log(`🔗 Navegando a: ${businessUrl}`);
      await this.page.goto(businessUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000 // Reducido de 60s a 30s
      });
      await this.page.waitForTimeout(3000); // Reducido de 4s a 3s

      // Hacer scroll en la página de detalles para cargar todo el contenido
      try {
        await this.page.evaluate(() => {
          window.scrollBy(0, 500);
        });
        await this.page.waitForTimeout(1000); // Reducido de 1.5s a 1s

        await this.page.evaluate(() => {
          window.scrollBy(0, -500);
        });
        await this.page.waitForTimeout(1000); // Reducido de 1.5s a 1s
      } catch (scrollError) {
        console.log(`⚠️ Error en scroll: ${scrollError.message}`);
      }

      // Intentar hacer click en botón "Mostrar teléfono" ANTES de evaluar
      try {
        await this.page.evaluate(() => {
          const showPhoneButtons = document.querySelectorAll('button, div, span, a');
          for (const btn of showPhoneButtons) {
            const btnText = (btn.textContent || btn.getAttribute('aria-label') || '').toLowerCase();
            if (btnText.includes('mostrar') && (btnText.includes('teléfono') || btnText.includes('número'))) {
              btn.click();
              return true;
            }
          }
          return false;
        });
        // Esperar a que se cargue el teléfono
        await this.page.waitForTimeout(2000);
      } catch (e) {
        // No hay problema si no se encuentra el botón
      }

      const details = await this.page.evaluate(() => {
        const data = {};

        // Dirección completa
        const addressButton = document.querySelector('[data-item-id*="address"]');
        if (addressButton) {
          const addressText = addressButton.getAttribute('aria-label') || '';
          data.direccion = addressText.replace('Dirección: ', '').replace('Address: ', '').trim();
        }

        // ========== TELÉFONO PRINCIPAL - MÉTODOS ULTRA ROBUSTOS ==========
        console.log('🔍 Iniciando búsqueda de teléfono...');

        // ESTRATEGIA 1: Botón de teléfono oficial de Google Maps (MEJORADO)
        const phoneSelectors = [
          '[data-item-id*="phone"]',
          '[data-item-id*="tel"]',
          '[data-tooltip*="phone"]',
          '[data-tooltip*="tel"]',
          '[aria-label*="Phone"]',
          '[aria-label*="Teléfono"]',
          '[aria-label*="Call"]',
          '[aria-label*="Llamar"]',
          'button[data-item-id*="phone"]',
          'button[aria-label*="phone" i]',
          'div[data-item-id*="phone"]',
          'a[data-item-id*="phone"]'
        ];

        for (const selector of phoneSelectors) {
          try {
            const elements = document.querySelectorAll(selector);
            for (const elem of elements) {
              const phoneText = elem.getAttribute('aria-label') ||
                elem.getAttribute('data-tooltip') ||
                elem.getAttribute('title') ||
                elem.textContent ||
                '';

              // Limpiar y extraer número
              const cleanText = phoneText.replace(/Teléfono:?/gi, '')
                .replace(/Phone:?/gi, '')
                .replace(/Llamar/gi, '')
                .replace(/Call/gi, '')
                .trim();

              // Buscar patrón de teléfono en el texto limpio
              const phoneMatch = cleanText.match(/(\+?51[\s-]?)?[9(]?\d{2,3}[\s-]?\d{3}[\s-]?\d{3,4}/);
              if (phoneMatch) {
                data.telefono = phoneMatch[0].trim();
                data.whatsapp = data.telefono;
                console.log(`✅ Teléfono encontrado (Método 1 - ${selector}): ${data.telefono}`);
                break;
              }
            }
            if (data.telefono) break;
          } catch (e) {
            // Continuar con siguiente selector
          }
        }

        // ESTRATEGIA 2: Enlaces tel: en la página (MEJORADO)
        if (!data.telefono) {
          const telLinks = document.querySelectorAll('a[href*="tel:"], a[href*="phone"], a[href*="callto"]');
          for (const link of telLinks) {
            const href = link.getAttribute('href') || '';
            const text = link.textContent || '';

            // Método A: Extraer del href
            let phoneMatch = href.match(/tel:(\+?[\d\s\-().]+)/);
            if (!phoneMatch) {
              // Método B: Extraer del texto del enlace
              phoneMatch = text.match(/(\+?51[\s-]?)?[9(]?\d{2,3}[\s-]?\d{3}[\s-]?\d{3,4}/);
            }

            if (phoneMatch) {
              data.telefono = phoneMatch[phoneMatch.length - 1].trim();
              data.whatsapp = data.telefono;
              console.log(`✅ Teléfono encontrado (Método 2 - tel link): ${data.telefono}`);
              break;
            }
          }
        }

        // Estrategia 3: Botones de acción y elementos clickeables (MEJORADA)
        if (!data.telefono) {
          const actionButtons = document.querySelectorAll('button, a, div[role="button"], span[role="button"], [class*="button"], [class*="btn"]');
          for (const button of actionButtons) {
            // Buscar en múltiples atributos
            const text = button.textContent || '';
            const ariaLabel = button.getAttribute('aria-label') || '';
            const title = button.getAttribute('title') || '';
            const dataPhone = button.getAttribute('data-phone') || button.getAttribute('data-tel') || '';
            const onclick = button.getAttribute('onclick') || '';

            const allText = `${text} ${ariaLabel} ${title} ${dataPhone} ${onclick}`;

            // Buscar patrones de teléfono peruano MEJORADOS
            const phonePatterns = [
              /\+51[\s-]?9\d{2}[\s-]?\d{3}[\s-]?\d{3}/,
              /\+51[\s-]?9\d{8}/,
              /9\d{2}[\s-]?\d{3}[\s-]?\d{3}/,
              /9\d{8}/,
              /\(01\)[\s-]?\d{3}[\s-]?\d{4}/,
              /01[\s-]?\d{3}[\s-]?\d{4}/,
              /\d{3}[\s.-]\d{3}[\s.-]\d{3}/  // Formato genérico 987-654-321
            ];

            for (const pattern of phonePatterns) {
              const phoneMatch = allText.match(pattern);
              if (phoneMatch) {
                const phoneCandidate = phoneMatch[0].trim();
                const digitsOnly = phoneCandidate.replace(/\D/g, '');
                // Validar que tenga al menos 7 dígitos
                if (digitsOnly.length >= 7) {
                  data.telefono = phoneCandidate;
                  data.whatsapp = phoneCandidate;
                  break;
                }
              }
            }
            if (data.telefono) break;
          }
        }

        // ESTRATEGIA 4: Escaneo COMPLETO del HTML y texto visible (ULTRA MEJORADO)
        if (!data.telefono) {
          console.log('🔍 Buscando teléfono en todo el contenido de la página...');

          // Buscar en TODO el texto de la página
          const bodyText = document.body.innerText;
          const bodyHTML = document.body.innerHTML;

          // PATRONES SUPER COMPLETOS para números peruanos
          const phonePatterns = [
            // Móviles con +51 (todas las variaciones)
            /\+51[\s-]?9\d{2}[\s-]?\d{3}[\s-]?\d{3}/,
            /\+51[\s-]?9\d{8}/,
            /\+51[\s.]?9\d{2}[\s.]?\d{3}[\s.]?\d{3}/,  // Con puntos
            /\+51\s?\(\d{3}\)\s?\d{3}[\s-]?\d{3}/,      // Con paréntesis (959) 123 456

            // Móviles sin código de país (más variaciones)
            /(?:^|\D)(9\d{2}[\s-]?\d{3}[\s-]?\d{3})(?:\D|$)/,
            /(?:^|\D)(9\d{8})(?:\D|$)/,
            /(?:^|\D)(9\d{2}[\s.]?\d{3}[\s.]?\d{3})(?:\D|$)/,  // Con puntos
            /\(9\d{2}\)[\s-]?\d{3}[\s-]?\d{3}/,          // (987) 654 321
            /9\d{2}[-.\s]\d{3}[-.\s]\d{3}/,              // 987-654-321 o 987.654.321

            // Teléfonos fijos de Lima (01) - más variaciones
            /\(01\)[\s-]?\d{3}[\s-]?\d{4}/,
            /01[\s-]?\d{3}[\s-]?\d{4}/,
            /\+51[\s-]?1[\s-]?\d{3}[\s-]?\d{4}/,         // +51 1 234 5678
            /\+51[\s-]?\(01\)[\s-]?\d{3}[\s-]?\d{4}/,

            // Teléfonos fijos otras ciudades (0XX) - más variaciones
            /\(0\d{2}\)[\s-]?\d{3}[\s-]?\d{3}/,
            /0\d{2}[\s-]?\d{3}[\s-]?\d{3}/,
            /\+51[\s-]?\d{2}[\s-]?\d{3}[\s-]?\d{3}/,     // +51 44 234 567

            // Formatos con palabras clave cercanas (más específico)
            /(?:tel[eé]fono|phone|celular|m[oó]vil|contacto|llamar|whatsapp|wsp)[\s:]*(\+?51[\s-]?9?\d{2,3}[\s-]?\d{3}[\s-]?\d{3,4})/i,
            /(?:tel[eé]fono|phone|celular|m[oó]vil|contacto|llamar|whatsapp|wsp)[\s:]*(\d{9,11})/i,

            // Formato internacional genérico (más flexible)
            /\+51[\s-]?\d{1,2}[\s-]?\d{3}[\s-]?\d{4}/,
            /\+51[\s-]?\d{9,11}/,

            // Números de 9 dígitos consecutivos (solo si empiezan con 9)
            /\b(9\d{8})\b/,

            // Números con separadores variados
            /9\d{2}[.\s-]\d{3}[.\s-]\d{3}/,
            /\d{3}[.\s-]\d{3}[.\s-]\d{3}/  // Genérico de 9 dígitos
          ];

          // Buscar en TEXTO VISIBLE
          for (const pattern of phonePatterns) {
            const match = bodyText.match(pattern);
            if (match) {
              let phoneCandidate = (match[1] || match[0]).trim();
              const digitsOnly = phoneCandidate.replace(/\D/g, '');
              if (digitsOnly.length >= 7 && digitsOnly.length <= 15) {
                data.telefono = phoneCandidate;
                data.whatsapp = phoneCandidate;
                console.log(`✅ Teléfono encontrado (Método 4A - texto): ${data.telefono}`);
                break;
              }
            }
          }

          // Si aún no encontró, buscar en HTML
          if (!data.telefono) {
            for (const pattern of phonePatterns) {
              const match = bodyHTML.match(pattern);
              if (match) {
                let phoneCandidate = (match[1] || match[0]).trim();
                const digitsOnly = phoneCandidate.replace(/\D/g, '');
                if (digitsOnly.length >= 7 && digitsOnly.length <= 15) {
                  data.telefono = phoneCandidate;
                  data.whatsapp = phoneCandidate;
                  console.log(`✅ Teléfono encontrado (Método 4B - HTML): ${data.telefono}`);
                  break;
                }
              }
            }
          }

          // Si aún no encontró, búsqueda agresiva de CUALQUIER número de 9 dígitos que empiece con 9
          if (!data.telefono) {
            const allNumbers = bodyText.match(/\b9\d{8}\b/g);
            if (allNumbers && allNumbers.length > 0) {
              // Tomar el primer número de 9 dígitos que empiece con 9
              data.telefono = allNumbers[0];
              data.whatsapp = allNumbers[0];
              console.log(`✅ Teléfono encontrado (Método 4C - número 9 dígitos): ${data.telefono}`);
            }
          }
        }

        // Estrategia 5: Buscar en meta tags y atributos ocultos
        if (!data.telefono) {
          const metaTags = document.querySelectorAll('meta[property], meta[name], meta[itemprop]');
          for (const meta of metaTags) {
            const content = meta.getAttribute('content') || '';
            const phoneMatch = content.match(/(\+51[\s-]?[9]\d{2}[\s-]?\d{3}[\s-]?\d{3}|[9]\d{8})/);
            if (phoneMatch) {
              data.telefono = phoneMatch[0].trim();
              data.whatsapp = data.telefono;
              break;
            }
          }
        }

        // Estrategia 6: Buscar en atributos data-* y otros atributos personalizados
        if (!data.telefono) {
          const allElements = document.querySelectorAll('[data-phone], [data-tel], [data-telefono], [data-contact]');
          for (const elem of allElements) {
            const phoneData = elem.getAttribute('data-phone') ||
              elem.getAttribute('data-tel') ||
              elem.getAttribute('data-telefono') ||
              elem.getAttribute('data-contact') || '';
            if (phoneData && phoneData.match(/\d{8,}/)) {
              data.telefono = phoneData.trim();
              data.whatsapp = data.telefono;
              break;
            }
          }
        }

        // ========== LIMPIEZA Y NORMALIZACIÓN FINAL DEL TELÉFONO ==========
        if (data.telefono) {
          console.log(`🧹 Limpiando teléfono: "${data.telefono}"`);

          // Eliminar espacios, guiones, paréntesis, puntos
          let cleanPhone = data.telefono.replace(/[\s\-().]/g, '');

          // Si empieza con 51 sin +, agregar +
          if (cleanPhone.startsWith('51') && !cleanPhone.startsWith('+')) {
            cleanPhone = '+' + cleanPhone;
          }

          // Si es móvil peruano (9 dígitos empezando con 9) y no tiene +51
          if (cleanPhone.match(/^9\d{8}$/)) {
            cleanPhone = '+51' + cleanPhone;
          }

          // Si es fijo de Lima (7 dígitos) y no tiene código
          if (cleanPhone.match(/^\d{7}$/)) {
            cleanPhone = '+5101' + cleanPhone;
          }

          // Si es fijo de otra ciudad (9 dígitos sin +51)
          if (cleanPhone.match(/^0\d{2}\d{6}$/)) {
            cleanPhone = '+51' + cleanPhone.substring(1); // Remover 0 y agregar +51
          }

          data.telefono = cleanPhone;
          data.whatsapp = cleanPhone;
          console.log(`✅ TELÉFONO FINAL: ${cleanPhone}`);
        } else {
          console.log(`❌ NO se encontró teléfono para este negocio`);
        }

        // NOMBRE DEL DUEÑO / CONTACTO (MUY IMPORTANTE PARA LLAMADAS Y CONEXIÓN PERSONAL)
        // Estrategia 1: Buscar en atributos y selectores específicos de Google Maps
        const ownerSelectors = [
          '[class*="owner"]',
          '[class*="contact"]',
          '[class*="proprietor"]',
          '[data-item-id*="owner"]',
          '[data-owner]',
          '[aria-label*="Owner"]',
          '[aria-label*="Propietario"]',
          '[aria-label*="Dueño"]',
          '[aria-label*="Gerente"]',
          '[aria-label*="Manager"]',
          '[aria-label*="Administrador"]',
          '[aria-label*="Director"]'
        ];

        for (const selector of ownerSelectors) {
          const elem = document.querySelector(selector);
          if (elem && elem.textContent.trim() && elem.textContent.length > 3) {
            const name = elem.textContent.trim();
            // Validar que parezca un nombre (2 palabras mínimo)
            if (name.match(/[A-ZÁ-Ú][a-záéíóúñ]+\s+[A-ZÁ-Ú][a-záéíóúñ]+/)) {
              data.nombreContacto = name;
              data.cargo = 'Propietario';
              break;
            }
          }
        }

        // Estrategia 2: Buscar en respuestas del propietario a reseñas
        if (!data.nombreContacto) {
          const ownerResponses = document.querySelectorAll('[class*="owner-response"], [class*="owner"] [class*="response"], [aria-label*="Respuesta del propietario"]');
          for (const response of ownerResponses) {
            const text = response.textContent;
            // Buscar firma al final tipo: "Saludos, Juan Pérez" o "Atentamente, María García"
            const signaturePatterns = [
              /(?:Saludos?|Atentamente|Cordialmente|Gracias),?\s+([A-ZÁ-Ú][a-záéíóúñ]+(?:\s+[A-ZÁ-Ú][a-záéíóúñ]+){1,2})/i,
              /([A-ZÁ-Ú][a-záéíóúñ]+\s+[A-ZÁ-Ú][a-záéíóúñ]+)\s*[-–]\s*(?:Propietario|Gerente|Owner|Manager)/i
            ];

            for (const pattern of signaturePatterns) {
              const match = text.match(pattern);
              if (match) {
                data.nombreContacto = match[1].trim();
                data.cargo = 'Propietario/Gerente';
                break;
              }
            }
            if (data.nombreContacto) break;
          }
        }

        // Estrategia 3: Buscar en la sección "Acerca de" / "About" / "Información"
        if (!data.nombreContacto) {
          const aboutSections = [
            document.querySelector('[aria-label*="Información"]'),
            document.querySelector('[aria-label*="About"]'),
            document.querySelector('[class*="about"]'),
            document.querySelector('[class*="description"]'),
            document.querySelector('[class*="info"]')
          ];

          for (const section of aboutSections) {
            if (!section) continue;
            const text = section.textContent;

            // Patrones más específicos con títulos comunes
            const ownerPatterns = [
              // Español
              /(?:Dueño|Propietario|Gerente General|Gerente|Administrador|Director|Fundador|Contacto|Encargado)[:|\s]+([A-ZÁ-Ú][a-záéíóúñ]+(?:\s+[A-ZÁ-Ú][a-záéíóúñ]+){1,3})/i,
              // Inglés
              /(?:Owner|Proprietor|Manager|Director|Administrator|Founder|Contact)[:|\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/i,
              // Formato "Atendido por"
              /(?:Atendido por|Dirigido por|A cargo de)[:|\s]+([A-ZÁ-Ú][a-záéíóúñ]+(?:\s+[A-ZÁ-Ú][a-záéíóúñ]+){1,2})/i
            ];

            for (const pattern of ownerPatterns) {
              const match = text.match(pattern);
              if (match && match[1]) {
                const extractedName = match[1].trim();
                // Validar que no sea muy largo (máx 4 palabras) y que sean palabras capitalizadas
                if (extractedName.split(/\s+/).length <= 4) {
                  data.nombreContacto = extractedName;
                  data.cargo = match[0].split(/[:|\s]+/)[0]; // Extraer el título
                  break;
                }
              }
            }
            if (data.nombreContacto) break;
          }
        }

        // Estrategia 4: Buscar en el sitio web del negocio si está visible
        if (!data.nombreContacto) {
          const websiteFrame = document.querySelector('iframe[src*="http"]');
          if (websiteFrame) {
            try {
              const frameDoc = websiteFrame.contentDocument || websiteFrame.contentWindow.document;
              if (frameDoc) {
                const frameText = frameDoc.body.innerText;
                const ownerMatch = frameText.match(/(?:Propietario|Dueño|Gerente|Owner|Manager)[:|\s]+([A-ZÁ-Ú][a-záéíóúñ]+\s+[A-ZÁ-Ú][a-záéíóúñ]+)/i);
                if (ownerMatch) {
                  data.nombreContacto = ownerMatch[1].trim();
                  data.cargo = ownerMatch[0].split(/[:|\s]+/)[0];
                }
              }
            } catch (e) {
              // Iframe puede estar bloqueado por CORS
            }
          }
        }

        // Estrategia 5: Buscar en meta tags y structured data (JSON-LD)
        if (!data.nombreContacto) {
          // Buscar en JSON-LD
          const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
          for (const script of jsonLdScripts) {
            try {
              const jsonData = JSON.parse(script.textContent);
              if (jsonData.founder || jsonData.owner || jsonData.contactPoint) {
                const person = jsonData.founder || jsonData.owner || jsonData.contactPoint;
                if (person.name) {
                  data.nombreContacto = person.name;
                  data.cargo = 'Propietario';
                  break;
                }
              }
            } catch (e) {
              // JSON inválido
            }
          }
        }

        // Estrategia 6: Buscar en cualquier parte del texto visible (más agresivo)
        if (!data.nombreContacto) {
          const bodyText = document.body.innerText;

          // Patrones genéricos para capturar nombres en contexto de negocios
          const generalPatterns = [
            // Con título profesional
            /(?:Propietario|Dueño|Gerente|Administrador|Director|Fundador|Encargado|Contacto|Owner|Manager|Director|Founder)[:|\s]+([A-ZÁ-Ú][a-záéíóúñ]+(?:\s+[A-ZÁ-Ú][a-záéíóúñ]+){1,2})/gi,
            // Atención personalizada
            /(?:Le atiende|Atendido por|A cargo de|Consulte con)[:|\s]+([A-ZÁ-Ú][a-záéíóúñ]+\s+[A-ZÁ-Ú][a-záéíóúñ]+)/i,
            // Firma de correo
            /(?:Saludos|Atentamente|Cordialmente),?\s+([A-ZÁ-Ú][a-záéíóúñ]+\s+[A-ZÁ-Ú][a-záéíóúñ]+)/i
          ];

          for (const pattern of generalPatterns) {
            const match = bodyText.match(pattern);
            if (match && match[1]) {
              const name = match[1].trim();
              // Validar que no sea una frase común
              const excludedWords = ['Google Maps', 'Más Información', 'Ver Más', 'Click Aquí', 'Página Web'];
              if (!excludedWords.some(excluded => name.includes(excluded))) {
                data.nombreContacto = name;
                data.cargo = 'Contacto';
                break;
              }
            }
          }
        }

        // Estrategia 7: Si todo falla, intentar extraer de la URL de redes sociales
        if (!data.nombreContacto) {
          const socialLinks = document.querySelectorAll('a[href*="facebook.com"], a[href*="instagram.com"]');
          for (const link of socialLinks) {
            const href = link.getAttribute('href') || '';
            // Extraer nombre de usuario que podría ser el nombre del dueño
            const usernameMatch = href.match(/(?:facebook|instagram)\.com\/([^/?]+)/);
            if (usernameMatch && usernameMatch[1]) {
              const username = usernameMatch[1];
              // Si el username parece un nombre real (sin números, guiones, etc.)
              if (username.match(/^[A-Za-z]+[A-Za-z]*$/)) {
                // Capitalizar primera letra
                data.nombreContacto = username.charAt(0).toUpperCase() + username.slice(1);
                data.cargo = 'Contacto (Red social)';
                break;
              }
            }
          }
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

        // Redes sociales - buscar en TODO el contenido
        const allLinks = Array.from(document.querySelectorAll('a[href]'));
        allLinks.forEach(link => {
          const href = link.getAttribute('href') || '';
          if (href.includes('facebook.com') && !data.facebook) {
            data.facebook = href.split('?')[0]; // Limpiar query params
          }
          if (href.includes('instagram.com') && !data.instagram) {
            data.instagram = href.split('?')[0];
          }
          if (href.includes('tiktok.com') && !data.tiktok) {
            data.tiktok = href.split('?')[0];
          }
          if (href.includes('linkedin.com') && !data.linkedin) {
            data.linkedin = href.split('?')[0];
          }
          if (href.includes('twitter.com') && !data.twitter) {
            data.twitter = href.split('?')[0];
          }
          if (href.includes('youtube.com') && !data.youtube) {
            data.youtube = href.split('?')[0];
          }
        });

        // Horarios de atención
        const hoursButton = document.querySelector('[data-item-id="oh"]');
        if (hoursButton) {
          const hoursText = hoursButton.getAttribute('aria-label') || '';
          data.horarios = hoursText;

          if (hoursText.toLowerCase().includes('abierto') || hoursText.toLowerCase().includes('open')) {
            data.estado = 'Abierto';
          } else if (hoursText.toLowerCase().includes('cerrado') || hoursText.toLowerCase().includes('closed')) {
            data.estado = 'Cerrado';
          }
        }

        // EMAIL DE CONTACTO (IMPORTANTE PARA COMUNICACIÓN PROFESIONAL)
        // Estrategia 1: Buscar en links mailto:
        const mailtoLinks = document.querySelectorAll('a[href^="mailto:"]');
        if (mailtoLinks.length > 0) {
          for (const link of mailtoLinks) {
            const href = link.getAttribute('href') || '';
            const emailMatch = href.match(/mailto:([^\s?]+)/);
            if (emailMatch) {
              const email = emailMatch[1].toLowerCase();
              // Validar que no sea email de sistemas
              if (!email.includes('noreply') && !email.includes('no-reply')) {
                if (!data.email) {
                  data.email = email;
                } else if (!data.email2) {
                  data.email2 = email;
                }
              }
            }
          }
        }

        // Estrategia 2: Buscar en atributos data-email o similares
        if (!data.email) {
          const emailElements = document.querySelectorAll('[data-email], [data-mail], [data-contact-email]');
          for (const elem of emailElements) {
            const emailData = elem.getAttribute('data-email') ||
              elem.getAttribute('data-mail') ||
              elem.getAttribute('data-contact-email');
            if (emailData && emailData.includes('@')) {
              data.email = emailData.toLowerCase();
              break;
            }
          }
        }

        // Estrategia 3: Buscar en meta tags
        if (!data.email) {
          const metaTags = document.querySelectorAll('meta[name*="email"], meta[property*="email"], meta[itemprop*="email"]');
          for (const meta of metaTags) {
            const content = meta.getAttribute('content');
            if (content && content.includes('@')) {
              data.email = content.toLowerCase();
              break;
            }
          }
        }

        // Estrategia 4: Buscar en structured data (JSON-LD)
        if (!data.email) {
          const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
          for (const script of jsonLdScripts) {
            try {
              const jsonData = JSON.parse(script.textContent);
              if (jsonData.email) {
                data.email = jsonData.email.toLowerCase();
                break;
              }
              if (jsonData.contactPoint && jsonData.contactPoint.email) {
                data.email = jsonData.contactPoint.email.toLowerCase();
                break;
              }
            } catch (e) {
              // JSON inválido
            }
          }
        }

        // Estrategia 5: Buscar en TODO el texto visible con patrones mejorados
        if (!data.email) {
          const bodyText = document.body.innerText;

          // Patrón mejorado para emails
          const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
          const emailMatches = bodyText.match(emailPattern);

          if (emailMatches && emailMatches.length > 0) {
            // Lista de dominios y palabras a excluir
            const excludedDomains = [
              'google.com', 'gstatic.com', 'example.com', 'test.com',
              'googleapis.com', 'googleusercontent.com', 'gmail.com.invalid',
              'noreply', 'no-reply', 'donotreply'
            ];

            // Filtrar emails válidos
            const validEmails = emailMatches.filter(email => {
              const emailLower = email.toLowerCase();
              return !excludedDomains.some(excluded => emailLower.includes(excluded));
            });

            // Priorizar emails corporativos sobre emails de Gmail/Hotmail
            const corporateEmails = validEmails.filter(email => {
              const emailLower = email.toLowerCase();
              return !emailLower.includes('gmail.') &&
                !emailLower.includes('hotmail.') &&
                !emailLower.includes('outlook.') &&
                !emailLower.includes('yahoo.');
            });

            // Usar email corporativo si existe, sino usar cualquier válido
            const emailsToUse = corporateEmails.length > 0 ? corporateEmails : validEmails;

            if (emailsToUse.length > 0) {
              data.email = emailsToUse[0].toLowerCase();
              if (emailsToUse.length > 1) {
                data.email2 = emailsToUse[1].toLowerCase();
              }
            }
          }
        }

        // Estrategia 6: Buscar en botones o secciones de contacto
        if (!data.email) {
          const contactSections = document.querySelectorAll(
            '[class*="contact"], [class*="email"], [id*="contact"], [id*="email"], [aria-label*="contact"], [aria-label*="email"]'
          );

          for (const section of contactSections) {
            const text = section.textContent || section.getAttribute('aria-label') || '';
            const emailMatch = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
            if (emailMatch) {
              const email = emailMatch[0].toLowerCase();
              if (!email.includes('google.') && !email.includes('example.')) {
                data.email = email;
                break;
              }
            }
          }
        }

        // Estrategia 7: Buscar en el sitio web del negocio si hay iframe
        if (!data.email) {
          const websiteFrame = document.querySelector('iframe[src*="http"]');
          if (websiteFrame) {
            try {
              const frameDoc = websiteFrame.contentDocument || websiteFrame.contentWindow.document;
              if (frameDoc) {
                const frameText = frameDoc.body.innerText;
                const emailMatch = frameText.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
                if (emailMatch) {
                  data.email = emailMatch[0].toLowerCase();
                }
              }
            } catch (e) {
              // Iframe bloqueado por CORS
            }
          }
        }

        // Descripción del negocio
        const descSection = document.querySelector('[class*="description"]') ||
          document.querySelector('[aria-label*="Descripción"]');
        if (descSection) {
          data.descripcion = descSection.textContent.trim().substring(0, 200);
        }

        return data;
      });

      return details;
    } catch (error) {
      console.log('⚠️ Error en detalles completos:', error.message);
      return {};
    }
  }

  async getBusinessDetails(businessUrl) {
    return this.getBusinessDetailsComplete(businessUrl);
  }

  // FUNCIÓN CRÍTICA: Validar que el negocio tenga datos MÍNIMOS ÚTILES para contacto
  hasMinimumRequiredData(business) {
    // REGLA FUNDAMENTAL: Un negocio DEBE tener al menos:
    // 1. Nombre del negocio (obligatorio)
    // 2. Dirección válida (obligatorio para localización)
    // 3. Teléfono O Email (OPCIONAL - ahora se permiten negocios sin contacto directo)

    // Validar nombre del negocio
    const tieneNombre = business.nombre && business.nombre.length > 2 && business.nombre !== 'Sin nombre';

    // Validar dirección completa (más flexible - mínimo 5 caracteres)
    const tieneDireccion = business.direccion && business.direccion.length > 5;

    // REQUISITO MÍNIMO REDUCIDO: Solo Nombre + Dirección
    // Esto permite capturar negocios incluso sin teléfono/email
    const cumpleRequisitos = tieneNombre && tieneDireccion;

    if (!cumpleRequisitos) {
      const razon = [];
      if (!tieneNombre) razon.push('sin nombre válido');
      if (!tieneDireccion) razon.push('sin dirección');

      console.log(`🚫 Filtrado (datos mínimos): ${business.nombre || 'Sin nombre'} - ${razon.join(', ')}`);
      return false;
    }

    // Advertencia si no tiene contacto (pero NO se filtra)
    const tieneTelefono = business.telefono && business.telefono.length >= 9;
    const tieneEmail = business.email && business.email.includes('@') && business.email.includes('.');

    if (!tieneTelefono && !tieneEmail) {
      console.log(`⚠️  Negocio sin contacto directo: ${business.nombre} (se incluirá de todos modos)`);
    }

    return true;
  }

  async close() {
    if (this.browser) {
      try {
        console.log('🔒 Cerrando navegador...');
        // Cerrar páginas primero
        const pages = await this.browser.pages();
        for (const page of pages) {
          try {
            await page.close();
          } catch (error) {
            console.log(`⚠️ Error cerrando página: ${error.message}`);
          }
        }

        // Luego cerrar el navegador
        await this.browser.close();
        console.log('✅ Navegador cerrado correctamente');
      } catch (error) {
        console.log(`⚠️ Error al cerrar navegador: ${error.message}`);
        // Intentar matar el proceso si el cierre normal falla
        try {
          await this.browser.process().kill('SIGKILL');
        } catch (killError) {
          console.log(`⚠️ No se pudo forzar cierre: ${killError.message}`);
        }
      } finally {
        this.browser = null;
        this.page = null;
      }
    }
  }
}

module.exports = GoogleMapsScraper;
