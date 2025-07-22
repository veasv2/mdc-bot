# Configuración de Claude AI para Mesa de Partes Bot

## 🤖 Descripción

Este bot integra Claude AI de Anthropic para realizar análisis avanzado de documentos, mejorando la clasificación automática y asignación de áreas responsables.

## 📋 Prerrequisitos

1. **Cuenta de Anthropic**: Necesitas una cuenta en [console.anthropic.com](https://console.anthropic.com/)
2. **Créditos de API**: La cuenta debe tener créditos suficientes para hacer requests
3. **API Key**: Generar una API key desde el dashboard

## 🔧 Configuración

### 1. Obtener API Key de Claude

1. Ve a [console.anthropic.com](https://console.anthropic.com/)
2. Inicia sesión o crea una cuenta
3. Ve a "API Keys" en el menú lateral
4. Clic en "Create Key"
5. Dale un nombre descriptivo (ej: "mdc-bot-production")
6. Copia la clave que empieza con `sk-ant-`

### 2. Configurar Variable de Entorno

#### Para desarrollo local:
Agrega en tu archivo `.env`:
```bash
CLAUDE_API_KEY=sk-ant-api03-tu_clave_real_aqui
```

#### Para producción en Vercel:
1. Ve a tu proyecto en Vercel Dashboard
2. Settings → Environment Variables
3. Agrega:
   - **Name**: `CLAUDE_API_KEY`
   - **Value**: `sk-ant-api03-tu_clave_real_aqui`
   - **Environment**: Production

### 3. Verificar Configuración

El bot verificará automáticamente la configuración:

```bash
# Comando para verificar estado
/status
```

Deberías ver:
- ✅ Claude API: Configurado

## 💰 Gestión de Costos

### Modelo Utilizado
- **claude-3-haiku-20240307**: Modelo más económico y rápido
- Costo aproximado: ~$0.00025 por análisis
- Límite de tokens: 1000 por request

### Fallback Automático
Si Claude no está disponible (sin créditos, error de API, etc.), el bot automáticamente usa el análisis local sin interrumpir el servicio.

### Monitoreo de Uso
- Los logs muestran cuando se usa Claude vs análisis local
- Revisa regularmente el dashboard de Anthropic para ver el uso

## 🛠️ Funcionalidades

### Análisis Avanzado con Claude
- **Clasificación inteligente**: Mejor detección de tipos de documento
- **Asignación de área**: Análisis contextual para determinar el área responsable
- **Priorización automática**: Evaluación de urgencia basada en contenido
- **Confianza del análisis**: Nivel de certeza de la clasificación

### Ejemplo de Análisis
```
📄 Documento: "Solicitud_Vacaciones_Juan_Perez.pdf"
🤖 Claude detecta:
   - Área: Recursos Humanos
   - Prioridad: Media
   - Tipo: Solicitud
   - Confianza: 95%
```

## 🔍 Troubleshooting

### Error: "Credit balance too low"
**Solución**: Agregar créditos en [console.anthropic.com](https://console.anthropic.com/account/billing)

### Error: "API key inválida"
**Solución**: Verificar que la API key sea correcta y esté activa

### Claude no se ejecuta
**Verificar**:
1. Variable `CLAUDE_API_KEY` configurada
2. API key válida y con créditos
3. Conexión a internet estable

### Análisis muy lento
**Posibles causas**:
1. Rate limiting de Anthropic
2. Documentos muy grandes
3. **Solución**: El sistema automáticamente usa análisis local como fallback

## 📊 Logs y Monitoreo

### Logs del Sistema
```bash
🤖 Análisis completado con Claude API          # ✅ Éxito
💳 Claude API: Créditos insuficientes         # ⚠️ Sin créditos
🔄 Continuando con análisis local...          # 🔄 Fallback
```

### Estados Posibles
- ✅ **Claude activo**: API key válida, con créditos
- ⚠️ **Claude inactivo**: Sin créditos o error temporal
- ❌ **Claude deshabilitado**: Sin API key configurada

## 🔐 Seguridad

### Buenas Prácticas
1. **No hardcodear** la API key en el código
2. **Usar variables de entorno** siempre
3. **Rotar claves** periódicamente
4. **Monitorear uso** para detectar actividad inusual

### Variables de Entorno
```bash
# ✅ Correcto
CLAUDE_API_KEY=sk-ant-api03-...

# ❌ Incorrecto (nunca en el código)
const apiKey = "sk-ant-api03-..."
```

## 📈 Beneficios

### Sin Claude (Solo análisis local)
- ✅ Funcionalidad básica
- ✅ Clasificación por reglas
- ⚠️ Precisión limitada

### Con Claude
- ✅ Análisis contextual avanzado
- ✅ Mayor precisión en clasificación
- ✅ Mejor detección de prioridades
- ✅ Adaptabilidad a nuevos tipos de documentos

## 📞 Soporte

Si tienes problemas con la configuración:

1. **Verificar logs** del bot
2. **Comprobar estado** con `/status`
3. **Revisar variables** de entorno
4. **Contactar administrador** del sistema

---

**Nota**: El bot funciona perfectamente sin Claude, usando análisis local inteligente como fallback automático.
