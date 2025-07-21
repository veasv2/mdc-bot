export default async function handler(req, res) {
  // Solo acepta POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const update = req.body;
    console.log('Mensaje recibido:', update);

    // Procesar el mensaje aquí
    if (update.message) {
      await procesarMensaje(update.message);
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function procesarMensaje(message) {
  // Lógica del bot (te la proporcionaré completa)
  console.log('Procesando:', message.text);
}