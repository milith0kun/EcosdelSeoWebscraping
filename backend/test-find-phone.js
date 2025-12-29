const puppeteer = require('puppeteer');

async function findBusinessWithPhone() {
  console.log('🔍 Buscando negocios con teléfono visible...\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/usr/bin/chromium-browser',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  // Buscar restaurantes en Cusco
  const searchUrl = 'https://www.google.com/maps/search/restaurantes+cusco+peru';

  console.log(`📍 Navegando a: ${searchUrl}\n`);
  await page.goto(searchUrl, { waitUntil: 'networkidle0', timeout: 60000 });

  console.log('⏳ Esperando que los resultados carguen...\n');
  await page.waitForTimeout(5000);

  // Esperar el feed de resultados
  await page.waitForSelector('[role="feed"]', { timeout: 10000 });

  // Extraer las primeras 10 URLs de negocios
  const businessUrls = await page.evaluate(() => {
    const articles = document.querySelectorAll('div[role="article"]');
    const urls = [];

    articles.forEach((article, index) => {
      if (index < 10) {
        const linkElement = article.querySelector('a[href*="/maps/place/"]');
        if (linkElement) {
          const href = linkElement.getAttribute('href');
          const fullUrl = href.startsWith('http') ? href : 'https://www.google.com' + href;

          // Extraer nombre
          const ariaLabel = linkElement.getAttribute('aria-label');

          urls.push({
            url: fullUrl,
            name: ariaLabel || 'Sin nombre'
          });
        }
      }
    });

    return urls;
  });

  console.log(`✅ Encontrados ${businessUrls.length} negocios\n`);

  // Ahora visitar cada negocio y buscar el teléfono
  for (let i = 0; i < businessUrls.length; i++) {
    const business = businessUrls[i];
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🔍 [${i + 1}/${businessUrls.length}] Revisando: ${business.name}`);
    console.log(`🔗 URL: ${business.url}`);
    console.log('='.repeat(80));

    try {
      await page.goto(business.url, { waitUntil: 'networkidle0', timeout: 60000 });
      await page.waitForTimeout(5000);

      // Hacer scroll
      await page.evaluate(() => window.scrollBy(0, 300));
      await page.waitForTimeout(2000);

      // Buscar botón de teléfono directamente en el HTML
      const phoneData = await page.evaluate(() => {
        // Método 1: Buscar button con data-item-id que contenga "phone"
        const phoneButton = document.querySelector('button[data-item-id*="phone"]');
        if (phoneButton) {
          const ariaLabel = phoneButton.getAttribute('aria-label') || '';
          console.log(`Botón encontrado con aria-label: "${ariaLabel}"`);

          // Intentar extraer el número del aria-label
          const phoneMatch = ariaLabel.match(/(\+?51[\s-]?9?\d{2,3}[\s-]?\d{3}[\s-]?\d{3,4})/);
          if (phoneMatch) {
            return {
              method: 'button-aria-label',
              phone: phoneMatch[0],
              fullLabel: ariaLabel
            };
          }

          // Hacer clic en el botón para revelar el teléfono
          phoneButton.click();
          return {
            method: 'button-clicked',
            clicked: true,
            ariaLabel: ariaLabel
          };
        }

        // Método 2: Buscar enlaces tel:
        const telLink = document.querySelector('a[href^="tel:"]');
        if (telLink) {
          const href = telLink.getAttribute('href');
          const phone = href.replace('tel:', '').trim();
          return {
            method: 'tel-link',
            phone: phone
          };
        }

        // Método 3: Buscar en todo el texto visible
        const bodyText = document.body.innerText;
        const phonePatterns = [
          /\+51[\s-]?9\d{2}[\s-]?\d{3}[\s-]?\d{3}/,
          /9\d{2}[\s-]?\d{3}[\s-]?\d{3}/,
          /\b9\d{8}\b/
        ];

        for (const pattern of phonePatterns) {
          const match = bodyText.match(pattern);
          if (match) {
            return {
              method: 'text-scan',
              phone: match[0]
            };
          }
        }

        return null;
      });

      if (phoneData) {
        console.log(`\n📱 DATOS ENCONTRADOS:`);
        console.log(JSON.stringify(phoneData, null, 2));

        if (phoneData.clicked) {
          // Esperar después del clic y buscar de nuevo
          await page.waitForTimeout(3000);

          const phoneAfterClick = await page.evaluate(() => {
            const bodyText = document.body.innerText;
            const phonePatterns = [
              /\+51[\s-]?9\d{2}[\s-]?\d{3}[\s-]?\d{3}/,
              /9\d{2}[\s-]?\d{3}[\s-]?\d{3}/,
              /\b9\d{8}\b/
            ];

            for (const pattern of phonePatterns) {
              const match = bodyText.match(pattern);
              if (match) {
                return match[0];
              }
            }

            // Buscar en el aria-label actualizado del botón
            const phoneButton = document.querySelector('button[data-item-id*="phone"]');
            if (phoneButton) {
              const ariaLabel = phoneButton.getAttribute('aria-label') || '';
              const match = ariaLabel.match(/(\+?51[\s-]?9?\d{2,3}[\s-]?\d{3}[\s-]?\d{3,4})/);
              if (match) {
                return match[0];
              }
            }

            return null;
          });

          if (phoneAfterClick) {
            console.log(`\n✅ ¡TELÉFONO ENCONTRADO DESPUÉS DEL CLIC!`);
            console.log(`📞 Negocio: ${business.name}`);
            console.log(`📱 Teléfono: ${phoneAfterClick}`);
            console.log(`🔗 URL: ${business.url}`);

            // Guardar screenshot
            await page.screenshot({
              path: `/home/ubuntu/success-phone-${i}.png`,
              fullPage: true
            });

            console.log(`📸 Screenshot guardado: /home/ubuntu/success-phone-${i}.png`);

            // ¡Éxito! Terminamos aquí
            await browser.close();
            return {
              business: business.name,
              phone: phoneAfterClick,
              url: business.url,
              method: 'button-click'
            };
          } else {
            console.log('❌ No se encontró teléfono después del clic');
          }
        } else if (phoneData.phone) {
          console.log(`\n✅ ¡TELÉFONO ENCONTRADO!`);
          console.log(`📞 Negocio: ${business.name}`);
          console.log(`📱 Teléfono: ${phoneData.phone}`);
          console.log(`🔗 URL: ${business.url}`);
          console.log(`🛠️  Método: ${phoneData.method}`);

          // Guardar screenshot
          await page.screenshot({
            path: `/home/ubuntu/success-phone-${i}.png`,
            fullPage: true
          });

          console.log(`📸 Screenshot guardado: /home/ubuntu/success-phone-${i}.png`);

          // ¡Éxito! Terminamos aquí
          await browser.close();
          return {
            business: business.name,
            phone: phoneData.phone,
            url: business.url,
            method: phoneData.method
          };
        }
      } else {
        console.log('❌ No se encontraron datos de teléfono');
      }

    } catch (error) {
      console.log(`⚠️ Error procesando negocio: ${error.message}`);
    }

    // Pequeña pausa entre negocios
    await page.waitForTimeout(1000);
  }

  await browser.close();
  console.log('\n❌ No se encontró ningún negocio con teléfono visible');
  return null;
}

findBusinessWithPhone()
  .then(result => {
    if (result) {
      console.log('\n' + '='.repeat(80));
      console.log('✅ RESULTADO FINAL:');
      console.log('='.repeat(80));
      console.log(JSON.stringify(result, null, 2));
    }
  })
  .catch(console.error);
