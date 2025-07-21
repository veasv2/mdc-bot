// src/services/UsuarioService.ts - Servicio para manejo de usuarios

import { Usuario, UsuarioCompleto, TelegramUser, AccesoNivel } from '../types';
import { GoogleSheetsService } from './google-sheets-service';
import { config } from '../config';

export class UsuarioService {
  private googleSheets: GoogleSheetsService;
  private usuariosCache: Map<string, UsuarioCompleto> = new Map();
  private cacheExpiry: number = 5 * 60 * 1000; // 5 minutos
  private lastCacheUpdate: number = 0;

  constructor() {
    this.googleSheets = new GoogleSheetsService();
  }

  /**
   * Obtiene el perfil completo de un usuario desde Google Sheets
   */
  async obtenerPerfilUsuario(telegramUser: TelegramUser): Promise<UsuarioCompleto> {
    const telegramId = this.formatTelegramId(telegramUser);
    
    try {
      // Intentar desde cache primero
      const cached = this.obtenerDesdeCache(telegramId);
      if (cached) {
        return cached;
      }

      // Obtener desde Google Sheets
      const usuario = await this.obtenerDesdeGoogleSheets(telegramId);
      
      if (usuario) {
        const usuarioCompleto = this.completarUsuario(usuario);
        this.guardarEnCache(telegramId, usuarioCompleto);
        return usuarioCompleto;
      }

      // Si no existe, crear perfil temporal
      return this.crearPerfilTemporal(telegramUser);

    } catch (error) {
      console.error('Error obteniendo perfil usuario:', error);
      return this.crearPerfilTemporal(telegramUser);
    }
  }

  /**
   * Busca todos los usuarios en Google Sheets
   */
  async obtenerTodosLosUsuarios(): Promise<UsuarioCompleto[]> {
    try {
      const rows = await this.googleSheets.obtenerFilas(config.usuariosSheetUrl);
      
      if (!rows || rows.length === 0) {
        return [];
      }

      // Saltar header row
      const dataRows = rows.slice(1);
      
      return dataRows
        .filter(row => row.length >= 6) // Mínimo campos requeridos
        .map(row => this.mapearFilaAUsuario(row))
        .map(usuario => this.completarUsuario(usuario));

    } catch (error) {
      console.error('Error obteniendo todos los usuarios:', error);
      return [];
    }
  }

  /**
   * Busca usuario por área
   */
  async obtenerUsuariosPorArea(area: string): Promise<UsuarioCompleto[]> {
    const usuarios = await this.obtenerTodosLosUsuarios();
    return usuarios.filter(usuario => 
      usuario.area.toLowerCase().includes(area.toLowerCase())
    );
  }

  /**
   * Busca usuarios por nivel de acceso
   */
  async obtenerUsuariosPorAcceso(acceso: AccesoNivel): Promise<UsuarioCompleto[]> {
    const usuarios = await this.obtenerTodosLosUsuarios();
    return usuarios.filter(usuario => usuario.acceso === acceso);
  }

  /**
   * Verifica si un usuario tiene permisos para una acción
   */
  tienePermisos(usuario: UsuarioCompleto, accionRequerida: 'registrar' | 'derivar' | 'reportes' | 'admin'): boolean {
    switch (accionRequerida) {
      case 'registrar':
        return usuario.acceso !== 'Guest';
      
      case 'derivar':
        return ['Admin', 'Super', 'User'].includes(usuario.acceso) && usuario.es_interno;
      
      case 'reportes':
        return ['Admin', 'Super'].includes(usuario.acceso);
      
      case 'admin':
        return usuario.acceso === 'Admin' || usuario.acceso === 'Super';
      
      default:
        return false;
    }
  }

  /**
   * Invalida el cache de usuarios
   */
  invalidarCache(): void {
    this.usuariosCache.clear();
    this.lastCacheUpdate = 0;
  }

  /**
   * Obtiene estadísticas de usuarios
   */
  async obtenerEstadisticasUsuarios(): Promise<{
    total: number;
    por_acceso: Record<AccesoNivel, number>;
    por_area: Record<string, number>;
    internos: number;
    externos: number;
  }> {
    const usuarios = await this.obtenerTodosLosUsuarios();
    
    const stats = {
      total: usuarios.length,
      por_acceso: {} as Record<AccesoNivel, number>,
      por_area: {} as Record<string, number>,
      internos: 0,
      externos: 0
    };

    // Inicializar contadores
    (['Admin', 'Super', 'User', 'Guest'] as AccesoNivel[]).forEach(acceso => {
      stats.por_acceso[acceso] = 0;
    });

    usuarios.forEach(usuario => {
      // Contar por acceso
      stats.por_acceso[usuario.acceso]++;
      
      // Contar por área
      stats.por_area[usuario.area] = (stats.por_area[usuario.area] || 0) + 1;
      
      // Contar internos/externos
      if (usuario.es_interno) {
        stats.internos++;
      } else {
        stats.externos++;
      }
    });

    return stats;
  }

  // ===== MÉTODOS PRIVADOS =====

  private formatTelegramId(telegramUser: TelegramUser): string {
    return telegramUser.username ? `@${telegramUser.username}` : telegramUser.id.toString();
  }

  private obtenerDesdeCache(telegramId: string): UsuarioCompleto | null {
    const now = Date.now();
    
    if (now - this.lastCacheUpdate > this.cacheExpiry) {
      this.usuariosCache.clear();
      return null;
    }

    return this.usuariosCache.get(telegramId) || null;
  }

  private guardarEnCache(telegramId: string, usuario: UsuarioCompleto): void {
    this.usuariosCache.set(telegramId, usuario);
    this.lastCacheUpdate = Date.now();
  }

  private async obtenerDesdeGoogleSheets(telegramId: string): Promise<Usuario | null> {
    try {
      const rows = await this.googleSheets.obtenerFilas(config.usuariosSheetUrl);
      
      if (!rows || rows.length === 0) {
        return null;
      }

      // Buscar usuario en las filas
      const userRow = rows.find(row => row[0] === telegramId);
      
      if (!userRow || userRow.length < 6) {
        return null;
      }

      return this.mapearFilaAUsuario(userRow);

    } catch (error) {
      console.error('Error Google Sheets en obtenerDesdeGoogleSheets:', error);
      return null;
    }
  }

  private mapearFilaAUsuario(row: string[]): Usuario {
    return {
      telegram_id: row[0] || '',
      nombre: row[1] || '',
      apellido_paterno: row[2] || '',
      apellido_materno: row[3] || '',
      area: row[4] || 'Mesa de Partes',
      cargo: row[5] || 'Usuario',
      acceso: (row[6] as AccesoNivel) || 'Guest',
      email: row[7] || '',
      telefono: row[8] || ''
    };
  }

  private completarUsuario(usuario: Usuario): UsuarioCompleto {
    const nombre_completo = `${usuario.nombre} ${usuario.apellido_paterno} ${usuario.apellido_materno}`.trim();
    const es_interno = usuario.area.toLowerCase() !== 'externo' && usuario.area.toLowerCase() !== 'ciudadano';
    const es_admin = ['Admin', 'Super'].includes(usuario.acceso);

    return {
      ...usuario,
      nombre_completo,
      es_interno,
      es_admin
    };
  }

  private crearPerfilTemporal(telegramUser: TelegramUser): UsuarioCompleto {
    const usuario: Usuario = {
      telegram_id: this.formatTelegramId(telegramUser),
      nombre: telegramUser.first_name,
      apellido_paterno: telegramUser.last_name || '',
      apellido_materno: '',
      area: 'Externo',
      cargo: 'Ciudadano',
      acceso: 'Guest',
      email: '',
      telefono: ''
    };

    return this.completarUsuario(usuario);
  }
}