const cron = require('node-cron');
const nodemailer = require('nodemailer');

let scheduledTask = null;
let scheduleConfig = null;

exports.configureSchedule = async (req, res) => {
  try {
    const { ciudad, hora, email } = req.body;

    if (!ciudad || !hora) {
      return res.status(400).json({
        success: false,
        message: 'Ciudad y hora son obligatorios'
      });
    }

    // Validar formato de hora (HH:MM)
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(hora)) {
      return res.status(400).json({
        success: false,
        message: 'Formato de hora inválido. Use HH:MM (24 horas)'
      });
    }

    // Detener tarea anterior si existe
    if (scheduledTask) {
      scheduledTask.stop();
    }

    // Parsear hora
    const [hours, minutes] = hora.split(':');
    
    // Crear expresión cron: minutos, hora, día, mes, día de semana
    const cronExpression = `${minutes} ${hours} * * *`;

    // Crear nueva tarea programada
    scheduledTask = cron.schedule(cronExpression, async () => {
      console.log(`⏰ Ejecutando búsqueda automática en ${ciudad}`);
      
      // Aquí se ejecutaría el scraping automático
      // Por ahora solo registramos el evento
      const result = {
        ciudad,
        fecha: new Date().toISOString(),
        status: 'Ejecutado automáticamente'
      };

      // Si hay email configurado, enviar notificación
      if (email) {
        await sendNotification(email, ciudad, result);
      }
    });

    scheduleConfig = {
      ciudad,
      hora,
      email: email || null,
      cronExpression,
      activo: true,
      fechaConfiguracion: new Date().toISOString()
    };

    console.log(`✅ Búsqueda automática configurada: ${ciudad} a las ${hora}`);

    res.json({
      success: true,
      message: `Búsqueda automática configurada para ${ciudad} a las ${hora}`,
      config: scheduleConfig
    });

  } catch (error) {
    console.error('Error en configureSchedule:', error);
    res.status(500).json({
      success: false,
      message: 'Error al configurar búsqueda automática',
      error: error.message
    });
  }
};

exports.getStatus = (req, res) => {
  try {
    if (!scheduleConfig) {
      return res.json({
        success: true,
        activo: false,
        message: 'No hay búsqueda automática configurada'
      });
    }

    res.json({
      success: true,
      activo: true,
      config: scheduleConfig
    });

  } catch (error) {
    console.error('Error en getStatus:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estado',
      error: error.message
    });
  }
};

exports.disable = (req, res) => {
  try {
    if (scheduledTask) {
      scheduledTask.stop();
      scheduledTask = null;
    }

    scheduleConfig = null;

    console.log('🛑 Búsqueda automática desactivada');

    res.json({
      success: true,
      message: 'Búsqueda automática desactivada'
    });

  } catch (error) {
    console.error('Error en disable:', error);
    res.status(500).json({
      success: false,
      message: 'Error al desactivar búsqueda automática',
      error: error.message
    });
  }
};

async function sendNotification(email, ciudad, result) {
  try {
    const transporter = nodemailer.createTransporter({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: `Búsqueda automática completada - ${ciudad}`,
      html: `
        <h2>Ecos del SEO - Prospección Automática</h2>
        <p>La búsqueda automática en <strong>${ciudad}</strong> se ha completado.</p>
        <p>Fecha: ${new Date(result.fecha).toLocaleString('es-PE')}</p>
        <p>Los resultados han sido procesados correctamente.</p>
        <br>
        <p>Saludos,<br>Ecos del SEO</p>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`📧 Notificación enviada a ${email}`);

  } catch (error) {
    console.error('Error al enviar notificación:', error);
  }
}
