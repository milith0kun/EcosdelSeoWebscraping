const puppeteer = require('puppeteer');

async function testPhoneExtraction() {
  console.log('🧪 Iniciando prueba de extracción de teléfono...\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/usr/bin/chromium-browser',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  // URL de un negocio específico de ejemplo en Cusco
  const businessUrl = 'https://www.google.com/maps/place/Sagrado+restaurante/data=!4m7!3m6!1s0x916dd7fadfbb3483:0xb66f4cc638ca5409!8m2!3d-13.5164239!4d-71.9798189!16s%2Fg%2F11pdgv0_0x';

  console.log(`📍 Navegando a: ${businessUrl}\n`);
  await page.goto(businessUrl, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForTimeout(5000);

  // Hacer scroll para cargar todo
  await page.evaluate(() => window.scrollBy(0, 500));
  await page.waitForTimeout(2000);

  console.log('📸 Capturando estructura de la página...\n');

  // Método 1: Buscar TODOS los elementos con aria-label que contengan números
  console.log('=== MÉTODO 1: Buscar aria-labels con números ===');
  const ariaLabels = await page.evaluate(() => {
    const elements = document.querySelectorAll('[aria-label]');
    const results = [];
    elements.forEach(el => {
      const label = el.getAttribute('aria-label');
      if (label && label.match(/\d{3,}/)) {
        results.push({
          tag: el.tagName,
          label: label,
          class: el.className,
          dataItemId: el.getAttribute('data-item-id') || 'none'
        });
      }
    });
    return results;
  });
  console.log('Elementos con aria-label que contienen números:');
  console.log(JSON.stringify(ariaLabels, null, 2));
  console.log('\n');

  // Método 2: Buscar TODOS los botones
  console.log('=== MÉTODO 2: Buscar todos los botones ===');
  const buttons = await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    const results = [];
    btns.forEach(btn => {
      const text = btn.textContent || '';
      const ariaLabel = btn.getAttribute('aria-label') || '';
      const dataItemId = btn.getAttribute('data-item-id') || '';

      if (text.toLowerCase().includes('phone') ||
          text.toLowerCase().includes('tel') ||
          ariaLabel.toLowerCase().includes('phone') ||
          ariaLabel.toLowerCase().includes('tel') ||
          dataItemId.includes('phone') ||
          dataItemId.includes('tel')) {
        results.push({
          text: text.substring(0, 100),
          ariaLabel: ariaLabel.substring(0, 100),
          dataItemId: dataItemId,
          class: btn.className
        });
      }
    });
    return results;
  });
  console.log('Botones relacionados con teléfono:');
  console.log(JSON.stringify(buttons, null, 2));
  console.log('\n');

  // Método 3: Buscar enlaces tel:
  console.log('=== MÉTODO 3: Buscar enlaces tel: ===');
  const telLinks = await page.evaluate(() => {
    const links = document.querySelectorAll('a[href*="tel"]');
    const results = [];
    links.forEach(link => {
      results.push({
        href: link.getAttribute('href'),
        text: link.textContent,
        ariaLabel: link.getAttribute('aria-label') || 'none'
      });
    });
    return results;
  });
  console.log('Enlaces tel: encontrados:');
  console.log(JSON.stringify(telLinks, null, 2));
  console.log('\n');

  // Método 4: Buscar en TODO el texto visible
  console.log('=== MÉTODO 4: Buscar patrones de teléfono en texto visible ===');
  const textPhones = await page.evaluate(() => {
    const bodyText = document.body.innerText;
    const patterns = [
      /\+51[\s-]?9\d{2}[\s-]?\d{3}[\s-]?\d{3}/g,
      /9\d{2}[\s-]?\d{3}[\s-]?\d{3}/g,
      /\(01\)[\s-]?\d{3}[\s-]?\d{4}/g,
      /\b9\d{8}\b/g
    ];

    const found = [];
    patterns.forEach((pattern, i) => {
      const matches = bodyText.match(pattern);
      if (matches) {
        found.push({
          pattern: `Patrón ${i + 1}`,
          matches: matches.slice(0, 5) // Primeros 5
        });
      }
    });
    return found;
  });
  console.log('Números encontrados en texto:');
  console.log(JSON.stringify(textPhones, null, 2));
  console.log('\n');

  // Método 5: Buscar elementos con data-item-id que contengan "phone"
  console.log('=== MÉTODO 5: Buscar data-item-id con "phone" ===');
  const phoneDataItems = await page.evaluate(() => {
    const elements = document.querySelectorAll('[data-item-id*="phone"]');
    const results = [];
    elements.forEach(el => {
      results.push({
        tag: el.tagName,
        dataItemId: el.getAttribute('data-item-id'),
        ariaLabel: el.getAttribute('aria-label') || 'none',
        text: el.textContent.substring(0, 100),
        class: el.className
      });
    });
    return results;
  });
  console.log('Elementos con data-item-id que contiene "phone":');
  console.log(JSON.stringify(phoneDataItems, null, 2));
  console.log('\n');

  // Método 6: Capturar HTML de secciones específicas
  console.log('=== MÉTODO 6: Capturar HTML de secciones clave ===');
  const sectionHTML = await page.evaluate(() => {
    // Buscar la sección de información del negocio
    const infoSections = document.querySelectorAll('[class*="information"], [class*="details"], [class*="contact"]');
    const results = [];

    infoSections.forEach((section, i) => {
      if (i < 3) { // Solo las primeras 3
        results.push({
          index: i,
          html: section.innerHTML.substring(0, 500)
        });
      }
    });

    return results;
  });
  console.log('HTML de secciones de información:');
  sectionHTML.forEach(section => {
    console.log(`\n--- Sección ${section.index} ---`);
    console.log(section.html);
  });
  console.log('\n');

  // Tomar screenshot para análisis visual
  await page.screenshot({ path: '/home/ubuntu/test-screenshot.png', fullPage: true });
  console.log('📸 Screenshot guardado en: /home/ubuntu/test-screenshot.png\n');

  await browser.close();
  console.log('✅ Prueba completada');
}

testPhoneExtraction().catch(console.error);
