// src/types/index.ts - Definiciones de tipos para Mesa de Partes Bot

// ===== TIPOS DE TELEGRAM =====
export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TelegramChat {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  type: 'private' | 'group' | 'supergroup' | 'channel';
}

export interface TelegramMessage {
  message_id: number;
  from: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  document?: TelegramDocument;
  photo?: TelegramPhotoSize[];
  video?: TelegramVideo;
  audio?: TelegramAudio;
  voice?: TelegramVoice;
}

export interface TelegramDocument {
  file_id: string;
  file_unique_id: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
  thumbnail?: TelegramPhotoSize;
}

export interface TelegramPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

export interface TelegramVideo {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  duration: number;
  thumbnail?: TelegramPhotoSize;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramAudio {
  file_id: string;
  file_unique_id: string;
  duration: number;
  performer?: string;
  title?: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
  thumbnail?: TelegramPhotoSize;
}

export interface TelegramVoice {
  file_id: string;
  file_unique_id: string;
  duration: number;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

// ===== TIPOS DE USUARIOS DEL SISTEMA =====
export type AccesoNivel = 'Admin' | 'Super' | 'User' | 'Guest';

export interface Usuario {
  telegram_id: string;           // @username o ID
  nombre: string;               // NOMBRE
  apellido_paterno: string;     // APELLIDO PATERNO  
  apellido_materno: string;     // APELLIDO MATERNO
  area: string;                 // AREA
  cargo: string;                // CARGO
  acceso: AccesoNivel;          // ACCESO
  email: string;                // EMAIL
  telefono: string;             // TELEFONO
}

export interface UsuarioCompleto extends Usuario {
  nombre_completo: string;      // Calculado: nombre + apellidos
  es_interno: boolean;          // Calculado: area !== 'Externo'
  es_admin: boolean;            // Calculado: acceso === 'Admin' || 'Super'
}

// ===== TIPOS DE MESA DE PARTES =====
export type TipoExpediente = 'Externo' | 'Interno';
export type TipoDocumento = 'Oficio' | 'Informe' | 'Formulario' | 'Oficio Múltiple' | 'Solicitud' | 'Memorando';
export type PrioridadNivel = 'Alta' | 'Media' | 'Baja' | 'Muy Urgente';
export type EstadoExpediente = 'Recibido' | 'Derivado' | 'Por atender' | 'Atendido' | 'En proceso' | 'Observado';

export interface Expediente {
  tipo: TipoExpediente;         // Tipo
  exp: number;                  // EXP
  doc: string;                  // DOC
  folios: number;               // Folios
  fecha_recepcion: string;      // Fecha Recepción
  hora: string;                 // Hora
  fecha_emision: string;        // Fecha Emisión
  tipo_documento: TipoDocumento; // Tipo Documento
  nro_documento: string;        // Nro. Documento
  emisor_responsable: string;   // Emisor - Responsable
  emisor_area: string;          // Emisor - Area
  asunto: string;               // Asunto
  referencia: string;           // Referencia
  prioridad: PrioridadNivel;    // Prioridad
  estado: EstadoExpediente;     // Estado
  derivado_area: string;        // Derivado - Area
  derivado_responsable: string; // Derivado - Responsable
  tipo_derivado: string;        // Tipo Derivado
}

export interface ExpedienteRegistro {
  numero_expediente: string;    // Generado: 2025-XXXXXXXXXX
  fecha_registro: Date;         // Fecha/hora actual
  usuario_registro: string;     // Quien registró
  archivo_original?: string;    // Nombre del archivo
  observaciones?: string;       // Notas adicionales
}

// ===== TIPOS DE ANÁLISIS DE DOCUMENTOS =====
export interface AnalisisDocumento {
  tipo: string;                 // Tipo detectado del documento
  area_responsable: string;     // Área que debe procesar
  prioridad: PrioridadNivel;    // Prioridad asignada
  tiempo_estimado: string;      // Tiempo estimado de proceso
  observaciones: string;        // Observaciones del análisis
  asunto_detectado: string;     // Asunto identificado
  requiere_revision: boolean;   // Si necesita revisión manual
  confianza: number;            // Nivel de confianza del análisis (0-1)
}

// ===== TIPOS DE RESPUESTA =====
export interface RespuestaBot {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

export interface ExpedienteRespuesta extends RespuestaBot {
  data?: {
    expediente: Expediente;
    numero: string;
    estado: string;
    analisis?: AnalisisDocumento;
  };
}

// ===== TIPOS DE CONFIGURACIÓN =====
export interface ConfiguracionBot {
  telegram_token: string;
  google_sheets_usuarios_id: string;
  google_sheets_expedientes_id: string;
  google_drive_folder_id: string;
  google_service_account_email: string;
  google_private_key: string;
  claude_api_key?: string;      // Para futuras integraciones
}

// ===== TIPOS DE ARCHIVOS =====
export type TipoArchivo = 'pdf' | 'imagen' | 'documento' | 'desconocido';

export interface ArchivoInfo {
  file_id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  tipo_detectado: TipoArchivo;
  extension: string;
  es_procesable: boolean;       // Si se puede procesar con el bot
}

// ===== TIPOS DE COMANDOS =====
export type ComandoBot = '/start' | '/perfil' | '/enviar' | '/estado' | '/reportes' | '/test' | '/help';

export interface ComandoRespuesta {
  comando: ComandoBot;
  descripcion: string;
  requiere_autenticacion: boolean;
  nivel_acceso_minimo: AccesoNivel;
}

// ===== TIPOS DE REPORTES =====
export interface ReporteEstadisticas {
  total_expedientes: number;
  expedientes_hoy: number;
  por_estado: Record<EstadoExpediente, number>;
  por_prioridad: Record<PrioridadNivel, number>;
  por_area: Record<string, number>;
  tiempo_promedio_respuesta: string;
}

// ===== TIPOS DE ERRORES =====
export interface ErrorBot extends Error {
  codigo: string;
  contexto?: any;
  es_temporal: boolean;
}

// ===== EXPORTACIONES ÚTILES =====
export type ArchivoTelegram = TelegramDocument | TelegramPhotoSize | TelegramVideo | TelegramAudio | TelegramVoice;