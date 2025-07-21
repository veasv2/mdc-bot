// src/services/AnalisisService.ts - Servicio para análisis de documentos

import { 
  AnalisisDocumento, 
  ArchivoInfo, 
  UsuarioCompleto, 
  PrioridadNivel, 
  TipoArchivo 
} from '../types';
import { config } from '../config';
import Anthropic from '@anthropic-ai/sdk';

export class AnalisisService {
  
  /**
   * Analiza un documento y determina área responsable, prioridad, etc.
   */
  async analizarDocumento(
    archivoInfo: ArchivoInfo,
    usuario: UsuarioCompleto,
    tipoMensaje?: string
  ): Promise<AnalisisDocumento> {
    try {
      // Si Claude API está disponible, usar análisis avanzado
      if (config.claudeApiKey) {
        return await this.analizarConClaude(archivoInfo, usuario, tipoMensaje);
      }
      
      // Análisis local inteligente
      return this.analizarLocal(archivoInfo, usuario, tipoMensaje);
      
    } catch (error) {
      console.error('Error en análisis de documento:', error);
      // Fallback a análisis básico
      return this.analizarBasico(archivoInfo, usuario, tipoMensaje);
    }
  }

  /**
   * Análisis avanzado usando Claude API
   */
  private async analizarConClaude(
    archivoInfo: ArchivoInfo,
    usuario: UsuarioCompleto,
    tipoMensaje?: string
  ): Promise<AnalisisDocumento> {
    try {
      if (!config.claudeApiKey) {
        console.log('⚠️ Claude API key no configurada, usando análisis local');
        return this.analizarLocal(archivoInfo, usuario, tipoMensaje);
      }

      const anthropic = new Anthropic({
        apiKey: config.claudeApiKey,
      });

      // Preparar el contexto para Claude
      const contexto = this.prepararContextoParaClaude(archivoInfo, usuario, tipoMensaje);

      const response = await anthropic.messages.create({
        model: "claude-3-haiku-20240307", // Modelo más económico para esta tarea
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: contexto
        }]
      });

      // Procesar la respuesta de Claude
      const analisisTexto = response.content[0].type === 'text' 
        ? response.content[0].text 
        : '';

      const analisis = this.procesarRespuestaClaude(analisisTexto, archivoInfo, usuario);
      
      console.log('🤖 Análisis completado con Claude API');
      return analisis;

    } catch (error) {
      console.error('Error al usar Claude API:', error);
      console.log('🔄 Fallback a análisis local');
      return this.analizarLocal(archivoInfo, usuario, tipoMensaje);
    }
  }

  /**
   * Análisis local inteligente basado en reglas y patrones
   */
  private analizarLocal(
    archivoInfo: ArchivoInfo,
    usuario: UsuarioCompleto,
    tipoMensaje?: string
  ): AnalisisDocumento {
    const nombreArchivo = archivoInfo.file_name.toLowerCase();
    const extension = archivoInfo.extension;
    
    // Detectar tipo de documento
    const tipoDetectado = this.detectarTipoDocumento(archivoInfo, tipoMensaje);
    
    // Determinar área responsable
    const areaResponsable = this.determinarAreaResponsable(nombreArchivo, usuario, tipoDetectado);
    
    // Calcular prioridad
    const prioridad = this.calcularPrioridad(nombreArchivo, usuario, archivoInfo);
    
    // Detectar asunto
    const asunto = this.detectarAsunto(nombreArchivo, tipoDetectado, tipoMensaje);
    
    // Generar observaciones
    const observaciones = this.generarObservaciones(archivoInfo, usuario, tipoMensaje);
    
    // Verificar si requiere revisión manual
    const requiereRevision = this.requiereRevisionManual(nombreArchivo, archivoInfo, usuario);
    
    // Calcular nivel de confianza
    const confianza = this.calcularConfianza(archivoInfo, usuario);

    return {
      tipo: tipoDetectado,
      area_responsable: areaResponsable,
      prioridad: prioridad,
      tiempo_estimado: this.calcularTiempoEstimado(prioridad),
      observaciones: observaciones,
      asunto_detectado: asunto,
      requiere_revision: requiereRevision,
      confianza: confianza
    };
  }

  /**
   * Análisis básico como fallback
   */
  private analizarBasico(
    archivoInfo: ArchivoInfo,
    usuario: UsuarioCompleto,
    tipoMensaje?: string
  ): AnalisisDocumento {
    return {
      tipo: this.getTipoBasico(archivoInfo.tipo_detectado),
      area_responsable: usuario.es_interno ? usuario.area : 'Mesa de Partes',
      prioridad: 'Media',
      tiempo_estimado: '3-5 días hábiles',
      observaciones: `Documento ${archivoInfo.tipo_detectado} enviado por ${usuario.cargo}`,
      asunto_detectado: `${this.getTipoBasico(archivoInfo.tipo_detectado)} - ${archivoInfo.file_name}`,
      requiere_revision: true,
      confianza: 0.5
    };
  }

  // ===== MÉTODOS DE DETECCIÓN Y ANÁLISIS =====

  private detectarTipoDocumento(archivoInfo: ArchivoInfo, tipoMensaje?: string): string {
    const nombre = archivoInfo.file_name.toLowerCase();
    const extension = archivoInfo.extension;

    // Detección por nombre de archivo
    const tiposPorNombre: Record<string, string> = {
      'oficio': 'Oficio',
      'informe': 'Informe',
      'solicitud': 'Solicitud',
      'memorando': 'Memorando',
      'carta': 'Carta',
      'constancia': 'Constancia',
      'certificado': 'Certificado',
      'resolucion': 'Resolución',
      'decreto': 'Decreto',
      'ordenanza': 'Ordenanza'
    };

    for (const [keyword, tipo] of Object.entries(tiposPorNombre)) {
      if (nombre.includes(keyword)) {
        return tipo;
      }
    }

    // Detección por tipo de mensaje y extensión
    if (tipoMensaje === 'foto') {
      return 'Documento fotografiado';
    }

    if (extension === 'pdf') {
      return 'Documento PDF';
    }

    if (['jpg', 'jpeg', 'png'].includes(extension)) {
      return 'Imagen - Documento escaneado';
    }

    return 'Documento';
  }

  private determinarAreaResponsable(nombreArchivo: string, usuario: UsuarioCompleto, tipoDocumento: string): string {
    // Si es usuario interno, derivar según el tipo de documento
    if (usuario.es_interno) {
      const areasPorTipo: Record<string, string> = {
        'informe': 'Secretaría General',
        'oficio': 'Secretaría General',
        'solicitud': usuario.area, // Mantener en su área
        'memorando': usuario.area,
        'resolucion': 'Secretaría General',
        'decreto': 'Secretaría General'
      };

      const tipoLower = tipoDocumento.toLowerCase();
      for (const [tipo, area] of Object.entries(areasPorTipo)) {
        if (tipoLower.includes(tipo)) {
          return area;
        }
      }

      return usuario.area; // Por defecto, su propia área
    }

    // Para usuarios externos, determinar área por contenido
    const areasPorPalabra: Record<string, string> = {
      'obras': 'Sub Gerencia de Infraestructura y Obras Públicas',
      'infraestructura': 'Sub Gerencia de Infraestructura y Obras Públicas',
      'construccion': 'Sub Gerencia de Infraestructura y Obras Públicas',
      'pista': 'Sub Gerencia de Infraestructura y Obras Públicas',
      'vereda': 'Sub Gerencia de Infraestructura y Obras Públicas',
      
      'desarrollo': 'Sub Gerencia de Desarrollo Social y Comunal',
      'social': 'Sub Gerencia de Desarrollo Social y Comunal',
      'comunal': 'Sub Gerencia de Desarrollo Social y Comunal',
      'educacion': 'Sub Gerencia de Desarrollo Social y Comunal',
      'salud': 'Sub Gerencia de Desarrollo Social y Comunal',
      
      'ambiental': 'Sub Gerencia de Desarrollo Económico y Gestión Ambiental',
      'economico': 'Sub Gerencia de Desarrollo Económico y Gestión Ambiental',
      'comercio': 'Sub Gerencia de Desarrollo Económico y Gestión Ambiental',
      'turismo': 'Sub Gerencia de Desarrollo Económico y Gestión Ambiental',
      
      'logistica': 'Oficina de Logística y Recursos Humanos',
      'recursos': 'Oficina de Logística y Recursos Humanos',
      'personal': 'Oficina de Logística y Recursos Humanos',
      
      'tesoreria': 'Responsable de Tesorería y Rentas',
      'pago': 'Responsable de Tesorería y Rentas',
      'tributo': 'Responsable de Tesorería y Rentas',
      'impuesto': 'Responsable de Tesorería y Rentas'
    };

    for (const [palabra, area] of Object.entries(areasPorPalabra)) {
      if (nombreArchivo.includes(palabra)) {
        return area;
      }
    }

    return 'Mesa de Partes'; // Área por defecto para externos
  }

  private calcularPrioridad(nombreArchivo: string, usuario: UsuarioCompleto, archivoInfo: ArchivoInfo): PrioridadNivel {
    // Palabras clave para prioridad alta
    const palabrasUrgentes = ['urgente', 'inmediato', 'emergencia', 'critico'];
    const palabrasAltas = ['importante', 'prioridad', 'rapido'];
    
    const nombreLower = nombreArchivo.toLowerCase();
    
    // Muy urgente
    if (palabrasUrgentes.some(palabra => nombreLower.includes(palabra))) {
      return 'Muy Urgente';
    }
    
    // Alta prioridad
    if (palabrasAltas.some(palabra => nombreLower.includes(palabra)) || 
        usuario.acceso === 'Admin' || usuario.acceso === 'Super') {
      return 'Alta';
    }
    
    // Baja prioridad para ciertos tipos
    if (nombreLower.includes('saludo') || nombreLower.includes('felicitacion')) {
      return 'Baja';
    }
    
    return 'Media'; // Por defecto
  }

  private detectarAsunto(nombreArchivo: string, tipoDocumento: string, tipoMensaje?: string): string {
    // Si el nombre es descriptivo, usarlo
    if (nombreArchivo.length > 20 && !nombreArchivo.includes('_') && !nombreArchivo.includes('documento')) {
      return nombreArchivo.replace(/\.[^/.]+$/, ''); // Quitar extensión
    }
    
    // Generar asunto basado en tipo
    if (tipoMensaje === 'foto') {
      return 'Documento capturado con cámara';
    }
    
    return `${tipoDocumento} recibido`;
  }

  private generarObservaciones(archivoInfo: ArchivoInfo, usuario: UsuarioCompleto, tipoMensaje?: string): string {
    const observaciones: string[] = [];
    
    observaciones.push(`Enviado por ${usuario.cargo} de ${usuario.area}`);
    
    if (tipoMensaje === 'foto') {
      observaciones.push('Documento fotografiado desde dispositivo móvil');
    }
    
    if (archivoInfo.file_size > 5 * 1024 * 1024) { // > 5MB
      observaciones.push('Archivo de gran tamaño');
    }
    
    if (archivoInfo.tipo_detectado === 'pdf') {
      observaciones.push('Documento en formato PDF');
    }
    
    return observaciones.join('. ');
  }

  private requiereRevisionManual(nombreArchivo: string, archivoInfo: ArchivoInfo, usuario: UsuarioCompleto): boolean {
    // Requiere revisión si:
    // - Es usuario externo
    // - Archivo muy grande
    // - Nombre genérico
    // - Tipo no reconocido claramente
    
    return !usuario.es_interno || 
           archivoInfo.file_size > 10 * 1024 * 1024 || 
           nombreArchivo.includes('documento') ||
           nombreArchivo.includes('archivo') ||
           archivoInfo.tipo_detectado === 'desconocido';
  }

  private calcularConfianza(archivoInfo: ArchivoInfo, usuario: UsuarioCompleto): number {
    let confianza = 0.7; // Base
    
    // Aumentar confianza si:
    if (usuario.es_interno) confianza += 0.1;
    if (archivoInfo.tipo_detectado !== 'desconocido') confianza += 0.1;
    if (archivoInfo.file_name.length > 10) confianza += 0.05;
    if (['pdf', 'imagen'].includes(archivoInfo.tipo_detectado)) confianza += 0.05;
    
    return Math.min(confianza, 1.0);
  }

  private calcularTiempoEstimado(prioridad: PrioridadNivel): string {
    const tiempos: Record<PrioridadNivel, string> = {
      'Muy Urgente': '24 horas',
      'Alta': '1-2 días hábiles',
      'Media': '3-5 días hábiles',
      'Baja': '5-7 días hábiles'
    };
    
    return tiempos[prioridad];
  }

  private getTipoBasico(tipoDetectado: TipoArchivo): string {
    const mapaTipos: Record<TipoArchivo, string> = {
      'pdf': 'Documento PDF',
      'imagen': 'Imagen - Documento',
      'documento': 'Documento',
      'desconocido': 'Archivo'
    };
    
    return mapaTipos[tipoDetectado];
  }

  /**
   * Método público para análisis rápido (usado en comandos de test)
   */
  async analizarRapido(archivoInfo: ArchivoInfo): Promise<{
    es_procesable: boolean;
    tipo_detectado: string;
    area_sugerida: string;
    prioridad_estimada: PrioridadNivel;
  }> {
    return {
      es_procesable: archivoInfo.es_procesable,
      tipo_detectado: this.detectarTipoDocumento(archivoInfo),
      area_sugerida: this.determinarAreaResponsable(archivoInfo.file_name, {} as UsuarioCompleto, ''),
      prioridad_estimada: this.calcularPrioridad(archivoInfo.file_name, {} as UsuarioCompleto, archivoInfo)
    };
  }

  /**
   * Prepara el contexto para enviar a Claude
   */
  private prepararContextoParaClaude(
    archivoInfo: ArchivoInfo,
    usuario: UsuarioCompleto,
    tipoMensaje?: string
  ): string {
    return `
Eres un asistente especializado en clasificación de documentos para una Mesa de Partes digital.

DOCUMENTO A ANALIZAR:
- Nombre del archivo: ${archivoInfo.file_name}
- Tamaño: ${(archivoInfo.file_size / 1024).toFixed(2)} KB
- Tipo MIME: ${archivoInfo.mime_type}
- Usuario: ${usuario.nombre} ${usuario.apellido_paterno} ${usuario.apellido_materno}
- Cargo: ${usuario.cargo || 'No especificado'}
- Área: ${usuario.area || 'No especificada'}
- Mensaje adicional: ${tipoMensaje || 'No especificado'}

ÁREAS DISPONIBLES:
- Mesa de Partes (predeterminada)
- Recursos Humanos
- Administración
- Tecnología
- Legal
- Contabilidad
- Logística
- Gerencia

NIVELES DE PRIORIDAD:
- Alta: Documentos urgentes, legales, contratos importantes
- Media: Documentos de rutina, informes regulares
- Baja: Documentos informativos, archivos de referencia

INSTRUCCIONES:
Analiza el documento basándote en el nombre del archivo, tipo, usuario y contexto. Responde ÚNICAMENTE en formato JSON:

{
  "area_responsable": "nombre_del_area",
  "prioridad": "Alta|Media|Baja",
  "asunto_detectado": "descripción breve del asunto",
  "observaciones": "descripción breve del análisis",
  "confianza": 0.95
}

Respuesta:`;
  }

  /**
   * Procesa la respuesta de Claude y la convierte en AnalisisDocumento
   */
  private procesarRespuestaClaude(
    respuestaClaude: string,
    archivoInfo: ArchivoInfo,
    usuario: UsuarioCompleto
  ): AnalisisDocumento {
    try {
      // Extraer JSON de la respuesta
      const jsonMatch = respuestaClaude.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No se encontró JSON válido en la respuesta');
      }

      const analisisClaude = JSON.parse(jsonMatch[0]);

      // Validar y mapear la respuesta
      return {
        tipo: this.detectarTipoDocumento(archivoInfo),
        area_responsable: this.validarArea(analisisClaude.area_responsable),
        prioridad: this.validarPrioridad(analisisClaude.prioridad),
        tiempo_estimado: this.calcularTiempoEstimado(analisisClaude.prioridad),
        observaciones: `Análisis IA (confianza: ${(analisisClaude.confianza * 100).toFixed(1)}%) - ${analisisClaude.observaciones || ''}`,
        asunto_detectado: analisisClaude.asunto_detectado || this.detectarAsunto(archivoInfo.file_name, this.detectarTipoDocumento(archivoInfo)),
        requiere_revision: analisisClaude.confianza < 0.8,
        confianza: analisisClaude.confianza || 0.8
      };

    } catch (error) {
      console.error('Error procesando respuesta de Claude:', error);
      // Fallback a análisis local
      return this.analizarLocal(archivoInfo, usuario);
    }
  }

  /**
   * Valida que el área esté en la lista permitida
   */
  private validarArea(area: string): string {
    const areasValidas = [
      'Mesa de Partes',
      'Recursos Humanos', 
      'Administración',
      'Tecnología',
      'Legal',
      'Contabilidad',
      'Logística',
      'Gerencia'
    ];

    const areaEncontrada = areasValidas.find(
      a => a.toLowerCase() === area?.toLowerCase()
    );

    return areaEncontrada || config.defaultArea;
  }

  /**
   * Valida que la prioridad esté en los valores permitidos
   */
  private validarPrioridad(prioridad: string): PrioridadNivel {
    const prioridadesValidas: PrioridadNivel[] = ['Alta', 'Media', 'Baja'];
    
    const prioridadEncontrada = prioridadesValidas.find(
      p => p.toLowerCase() === prioridad?.toLowerCase()
    );

    return prioridadEncontrada || 'Media';
  }
}