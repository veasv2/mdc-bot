// src/services/GoogleSheetsService.ts - Servicio para Google Sheets

import jwt from 'jsonwebtoken';
import { config } from '../config';

export class GoogleSheetsService {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  /**
   * Obtiene un token de acceso válido para Google Sheets API
   */
  async obtenerAccessToken(): Promise<string> {
    // Verificar si el token actual sigue siendo válido
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const now = Math.floor(Date.now() / 1000);
      
      const payload = {
        iss: config.googleServiceAccountEmail,
        scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file',
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + config.googleTokenExpiry,
        iat: now
      };

      const token = jwt.sign(payload, config.googlePrivateKey, { algorithm: 'RS256' });

      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${token}`
      });

      const data = await response.json();
      
      if (!data.access_token) {
        console.error('Google API Error:', data);
        throw new Error(`Error Google API: ${data.error || 'Sin access token'}`);
      }

      // Guardar token con expiración
      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000; // 60s de buffer

      return this.accessToken!; // We just assigned it, so it's definitely not null

    } catch (error) {
      console.error('Error obteniendo access token:', error);
      throw new Error(`No se pudo obtener token de Google: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * Obtiene todas las filas de una hoja de Google Sheets
   */
  async obtenerFilas(sheetUrl: string): Promise<string[][]> {
    try {
      const accessToken = await this.obtenerAccessToken();
      
      const response = await fetch(sheetUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();
      return data.values || [];

    } catch (error) {
      console.error('Error obteniendo filas de Google Sheets:', error);
      throw error;
    }
  }

  /**
   * Agrega una nueva fila a una hoja de Google Sheets
   */
  async agregarFila(sheetId: string, fila: (string | number)[]): Promise<void> {
    try {
      const accessToken = await this.obtenerAccessToken();
      const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1:append?valueInputOption=RAW`;

      const response = await fetch(appendUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [fila]
        })
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error('❌ Error Google Sheets Response:', responseData);
        throw new Error(`Error Google Sheets: ${responseData.error?.message || 'Sin detalles'}`);
      }

      console.log('✅ Fila agregada a Google Sheets:', responseData);

    } catch (error) {
      console.error('Error agregando fila a Google Sheets:', error);
      throw error;
    }
  }

  /**
   * Actualiza una fila específica en Google Sheets
   */
  async actualizarFila(sheetId: string, rango: string, fila: (string | number)[]): Promise<void> {
    try {
      const accessToken = await this.obtenerAccessToken();
      const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${rango}?valueInputOption=RAW`;

      const response = await fetch(updateUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [fila]
        })
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error('❌ Error actualizando Google Sheets:', responseData);
        throw new Error(`Error Google Sheets: ${responseData.error?.message || 'Sin detalles'}`);
      }

      console.log('✅ Fila actualizada en Google Sheets:', responseData);

    } catch (error) {
      console.error('Error actualizando fila en Google Sheets:', error);
      throw error;
    }
  }

  /**
   * Busca filas que coincidan con un criterio específico
   */
  async buscarFilas(sheetUrl: string, columna: number, valor: string): Promise<string[][]> {
    try {
      const todasLasFilas = await this.obtenerFilas(sheetUrl);
      
      return todasLasFilas.filter(fila => 
        fila[columna] && fila[columna].toString().toLowerCase().includes(valor.toLowerCase())
      );

    } catch (error) {
      console.error('Error buscando filas:', error);
      return [];
    }
  }

  /**
   * Busca una fila específica por valor exacto en una columna
   */
  async buscarFilaExacta(sheetUrl: string, columna: number, valor: string): Promise<string[] | null> {
    try {
      const todasLasFilas = await this.obtenerFilas(sheetUrl);
      
      const filaEncontrada = todasLasFilas.find(fila => 
        fila[columna] && fila[columna].toString() === valor
      );

      return filaEncontrada || null;

    } catch (error) {
      console.error('Error buscando fila exacta:', error);
      return null;
    }
  }

  /**
   * Obtiene el rango de datos utilizados en una hoja
   */
  async obtenerRangoUtilizado(sheetId: string): Promise<{ filas: number; columnas: number }> {
    try {
      const sheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1`;
      const filas = await this.obtenerFilas(sheetUrl);
      
      if (filas.length === 0) {
        return { filas: 0, columnas: 0 };
      }

      const maxColumnas = Math.max(...filas.map(fila => fila.length));
      
      return {
        filas: filas.length,
        columnas: maxColumnas
      };

    } catch (error) {
      console.error('Error obteniendo rango utilizado:', error);
      return { filas: 0, columnas: 0 };
    }
  }

  /**
   * Valida que una hoja tenga los headers esperados
   */
  async validarHeaders(sheetUrl: string, headersEsperados: string[]): Promise<{ valido: boolean; faltantes: string[] }> {
    try {
      const filas = await this.obtenerFilas(sheetUrl);
      
      if (filas.length === 0) {
        return { valido: false, faltantes: headersEsperados };
      }

      const headersActuales = filas[0] || [];
      const faltantes = headersEsperados.filter(header => 
        !headersActuales.some(actual => 
          actual.toLowerCase().trim() === header.toLowerCase().trim()
        )
      );

      return {
        valido: faltantes.length === 0,
        faltantes
      };

    } catch (error) {
      console.error('Error validando headers:', error);
      return { valido: false, faltantes: headersEsperados };
    }
  }

  /**
   * Obtiene estadísticas básicas de una hoja
   */
  async obtenerEstadisticas(sheetUrl: string): Promise<{
    total_filas: number;
    filas_con_datos: number;
    columnas_utilizadas: number;
    ultima_actualizacion: string;
  }> {
    try {
      const filas = await this.obtenerFilas(sheetUrl);
      const filasConDatos = filas.filter(fila => 
        fila.some(celda => celda && celda.toString().trim() !== '')
      );

      const columnasUtilizadas = filas.length > 0 
        ? Math.max(...filas.map(fila => fila.length))
        : 0;

      return {
        total_filas: filas.length,
        filas_con_datos: filasConDatos.length,
        columnas_utilizadas: columnasUtilizadas,
        ultima_actualizacion: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      return {
        total_filas: 0,
        filas_con_datos: 0,
        columnas_utilizadas: 0,
        ultima_actualizacion: new Date().toISOString()
      };
    }
  }

  /**
   * Verifica la conectividad con Google Sheets
   */
  async verificarConectividad(): Promise<{ conectado: boolean; error?: string }> {
    try {
      await this.obtenerAccessToken();
      
      // Intentar una operación simple en el sheet de usuarios
      await this.obtenerRangoUtilizado(config.googleSheetsUsuariosId);
      
      return { conectado: true };

    } catch (error) {
      return { 
        conectado: false, 
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }

  /**
   * Limpia el cache de tokens (útil para testing o errores de auth)
   */
  limpiarCache(): void {
    this.accessToken = null;
    this.tokenExpiry = 0;
  }
}