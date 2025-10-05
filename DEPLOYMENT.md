# 🚀 Deployment Instructions - Sapira Teams Bot

## ✅ Cambios Realizados

Se ha actualizado el bot de Teams para soportar **mensajería proactiva**. Ahora cuando un issue es aceptado/rechazado/pospuesto en el triage, el usuario recibe una notificación automática en Teams.

### Archivos Modificados:

1. **`server.js`** (líneas 209-228)
   - Captura `conversationReference` del activity de Teams
   - Lo pasa al servicio de creación de tickets

2. **`lib/conversation-manager.js`** (línea 47 y 75)
   - Acepta `conversationReference` como parámetro
   - Lo incluye en el request al API

---

## 📦 Pasos para Deployment

### 1. Commit y Push de Cambios

```bash
# Navegar a la carpeta del bot
cd sapira-teams-bot

# Ver cambios
git status

# Añadir archivos modificados
git add server.js lib/conversation-manager.js

# Commit
git commit -m "feat: Add conversation reference for proactive Teams messaging

- Capture Teams conversation reference when creating tickets
- Pass reference to API for storing in database
- Enable proactive notifications when issues are triaged"

# Push al repositorio
git push origin main
```

### 2. Deploy en Render/Azure/Heroku

#### Si usas Render:
```bash
# Render detecta automáticamente el push y redeploys
# Monitorea en: https://dashboard.render.com
```

#### Si usas Azure App Service:
```bash
# Deploy desde Git
az webapp deployment source sync --name sapira-teams-bot --resource-group YOUR_RESOURCE_GROUP

# O usando GitHub Actions (si está configurado)
# Render automáticamente desplegará al hacer push
```

#### Si usas Heroku:
```bash
# Si tienes Heroku CLI configurado
heroku git:remote -a sapira-teams-bot
git push heroku main
```

### 3. Verificar Variables de Entorno

Asegúrate de que tu servicio de hosting tiene estas variables:

```env
# Microsoft Teams Bot
MICROSOFT_APP_ID=xxx
MICROSOFT_APP_PASSWORD=xxx
MICROSOFT_APP_TENANT_ID=xxx (opcional)

# Gemini AI
GEMINI_API_KEY=xxx

# Sapira API
SAPIRA_API_URL=https://your-domain.com  # URL de tu API principal

# Node Environment
NODE_ENV=production
PORT=3000
```

### 4. Verificar el Deploy

#### Hacer un Health Check:
```bash
curl https://your-bot-domain.com/health
```

**Respuesta esperada:**
```json
{
  "status": "healthy",
  "message": "Sapira Teams Bot is running",
  "configured": {
    "gemini": true,
    "teams": true
  },
  "timestamp": "2025-09-30T..."
}
```

#### Test del Endpoint:
```bash
curl https://your-bot-domain.com/api/messages
```

**Respuesta esperada:**
```json
{
  "status": "healthy",
  "message": "Sapira Teams Bot API endpoint",
  "method": "POST",
  "timestamp": "2025-09-30T..."
}
```

---

## 🧪 Testing Completo

### 1. Test Creación de Issue desde Teams

1. Abre Teams
2. Busca el bot "Sapira Soporte"
3. Envía un mensaje: "Tengo un problema con el login"
4. El bot te propondrá un ticket
5. Responde "sí" para confirmar
6. ✅ El bot debe responder con el ticket creado

### 2. Test Notificación Proactiva

1. Ve al UI de triage: `https://your-domain.com/triage-new`
2. Selecciona el issue que creaste
3. Haz clic en "Actions" → "Accept"
4. Añade un comentario: "Hemos revisado tu issue y lo aceptamos"
5. Confirma
6. ✅ **Deberías recibir un mensaje en Teams** con el comentario

### 3. Verificar en Base de Datos

```sql
-- Verificar que se guardó el conversation_reference
SELECT 
  id, 
  provider, 
  external_id,
  teams_context->>'service_url' as service_url,
  teams_context->'user'->>'name' as user_name
FROM issue_links 
WHERE provider = 'teams' 
  AND teams_context IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;
```

---

## 🔧 Troubleshooting

### El bot no envía notificaciones proactivas

1. **Verificar que el issue tiene Teams context:**
   ```bash
   curl "https://your-domain.com/api/teams/send-message?issue_id=xxx"
   ```
   Debe devolver: `{ "has_teams_context": true }`

2. **Verificar logs del servidor:**
   ```bash
   # En Render
   # Dashboard → Logs
   
   # En Heroku
   heroku logs --tail -a sapira-teams-bot
   
   # En Azure
   az webapp log tail --name sapira-teams-bot --resource-group YOUR_RESOURCE_GROUP
   ```

3. **Verificar access token de Microsoft:**
   - El error común es token expirado
   - Cada request obtiene un nuevo token
   - Verifica MICROSOFT_APP_ID y MICROSOFT_APP_PASSWORD

### El conversation_reference no se guarda

1. **Verificar que el bot está actualizado:**
   ```bash
   curl https://your-bot-domain.com/
   ```
   Debe mostrar `version: 1.0.0` o superior

2. **Verificar request body en logs:**
   - Busca: `🎫 Creating ticket via API`
   - Debe incluir `conversation_reference` en el body

---

## 📊 Monitoreo

### Métricas a Observar:

1. **Tasa de éxito de notificaciones:**
   ```sql
   SELECT 
     COUNT(*) as total_notifications,
     COUNT(CASE WHEN payload->>'source' = 'teams_proactive_message' THEN 1 END) as teams_sent
   FROM issue_activity
   WHERE action = 'commented'
     AND created_at > NOW() - INTERVAL '7 days';
   ```

2. **Issues con Teams context:**
   ```sql
   SELECT 
     COUNT(*) as total_teams_issues,
     COUNT(teams_context) as with_context
   FROM issue_links
   WHERE provider = 'teams';
   ```

---

## 🔄 Rollback (si algo sale mal)

Si necesitas revertir los cambios:

```bash
# Revertir último commit
git revert HEAD

# Push
git push origin main

# El servicio re-deployeará automáticamente
```

---

## 📚 Documentación Relacionada

- [Teams Proactive Messaging](../TEAMS_PROACTIVE_MESSAGING.md)
- [Bot Framework REST API](https://docs.microsoft.com/en-us/azure/bot-service/rest-api/bot-framework-rest-connector-send-and-receive-messages)
- [Render Deployment](https://render.com/docs/deploy-node-express-app)

---

## ✅ Checklist Final

- [ ] Commit y push de cambios
- [ ] Deploy verificado (health check OK)
- [ ] Variables de entorno configuradas
- [ ] Test de creación de issue funciona
- [ ] Test de notificación proactiva funciona
- [ ] Logs del servidor sin errores
- [ ] Migración SQL ejecutada en Supabase ✅
- [ ] Documentación actualizada ✅

---

**¿Todo OK?** Una vez completado el checklist, el sistema de mensajería proactiva estará completamente funcional. 🎉
