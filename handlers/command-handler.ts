// src/handlers/CommandHandler.ts - Manejador de comandos del bot

import { ComandoBot, UsuarioCompleto, TelegramUser } from '../types';
import { UsuarioService } from '../services/usuario-service';
import { TelegramService } from '../services/telegram-service';
import { ExpedienteService } from '../services/expediente-service';
import { config } from '../config';

export class CommandHandler {
  private usuarioService: UsuarioService;
  private telegramService: TelegramService;
  private expedienteService: ExpedienteService;

  constructor(
    usuarioService: UsuarioService,
    telegramService: TelegramService,
    expedienteService: ExpedienteService
  ) {
    this.usuarioService = usuarioService;
    this.telegramService = telegramService;
    this.expedienteService = expedienteService;
  }

  /**
   * Maneja todos los comandos del bot
   */
  async manejarComando(
    chatId: number,
    comando: ComandoBot,
    usuario: TelegramUser,
    perfil: UsuarioCompleto
  ): Promise<void> {
    const comandoBase = comando.split(' ')[0] as ComandoBot;
    
    console.log(`⚡ Ejecutando comando: ${comandoBase} para usuario: ${perfil.nombre_completo}`);

    try {
      switch (comandoBase) {
        case '/start':
          await this.comandoStart(chatId, perfil);
          break;

        case '/perfil':
          await this.comandoPerfil(chatId, perfil);
          break;

        case '/enviar':
          await this.comandoEnviar(chatId, perfil);
          break;

        case '/estado':
          await this.comandoEstado(chatId, perfil);
          break;

        case '/reportes':
          await this.comandoReportes(chatId, perfil);
          break;

        case '/test':
          await this.comandoTest(chatId, perfil, usuario);
          break;

        case '/help':
          await this.comandoHelp(chatId, perfil);
          break;

        default:
          await this.comandoDesconocido(chatId, comando);
      }

    } catch (error) {
      console.error(`Error ejecutando comando ${comandoBase}:`, error);
      await this.telegramService.enviarMensaje(chatId, 
        `❌ **Error ejecutando comando**\n\nIntenta de nuevo en unos momentos.`
      );
    }
  }

  /**
   * Comando /start - Bienvenida
   */
  private async comandoStart(chatId: number, perfil: UsuarioCompleto): Promise<void> {
    const saludo = perfil.es_interno 
      ? `¡Hola ${perfil.nombre}! 👋\n🏢 **${perfil.area}** - *${perfil.cargo}*\n` 
      : `¡Hola ${perfil.nombre}! 👋\n👤 **Ciudadano**\n`;

    const mensaje = `${saludo}
🏛️ **Bienvenido a la Mesa de Partes Digital**
**Municipalidad Distrital de Colca**

📋 **Servicios disponibles:**
• Registrar documentos oficiales
• Consultar estado de expedientes  
• Generar reportes y estadísticas
• Búsquedas por criterios

**Comandos principales:**
/enviar - Registrar documento
/estado - Consultar expediente  
/reportes - Ver estadísticas
/perfil - Ver mi información
/help - Ayuda completa

**¿En qué puedo ayudarte?**`;

    await this.telegramService.enviarMensaje(chatId, mensaje);
  }

  /**
   * Comando /perfil - Información del usuario
   */
  private async comandoPerfil(chatId: number, perfil: UsuarioCompleto): Promise<void> {
    const mensaje = `👤 **Tu perfil en el sistema:**

**Nombre:** ${perfil.nombre_completo}
**Área:** ${perfil.area}
**Cargo:** ${perfil.cargo}
**Nivel de acceso:** ${perfil.acceso}
${perfil.email ? `**Email:** ${perfil.email}` : ''}
${perfil.telefono ? `**Teléfono:** ${perfil.telefono}` : ''}

**Estado:** ${perfil.es_interno ? '✅ Usuario interno' : '👤 Usuario externo'}
**Permisos:** ${this.obtenerDescripcionPermisos(perfil)}

${!perfil.es_interno ? '\n⚠️ *Como usuario externo, puedes enviar solicitudes ciudadanas que serán procesadas por el área correspondiente.*' : ''}`;

    await this.telegramService.enviarMensaje(chatId, mensaje);
  }

  /**
   * Comando /enviar - Instrucciones para enviar documentos
   */
  private async comandoEnviar(chatId: number, perfil: UsuarioCompleto): Promise<void> {
    const permisos = this.usuarioService.tienePermisos(perfil, 'registrar')
      ? 'Tienes permisos para registrar documentos oficiales.' 
      : 'Como usuario externo, puedes enviar solicitudes ciudadanas.';
        
    const mensaje = `📤 **Registro de documento**
${perfil.es_interno ? `*Área: ${perfil.area}*` : '*Usuario externo*'}

${permisos}

**Envía tu archivo** (PDF o imagen) y yo lo procesaré automáticamente.

**Formatos soportados:**
• 📄 **PDF** - Documentos oficiales
• 📸 **Imágenes** - JPG, PNG, WEBP
• 📱 **Fotos** - Capturadas con el móvil

**Límites:**
• Tamaño máximo: ${Math.round(config.maxFileSize / 1024 / 1024)}MB
• Solo archivos individuales

**¡Solo envía el archivo y yo me encargo del resto!**`;

    await this.telegramService.enviarMensaje(chatId, mensaje);
  }

  /**
   * Comando /estado - Consulta de expedientes
   */
  private async comandoEstado(chatId: number, perfil: UsuarioCompleto): Promise<void> {
    const mensaje = `🔍 **Consulta de expedientes**

**Para consultar un expediente específico:**
Envía el número completo del expediente

**Formato:** 2025-XXXXXXXXXX
**Ejemplo:** 2025-0121142856

**Otras opciones:**
• Envía "buscar" para más opciones
• Usa /reportes para estadísticas generales

${perfil.es_admin ? '\n**👑 Como administrador, también puedes:**\n• Ver todos los expedientes del sistema\n• Generar reportes detallados' : ''}

**¿Qué expediente quieres consultar?**`;

    await this.telegramService.enviarMensaje(chatId, mensaje);
  }

  /**
   * Comando /reportes - Reportes y estadísticas
   */
  private async comandoReportes(chatId: number, perfil: UsuarioCompleto): Promise<void> {
    if (this.usuarioService.tienePermisos(perfil, 'reportes')) {
      // Reportes administrativos
      const botones = [
        [
          { text: '📊 Documentos del día', callback_data: 'reporte_dia' },
          { text: '📋 Expedientes pendientes', callback_data: 'reporte_pendientes' }
        ],
        [
          { text: '📈 Reporte semanal', callback_data: 'reporte_semanal' },
          { text: '🏢 Por áreas', callback_data: 'reporte_areas' }
        ],
        [
          { text: `📍 Mi área (${perfil.area})`, callback_data: 'reporte_mi_area' }
        ]
      ];

      await this.telegramService.enviarMensajeConBotones(
        chatId,
        `📊 **Reportes administrativos**
*Disponible para: ${perfil.cargo}*

**Selecciona un reporte:**`,
        botones
      );
    } else {
      // Reportes básicos para usuarios
      await this.comandoReportesBasicos(chatId, perfil);
    }
  }

  /**
   * Comando /test - Estado del sistema
   */
  private async comandoTest(chatId: number, perfil: UsuarioCompleto, usuario: TelegramUser): Promise<void> {
    const estadoConfig = config.getConfigStatus();
    const estadoSistema = await this.obtenerEstadoSistema();

    const mensaje = `🔧 **Estado del sistema**

**Variables configuradas:**
${Object.entries(estadoConfig).map(([key, value]) => 
  `${value ? '✅' : '❌'} ${this.formatearNombreConfig(key)}`
).join('\n')}

**Conectividad:**
${Object.entries(estadoSistema).map(([key, value]) => 
  `${value ? '✅' : '❌'} ${this.formatearNombreServicio(key)}`
).join('\n')}

**Usuario detectado:**
• **Telegram ID:** @${usuario.username || usuario.id}
• **Acceso:** ${perfil.acceso}
• **Área:** ${perfil.area}
• **Permisos:** ${perfil.es_admin ? 'Administrador' : 'Usuario'}

**Timestamp:** ${new Date().toLocaleString('es-PE')}`;

    await this.telegramService.enviarMensaje(chatId, mensaje);
  }

  /**
   * Comando /help - Ayuda completa
   */
  private async comandoHelp(chatId: number, perfil: UsuarioCompleto): Promise<void> {
    const mensaje = `📚 **Guía completa del bot**

**🚀 Comandos principales:**
/start - Mensaje de bienvenida
/enviar - Instrucciones para enviar documentos
/estado - Consultar expedientes
/reportes - Ver estadísticas
/perfil - Tu información personal
/test - Estado del sistema
/help - Esta ayuda

**📤 Envío de documentos:**
• Envía directamente archivos PDF o imágenes
• El bot los procesará automáticamente
• Recibirás un número de expediente

**🔍 Consultas:**
• Envía número de expediente: 2025-XXXXXXXXXX
• Usa palabras como "buscar expediente"

**📊 Reportes:**
${perfil.es_admin ? '• Acceso completo a reportes administrativos' : '• Reportes básicos de tus documentos'}

**💡 Consejos:**
• Los documentos PDF se procesan más rápido
• Las fotos deben ser claras y legibles
• Usa /estado para seguimiento de expedientes

**¿Alguna pregunta específica?**`;

    await this.telegramService.enviarMensaje(chatId, mensaje);
  }

  /**
   * Comando desconocido
   */
  private async comandoDesconocido(chatId: number, comando: string): Promise<void> {
    const mensaje = `❓ **Comando no reconocido:** ${comando}

**Comandos disponibles:**
/start - Inicio
/enviar - Registrar documento
/estado - Consultar expediente
/reportes - Estadísticas
/perfil - Mi información
/test - Estado del sistema
/help - Ayuda completa

**💡 También puedes:**
• Enviar archivos directamente
• Escribir números de expediente
• Hacer consultas en texto libre`;

    await this.telegramService.enviarMensaje(chatId, mensaje);
  }

  /**
   * Genera reportes específicos (llamado desde texto libre)
   */
  async generarReporte(chatId: number, opcion: string, perfil: UsuarioCompleto): Promise<void> {
    if (!this.usuarioService.tienePermisos(perfil, 'reportes')) {
      await this.telegramService.enviarMensaje(chatId, 
        '❌ **Sin permisos**\n\nNo tienes acceso a reportes administrativos.'
      );
      return;
    }

    try {
      const stats = await this.expedienteService.obtenerEstadisticas();
      
      switch (opcion) {
        case '1':
          await this.reporteDelDia(chatId, stats, perfil);
          break;
        case '2':
          await this.reportePendientes(chatId, stats, perfil);
          break;
        case '3':
          await this.reporteSemanal(chatId, stats, perfil);
          break;
        case '4':
          await this.reportePorAreas(chatId, stats, perfil);
          break;
        case '5':
          await this.reporteMiArea(chatId, stats, perfil);
          break;
        default:
          await this.telegramService.enviarMensaje(chatId, 
            '❓ Opción no válida. Usa /reportes para ver las opciones disponibles.'
          );
      }

    } catch (error) {
      console.error('Error generando reporte:', error);
      await this.telegramService.enviarMensaje(chatId, 
        '❌ **Error generando reporte**\n\nIntenta de nuevo en unos momentos.'
      );
    }
  }

  // ===== MÉTODOS PRIVADOS =====

  private obtenerDescripcionPermisos(perfil: UsuarioCompleto): string {
    if (perfil.acceso === 'Admin' || perfil.acceso === 'Super') {
      return 'Completos (registrar, derivar, reportes)';
    } else if (perfil.acceso === 'User') {
      return 'Registrar y consultar documentos';
    } else {
      return 'Solo consultas y solicitudes ciudadanas';
    }
  }

  private async comandoReportesBasicos(chatId: number, perfil: UsuarioCompleto): Promise<void> {
    const mensaje = `📊 **Mis documentos**

**Estadísticas personales:**
• Documentos enviados: En desarrollo
• Expedientes pendientes: En desarrollo  
• Última actividad: Hoy

**Para consultar expedientes específicos:**
• Usa /estado
• Envía el número de expediente

*Los reportes administrativos están disponibles solo para jefes de área*`;

    await this.telegramService.enviarMensaje(chatId, mensaje);
  }

  private async obtenerEstadoSistema(): Promise<Record<string, boolean>> {
    try {
      const usuarios = await this.usuarioService.obtenerTodosLosUsuarios();
      const stats = await this.expedienteService.obtenerEstadisticas();
      
      return {
        usuarios_cargados: usuarios.length > 0,
        expedientes_accesibles: stats.total >= 0,
        google_sheets_conectado: true,
        telegram_activo: true
      };
    } catch (error) {
      return {
        usuarios_cargados: false,
        expedientes_accesibles: false,
        google_sheets_conectado: false,
        telegram_activo: false
      };
    }
  }

  private formatearNombreConfig(key: string): string {
    const nombres: Record<string, string> = {
      'telegram_configured': 'Telegram Bot',
      'google_sheets_configured': 'Google Sheets',
      'google_auth_configured': 'Autenticación Google',
      'google_drive_configured': 'Google Drive',
      'claude_configured': 'Claude API'
    };
    return nombres[key] || key;
  }

  private formatearNombreServicio(key: string): string {
    const nombres: Record<string, string> = {
      'usuarios_cargados': 'Usuarios cargados',
      'expedientes_accesibles': 'Expedientes accesibles', 
      'google_sheets_conectado': 'Google Sheets conectado',
      'telegram_activo': 'Telegram activo'
    };
    return nombres[key] || key;
  }

  // ===== MÉTODOS DE REPORTES =====

  private async reporteDelDia(chatId: number, stats: any, perfil: UsuarioCompleto): Promise<void> {
    const mensaje = `📈 **Documentos del día**

**Resumen:**
• **Total:** ${stats.hoy} documentos
• **Procesados:** ${stats.por_estado['Atendido'] || 0}
• **Pendientes:** ${stats.por_estado['Recibido'] + stats.por_estado['En proceso'] || 0}

**Por estado:**
• Recibidos: ${stats.por_estado['Recibido'] || 0}
• En proceso: ${stats.por_estado['En proceso'] || 0}
• Derivados: ${stats.por_estado['Derivado'] || 0}
• Atendidos: ${stats.por_estado['Atendido'] || 0}

**Generado:** ${new Date().toLocaleString('es-PE')}`;

    await this.telegramService.enviarMensaje(chatId, mensaje);
  }

  private async reportePendientes(chatId: number, stats: any, perfil: UsuarioCompleto): Promise<void> {
    const pendientes = (stats.por_estado['Recibido'] || 0) + 
                     (stats.por_estado['En proceso'] || 0) + 
                     (stats.por_estado['Derivado'] || 0);

    const mensaje = `📊 **Expedientes pendientes**

**Total pendientes:** ${pendientes} expedientes

**Desglose:**
• Por atender: ${stats.por_estado['Por atender'] || 0}
• En proceso: ${stats.por_estado['En proceso'] || 0} 
• Derivados: ${stats.por_estado['Derivado'] || 0}
• Observados: ${stats.por_estado['Observado'] || 0}

**Por prioridad:**
• Muy urgente: ${stats.por_prioridad['Muy Urgente'] || 0}
• Alta: ${stats.por_prioridad['Alta'] || 0}
• Media: ${stats.por_prioridad['Media'] || 0}
• Baja: ${stats.por_prioridad['Baja'] || 0}`;

    await this.telegramService.enviarMensaje(chatId, mensaje);
  }

  private async reporteSemanal(chatId: number, stats: any, perfil: UsuarioCompleto): Promise<void> {
    const mensaje = `📈 **Reporte semanal**

**Total expedientes:** ${stats.total}
**Esta semana:** ${stats.hoy * 7} (estimado)

**Rendimiento:**
• Atendidos: ${stats.por_estado['Atendido'] || 0} (${Math.round(((stats.por_estado['Atendido'] || 0) / stats.total) * 100)}%)
• En proceso: ${stats.por_estado['En proceso'] || 0}
• Pendientes: ${stats.por_estado['Recibido'] || 0}

**Tipos de documentos:**
• Externos: ${stats.por_tipo['Externo'] || 0}
• Internos: ${stats.por_tipo['Interno'] || 0}

*Reporte automático generado*`;

    await this.telegramService.enviarMensaje(chatId, mensaje);
  }

  private async reportePorAreas(chatId: number, stats: any, perfil: UsuarioCompleto): Promise<void> {
    const mensaje = `🏢 **Reporte por áreas**

**Estadísticas generales:**
• Total expedientes: ${stats.total}
• Documentos hoy: ${stats.hoy}

**Por tipo:**
• Externos (ciudadanos): ${stats.por_tipo['Externo'] || 0}
• Internos (municipalidad): ${stats.por_tipo['Interno'] || 0}

**Estados actuales:**
• Atendidos: ${stats.por_estado['Atendido'] || 0}
• En proceso: ${stats.por_estado['En proceso'] || 0}
• Derivados: ${stats.por_estado['Derivado'] || 0}

*Para reportes específicos por área, contacta al administrador del sistema*`;

    await this.telegramService.enviarMensaje(chatId, mensaje);
  }

  private async reporteMiArea(chatId: number, stats: any, perfil: UsuarioCompleto): Promise<void> {
    try {
      const expedientesArea = await this.expedienteService.obtenerExpedientesPorArea(perfil.area);
      
      const mensaje = `📍 **Reporte: ${perfil.area}**

**Expedientes de tu área:**
• Total: ${expedientesArea.length}
• Pendientes: ${expedientesArea.filter(e => e.estado !== 'Atendido').length}
• Atendidos: ${expedientesArea.filter(e => e.estado === 'Atendido').length}

**Por prioridad:**
• Alta/Urgente: ${expedientesArea.filter(e => ['Alta', 'Muy Urgente'].includes(e.prioridad)).length}
• Media: ${expedientesArea.filter(e => e.prioridad === 'Media').length}
• Baja: ${expedientesArea.filter(e => e.prioridad === 'Baja').length}

**Tu rol:** ${perfil.cargo}
**Acceso:** ${perfil.acceso}`;

      await this.telegramService.enviarMensaje(chatId, mensaje);

    } catch (error) {
      console.error('Error en reporte de área:', error);
      await this.telegramService.enviarMensaje(chatId, 
        `❌ **Error generando reporte de ${perfil.area}**\n\nIntenta de nuevo más tarde.`
      );
    }
  }
}