/**
 * Test simple para verificar la extracción de teléfonos en Google Maps
 * Compatible con Windows y Linux
 */

const puppeteer = require('puppeteer');

async function testPhoneExtraction() {
    console.log('🧪 Iniciando prueba de extracción de teléfono...\n');
    console.log(`🖥️  Sistema operativo: ${process.platform}\n`);

    // Configurar Puppeteer según el SO
    const launchOptions = {
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
    };

    // Solo en Linux especificar la ruta
    if (process.platform === 'linux') {
        launchOptions.executablePath = '/usr/bin/chromium-browser';
    }

    let browser;
    try {
        browser = await puppeteer.launch(launchOptions);
        const page = await browser.newPage();

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1920, height: 1080 });

        // Buscar restaurantes en Cusco
        const searchUrl = 'https://www.google.com/maps/search/restaurantes+en+cusco+peru';
        console.log(`📍 Navegando a: ${searchUrl}\n`);

        await page.goto(searchUrl, { waitUntil: 'networkidle0', timeout: 60000 });
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Esperar y obtener los primeros resultados
        await page.waitForSelector('[role="feed"]', { timeout: 15000 });

        // Hacer scroll para cargar más resultados
        console.log('📜 Haciendo scroll para cargar resultados...');
        for (let i = 0; i < 3; i++) {
            await page.evaluate(() => {
                const feed = document.querySelector('[role="feed"]');
                if (feed) feed.scrollTop = feed.scrollHeight;
            });
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // Obtener las URLs de los primeros 5 negocios
        const businessUrls = await page.evaluate(() => {
            const articles = document.querySelectorAll('div[role="article"]');
            const urls = [];

            articles.forEach((article, index) => {
                if (index < 5) {
                    const linkElement = article.querySelector('a[href*="/maps/place/"]');
                    const nameElement = article.querySelector('div[class*="fontHeadlineSmall"]');

                    if (linkElement) {
                        urls.push({
                            url: linkElement.getAttribute('href'),
                            name: nameElement?.textContent || 'Sin nombre'
                        });
                    }
                }
            });

            return urls;
        });

        console.log(`\n✅ Encontrados ${businessUrls.length} negocios para analizar\n`);
        console.log('='.repeat(80));

        // Visitar cada negocio y buscar teléfono
        for (let i = 0; i < businessUrls.length; i++) {
            const business = businessUrls[i];
            console.log(`\n🔍 [${i + 1}/${businessUrls.length}] Analizando: ${business.name}`);

            try {
                await page.goto(business.url, { waitUntil: 'networkidle0', timeout: 60000 });
                await new Promise(resolve => setTimeout(resolve, 4000));

                // Hacer scroll
                await page.evaluate(() => window.scrollBy(0, 500));
                await new Promise(resolve => setTimeout(resolve, 1500));
                await page.evaluate(() => window.scrollBy(0, -500));
                await new Promise(resolve => setTimeout(resolve, 1500));

                // Extraer información de la página
                const details = await page.evaluate(() => {
                    const data = { telefono: null, metodo: null };

                    // MÉTODO 1: Botón de teléfono [data-item-id*="phone"]
                    const phoneButton = document.querySelector('button[data-item-id*="phone"], div[data-item-id*="phone"], a[data-item-id*="phone"]');
                    if (phoneButton) {
                        const ariaLabel = phoneButton.getAttribute('aria-label') || '';
                        console.log('Encontrado botón de teléfono con aria-label:', ariaLabel);

                        // Extraer número del aria-label
                        const phoneMatch = ariaLabel.match(/(\+?51[\s-]?)?[9]?\d{2,3}[\s-]?\d{3}[\s-]?\d{3,4}/);
                        if (phoneMatch) {
                            data.telefono = phoneMatch[0].trim();
                            data.metodo = 'data-item-id phone button';
                            return data;
                        }
                    }

                    // MÉTODO 2: Enlaces tel:
                    const telLink = document.querySelector('a[href^="tel:"]');
                    if (telLink) {
                        const href = telLink.getAttribute('href') || '';
                        const phone = href.replace('tel:', '').trim();
                        if (phone) {
                            data.telefono = phone;
                            data.metodo = 'tel: link';
                            return data;
                        }
                    }

                    // MÉTODO 3: Buscar en aria-labels que contengan "teléfono" o "phone"
                    const allButtons = document.querySelectorAll('button[aria-label], a[aria-label], div[aria-label]');
                    for (const btn of allButtons) {
                        const label = (btn.getAttribute('aria-label') || '').toLowerCase();
                        if (label.includes('teléfono') || label.includes('phone') || label.includes('llamar') || label.includes('call')) {
                            const phoneMatch = label.match(/(\+?51[\s-]?)?[9]?\d{2,3}[\s-]?\d{3}[\s-]?\d{3,4}/);
                            if (phoneMatch) {
                                data.telefono = phoneMatch[0].trim();
                                data.metodo = 'aria-label con keyword';
                                return data;
                            }
                        }
                    }

                    // MÉTODO 4: Escanear todo el texto visible
                    const bodyText = document.body.innerText;
                    const phonePatterns = [
                        /\+51[\s-]?9\d{2}[\s-]?\d{3}[\s-]?\d{3}/,
                        /(?:^|\D)(9\d{2}[\s-]?\d{3}[\s-]?\d{3})(?:\D|$)/,
                        /\b9\d{8}\b/,
                        /\(01\)[\s-]?\d{3}[\s-]?\d{4}/
                    ];

                    for (const pattern of phonePatterns) {
                        const match = bodyText.match(pattern);
                        if (match) {
                            data.telefono = (match[1] || match[0]).trim();
                            data.metodo = 'text scan pattern: ' + pattern.toString();
                            return data;
                        }
                    }

                    return data;
                });

                if (details.telefono) {
                    console.log(`   📞 TELÉFONO ENCONTRADO: ${details.telefono}`);
                    console.log(`   🛠️  Método: ${details.metodo}`);
                } else {
                    console.log('   ❌ No se encontró teléfono');

                    // Tomar screenshot para debug
                    const screenshotPath = `./debug-no-phone-${i + 1}.png`;
                    await page.screenshot({ path: screenshotPath, fullPage: false });
                    console.log(`   📸 Screenshot guardado: ${screenshotPath}`);
                }

            } catch (error) {
                console.log(`   ⚠️ Error: ${error.message}`);
            }
        }

        console.log('\n' + '='.repeat(80));
        console.log('✅ Prueba completada');

    } catch (error) {
        console.error('❌ Error general:', error.message);
    } finally {
        if (browser) await browser.close();
    }
}

testPhoneExtraction();
