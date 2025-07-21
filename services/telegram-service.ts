// src/services/TelegramService.ts - Servicio para comunicación con Telegram

import { ArchivoInfo, TipoArchivo, ArchivoTelegram } from '../types';
import { config } from '../config';

// Interfaces para las respuestas de Telegram API
interface TelegramResponse {
  ok: boolean;
  description?: string;
  result?: any;
}

interface TelegramFileResponse {
  ok: boolean;
  description?: string;
  result?: {
    file_path?: string;
    file_size?: number;
  };
}

export class TelegramService {
  private readonly apiUrl: string;

  constructor() {
    this.apiUrl = config.telegramApiUrl;
  }

  /**
   * Envía un mensaje de texto a un chat
   */
  async enviarMensaje(chatId: number, texto: string, parseMode: 'Markdown' | 'HTML' = 'Markdown'): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: texto,
          parse_mode: parseMode
        })
      });

      const result = await response.json() as TelegramResponse;
      
      if (!result.ok) {
        console.error('Error enviando mensaje Telegram:', result);
        return false;
      }

      console.log('✅ Mensaje enviado a Telegram');
      return true;

    } catch (error) {
      console.error('❌ Error en enviarMensaje:', error);
      return false;
    }
  }

  /**
   * Envía un mensaje con botones inline
   */
  async enviarMensajeConBotones(
    chatId: number, 
    texto: string, 
    botones: Array<Array<{ text: string; callback_data: string }>>
  ): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: texto,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: botones
          }
        })
      });

      const result = await response.json() as TelegramResponse;
      
      if (!result.ok) {
        console.error('Error enviando mensaje con botones:', result);
        return false;
      }

      console.log('✅ Mensaje con botones enviado');
      return true;

    } catch (error) {
      console.error('❌ Error en enviarMensajeConBotones:', error);
      return false;
    }
  }

  /**
   * Obtiene información de un archivo de Telegram
   */
  async obtenerInfoArchivo(fileId: string): Promise<{
    file_path?: string;
    file_size?: number;
    error?: string;
  }> {
    try {
      const response = await fetch(`${this.apiUrl}/getFile?file_id=${fileId}`);
      const result = await response.json() as TelegramFileResponse;
      
      if (!result.ok) {
        return { error: result.description || 'Error obteniendo archivo' };
      }

      return {
        file_path: result.result?.file_path,
        file_size: result.result?.file_size
      };

    } catch (error) {
      console.error('Error obteniendo info de archivo:', error);
      return { error: 'Error de conexión' };
    }
  }

  /**
   * Descarga un archivo de Telegram
   */
  async descargarArchivo(filePath: string): Promise<Buffer | null> {
    try {
      const downloadUrl = `https://api.telegram.org/file/bot${config.telegramToken}/${filePath}`;
      
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.requestTimeout);
      
      const response = await fetch(downloadUrl, {
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error('Error descargando archivo:', response.statusText);
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);

    } catch (error) {
      console.error('Error en descargarArchivo:', error);
      return null;
    }
  }

  /**
   * Analiza un archivo de Telegram y devuelve información procesable
   */
  analizarArchivo(archivo: ArchivoTelegram, tipoMensaje?: string): ArchivoInfo {
    const info: ArchivoInfo = {
      file_id: archivo.file_id,
      file_name: this.obtenerNombreArchivo(archivo, tipoMensaje),
      file_size: archivo.file_size || 0,
      mime_type: this.obtenerMimeType(archivo),
      tipo_detectado: 'desconocido',
      extension: '',
      es_procesable: false
    };

    // Detectar extensión
    info.extension = this.obtenerExtension(archivo);
    
    // Detectar tipo
    info.tipo_detectado = this.detectarTipo(info.extension, info.mime_type);
    
    // Verificar si es procesable
    info.es_procesable = this.esArchivoProcesable(info);

    return info;
  }

  /**
   * Valida si un archivo puede ser procesado por el bot
   */
  validarArchivo(archivoInfo: ArchivoInfo): { valido: boolean; razon?: string } {
    // Verificar tamaño
    if (archivoInfo.file_size > config.maxFileSize) {
      return { 
        valido: false, 
        razon: `Archivo muy grande (máx. ${Math.round(config.maxFileSize / 1024 / 1024)}MB)` 
      };
    }

    // Verificar tipo
    if (!archivoInfo.es_procesable) {
      return { 
        valido: false, 
        razon: `Tipo de archivo no soportado (${archivoInfo.extension})` 
      };
    }

    // Verificar MIME type
    if (archivoInfo.mime_type && !config.supportedMimeTypes.includes(archivoInfo.mime_type)) {
      return { 
        valido: false, 
        razon: `Formato no soportado (${archivoInfo.mime_type})` 
      };
    }

    return { valido: true };
  }

  /**
   * Envía mensaje de estado de typing
   */
  async enviarEstadoTyping(chatId: number): Promise<void> {
    try {
      await fetch(`${this.apiUrl}/sendChatAction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          action: 'typing'
        })
      });
    } catch (error) {
      // No es crítico si falla
      console.warn('No se pudo enviar estado typing:', error);
    }
  }

  /**
   * Envía mensaje de estado de subida de documento
   */
  async enviarEstadoSubiendoDocumento(chatId: number): Promise<void> {
    try {
      await fetch(`${this.apiUrl}/sendChatAction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          action: 'upload_document'
        })
      });
    } catch (error) {
      console.warn('No se pudo enviar estado subiendo documento:', error);
    }
  }

  // ===== MÉTODOS PRIVADOS =====

  private obtenerNombreArchivo(archivo: ArchivoTelegram, tipoMensaje?: string): string {
    // Si tiene nombre de archivo, usarlo
    if ('file_name' in archivo && archivo.file_name) {
      return archivo.file_name;
    }

    // Generar nombre basado en tipo
    const timestamp = Date.now();
    const extension = this.obtenerExtension(archivo);
    
    const tipoMap: Record<string, string> = {
      'foto': 'imagen',
      'video': 'video',
      'audio': 'audio',
      'voice': 'nota_voz',
      'documento': 'documento'
    };

    const nombreBase = tipoMap[tipoMensaje || 'documento'] || 'archivo';
    return `${nombreBase}_${timestamp}.${extension}`;
  }

  private obtenerMimeType(archivo: ArchivoTelegram): string {
    if ('mime_type' in archivo && archivo.mime_type) {
      return archivo.mime_type;
    }

    // Mapeo por extensión si no hay mime_type
    const extension = this.obtenerExtension(archivo);
    const mimeMap: Record<string, string> = {
      'pdf': 'application/pdf',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp'
    };

    return mimeMap[extension] || 'application/octet-stream';
  }

  private obtenerExtension(archivo: ArchivoTelegram): string {
    // Para archivos con nombre
    if ('file_name' in archivo && archivo.file_name) {
      return archivo.file_name.split('.').pop()?.toLowerCase() || 'bin';
    }

    // Para archivos sin nombre, usar mime_type
    if ('mime_type' in archivo && archivo.mime_type) {
      const mimeToExt: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'application/pdf': 'pdf',
        'video/mp4': 'mp4',
        'audio/mpeg': 'mp3',
        'audio/ogg': 'ogg'
      };
      return mimeToExt[archivo.mime_type] || 'bin';
    }

    return 'bin';
  }

  private detectarTipo(extension: string, mimeType: string): TipoArchivo {
    // Tipos de imagen
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension) || 
        mimeType.startsWith('image/')) {
      return 'imagen';
    }

    // Tipo PDF
    if (extension === 'pdf' || mimeType === 'application/pdf') {
      return 'pdf';
    }

    // Tipos de documento
    if (['doc', 'docx', 'xls', 'xlsx', 'txt'].includes(extension)) {
      return 'documento';
    }

    return 'desconocido';
  }

  private esArchivoProcesable(archivoInfo: ArchivoInfo): boolean {
    return config.supportedExtensions.includes(archivoInfo.extension) &&
           archivoInfo.tipo_detectado !== 'desconocido' &&
           archivoInfo.file_size <= config.maxFileSize;
  }
}