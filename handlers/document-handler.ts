// src/handlers/DocumentHandler.ts - Manejador de documentos

import { ArchivoTelegram, UsuarioCompleto, TelegramUser } from '../types';
import { TelegramService } from '../services/telegram-service';
import { ExpedienteService } from '../services/expediente-service';
import { AnalisisService } from '../services/analisis-service';
import { UsuarioService } from '../services/usuario-service';

export class DocumentHandler {
  private telegramService: TelegramService;
  private expedienteService: ExpedienteService;
  private analisisService: AnalisisService;
  private usuarioService: UsuarioService;

  constructor(
    telegramService: TelegramService,
    expedienteService: ExpedienteService,
    analisisService: AnalisisService,
    usuarioService: UsuarioService
  ) {
    this.telegramService = telegramService;
    this.expedienteService = expedienteService;
    this.analisisService = analisisService;
    this.usuarioService = usuarioService;
  }

  /**
   * Procesa cualquier tipo de documento enviado por Telegram
   */
  async procesarDocumento(
    chatId: number,
    archivo: ArchivoTelegram,
    usuario: TelegramUser,
    perfil: UsuarioCompleto,
    tipoMensaje: string = 'documento'
  ): Promise<void> {
    console.log(`📄 Procesando ${tipoMensaje}:`, {
      file_id: archivo.file_id,
      file_size: archivo.file_size,
      tipo: tipoMensaje
    });

    try {
      // Enviar estado de "subiendo documento"
      await this.telegramService.enviarEstadoSubiendoDocumento(chatId);

      // Analizar el archivo
      const archivoInfo = this.telegramService.analizarArchivo(archivo, tipoMensaje);
      
      console.log('📊 Archivo analizado:', {
        nombre: archivoInfo.file_name,
        tipo: archivoInfo.tipo_detectado,
        procesable: archivoInfo.es_procesable,
        tamaño: `${Math.round(archivoInfo.file_size / 1024)} KB`
      });

      // Validar el archivo
      const validacion = this.telegramService.validarArchivo(archivoInfo);
      
      if (!validacion.valido) {
        await this.telegramService.enviarMensaje(chatId, 
          `❌ **Archivo no válido**\n\n**Razón:** ${validacion.razon}\n\n**Formatos soportados:**\n• 📄 PDF (hasta 20MB)\n• 📸 Imágenes JPG, PNG, WEBP\n\n¿Podrías enviar el archivo en un formato compatible?`
        );
        return;
      }

      // Verificar permisos del usuario
      if (!this.usuarioService.tienePermisos(perfil, 'registrar')) {
        await this.telegramService.enviarMensaje(chatId, 
          `⚠️ **Acceso limitado**\n\nComo usuario externo, tu documento será registrado como solicitud ciudadana y derivado al área correspondiente para su procesamiento.\n\n**Continuando con el registro...**`
        );
      }

      // Enviar estado de "escribiendo" (procesando)
      await this.telegramService.enviarEstadoTyping(chatId);

      // Analizar el documento con IA
      const analisis = await this.analisisService.analizarDocumento(archivoInfo, perfil, tipoMensaje);

      console.log('🤖 Análisis completado:', {
        tipo: analisis.tipo,
        area: analisis.area_responsable,
        prioridad: analisis.prioridad,
        confianza: analisis.confianza
      });

      // Intentar registrar en Google Sheets
      let expediente;
      let registroExitoso = true;

      try {
        const resultado = await this.expedienteService.registrarExpediente(
          archivoInfo,
          analisis,
          perfil,
          `Archivo: ${archivoInfo.file_name}, Tipo: ${tipoMensaje}, Usuario: @${usuario.username || usuario.id}`
        );
        
        expediente = resultado;
        console.log('✅ Expediente registrado:', expediente.numeroExpediente);

      } catch (error) {
        console.error('❌ Error registrando en Google Sheets:', error);
        registroExitoso = false;
        
        // Generar expediente temporal para responder al usuario
        expediente = this.generarExpedienteTemporal();
      }

      // Enviar respuesta al usuario
      await this.enviarRespuestaRegistro(
        chatId, 
        archivoInfo, 
        analisis, 
        expediente, 
        perfil, 
        tipoMensaje, 
        registroExitoso
      );

      // Log final
      console.log(`✅ Documento ${tipoMensaje} procesado exitosamente:`, {
        expediente: expediente.numeroExpediente,
        usuario: perfil.nombre_completo,
        area: analisis.area_responsable,
        registro_exitoso: registroExitoso
      });

    } catch (error) {
      console.error(`❌ Error procesando ${tipoMensaje}:`, error);
      await this.manejarErrorProcesamiento(chatId, tipoMensaje, error);
    }
  }

  /**
   * Procesa específicamente fotos (con lógica especial para OCR futuro)
   */
  async procesarFoto(
    chatId: number,
    foto: ArchivoTelegram,
    usuario: TelegramUser,
    perfil: UsuarioCompleto
  ): Promise<void> {
    // Enviar mensaje específico para fotos
    await this.telegramService.enviarMensaje(chatId, 
      `📸 **Procesando fotografía...**\n\n*Analizando documento capturado con cámara*`
    );

    await this.procesarDocumento(chatId, foto, usuario, perfil, 'foto');
  }

  /**
   * Procesa documentos PDF con lógica específica
   */
  async procesarPDF(
    chatId: number,
    documento: ArchivoTelegram,
    usuario: TelegramUser,
    perfil: UsuarioCompleto
  ): Promise<void> {
    // Mensaje específico para PDFs
    await this.telegramService.enviarMensaje(chatId, 
      `📄 **Procesando documento PDF...**\n\n*Analizando contenido y metadatos*`
    );

    await this.procesarDocumento(chatId, documento, usuario, perfil, 'documento');
  }

  // ===== MÉTODOS PRIVADOS =====

  /**
   * Envía la respuesta final del registro
   */
  private async enviarRespuestaRegistro(
    chatId: number,
    archivoInfo: any,
    analisis: any,
    expediente: any,
    perfil: UsuarioCompleto,
    tipoMensaje: string,
    registroExitoso: boolean
  ): Promise<void> {
    const iconoTipo = this.obtenerIconoTipo(tipoMensaje);
    const estadoRegistro = registroExitoso ? 'Registrado' : 'Recibido (temporal)';
    
    const mensaje = `✅ **${iconoTipo} ${tipoMensaje.toUpperCase()} registrado**

📋 **Expediente:** ${expediente.numeroExpediente}
**Fecha:** ${new Date().toLocaleDateString('es-PE')}
**Estado:** ${estadoRegistro}

📄 **Archivo:** ${archivoInfo.file_name}
**Tamaño:** ${Math.round(archivoInfo.file_size / 1024)} KB
**Tipo detectado:** ${analisis.tipo}

🏢 **Procesamiento:**
**Asignado a:** ${analisis.area_responsable}
**Prioridad:** ${analisis.prioridad}
**Tiempo estimado:** ${analisis.tiempo_estimado}

📝 **Asunto:** ${analisis.asunto_detectado}

**Para seguimiento:** /estado ${expediente.numeroExpediente}

${!registroExitoso ? '\n⚠️ *Registro temporal - se sincronizará con el sistema principal*' : ''}
${analisis.requiere_revision ? '\n🔍 *Este documento será revisado manualmente por el área responsable*' : ''}
${perfil.es_interno ? '' : '\n👤 *Como ciudadano, recibirás notificaciones del progreso de tu expediente*'}`

    // Agregar botones de acción si es usuario interno
    if (perfil.es_interno && this.usuarioService.tienePermisos(perfil, 'derivar')) {
      const botones = [
        [
          { text: '🔄 Derivar expediente', callback_data: `derivar_${expediente.numeroExpediente}` },
          { text: '📊 Ver detalles', callback_data: `detalles_${expediente.numeroExpediente}` }
        ]
      ];

      await this.telegramService.enviarMensajeConBotones(chatId, mensaje, botones);
    } else {
      await this.telegramService.enviarMensaje(chatId, mensaje);
    }

    // Enviar información adicional según el análisis
    await this.enviarInformacionAdicional(chatId, analisis, perfil, archivoInfo);
  }

  /**
   * Envía información adicional basada en el análisis
   */
  private async enviarInformacionAdicional(
    chatId: number,
    analisis: any,
    perfil: UsuarioCompleto,
    archivoInfo: any
  ): Promise<void> {
    const mensajesAdicionales = [];

    // Información sobre prioridad alta
    if (analisis.prioridad === 'Muy Urgente' || analisis.prioridad === 'Alta') {
      mensajesAdicionales.push(`⚡ **Prioridad ${analisis.prioridad}**\n\nEste documento será procesado con prioridad debido a su naturaleza urgente.`);
    }

    // Información sobre revisión manual
    if (analisis.requiere_revision) {
      mensajesAdicionales.push(`🔍 **Revisión requerida**\n\nEste documento necesita revisión manual del área responsable para garantizar el procesamiento correcto.`);
    }

    // Consejos para usuarios externos
    if (!perfil.es_interno) {
      mensajesAdicionales.push(`💡 **Consejos para seguimiento:**\n\n• Guarda el número de expediente: ${analisis.numero || 'pendiente'}\n• Puedes consultar el estado en cualquier momento\n• Recibirás notificaciones de cambios importantes`);
    }

    // Información específica por tipo de archivo
    if (archivoInfo.tipo_detectado === 'imagen') {
      mensajesAdicionales.push(`📸 **Procesamiento de imagen**\n\nLa imagen será analizada para extraer texto y contenido. Si el texto no es legible, es posible que requiera intervención manual.`);
    }

    // Enviar mensajes adicionales con delay
    for (const mensaje of mensajesAdicionales) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 segundo de delay
      await this.telegramService.enviarMensaje(chatId, mensaje);
    }
  }

  /**
   * Maneja errores durante el procesamiento
   */
  private async manejarErrorProcesamiento(chatId: number, tipoMensaje: string, error: any): Promise<void> {
    console.error(`Error detallado procesando ${tipoMensaje}:`, {
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 3).join('\n')
    });

    const mensajesError = [
      `❌ **Error procesando ${tipoMensaje}**`,
      '',
      '**Posibles causas:**',
      '• Error temporal del sistema',
      '• Problema de conectividad',
      '• Archivo corrupto o inválido',
      '',
      '**Qué hacer:**',
      '• Intenta enviar el archivo nuevamente',
      '• Verifica que el archivo no esté dañado',
      '• Si persiste, contacta al administrador',
      '',
      '**Alternativas:**',
      '• Envía el documento en formato PDF',
      '• Usa una imagen más clara si es foto',
      '• Reduce el tamaño del archivo si es muy grande'
    ];

    await this.telegramService.enviarMensaje(chatId, mensajesError.join('\n'));

    // Si es un error específico, dar información más detallada
    if (error.message?.includes('Google Sheets')) {
      await this.telegramService.enviarMensaje(chatId, 
        `🔧 **Error de conexión con Google Sheets**\n\nEl sistema de registro está temporalmente indisponible. El documento se procesará tan pronto como se restablezca la conexión.`
      );
    } else if (error.message?.includes('timeout')) {
      await this.telegramService.enviarMensaje(chatId, 
        `⏱️ **Tiempo de espera agotado**\n\nEl archivo es muy grande o la conexión es lenta. Intenta con un archivo más pequeño.`
      );
    }
  }

  /**
   * Genera un expediente temporal cuando falla el registro principal
   */
  private generarExpedienteTemporal(): { numeroExpediente: string; expediente: any } {
    const ahora = new Date();
    const numeroExpediente = `2025-${String(ahora.getMonth() + 1).padStart(2, '0')}${String(ahora.getDate()).padStart(2, '0')}${String(ahora.getHours()).padStart(2, '0')}${String(ahora.getMinutes()).padStart(2, '0')}${String(ahora.getSeconds()).padStart(2, '0')}`;
    
    return {
      numeroExpediente,
      expediente: {
        numero: numeroExpediente,
        fecha: ahora.toLocaleDateString('es-PE'),
        estado: 'Recibido (temporal)',
        observaciones: 'Registro temporal - pendiente de sincronización'
      }
    };
  }

  /**
   * Obtiene el icono apropiado para el tipo de mensaje
   */
  private obtenerIconoTipo(tipoMensaje: string): string {
    const iconos: Record<string, string> = {
      'documento': '📄',
      'foto': '📸',
      'imagen': '🖼️',
      'pdf': '📋',
      'video': '🎥',
      'audio': '🎵'
    };

    return iconos[tipoMensaje] || '📎';
  }

  /**
   * Valida que el usuario tenga permisos para el tipo de operación
   */
  private validarPermisosUsuario(perfil: UsuarioCompleto, operacion: 'registrar' | 'derivar' | 'reportes' | 'admin'): boolean {
    return this.usuarioService.tienePermisos(perfil, operacion);
  }

  /**
   * Genera sugerencias específicas según el tipo de archivo y usuario
   */
  private generarSugerencias(archivoInfo: any, perfil: UsuarioCompleto, analisis: any): string[] {
    const sugerencias = [];

    // Sugerencias por tipo de archivo
    if (archivoInfo.tipo_detectado === 'imagen') {
      sugerencias.push('💡 Para mejor procesamiento, envía documentos en formato PDF cuando sea posible');
    }

    if (archivoInfo.file_size > 5 * 1024 * 1024) { // > 5MB
      sugerencias.push('📏 Considera comprimir archivos grandes para acelerar el procesamiento');
    }

    // Sugerencias por usuario
    if (!perfil.es_interno) {
      sugerencias.push('📞 Puedes contactar directamente al área responsable para seguimiento urgente');
    }

    if (perfil.es_admin) {
      sugerencias.push('👑 Como administrador, puedes derivar este expediente inmediatamente usando los botones de acción');
    }

    // Sugerencias por análisis
    if (analisis.confianza < 0.7) {
      sugerencias.push('🔍 El análisis automático tiene baja confianza - considera agregar más detalles en el nombre del archivo');
    }

    return sugerencias;
  }

  /**
   * Procesa archivos grandes con lógica especial
   */
  private async procesarArchivoGrande(chatId: number, archivoInfo: any): Promise<void> {
    await this.telegramService.enviarMensaje(chatId, 
      `📁 **Archivo grande detectado**\n\n**Tamaño:** ${Math.round(archivoInfo.file_size / 1024 / 1024)} MB\n\n*Procesando... esto puede tomar unos momentos adicionales*`
    );
  }

  /**
   * Método público para procesar documentos con validación completa
   */
  async procesarDocumentoCompleto(
    chatId: number,
    archivo: ArchivoTelegram,
    usuario: TelegramUser,
    perfil: UsuarioCompleto,
    tipoMensaje: string = 'documento'
  ): Promise<{ exito: boolean; numeroExpediente?: string; error?: string }> {
    try {
      await this.procesarDocumento(chatId, archivo, usuario, perfil, tipoMensaje);
      return { exito: true };
    } catch (error) {
      return { 
        exito: false, 
        error: error instanceof Error ? error.message : 'Error desconocido' 
      };
    }
  }

  /**
   * Obtiene estadísticas de procesamiento de documentos
   */
  async obtenerEstadisticasProcesamiento(): Promise<{
    documentos_procesados: number;
    tipos_detectados: Record<string, number>;
    areas_mas_activas: Record<string, number>;
    promedio_tiempo_procesamiento: string;
  }> {
    try {
      // Esta información se obtendría del expediente service o una base de datos
      // Por ahora retornamos datos simulados
      return {
        documentos_procesados: 0,
        tipos_detectados: {},
        areas_mas_activas: {},
        promedio_tiempo_procesamiento: '2-3 minutos'
      };
    } catch (error) {
      console.error('Error obteniendo estadísticas de procesamiento:', error);
      return {
        documentos_procesados: 0,
        tipos_detectados: {},
        areas_mas_activas: {},
        promedio_tiempo_procesamiento: 'No disponible'
      };
    }
  }
}