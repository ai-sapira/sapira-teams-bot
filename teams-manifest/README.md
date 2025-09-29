# Teams Bot Manifest

Este directorio contiene los archivos necesarios para desplegar el bot de Sapira en Microsoft Teams.

## Archivos Requeridos

### 1. manifest.json
- **Ubicación**: `teams-manifest/manifest.json`
- **Descripción**: Configuración principal del bot para Teams
- **Acción**: ✅ Ya creado - actualizar APP_ID cuando tengas las credenciales

### 2. Iconos del Bot

#### color-icon.png
- **Tamaño**: 192x192 píxeles
- **Formato**: PNG con fondo de color
- **Descripción**: Icono principal que aparece en el catálogo de apps

#### outline-icon.png  
- **Tamaño**: 32x32 píxeles
- **Formato**: PNG con fondo transparente y contorno blanco
- **Descripción**: Icono que aparece en la barra lateral de Teams

## Pasos para Desplegar

### 1. Obtener Credenciales de Azure
```bash
# Registrar aplicación en Azure AD
az ad app create --display-name "Sapira Soporte Bot"

# Crear Bot Service en Azure
az bot create --resource-group "tu-resource-group" --name "sapira-soporte-bot" --app-id "TU-APP-ID"
```

### 2. Actualizar manifest.json
Reemplazar `REPLACE-WITH-YOUR-APP-ID` con tu App ID real de Azure.

### 3. Crear Iconos
Crear los archivos `color-icon.png` y `outline-icon.png` con las especificaciones mencionadas.

### 4. Empaquetar para Teams
```bash
cd teams-manifest/
zip sapira-bot.zip manifest.json color-icon.png outline-icon.png
```

### 5. Subir a Teams Admin Center
1. Ir a [Teams Admin Center](https://admin.teams.microsoft.com)
2. "Teams apps" > "Manage apps" > "Upload new app"
3. Seleccionar `sapira-bot.zip`
4. Configurar permisos y distribución

## Variables de Entorno Necesarias

Asegúrate de configurar estas variables antes del despliegue:

```env
MICROSOFT_APP_ID=tu-app-id-de-azure
MICROSOFT_APP_PASSWORD=tu-password-de-azure  
GEMINI_API_KEY=tu-api-key-de-gemini
NEXT_PUBLIC_APP_URL=https://tu-dominio.com
```

## Distribución Organizacional

Para instalar automáticamente para todos los usuarios:

1. **Teams Admin Center** > "Teams apps" > "Setup policies"
2. Crear/editar política global
3. **Installed apps** > Añadir "Sapira Soporte"  
4. **Pinned apps** > Añadir "Sapira Soporte" (opcional)
5. Asignar política a usuarios/grupos

## Testing

### Desarrollo Local
```bash
# Usar ngrok para exponer endpoint local
npx ngrok http 3000

# Actualizar endpoint en Azure Bot
az bot update --name "sapira-soporte-bot" --endpoint "https://abc123.ngrok.io/api/messages"
```

### Producción
Actualizar endpoint con tu dominio real:
```bash
az bot update --name "sapira-soporte-bot" --endpoint "https://tu-dominio.com/api/messages"
```

## Solución de Problemas

### Error: "Bot not found"
- Verificar que `MICROSOFT_APP_ID` sea correcto
- Confirmar que el bot esté registrado en Azure

### Error: "Authentication failed"  
- Verificar `MICROSOFT_APP_PASSWORD`
- Regenerar secreto si es necesario

### Error: "Endpoint not reachable"
- Verificar que `/api/messages` esté accesible
- Confirmar HTTPS en producción
- Probar endpoint con `curl` o Postman

### Bot no responde
- Verificar logs de la aplicación
- Comprobar `GEMINI_API_KEY`
- Verificar que el webhook esté funcionando: `GET /api/messages`

## Logs y Monitoreo

El bot incluye logging detallado:
- Conversaciones activas
- Errores de Gemini  
- Creación de tickets
- Métricas de uso

Acceder a estadísticas en desarrollo:
```bash
curl http://localhost:3000/api/messages
```
