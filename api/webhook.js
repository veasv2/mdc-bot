export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const update = req.body;
    console.log('📩 Mensaje recibido:', JSON.stringify(update, null, 2));

    if (update.message) {
      await procesarMensaje(update.message);
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function procesarMensaje(message) {
  const chatId = message.chat.id;
  const texto = message.text;
  const usuario = message.from;

  console.log(`👤 Usuario: ${usuario.first_name} (@${usuario.username || usuario.id})`);
  console.log(`💬 Mensaje: ${texto}`);

  try {
    // Obtener perfil del usuario desde Google Sheets
    const perfilUsuario = await obtenerPerfilUsuario(usuario);
    
    // Procesar según tipo de mensaje
    if (texto?.startsWith('/')) {
      await manejarComando(chatId, texto, usuario, perfilUsuario);
    } 
    else if (message.document) {
      await procesarDocumento(chatId, message.document, usuario, perfilUsuario);
    }
    else if (texto) {
      await procesarTextoLibre(chatId, texto, usuario, perfilUsuario);
    }
  } catch (error) {
    console.error('Error procesando mensaje:', error);
    await enviarMensaje(chatId, '❌ Ocurrió un error. Intenta de nuevo.');
  }
}

async function obtenerPerfilUsuario(usuario) {
  try {
    const telegramId = `@${usuario.username || usuario.id}`;
    
    // Obtener token de acceso para Google API
    const accessToken = await obtenerGoogleAccessToken();
    
    // Leer datos del Google Sheet de usuarios
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${process.env.GOOGLE_SHEETS_USUARIOS_ID}/values/Sheet1`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      console.log('⚠️ No se pudo acceder al sheet de usuarios, usando perfil por defecto');
      return {
        nombre: usuario.first_name,
        area: 'Externo',
        cargo: 'Ciudadano',
        acceso: 'Guest'
      };
    }

    const data = await response.json();
    const rows = data.values || [];
    
    // Buscar usuario en el sheet
    const userRow = rows.find(row => row[0] === telegramId);
    
    if (userRow) {
      return {
        telegram_id: userRow[0],
        nombre: userRow[1],
        area: userRow[2],
        cargo: userRow[3],
        acceso: userRow[4],
        email: userRow[5] || '',
        telefono: userRow[6] || ''
      };
    } else {
      // Usuario no registrado
      return {
        nombre: usuario.first_name,
        area: 'Externo',
        cargo: 'Ciudadano',
        acceso: 'Guest',
        es_nuevo: true
      };
    }
  } catch (error) {
    console.error('Error obteniendo perfil:', error);
    return {
      nombre: usuario.first_name,
      area: 'Sistema',
      cargo: 'Usuario',
      acceso: 'Guest'
    };
  }
}

async function manejarComando(chatId, comando, usuario, perfil) {
  const saludo = perfil.area !== 'Externo' 
    ? `¡Hola ${perfil.nombre}! 👋\n🏢 **${perfil.area}** - *${perfil.cargo}*\n` 
    : `¡Hola ${perfil.nombre}! 👋\n`;

  switch (comando.split(' ')[0]) {
    case '/start':
      await enviarMensaje(chatId, `${saludo}
🏛️ **Bienvenido a la Mesa de Partes Digital**
**Municipalidad Distrital de Colca**

📋 **Servicios disponibles:**
• Registrar documentos oficiales
• Consultar estado de expedientes  
• Generar reportes y estadísticas
• Búsquedas por criterios

**Comandos:**
/enviar - Registrar documento
/estado - Consultar expediente  
/reportes - Ver estadísticas
/perfil - Ver mi información
/help - Ayuda completa

**¿En qué puedo ayudarte?**`);
      break;

    case '/perfil':
      await enviarMensaje(chatId, `👤 **Tu perfil en el sistema:**

**Nombre:** ${perfil.nombre}
**Área:** ${perfil.area}
**Cargo:** ${perfil.cargo}
**Nivel de acceso:** ${perfil.acceso}
${perfil.email ? `**Email:** ${perfil.email}` : ''}
${perfil.telefono ? `**Teléfono:** ${perfil.telefono}` : ''}

${perfil.es_nuevo ? '⚠️ *Perfil no registrado - acceso limitado*' : '✅ *Perfil verificado*'}`);
      break;

    case '/enviar':
      const permisos = perfil.acceso !== 'Guest' 
        ? 'Tienes permisos para registrar documentos oficiales.' 
        : 'Como usuario externo, puedes enviar solicitudes ciudadanas.';
        
      await enviarMensaje(chatId, `📤 **Registro de documento**
${perfil.area !== 'Externo' ? `*Área: ${perfil.area}*` : ''}

${permisos}

**Envía tu archivo** (PDF, Word, imagen) y yo lo procesaré automáticamente.

*Formatos: PDF, DOC, DOCX, JPG, PNG (máx. 20MB)*`);
      break;

    case '/estado':
      await enviarMensaje(chatId, `🔍 **Consulta de expedientes**

Envía el número de expediente:
**Formato:** 2025-0001

O describe el documento que buscas.`);
      break;

    case '/reportes':
      if (['Admin', 'Super'].includes(perfil.acceso)) {
        await enviarMensaje(chatId, `📊 **Reportes administrativos**
*Disponible para: ${perfil.cargo}*

**Selecciona un reporte:**
1️⃣ Documentos del día
2️⃣ Expedientes pendientes
3️⃣ Reporte semanal  
4️⃣ Estadísticas por área
5️⃣ Mi área (${perfil.area})

Responde con el número.`);
      } else {
        await enviarMensaje(chatId, `📊 **Mis documentos**

**Estadísticas personales:**
• Documentos enviados: En desarrollo
• Expedientes pendientes: En desarrollo
• Última actividad: Hoy

*Reportes administrativos disponibles solo para jefes de área*`);
      }
      break;

    default:
      await enviarMensaje(chatId, `❓ Comando: ${comando}

**Comandos disponibles:**
/start - Inicio
/enviar - Registrar documento
/estado - Consultar expediente
/reportes - Estadísticas
/perfil - Mi información
/help - Ayuda`);
  }
}

async function procesarDocumento(chatId, documento, usuario, perfil) {
  console.log(`📄 Procesando: ${documento.file_name} (${documento.file_size} bytes)`);

  try {
    // Analizar documento con Claude API
    const analisis = await analizarDocumentoConClaude(documento, perfil);
    
    // Registrar en Google Sheets
    const expediente = await registrarEnGoogleSheets(documento, analisis, usuario, perfil);

    await enviarMensaje(chatId, `✅ **Documento registrado exitosamente**

📋 **Expediente:** ${expediente.numero}
**Fecha:** ${expediente.fecha}
**Estado:** ${expediente.estado}

📄 **Archivo:** ${documento.file_name}
**Tamaño:** ${Math.round(documento.file_size / 1024)} KB
**Tipo detectado:** ${analisis.tipo}

🏢 **Asignado a:** ${analisis.area_responsable}
**Prioridad:** ${analisis.prioridad}

${analisis.observaciones ? `**Observaciones:** ${analisis.observaciones}` : ''}

**Para seguimiento:** /estado ${expediente.numero}
**Tiempo estimado:** ${analisis.tiempo_estimado}`);

    // Si es documento importante, notificar al área
    if (['Admin', 'Super'].includes(perfil.acceso)) {
      console.log(`🔔 Notificación enviada a ${analisis.area_responsable}`);
    }

  } catch (error) {
    console.error('Error procesando documento:', error);
    await enviarMensaje(chatId, `❌ **Error procesando documento**

No se pudo procesar ${documento.file_name}.
Intenta nuevamente o contacta soporte.

**Posibles causas:**
• Archivo muy grande (máx. 20MB)
• Formato no soportado
• Error temporal del sistema`);
  }
}

async function analizarDocumentoConClaude(documento, perfil) {
  // Simular análisis inteligente por ahora
  // Aquí integraríamos con Claude API para análisis real del contenido
  
  const tiposPorExtension = {
    'pdf': { tipo: 'Documento PDF', area: 'Secretaría General' },
    'doc': { tipo: 'Documento Word', area: 'Administración' },
    'docx': { tipo: 'Documento Word', area: 'Administración' },
    'jpg': { tipo: 'Imagen escaneada', area: 'Mesa de Partes' },
    'png': { tipo: 'Documento digitalizado', area: 'Mesa de Partes' }
  };

  const extension = documento.file_name?.split('.').pop()?.toLowerCase();
  const tipoBase = tiposPorExtension[extension] || { tipo: 'Documento', area: 'Mesa de Partes' };

  // Lógica inteligente según área del usuario
  let areaResponsable = perfil.area !== 'Externo' ? perfil.area : tipoBase.area;
  let prioridad = perfil.acceso === 'Super' ? 'Alta' : 'Media';

  // Detectar urgencia por nombre de archivo
  if (documento.file_name?.toLowerCase().includes('urgente')) {
    prioridad = 'Muy Urgente';
  }

  return {
    tipo: tipoBase.tipo,
    area_responsable: areaResponsable,
    prioridad: prioridad,
    tiempo_estimado: prioridad === 'Muy Urgente' ? '24 horas' : '3-5 días hábiles',
    observaciones: `Enviado por ${perfil.cargo} de ${perfil.area}`,
    asunto_detectado: `Documento ${tipoBase.tipo.toLowerCase()}`
  };
}

async function registrarEnGoogleSheets(documento, analisis, usuario, perfil) {
  try {
    const accessToken = await obtenerGoogleAccessToken();
    const ahora = new Date();
    
    // Generar número de expediente único
    const numeroExpediente = `2025-${String(ahora.getMonth() + 1).padStart(2, '0')}${String(ahora.getDate()).padStart(2, '0')}${String(ahora.getHours()).padStart(2, '0')}${String(ahora.getMinutes()).padStart(2, '0')}${String(ahora.getSeconds()).padStart(2, '0')}`;
    
    // Preparar datos para el sheet
    const nuevaFila = [
      numeroExpediente,
      ahora.toLocaleDateString('es-PE') + ' ' + ahora.toLocaleTimeString('es-PE', {hour: '2-digit', minute: '2-digit'}),
      `${perfil.nombre} (${perfil.area})`,
      analisis.asunto_detectado,
      analisis.tipo,
      analisis.area_responsable,
      'Recibido',
      analisis.prioridad,
      analisis.observaciones,
      `@${usuario.username || usuario.id}`,
      documento.file_name
    ];

    // Agregar fila al Google Sheet
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${process.env.GOOGLE_SHEETS_EXPEDIENTES_ID}/values/Sheet1:append?valueInputOption=RAW`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [nuevaFila]
        })
      }
    );

    if (!response.ok) {
      throw new Error('Error escribiendo en Google Sheets');
    }

    console.log('✅ Expediente registrado en Google Sheets');

    return {
      numero: numeroExpediente,
      fecha: ahora.toLocaleDateString('es-PE'),
      estado: 'Recibido'
    };

  } catch (error) {
    console.error('Error registrando en Google Sheets:', error);
    throw error;
  }
}

async function procesarTextoLibre(chatId, texto, usuario, perfil) {
  // Detectar número de expediente
  if (texto.match(/2025-\d{10}/)) {
    await consultarExpediente(chatId, texto.trim(), perfil);
    return;
  }

  // Responder a opciones de reportes
  if (['1', '2', '3', '4', '5'].includes(texto.trim())) {
    await generarReporte(chatId, texto.trim(), perfil);
    return;
  }

  // Respuesta inteligente general
  await enviarMensaje(chatId, `💭 Recibí: "${texto}"

**¿Qué puedes hacer?**
• Enviar un archivo para registrarlo
• Consultar expediente: 2025-XXXXXXXXXX
• Ver reportes: /reportes
• Ayuda: /help

¿En qué más puedo ayudarte?`);
}

async function consultarExpediente(chatId, numeroExp, perfil) {
  // Simular consulta por ahora
  await enviarMensaje(chatId, `🔍 **Consultando:** ${numeroExp}

📋 **Resultado:**
**Estado:** ✅ En proceso  
**Área:** Obras y Desarrollo
**Fecha registro:** 19/07/2025
**Última actualización:** Hoy 14:30

**Historial:**
🟢 Recibido (09:15)
🟡 En revisión (10:30)
🔵 Derivado a área técnica (14:30)

**Próximo paso:** Evaluación (2-3 días)

${['Admin', 'Super'].includes(perfil.acceso) ? '\n**Acciones disponibles:** /aprobar /derivar /observar' : ''}`);
}

async function generarReporte(chatId, opcion, perfil) {
  const reportes = {
    '1': `📈 **Documentos del día** - ${new Date().toLocaleDateString()}

**Resumen general:**
• Total recibidos: 12 docs
• Procesados: 9
• Pendientes: 3

**Por área:**
🏗️ Obras: 5 docs
🏛️ Alcaldía: 3 docs  
💰 Administración: 4 docs

**Tu área (${perfil.area}):**
• Recibidos: 2
• Procesados: 1
• Pendientes: 1`,

    '5': `📊 **Reporte ${perfil.area}**

**Esta semana:**
• Documentos: 8
• Procesados: 6
• Pendientes: 2
• Tiempo promedio: 2.3 días

**Tipos más frecuentes:**
📄 Informes: 4
📋 Solicitudes: 3  
📝 Oficios: 1`
  };

  const reporte = reportes[opcion] || `📊 Reporte ${opcion} no disponible`;
  await enviarMensaje(chatId, reporte);
}

async function obtenerGoogleAccessToken() {
  try {
    // Crear JWT para autenticación
    const jwt = await crearJWT();
    
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
    });

    const data = await response.json();
    
    if (!data.access_token) {
      throw new Error('No se pudo obtener access token');
    }

    return data.access_token;
  } catch (error) {
    console.error('Error obteniendo access token:', error);
    throw error;
  }
}

async function crearJWT() {
  // Implementación simplificada de JWT para Google API
  // En producción usarías una librería como jsonwebtoken
  const header = {
    "alg": "RS256",
    "typ": "JWT"
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    "iss": process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    "scope": "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file",
    "aud": "https://oauth2.googleapis.com/token",
    "exp": now + 3600,
    "iat": now
  };

  // Para esta demo, retornamos un token mock
  // En producción necesitarías firmar con la private key
  return 'jwt_token_placeholder';
}

async function enviarMensaje(chatId, texto) {
  const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
  
  try {
    const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: texto,
        parse_mode: 'Markdown'
      })
    });

    const result = await response.json();
    
    if (!result.ok) {
      console.error('Error enviando mensaje:', result);
    } else {
      console.log('✅ Mensaje enviado');
    }
    
    return result;
  } catch (error) {
    console.error('❌ Error en enviarMensaje:', error);
    throw error;
  }
}