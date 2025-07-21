// api/webhook.ts - Endpoint principal del bot de Mesa de Partes

import { VercelRequest, VercelResponse } from 'types/vercel';
import { TelegramUpdate } from 'types';
import { BotController } from 'controllers/bot-controller';
import { config } from 'config';

// Instancia única del controlador
const botController = new BotController();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Solo permitir POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verificar configuración
    if (!config.isConfigured()) {
      console.error('❌ Bot no configurado correctamente');
      return res.status(500).json({ error: 'Bot configuration error' });
    }

    const update: TelegramUpdate = req.body;
    
    // Log del mensaje recibido
    console.log('📩 Webhook recibido:', {
      update_id: update.update_id,
      message_id: update.message?.message_id,
      from: update.message?.from?.username || update.message?.from?.id,
      chat_id: update.message?.chat?.id,
      has_text: !!update.message?.text,
      has_document: !!update.message?.document,
      has_photo: !!update.message?.photo,
      timestamp: new Date().toISOString()
    });

    // Procesar el update
    if (update.message) {
      await botController.procesarMensaje(update.message);
    } else {
      console.log('⚠️ Update sin mensaje:', update);
    }

    // Responder OK a Telegram
    res.status(200).json({ ok: true });

  } catch (error) {
    console.error('❌ Error en webhook:', error);
    
    // Log detallado del error
    if (error instanceof Error) {
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 5).join('\n')
      });
    }

    // Responder error a Telegram
    res.status(500).json({ 
      error: 'Internal server error',
      details: config.enableDebugLogs ? error instanceof Error ? error.message : 'Unknown error' : undefined
    });
  }
}