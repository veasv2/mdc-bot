// src/controllers/BotController.ts - Controlador principal del bot

import { TelegramMessage, UsuarioCompleto, ComandoBot } from '../types';
import { UsuarioService } from 'services/usuario-service';
import { TelegramService } from 'services/telegram-service';
import { ExpedienteService } from 'services/expediente-service';
import { AnalisisService } from 'services/analisis-service';
import { CommandHandler } from 'handlers/command-handler';
import { DocumentHandler } from 'handlers/document-handler';
import { config } from '../config';

export class BotController {
  private usuarioService: UsuarioService;
  private telegramService: TelegramService;
  private expedienteService: ExpedienteService;
  private analisisService: AnalisisService;
  private commandHandler: CommandHandler;
  private documentHandler: DocumentHandler;

  constructor() {
    this.usuarioService = new UsuarioService();
    this.telegramService = new TelegramService();
    this.expedienteService = new ExpedienteService();
    this.analisisService = new AnalisisService();
    this.commandHandler = new CommandHandler(this.usuarioService, this.telegramService, this.expedienteService);
    this.documentHandler = new DocumentHandler(
      this.telegramService, 
      this.expedienteService, 
      this.analisisService, 
      this.usuarioService
    );
  }

  /**
   * Procesa un mensaje de Telegram
   */
  async procesarMensaje(message: TelegramMessage): Promise<void> {
    const chatId = message.chat.id;
    const texto = message.text;
    const usuario = message.from;

    try {
      // Log del mensaje
      console.log('🔄 Procesando mensaje:', {
        usuario: `${usuario.first_name} (@${usuario.username || usuario.id})`,
        texto: texto || 'sin texto',
        adjuntos: {
          documento: !!message.document,
          foto: !!message.photo,
          video: !!message.video,
          audio: !!message.audio || !!message.voice
        }
      });

      // Obtener perfil del usuario
      const perfilUsuario = await this.usuarioService.obtenerPerfilUsuario(usuario);
      
      // Enviar estado de "escribiendo"
      await this.telegramService.enviarEstadoTyping(chatId);

      // Determinar tipo de mensaje y procesar
      if (texto?.startsWith('/')) {
        // Comando
        await this.commandHandler.manejarComando(chatId, texto as ComandoBot, usuario, perfilUsuario);
      }
      else if (message.document) {
        // Documento
        await this.documentHandler.procesarDocumento(chatId, message.document, usuario, perfilUsuario, 'documento');
      }
      else if (message.photo) {
        // Foto - tomar la de mayor resolución
        const foto = message.photo[message.photo.length - 1];
        await this.documentHandler.procesarDocumento(chatId, foto, usuario, perfilUsuario, 'foto');
      }
      else if (message.video) {
        // Video (no procesamos pero informamos)
        await this.telegramService.enviarMensaje(chatId, 
          '❌ **Videos no soportados**\n\nActualmente solo procesamos:\n• 📄 Documentos PDF\n• 📸 Imágenes\n\n¿Podrías enviar tu documento como PDF o imagen?'
        );
      }
      else if (message.audio || message.voice) {
        // Audio (no procesamos pero informamos)
        await this.telegramService.enviarMensaje(chatId,
          '❌ **Audio no soportado**\n\nActualmente solo procesamos:\n• 📄 Documentos PDF\n• 📸 Imágenes\n\n¿Podrías enviar tu documento como PDF o imagen?'
        );
      }
      else if (texto) {
        // Texto libre
        await this.procesarTextoLibre(chatId, texto, usuario, perfilUsuario);
      }
      else {
        // Tipo de mensaje no reconocido
        await this.telegramService.enviarMensaje(chatId, `🤔 **Tipo de mensaje no reconocido**

**Puedo procesar:**
• 📄 Documentos PDF
• 📸 Fotos e imágenes
• 💬 Mensajes de texto
• ⚡ Comandos (/start, /perfil, etc.)

¿Podrías enviar tu archivo nuevamente?`);
      }

    } catch (error) {
      console.error('❌ Error procesando mensaje:', error);
      
      await this.telegramService.enviarMensaje(chatId, 
        '❌ **Error temporal del sistema**\n\nIntenta de nuevo en unos momentos.\n\nSi el problema persiste, contacta al administrador.'
      );
    }
  }

  /**
   * Procesa texto libre (consultas, números de expediente, etc.)
   */
  private async procesarTextoLibre(
    chatId: number, 
    texto: string, 
    usuario: any, 
    perfil: UsuarioCompleto
  ): Promise<void> {
    const textoLimpio = texto.trim();

    // Verificar si es un número de expediente
    if (textoLimpio.match(/2025-\d{10}/)) {
      await this.consultarExpediente(chatId, textoLimpio, perfil);
      return;
    }

    // Verificar si es una opción de reporte (números 1-5)
    if (['1', '2', '3', '4', '5'].includes(textoLimpio)) {
      await this.commandHandler.generarReporte(chatId, textoLimpio, perfil);
      return;
    }

    // Verificar si es una búsqueda
    if (textoLimpio.toLowerCase().includes('buscar') || textoLimpio.toLowerCase().includes('expediente')) {
      await this.telegramService.enviarMensaje(chatId, `🔍 **Búsqueda de expedientes**

Para buscar un expediente específico, envía el número completo:
**Formato:** 2025-XXXXXXXXXX

**Ejemplo:** 2025-0107162830

¿Tienes el número del expediente que buscas?`);
      return;
    }

    // Respuesta genérica para texto libre
    await this.telegramService.enviarMensaje(chatId, `💭 Recibí: "${texto}"

**¿Qué puedes hacer?**
• **Enviar archivo:** Para registrar documento
• **Consultar expediente:** 2025-XXXXXXXXXX
• **Ver reportes:** /reportes
• **Ayuda completa:** /help

¿En qué más puedo ayudarte?`);
  }

  /**
   * Consulta un expediente específico
   */
  private async consultarExpediente(chatId: number, numeroExp: string, perfil: UsuarioCompleto): Promise<void> {
    try {
      await this.telegramService.enviarEstadoTyping(chatId);
      
      const expediente = await this.expedienteService.buscarExpedientePorNumero(numeroExp);
      
      if (!expediente) {
        await this.telegramService.enviarMensaje(chatId, `❌ **Expediente no encontrado**

**Número consultado:** ${numeroExp}

**Posibles causas:**
• Número incorrecto
• Expediente muy reciente (aún procesándose)
• Error de tipeo

**Formato correcto:** 2025-XXXXXXXXXX`);
        return;
      }

      // Mostrar información del expediente
      await this.telegramService.enviarMensaje(chatId, `📋 **Expediente encontrado**

**📋 Número:** ${numeroExp}
**📄 Código:** ${expediente.doc}
**📅 Fecha recepción:** ${expediente.fecha_recepcion} ${expediente.hora}
**👤 Emisor:** ${expediente.emisor_responsable}
**🏢 Área emisora:** ${expediente.emisor_area}

**📋 Estado actual:** ${expediente.estado}
**⚡ Prioridad:** ${expediente.prioridad}
**📝 Asunto:** ${expediente.asunto}

${expediente.derivado_area ? `**🔄 Derivado a:** ${expediente.derivado_area}` : ''}
${expediente.derivado_responsable ? `**👤 Responsable:** ${expediente.derivado_responsable}` : ''}

**📊 Tipo:** ${expediente.tipo_documento} (${expediente.folios} folio${expediente.folios > 1 ? 's' : ''})`);

    } catch (error) {
      console.error('Error consultando expediente:', error);
      await this.telegramService.enviarMensaje(chatId, `❌ **Error consultando expediente**

No se pudo acceder a la información en este momento.

Intenta nuevamente en unos minutos.`);
    }
  }

  /**
   * Verifica el estado del sistema
   */
  async verificarEstado(): Promise<{
    telegram: boolean;
    google_sheets: boolean;
    configuracion: boolean;
    servicios: boolean;
  }> {
    try {
      return {
        telegram: !!config.telegramToken,
        google_sheets: (await this.usuarioService.obtenerTodosLosUsuarios()).length >= 0,
        configuracion: config.isConfigured(),
        servicios: true
      };
    } catch (error) {
      console.error('Error verificando estado:', error);
      return {
        telegram: false,
        google_sheets: false,
        configuracion: false,
        servicios: false
      };
    }
  }
}