const puppeteer = require('puppeteer');

async function testSimplePhoneExtraction() {
  console.log('🧪 Iniciando prueba SIMPLE de extracción de teléfono...\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/usr/bin/chromium-browser',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  // URL de un negocio específico de ejemplo en Cusco
  const businessUrl = 'https://www.google.com/maps/place/Sagrado+restaurante/@-13.5164239,-71.9798189,17z/data=!3m1!4b1!4m6!3m5!1s0x916dd7fadfbb3483:0xb66f4cc638ca5409!8m2!3d-13.5164239!4d-71.9798189!16s%2Fg%2F11pdgv0_0x';

  console.log(`📍 Navegando a: ${businessUrl}\n`);
  await page.goto(businessUrl, { waitUntil: 'networkidle0', timeout: 60000 });

  console.log('⏳ Esperando que la página cargue completamente...\n');
  await page.waitForTimeout(8000);

  // Hacer scroll para asegurar que todo se cargue
  console.log('📜 Haciendo scroll para cargar contenido...\n');
  await page.evaluate(() => {
    window.scrollBy(0, 300);
  });
  await page.waitForTimeout(2000);

  // MÉTODO 1: Buscar botón con "phone" o "teléfono" y hacer clic
  console.log('=== MÉTODO 1: Buscar y hacer clic en botón de teléfono ===\n');

  const phoneButtonClicked = await page.evaluate(() => {
    // Buscar todos los botones
    const allButtons = document.querySelectorAll('button, div[role="button"], a');

    for (const btn of allButtons) {
      const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
      const dataItemId = (btn.getAttribute('data-item-id') || '').toLowerCase();
      const text = (btn.textContent || '').toLowerCase();

      console.log(`Botón encontrado: aria-label="${ariaLabel}", data-item-id="${dataItemId}", text="${text.substring(0, 50)}"`);

      // Buscar botones relacionados con teléfono
      if (ariaLabel.includes('phone') || ariaLabel.includes('teléfono') ||
          dataItemId.includes('phone') || dataItemId.includes('tel')) {
        console.log(`✅ ENCONTRADO botón de teléfono: ${ariaLabel || dataItemId}`);
        btn.click();
        return true;
      }
    }
    return false;
  });

  console.log(`Botón de teléfono clickeado: ${phoneButtonClicked}\n`);

  if (phoneButtonClicked) {
    await page.waitForTimeout(3000);
  }

  // MÉTODO 2: Buscar el número en data-item-id="phone" después del clic
  console.log('=== MÉTODO 2: Buscar elementos con data-item-id phone ===\n');

  const phoneFromDataItem = await page.evaluate(() => {
    const phoneElements = document.querySelectorAll('[data-item-id*="phone"]');
    const results = [];

    phoneElements.forEach(elem => {
      const ariaLabel = elem.getAttribute('aria-label') || '';
      const innerHTML = elem.innerHTML || '';
      const textContent = elem.textContent || '';

      results.push({
        tag: elem.tagName,
        ariaLabel: ariaLabel.substring(0, 100),
        textContent: textContent.substring(0, 100),
        dataItemId: elem.getAttribute('data-item-id')
      });
    });

    return results;
  });

  console.log('Elementos con data-item-id phone:');
  console.log(JSON.stringify(phoneFromDataItem, null, 2));
  console.log('\n');

  // MÉTODO 3: Buscar en TODO el texto de la página
  console.log('=== MÉTODO 3: Buscar en todo el texto visible ===\n');

  const phoneFromText = await page.evaluate(() => {
    const bodyText = document.body.innerText;

    // Patrones para números peruanos
    const patterns = [
      /\+51[\s-]?9\d{2}[\s-]?\d{3}[\s-]?\d{3}/g,
      /9\d{2}[\s-]?\d{3}[\s-]?\d{3}/g,
      /\(?\+?51\)?[\s-]?9\d{8}/g,
      /\b9\d{8}\b/g
    ];

    const found = {};
    patterns.forEach((pattern, i) => {
      const matches = bodyText.match(pattern);
      if (matches && matches.length > 0) {
        found[`patron_${i + 1}`] = [...new Set(matches)]; // Eliminar duplicados
      }
    });

    // También buscar el primer fragmento de texto que contenga "phone" o "teléfono"
    const lines = bodyText.split('\n');
    const phoneLines = lines.filter(line =>
      line.toLowerCase().includes('phone') ||
      line.toLowerCase().includes('teléfono') ||
      line.toLowerCase().includes('call')
    );

    return {
      numbersFound: found,
      phoneRelatedLines: phoneLines.slice(0, 10)
    };
  });

  console.log('Números encontrados:');
  console.log(JSON.stringify(phoneFromText, null, 2));
  console.log('\n');

  // MÉTODO 4: Capturar TODO el contenido del panel de información
  console.log('=== MÉTODO 4: Capturar panel completo de información ===\n');

  const infoPanel = await page.evaluate(() => {
    // Buscar el panel principal de información
    const mainPanel = document.querySelector('[role="main"]');
    if (mainPanel) {
      return {
        text: mainPanel.innerText.substring(0, 1000),
        buttonsWithPhone: Array.from(mainPanel.querySelectorAll('button')).map(btn => ({
          ariaLabel: btn.getAttribute('aria-label'),
          dataItemId: btn.getAttribute('data-item-id'),
          text: btn.textContent.substring(0, 50)
        })).filter(btn =>
          (btn.ariaLabel && btn.ariaLabel.toLowerCase().includes('phone')) ||
          (btn.dataItemId && btn.dataItemId.toLowerCase().includes('phone'))
        )
      };
    }
    return null;
  });

  console.log('Panel de información:');
  console.log(JSON.stringify(infoPanel, null, 2));
  console.log('\n');

  // RESUMEN FINAL
  console.log('=== RESUMEN DE EXTRACCIÓN ===\n');

  let phoneNumber = null;

  // Intentar extraer de los resultados
  if (phoneFromDataItem.length > 0 && phoneFromDataItem[0].ariaLabel) {
    const match = phoneFromDataItem[0].ariaLabel.match(/[\d\s\-+()]+/);
    if (match) {
      phoneNumber = match[0].trim();
    }
  }

  if (!phoneNumber && phoneFromText.numbersFound) {
    const allNumbers = Object.values(phoneFromText.numbersFound).flat();
    if (allNumbers.length > 0) {
      phoneNumber = allNumbers[0];
    }
  }

  if (phoneNumber) {
    console.log(`✅ ¡TELÉFONO ENCONTRADO! ${phoneNumber}`);
  } else {
    console.log('❌ No se pudo extraer el número de teléfono');
  }

  // Tomar screenshot para análisis visual
  await page.screenshot({ path: '/home/ubuntu/test-screenshot-simple.png', fullPage: true });
  console.log('\n📸 Screenshot guardado en: /home/ubuntu/test-screenshot-simple.png');

  await browser.close();
  console.log('\n✅ Prueba completada');
}

testSimplePhoneExtraction().catch(console.error);
