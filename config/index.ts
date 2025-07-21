// src/config/index.ts - Configuración centralizada del bot

import { ConfiguracionBot } from '../types';

export class Config {
  private static instance: Config;
  private config: ConfiguracionBot;

  private constructor() {
    this.config = this.loadConfiguration();
    this.validateConfiguration();
  }

  public static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }

  private loadConfiguration(): ConfiguracionBot {
    return {
      telegram_token: process.env.TELEGRAM_BOT_TOKEN || '',
      google_sheets_usuarios_id: process.env.GOOGLE_SHEETS_USUARIOS_ID || '',
      google_sheets_expedientes_id: process.env.GOOGLE_SHEETS_EXPEDIENTES_ID || '',
      google_drive_folder_id: process.env.GOOGLE_DRIVE_FOLDER_ID || '',
      google_service_account_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '',
      google_private_key: process.env.GOOGLE_PRIVATE_KEY || '',
      claude_api_key: process.env.CLAUDE_API_KEY || undefined,
    };
  }

  private validateConfiguration(): void {
    const required = [
      'telegram_token',
      'google_sheets_usuarios_id', 
      'google_sheets_expedientes_id',
      'google_drive_folder_id',
      'google_service_account_email',
      'google_private_key'
    ];

    const missing = required.filter(key => 
      !this.config[key as keyof ConfiguracionBot]
    );

    if (missing.length > 0) {
      throw new Error(`Variables de entorno faltantes: ${missing.join(', ')}`);
    }
  }

  // Getters para acceso a configuración
  public get telegramToken(): string {
    return this.config.telegram_token;
  }

  public get googleSheetsUsuariosId(): string {
    return this.config.google_sheets_usuarios_id;
  }

  public get googleSheetsExpedientesId(): string {
    return this.config.google_sheets_expedientes_id;
  }

  public get googleDriveFolderId(): string {
    return this.config.google_drive_folder_id;
  }

  public get googleServiceAccountEmail(): string {
    return this.config.google_service_account_email;
  }

  public get googlePrivateKey(): string {
    return this.config.google_private_key.replace(/\\n/g, '\n');
  }

  public get claudeApiKey(): string | undefined {
    return this.config.claude_api_key;
  }

  public get telegramApiUrl(): string {
    return `https://api.telegram.org/bot${this.telegramToken}`;
  }

  // URLs de Google Sheets
  public get usuariosSheetUrl(): string {
    return `https://sheets.googleapis.com/v4/spreadsheets/${this.googleSheetsUsuariosId}/values/Sheet1`;
  }

  public get expedientesSheetUrl(): string {
    return `https://sheets.googleapis.com/v4/spreadsheets/${this.googleSheetsExpedientesId}/values/Sheet1`;
  }

  public get expedientesAppendUrl(): string {
    return `${this.expedientesSheetUrl}:append?valueInputOption=RAW`;
  }

  // Configuración de análisis
  public get maxFileSize(): number {
    return 20 * 1024 * 1024; // 20MB en bytes
  }

  public get supportedMimeTypes(): string[] {
    return [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp'
    ];
  }

  public get supportedExtensions(): string[] {
    return ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp'];
  }

  // Configuración de timeouts
  public get requestTimeout(): number {
    return 30000; // 30 segundos
  }

  public get googleTokenExpiry(): number {
    return 3600; // 1 hora en segundos
  }

  // Configuración de expedientes
  public get expedienteFormat(): string {
    return 'YYYY-FFFFFFFFFF'; // Año + 10 dígitos
  }

  public get defaultArea(): string {
    return 'Mesa de Partes';
  }

  public get defaultPrioridad(): string {
    return 'Media';
  }

  // Logging y debug
  public get isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  public get enableDebugLogs(): boolean {
    return process.env.ENABLE_DEBUG === 'true' || !this.isProduction;
  }

  // Método para obtener toda la configuración (para testing)
  public getFullConfig(): ConfiguracionBot {
    return { ...this.config };
  }

  // Método para validar si el bot está configurado correctamente
  public isConfigured(): boolean {
    try {
      this.validateConfiguration();
      return true;
    } catch {
      return false;
    }
  }

  // Método para obtener estado de configuración
  public getConfigStatus(): Record<string, boolean> {
    return {
      telegram_configured: !!this.config.telegram_token,
      google_sheets_configured: !!(
        this.config.google_sheets_usuarios_id &&
        this.config.google_sheets_expedientes_id
      ),
      google_auth_configured: !!(
        this.config.google_service_account_email &&
        this.config.google_private_key
      ),
      google_drive_configured: !!this.config.google_drive_folder_id,
      claude_configured: !!this.config.claude_api_key,
    };
  }
}

// Exportar instancia singleton
export const config = Config.getInstance();