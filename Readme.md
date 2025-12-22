# Especificaciones Técnicas Completas
## Aplicación Web de Prospección de Negocios - Ecos del SEO

---

## 1. DESCRIPCIÓN GENERAL DEL PROYECTO

### Objetivo
Desarrollar una aplicación web de web scraping que permita recopilar información de contacto de negocios en cualquier ciudad de Perú para la captación de clientes potenciales para la agencia digital Ecos del SEO.

### Propósito
Automatizar la prospección de clientes mediante la extracción de datos de negocios que puedan necesitar servicios de desarrollo web, marketing digital, diseño gráfico, automatización, redacción de contenido o asistencia virtual.

---

## 2. REQUISITOS FUNCIONALES

### 2.1 Funcionalidad Principal
- La aplicación debe permitir al usuario ingresar una ciudad o ubicación específica de Perú.
- El sistema debe buscar y extraer información de TODOS los tipos de negocios en esa ubicación.
- Los datos deben mostrarse en tiempo real en una tabla dentro de la aplicación.
- El usuario debe poder exportar todos los datos recolectados a un archivo Excel (.xlsx) completamente formateado y listo para usar.

### 2.2 Ejecución Automatizada
- La aplicación debe poder programarse para ejecutarse automáticamente una vez al día.
- Debe permitir al usuario configurar la hora de ejecución automática.
- Debe enviar una notificación o correo cuando termine la recopilación diaria.
- Debe mantener un historial de las recopilaciones realizadas con fecha y hora.

### 2.3 Fuente de Datos
- **Fuente primaria**: Google Maps / Google Business Profile
- **Fuentes secundarias opcionales**: Páginas Amarillas Perú, directorios locales
- El scraping debe respetar las políticas de uso de las plataformas y utilizar APIs oficiales cuando sea posible.

---

## 3. DATOS A EXTRAER POR CADA NEGOCIO

### 3.1 Información Básica del Negocio
1. **Nombre del negocio** (obligatorio)
2. **Tipo/Categoría de negocio** (ej: Restaurante, Hotel, Tienda de ropa, etc.)
3. **Dirección completa** (calle, número, distrito, ciudad)
4. **Coordenadas GPS** (latitud, longitud) - opcional pero recomendado

### 3.2 Información de Contacto (PRIORITARIO)
5. **Nombre del contacto** (Gerente/Dueño/Encargado/Administrador)
6. **Cargo del contacto** (Gerente General, Propietario, Encargado de Marketing, etc.)
7. **Teléfono principal** (obligatorio - formato: +51 XXX XXX XXX)
8. **Teléfono secundario** (si está disponible)
9. **WhatsApp Business** (número si está disponible)
10. **Email de contacto** (correo principal del negocio)
11. **Email secundario** (si está disponible)

### 3.3 Presencia Digital
12. **Tiene página web** (Sí/No)
13. **URL de la página web** (si existe)
14. **Estado de la página web** (Activa/Inactiva/En construcción/No responde)
15. **Facebook** (URL del perfil/página)
16. **Instagram** (URL del perfil)
17. **TikTok** (URL si está disponible)
18. **LinkedIn** (URL si está disponible)

### 3.4 Análisis y Calificación
19. **Calificación promedio** (estrellas de 1-5)
20. **Número total de reseñas**
21. **Horarios de atención** (horario completo)
22. **Estado del negocio** (Abierto/Cerrado/Temporalmente cerrado)

### 3.5 Análisis Automático de Oportunidad
23. **Nivel de prioridad del lead** (Premium/Alto/Medio/Bajo)
    - **Premium**: No tiene web + tiene redes sociales activas + más de 50 reseñas
    - **Alto**: Tiene web desactualizada o problemas técnicos + buenas reseñas
    - **Medio**: Tiene web básica pero sin optimización SEO
    - **Bajo**: Tiene web moderna y optimizada

24. **Servicios recomendados de Ecos del SEO** (lista automática según análisis):
    - Desarrollo Web (si no tiene web o web deficiente)
    - E-commerce (si es tienda sin venta online)
    - SEO (si tiene web pero no aparece en búsquedas)
    - Google Ads (si tiene presupuesto aparente)
    - Redes Sociales (si no tiene presencia)
    - Branding (si no tiene identidad visual clara)
    - Chatbot WhatsApp (si tiene muchas consultas)
    - Asistente Virtual (si es negocio grande)

### 3.6 Gestión de Prospección
25. **Estado de contacto** (valores: Pendiente/Llamado/Interesado/No interesado/Contrató/No responde)
26. **Fecha de primer contacto** (se llena manualmente o automáticamente)
27. **Fecha de último seguimiento**
28. **Observaciones** (campo de texto libre para notas)
29. **Fecha y hora de captura de datos** (timestamp automático)
30. **Ciudad de búsqueda** (ciudad donde se realizó la búsqueda)

---

## 4. ESTRUCTURA DEL ARCHIVO EXCEL EXPORTADO

### 4.1 Formato General
- **Nombre del archivo**: `Prospeccion_[CIUDAD]_[FECHA]_[HORA].xlsx`
- **Ejemplo**: `Prospeccion_Cusco_2024-12-22_14-30.xlsx`

### 4.2 Hojas del Documento Excel
El archivo debe contener 3 hojas:

#### HOJA 1: "Negocios Recopilados"
Todas las columnas mencionadas en la sección 3, organizadas en el siguiente orden:

| A | B | C | D | E | F | G | H | I | J | K | L | M | N | O | P | Q | R | S | T | U | V | W | X | Y | Z | AA | AB | AC | AD |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|----|----|----|----|
| Nombre del Negocio | Categoría | Dirección | Nombre Contacto | Cargo | Teléfono Principal | Teléfono 2 | WhatsApp | Email 1 | Email 2 | Tiene Web | URL Web | Estado Web | Facebook | Instagram | TikTok | LinkedIn | Calificación | Reseñas | Horarios | Estado | Nivel Prioridad | Servicios Sugeridos | Estado Contacto | Fecha 1er Contacto | Último Seguimiento | Observaciones | Fecha Captura | Ciudad | Coordenadas |

#### HOJA 2: "Resumen Ejecutivo"
Estadísticas automáticas:
- Total de negocios recopilados
- Distribución por categoría de negocio
- Distribución por nivel de prioridad
- Negocios sin página web (oportunidad directa)
- Negocios con web deficiente
- Promedio de calificación general
- Ciudad analizada
- Fecha y hora de recopilación

#### HOJA 3: "Guía de Uso"
Instrucciones breves sobre:
- Cómo interpretar el nivel de prioridad
- Significado de cada estado de contacto
- Cómo usar las columnas de seguimiento
- Servicios de Ecos del SEO y cuándo ofrecerlos

### 4.3 Formato Visual del Excel
- **Encabezados**: Fondo azul oscuro (#1F4788), texto blanco, negrita, centrado
- **Filas alternas**: Gris claro (#F2F2F2) y blanco para mejor lectura
- **Columnas de prioridad**: 
  - Premium: Fondo verde claro (#D4EDDA)
  - Alto: Fondo amarillo claro (#FFF3CD)
  - Medio: Fondo naranja claro (#FFE5CC)
  - Bajo: Sin color especial
- **Columnas de estado de contacto**:
  - Interesado: Verde (#28A745)
  - Contrató: Verde oscuro (#155724)
  - No interesado: Rojo (#DC3545)
  - Pendiente: Amarillo (#FFC107)
- **Ancho automático de columnas** según contenido
- **Filtros habilitados** en la fila de encabezados
- **Congelación de la primera fila** para mantener encabezados visibles

---

## 5. INTERFAZ DE USUARIO

### 5.1 Diseño Visual
**Estilo**: Minimalista, moderno, directo, sin elementos innecesarios.

**Paleta de colores sugerida**:
- Primario: #1F4788 (azul corporativo)
- Secundario: #28A745 (verde éxito)
- Fondo: #FFFFFF (blanco)
- Texto: #212529 (gris oscuro)
- Bordes: #DEE2E6 (gris claro)

**NO incluir**:
- Íconos decorativos innecesarios
- Animaciones excesivas
- Elementos visuales que distraigan del objetivo principal

### 5.2 Componentes de la Interfaz

#### Pantalla Principal
```
┌─────────────────────────────────────────────────────┐
│  ECOS DEL SEO - Prospección de Negocios             │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Ciudad o ubicación:                                 │
│  [_____________________] [Buscar Negocios]          │
│                                                      │
│  ☐ Búsqueda automática diaria                       │
│  Hora: [__:__] [Guardar configuración]              │
│                                                      │
├─────────────────────────────────────────────────────┤
│  Resultados encontrados: 156 negocios               │
│  [Exportar a Excel]  [Limpiar resultados]           │
├─────────────────────────────────────────────────────┤
│                                                      │
│  [TABLA DE RESULTADOS EN TIEMPO REAL]               │
│                                                      │
└─────────────────────────────────────────────────────┘
```

#### Barra de progreso durante el scraping
```
Buscando negocios en Cusco...
[████████░░░░░░░░] 45% completado
Procesados: 67/150 negocios
```

#### Tabla de resultados
- Debe mostrar las columnas más importantes: Nombre, Categoría, Contacto, Teléfono, Email, Tiene Web, Prioridad
- Scroll horizontal para ver todas las columnas
- Paginación si hay más de 50 resultados
- Búsqueda/filtro rápido dentro de los resultados

---

## 6. REQUISITOS TÉCNICOS

### 6.1 Stack Tecnológico Recomendado

#### Frontend
- **Framework**: React.js o Next.js
- **Estilos**: Tailwind CSS (minimalista y rápido)
- **Librería de tablas**: TanStack Table (React Table) o AG Grid
- **Exportación Excel**: SheetJS (xlsx) o ExcelJS

#### Backend
- **Lenguaje**: Node.js con Express o Python con FastAPI
- **Web Scraping**: 
  - Puppeteer (Node.js) o Playwright
  - BeautifulSoup + Selenium (Python)
  - Scrapy (Python) para scraping más robusto
- **APIs**: Google Places API (recomendado para datos precisos)
- **Base de datos**: PostgreSQL o MongoDB para almacenar historial
- **Tareas programadas**: node-cron (Node.js) o Celery (Python)

#### Infraestructura
- **Hosting recomendado**: 
  - Vercel o Netlify (frontend)
  - Railway, Render o DigitalOcean (backend)
- **Alternativa local**: Aplicación Electron para ejecutar en escritorio

### 6.2 Consideraciones de Scraping

#### Límites y Rate Limiting
- Implementar delays entre peticiones (1-3 segundos)
- Rotar user-agents para evitar bloqueos
- Implementar sistema de reintentos ante errores
- No exceder 100 peticiones por minuto

#### Manejo de Errores
- Capturar y registrar todos los errores en logs
- Continuar con el siguiente negocio si uno falla
- Mostrar negocios problemáticos en sección separada del Excel

#### Validación de Datos
- Validar formato de teléfonos (+51)
- Validar formato de emails
- Detectar URLs inválidas
- Limpiar espacios y caracteres especiales

---

## 7. FLUJO DE TRABAJO DE LA APLICACIÓN

### 7.1 Proceso de Búsqueda Manual

1. Usuario ingresa ciudad (ej: "Cusco")
2. Sistema valida que la ciudad existe en Perú
3. Muestra mensaje: "Buscando negocios en Cusco..."
4. Inicia scraping con barra de progreso
5. Por cada negocio encontrado:
   - Extrae datos básicos
   - Intenta encontrar información de contacto del encargado
   - Analiza presencia digital
   - Calcula nivel de prioridad
   - Sugiere servicios de Ecos del SEO
   - Muestra en tabla en tiempo real
6. Al terminar, muestra: "Búsqueda completada: X negocios encontrados"
7. Usuario puede exportar a Excel o realizar nueva búsqueda

### 7.2 Proceso de Búsqueda Automática

1. Usuario configura ciudad y hora de ejecución
2. Sistema guarda configuración
3. Cada día a la hora programada:
   - Ejecuta búsqueda automáticamente
   - Genera archivo Excel
   - Envía notificación/email con archivo adjunto
   - Guarda en historial de búsquedas

### 7.3 Proceso de Exportación a Excel

1. Usuario hace clic en "Exportar a Excel"
2. Sistema genera archivo con las 3 hojas especificadas
3. Aplica formato visual (colores, filtros, anchos)
4. Descarga automáticamente el archivo
5. Muestra mensaje: "Excel descargado exitosamente"

---

## 8. CASOS DE USO ESPECÍFICOS

### Caso 1: Prospección en Nueva Ciudad
```
Usuario: Quiero buscar negocios en Arequipa
Sistema: Ingresa "Arequipa" → Click "Buscar"
Resultado: 234 negocios encontrados, exporta Excel con todos los datos
```

### Caso 2: Seguimiento de Leads
```
Usuario: Descarga Excel → Llama a negocios
Usuario: Actualiza columna "Estado de contacto" a "Interesado"
Usuario: Anota en "Observaciones": "Interesado en desarrollo web, llamar viernes"
```

### Caso 3: Búsqueda Automatizada Diaria
```
Usuario: Configura búsqueda diaria en "Lima" a las 8:00 AM
Sistema: Cada día a las 8 AM busca negocios nuevos en Lima
Sistema: Envía email con Excel adjunto
Usuario: Recibe leads frescos cada mañana
```

---

## 9. VALIDACIONES Y RESTRICCIONES

### 9.1 Validaciones de Entrada
- Ciudad no puede estar vacía
- Ciudad debe existir en Perú
- Hora de ejecución debe estar en formato 24h (00:00 - 23:59)
- No permitir búsquedas simultáneas (una a la vez)

### 9.2 Restricciones
- Máximo 500 negocios por búsqueda (para evitar saturación)
- Si hay más, dividir en múltiples archivos Excel
- Timeout de 30 segundos por negocio
- Almacenar máximo 90 días de historial

---

## 10. INFORMACIÓN DE ECOS DEL SEO PARA INTEGRAR

### 10.1 Servicios y Precios (Para sugerencias automáticas)

**Desarrollo Web**
- Sitios Web WordPress: Desde S/ 2,500
- Tiendas Online: Desde S/ 3,500
- Landing Pages: Desde S/ 800

**Marketing Digital**
- SEO: Desde S/ 800/mes
- Google Ads: Desde S/ 500/mes
- Facebook e Instagram Ads: Desde S/ 500/mes

**Diseño Gráfico**
- Logos: Desde S/ 500
- Branding Corporativo: Desde S/ 1,500

**Automatización**
- Chatbots WhatsApp: Desde S/ 1,200
- Automatización n8n: Desde S/ 800

**Redacción y Contenido**
- Copywriting: Desde S/ 300

**Asistente Virtual**
- Asistente Administrativo: Desde S/ 500/mes

### 10.2 Datos de Contacto
- Ubicación: Cusco, Perú
- Teléfono: +51 912 672 008
- Email: contacto@ecosdelseo.com
- Horario: Lunes a Viernes 9 AM - 6 PM

### 10.3 Lógica de Sugerencias Automáticas

El sistema debe sugerir servicios basándose en:

**Si NO tiene página web**: 
→ Desarrollo Web + SEO + Branding

**Si tiene web pero no aparece en Google**: 
→ SEO + Google Ads

**Si es tienda física sin e-commerce**: 
→ Tienda Online + Facebook Ads

**Si tiene muchas reseñas pero poca presencia digital**: 
→ Marketing Digital completo + Redes Sociales

**Si es negocio grande (50+ reseñas)**: 
→ Asistente Virtual + Automatización + Chatbot

---

## 11. SEGURIDAD Y PRIVACIDAD

### 11.1 Protección de Datos
- Todos los datos recopilados son públicos (de Google Maps/directorios)
- No almacenar datos sensibles sin cifrado
- Implementar HTTPS en toda la aplicación
- No compartir ni vender datos de terceros

### 11.2 Cumplimiento Legal
- Respetar términos de servicio de las plataformas scrapeadas
- Incluir disclaimer de uso ético de la información
- No usar datos para spam o actividades ilegales
- Preferir APIs oficiales sobre scraping directo

---

## 12. MEJORAS FUTURAS (OPCIONAL)

### Fase 2
- Integración con CRM (HubSpot, Salesforce)
- Sistema de scoring automático de leads
- Envío automático de emails de prospección
- Análisis de competencia del negocio

### Fase 3
- Dashboard con métricas y KPIs
- Integración con WhatsApp Business API
- Generación automática de propuestas comerciales
- Machine Learning para predecir probabilidad de cierre

---

## 13. ENTREGABLES ESPERADOS

### 13.1 Código Fuente
- Repositorio Git completo
- README con instrucciones de instalación
- Variables de entorno documentadas
- Scripts de despliegue

### 13.2 Documentación
- Manual de usuario (PDF)
- Documentación técnica de la API
- Guía de mantenimiento
- Video tutorial de uso (5-10 min)

### 13.3 Aplicación Desplegada
- URL de la aplicación en producción
- Credenciales de acceso
- Panel de administración
- Backup de base de datos

---

## 14. CRITERIOS DE ACEPTACIÓN

La aplicación estará completa cuando:

✅ Permita ingresar cualquier ciudad de Perú y buscar negocios
✅ Extraiga al menos 20 de los 30 campos de datos especificados
✅ Genere archivos Excel con el formato exacto especificado
✅ Tenga interfaz minimalista y funcional sin elementos innecesarios
✅ Permita configurar búsquedas automáticas diarias
✅ Maneje errores sin crash de la aplicación
✅ Tenga tiempo de respuesta menor a 5 minutos para 100 negocios
✅ Incluya documentación completa de uso

---

## 15. CONTACTO Y SOPORTE

Para dudas sobre este documento o la aplicación:

**Ecos del SEO**
- Email: contacto@ecosdelseo.com
- Teléfono: +51 912 672 008
- Ubicación: Cusco, Perú

---

**Versión del documento**: 1.0  
**Fecha de creación**: 22 de diciembre de 2024  
**Última actualización**: 22 de diciembre de 2024

---

## NOTAS IMPORTANTES PARA EL DESARROLLADOR/IA

1. Este documento es exhaustivo e incluye TODOS los requerimientos necesarios para desarrollar la aplicación completa.

2. Priorizar la funcionalidad sobre la estética, pero mantener diseño minimalista profesional.

3. La información de contacto del encargado/dueño es el dato MÁS IMPORTANTE a extraer.

4. El archivo Excel debe estar 100% listo para que el usuario pueda hacer llamadas inmediatamente después de descargarlo.

5. Todos los textos deben ser naturales, directos y sin parecer automatizados.

6. NO incluir íconos, emojis o elementos visuales innecesarios en la interfaz ni en los documentos exportados.

7. La aplicación debe ser intuitiva: cualquier persona sin conocimientos técnicos debe poder usarla.

8. Implementar manejo robusto de errores: la aplicación nunca debe "romperse" por errores de scraping.

9. Documentar TODO el código para facilitar mantenimiento futuro.

10. Seguir las mejores prácticas de desarrollo web y seguridad.

---

**Este documento contiene todas las especificaciones necesarias para construir la aplicación completa. No se requiere información adicional para comenzar el desarrollo.**