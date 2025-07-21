// src/services/ExpedienteService.ts - Servicio para manejo de expedientes

import { 
  Expediente, 
  ExpedienteRegistro, 
  UsuarioCompleto, 
  ArchivoInfo, 
  AnalisisDocumento,
  TipoExpediente,
  PrioridadNivel,
  EstadoExpediente,
  TipoDocumento
} from '../types';
import { GoogleSheetsService } from './google-sheets-service';
import { config } from '../config';

export class ExpedienteService {
  private googleSheets: GoogleSheetsService;

  constructor() {
    this.googleSheets = new GoogleSheetsService();
  }

  /**
   * Genera un nuevo número de expediente único
   */
  generarNumeroExpediente(): string {
    const ahora = new Date();
    const year = ahora.getFullYear();
    const month = String(ahora.getMonth() + 1).padStart(2, '0');
    const day = String(ahora.getDate()).padStart(2, '0');
    const hour = String(ahora.getHours()).padStart(2, '0');
    const minute = String(ahora.getMinutes()).padStart(2, '0');
    const second = String(ahora.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}${day}${hour}${minute}${second}`;
  }

  /**
   * Genera código de documento basado en tipo de expediente
   */
  generarCodigoDocumento(tipoExpediente: TipoExpediente, numeroSecuencial: number): string {
    const prefijo = tipoExpediente === 'Externo' ? 'E' : 'C';
    return `${prefijo}-${numeroSecuencial}`;
  }

  /**
   * Registra un nuevo expediente en Google Sheets
   */
  async registrarExpediente(
    archivoInfo: ArchivoInfo,
    analisis: AnalisisDocumento,
    usuario: UsuarioCompleto,
    observaciones?: string
  ): Promise<{ numeroExpediente: string; expediente: Expediente }> {
    try {
      const ahora = new Date();
      const numeroExpediente = this.generarNumeroExpediente();
      
      // Obtener próximo número secuencial
      const numeroSecuencial = await this.obtenerProximoNumeroSecuencial();
      const codigoDocumento = this.generarCodigoDocumento(
        usuario.es_interno ? 'Interno' : 'Externo',
        numeroSecuencial
      );

      // Crear expediente
      const expediente: Expediente = {
        tipo: usuario.es_interno ? 'Interno' : 'Externo',
        exp: numeroSecuencial,
        doc: codigoDocumento,
        folios: 1, // Por defecto, se puede ajustar
        fecha_recepcion: ahora.toLocaleDateString('es-PE'),
        hora: ahora.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
        fecha_emision: ahora.toLocaleDateString('es-PE'), // Asumir misma fecha si no se especifica
        tipo_documento: this.detectarTipoDocumento(archivoInfo, analisis),
        nro_documento: '', // Se puede llenar después
        emisor_responsable: usuario.nombre_completo,
        emisor_area: usuario.area,
        asunto: analisis.asunto_detectado,
        referencia: '', // Se puede llenar después
        prioridad: analisis.prioridad,
        estado: 'Recibido',
        derivado_area: analisis.area_responsable !== usuario.area ? analisis.area_responsable : '',
        derivado_responsable: '', // Se llena al derivar
        tipo_derivado: '' // Se llena al derivar
      };

      // Preparar fila para Google Sheets
      const fila = this.expedienteAFila(expediente, numeroExpediente, archivoInfo.file_name, observaciones);

      // Registrar en Google Sheets
      await this.googleSheets.agregarFila(config.googleSheetsExpedientesId, fila);

      console.log(`✅ Expediente ${numeroExpediente} registrado exitosamente`);

      return { numeroExpediente, expediente };

    } catch (error) {
      console.error('Error registrando expediente:', error);
      throw new Error(`No se pudo registrar el expediente: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * Busca un expediente por su número
   */
  async buscarExpedientePorNumero(numeroExpediente: string): Promise<Expediente | null> {
    try {
      const filas = await this.googleSheets.obtenerFilas(config.expedientesSheetUrl);
      
      if (!filas || filas.length <= 1) {
        return null;
      }

      // Buscar expediente (asumiendo que el número está en alguna columna)
      const expedienteRow = filas.find(fila => 
        fila.some(celda => celda && celda.toString().includes(numeroExpediente))
      );

      if (!expedienteRow) {
        return null;
      }

      return this.filaAExpediente(expedienteRow);

    } catch (error) {
      console.error('Error buscando expediente:', error);
      return null;
    }
  }

  /**
   * Obtiene expedientes por estado
   */
  async obtenerExpedientesPorEstado(estado: EstadoExpediente): Promise<Expediente[]> {
    try {
      const filas = await this.googleSheets.obtenerFilas(config.expedientesSheetUrl);
      
      if (!filas || filas.length <= 1) {
        return [];
      }

      // Filtrar por estado (columna 14, índice 14)
      const expedientesFiltrados = filas
        .slice(1) // Saltar header
        .filter(fila => fila[14] === estado)
        .map(fila => this.filaAExpediente(fila));

      return expedientesFiltrados;

    } catch (error) {
      console.error('Error obteniendo expedientes por estado:', error);
      return [];
    }
  }

  /**
   * Obtiene expedientes por área
   */
  async obtenerExpedientesPorArea(area: string): Promise<Expediente[]> {
    try {
      const filas = await this.googleSheets.obtenerFilas(config.expedientesSheetUrl);
      
      if (!filas || filas.length <= 1) {
        return [];
      }

      // Filtrar por área emisora o derivada
      const expedientesFiltrados = filas
        .slice(1) // Saltar header
        .filter(fila => 
          fila[10]?.toLowerCase().includes(area.toLowerCase()) || // Emisor Area
          fila[15]?.toLowerCase().includes(area.toLowerCase())    // Derivado Area
        )
        .map(fila => this.filaAExpediente(fila));

      return expedientesFiltrados;

    } catch (error) {
      console.error('Error obteniendo expedientes por área:', error);
      return [];
    }
  }

  /**
   * Actualiza el estado de un expediente
   */
  async actualizarEstadoExpediente(numeroExpediente: string, nuevoEstado: EstadoExpediente): Promise<boolean> {
    try {
      const filas = await this.googleSheets.obtenerFilas(config.expedientesSheetUrl);
      
      if (!filas || filas.length <= 1) {
        return false;
      }

      // Encontrar la fila del expediente
      const indice = filas.findIndex(fila => 
        fila.some(celda => celda && celda.toString().includes(numeroExpediente))
      );

      if (indice === -1) {
        return false;
      }

      // Actualizar estado (columna 14, índice 14)
      const filaActualizada = [...filas[indice]];
      filaActualizada[14] = nuevoEstado;

      // Actualizar en Google Sheets
      const rango = `Sheet1!A${indice + 1}:R${indice + 1}`;
      await this.googleSheets.actualizarFila(config.googleSheetsExpedientesId, rango, filaActualizada);

      console.log(`✅ Estado actualizado para expediente ${numeroExpediente}: ${nuevoEstado}`);
      return true;

    } catch (error) {
      console.error('Error actualizando estado de expediente:', error);
      return false;
    }
  }

  /**
   * Deriva un expediente a otra área
   */
  async derivarExpediente(
    numeroExpediente: string,
    areaDestino: string,
    responsableDestino: string,
    tipoDerivacion: string = 'Derivado'
  ): Promise<boolean> {
    try {
      const filas = await this.googleSheets.obtenerFilas(config.expedientesSheetUrl);
      
      if (!filas || filas.length <= 1) {
        return false;
      }

      // Encontrar la fila del expediente
      const indice = filas.findIndex(fila => 
        fila.some(celda => celda && celda.toString().includes(numeroExpediente))
      );

      if (indice === -1) {
        return false;
      }

      // Actualizar campos de derivación
      const filaActualizada = [...filas[indice]];
      filaActualizada[14] = 'Derivado'; // Estado
      filaActualizada[15] = areaDestino; // Derivado - Area
      filaActualizada[16] = responsableDestino; // Derivado - Responsable
      filaActualizada[17] = tipoDerivacion; // Tipo Derivado

      // Actualizar en Google Sheets
      const rango = `Sheet1!A${indice + 1}:R${indice + 1}`;
      await this.googleSheets.actualizarFila(config.googleSheetsExpedientesId, rango, filaActualizada);

      console.log(`✅ Expediente ${numeroExpediente} derivado a ${areaDestino}`);
      return true;

    } catch (error) {
      console.error('Error derivando expediente:', error);
      return false;
    }
  }

  /**
   * Obtiene estadísticas de expedientes
   */
  async obtenerEstadisticas(): Promise<{
    total: number;
    hoy: number;
    por_estado: Record<EstadoExpediente, number>;
    por_prioridad: Record<PrioridadNivel, number>;
    por_tipo: Record<TipoExpediente, number>;
  }> {
    try {
      const filas = await this.googleSheets.obtenerFilas(config.expedientesSheetUrl);
      
      if (!filas || filas.length <= 1) {
        return this.estadisticasVacias();
      }

      const hoy = new Date().toLocaleDateString('es-PE');
      const expedientes = filas.slice(1).map(fila => this.filaAExpediente(fila));

      const stats = this.estadisticasVacias();
      stats.total = expedientes.length;

      expedientes.forEach(expediente => {
        // Contar por día
        if (expediente.fecha_recepcion === hoy) {
          stats.hoy++;
        }

        // Contar por estado
        stats.por_estado[expediente.estado]++;

        // Contar por prioridad
        stats.por_prioridad[expediente.prioridad]++;

        // Contar por tipo
        stats.por_tipo[expediente.tipo]++;
      });

      return stats;

    } catch (error) {
      console.error('Error obteniendo estadísticas de expedientes:', error);
      return this.estadisticasVacias();
    }
  }

  // ===== MÉTODOS PRIVADOS =====

  private async obtenerProximoNumeroSecuencial(): Promise<number> {
    try {
      const stats = await this.googleSheets.obtenerRangoUtilizado(config.googleSheetsExpedientesId);
      return stats.filas; // El próximo número secuencial
    } catch (error) {
      console.warn('Error obteniendo número secuencial, usando timestamp:', error);
      return Date.now() % 10000; // Fallback
    }
  }

  private detectarTipoDocumento(archivoInfo: ArchivoInfo, analisis: AnalisisDocumento): TipoDocumento {
    // Detectar por nombre de archivo
    const nombre = archivoInfo.file_name.toLowerCase();
    
    if (nombre.includes('oficio')) return 'Oficio';
    if (nombre.includes('informe')) return 'Informe';
    if (nombre.includes('solicitud')) return 'Solicitud';
    if (nombre.includes('memorando')) return 'Memorando';
    
    // Detectar por tipo de archivo
    if (archivoInfo.tipo_detectado === 'imagen') return 'Formulario';
    
    // Por defecto
    return 'Formulario';
  }

  private expedienteAFila(
    expediente: Expediente, 
    numeroExpediente: string, 
    nombreArchivo: string, 
    observaciones?: string
  ): (string | number)[] {
    return [
      expediente.tipo,
      expediente.exp,
      expediente.doc,
      expediente.folios,
      expediente.fecha_recepcion,
      expediente.hora,
      expediente.fecha_emision,
      expediente.tipo_documento,
      expediente.nro_documento,
      expediente.emisor_responsable,
      expediente.emisor_area,
      expediente.asunto,
      expediente.referencia,
      expediente.prioridad,
      expediente.estado,
      expediente.derivado_area,
      expediente.derivado_responsable,
      expediente.tipo_derivado,
      numeroExpediente, // Extra: número completo
      nombreArchivo,    // Extra: archivo original
      observaciones || '' // Extra: observaciones
    ];
  }

  private filaAExpediente(fila: string[]): Expediente {
    return {
      tipo: (fila[0] as TipoExpediente) || 'Externo',
      exp: parseInt(fila[1]) || 0,
      doc: fila[2] || '',
      folios: parseInt(fila[3]) || 1,
      fecha_recepcion: fila[4] || '',
      hora: fila[5] || '',
      fecha_emision: fila[6] || '',
      tipo_documento: (fila[7] as TipoDocumento) || 'Formulario',
      nro_documento: fila[8] || '',
      emisor_responsable: fila[9] || '',
      emisor_area: fila[10] || '',
      asunto: fila[11] || '',
      referencia: fila[12] || '',
      prioridad: (fila[13] as PrioridadNivel) || 'Media',
      estado: (fila[14] as EstadoExpediente) || 'Recibido',
      derivado_area: fila[15] || '',
      derivado_responsable: fila[16] || '',
      tipo_derivado: fila[17] || ''
    };
  }

  private estadisticasVacias() {
    return {
      total: 0,
      hoy: 0,
      por_estado: {
        'Recibido': 0,
        'Derivado': 0,
        'Por atender': 0,
        'Atendido': 0,
        'En proceso': 0,
        'Observado': 0
      } as Record<EstadoExpediente, number>,
      por_prioridad: {
        'Alta': 0,
        'Media': 0,
        'Baja': 0,
        'Muy Urgente': 0
      } as Record<PrioridadNivel, number>,
      por_tipo: {
        'Externo': 0,
        'Interno': 0
      } as Record<TipoExpediente, number>
    };
  }
}