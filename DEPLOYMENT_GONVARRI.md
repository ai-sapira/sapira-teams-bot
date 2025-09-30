# 🚀 Deployment - Bot Sapira para Gonvarri

## 📋 Resumen de Actualización

Bot actualizado para gestionar **initiatives de automatización e IA de Gonvarri** en lugar de tickets de soporte técnico.

---

## 📦 Pasos para Despliegue

### 1️⃣ Verificar Cambios

```bash
cd sapira-teams-bot
git status
```

**Archivos modificados:**
- ✅ `lib/gemini-service.js` - Prompts actualizados
- ✅ `lib/conversation-manager.js` - Nuevos campos
- ✅ `bot/*.ts` - Versión TypeScript actualizada
- ✅ `COMMIT_MESSAGE.txt` - Mensaje de commit
- ✅ `DEPLOYMENT_GONVARRI.md` - Esta guía

### 2️⃣ Commit y Push

```bash
# Añadir archivos
git add lib/gemini-service.js lib/conversation-manager.js
git add bot/types.ts bot/gemini.service.ts bot/ticket-creation.service.ts bot/adaptive-cards.ts
git add COMMIT_MESSAGE.txt DEPLOYMENT_GONVARRI.md

# Commit
git commit -F COMMIT_MESSAGE.txt

# Push a main
git push origin main
```

### 3️⃣ Deploy Automático

El servicio en **Render** detectará el push y redesplegará automáticamente:

- 🔗 Dashboard: https://dashboard.render.com
- ⏱️ Tiempo estimado: 2-3 minutos
- 🔔 Recibirás notificación cuando complete

### 4️⃣ Verificar Deployment

```bash
# Health check
curl https://your-bot-domain.onrender.com/health

# Debería responder:
# {"status":"healthy","message":"Sapira Teams Bot is running","version":"1.0.0"}
```

---

## 🧪 Testing Post-Deployment

### Test 1: Conversación Simple
```
Usuario: "Quiero automatizar la aprobación de facturas con IA"

Sapira debería:
1. Preguntar sobre tecnología específica
2. Preguntar sobre impacto en negocio
3. Generar propuesta con campos de Gonvarri
```

### Test 2: Verificar Tarjeta Adaptativa
La tarjeta debe mostrar:
- ✅ Título: "🚀 Propuesta de Initiative"
- ✅ Alcance (short_description)
- ✅ Tecnología Core
- ✅ Impacto
- ✅ Complejidad: X/3
- ✅ Impacto Negocio: X/3
- ✅ Prioridad calculada

### Test 3: Creación de Issue
Al confirmar la initiative:
- ✅ Se crea en la base de datos
- ✅ Incluye todos los campos de Gonvarri
- ✅ Prioridad calculada correctamente
- ✅ Estado: "triage"

---

## 🔐 Variables de Entorno

Verificar que estén configuradas en Render:

```env
# Microsoft Teams
MICROSOFT_APP_ID=xxxxx
MICROSOFT_APP_PASSWORD=xxxxx
MICROSOFT_APP_TENANT_ID=xxxxx

# Gemini AI
GEMINI_API_KEY=xxxxx

# Sapira API
SAPIRA_API_URL=https://your-domain.com

# Environment
NODE_ENV=production
PORT=3000
```

---

## 🎯 Ejemplos de Initiatives

### Ejemplo 1: FraudFinder AI
```json
{
  "title": "FraudFinder AI",
  "short_description": "Fraudulent transactions detection",
  "core_technology": "IDP + Predictive AI",
  "impact": "Reduce time on investigations",
  "difficulty": 3,
  "impact_score": 3,
  "priority": "P0"
}
```

### Ejemplo 2: Agile Pricing
```json
{
  "title": "Agile pricing",
  "short_description": "AI for pricing and discount margins",
  "core_technology": "Predictive AI",
  "impact": "Reduced repetitive tasks",
  "difficulty": 2,
  "impact_score": 3,
  "priority": "P1"
}
```

---

## 🔄 Rollback (si es necesario)

Si hay problemas, hacer rollback al commit anterior:

```bash
# Ver commits recientes
git log --oneline -5

# Rollback al commit anterior
git revert HEAD

# Push
git push origin main
```

---

## 📊 Monitoreo Post-Deploy

1. **Logs en Render:**
   - Dashboard → Service → Logs
   - Buscar: "🎫 Creating ticket" y verificar estructura

2. **Base de Datos:**
   - Verificar que issues tengan campos:
     - `short_description`
     - `impact`
     - `core_technology`

3. **Teams:**
   - Probar conversación end-to-end
   - Verificar tarjetas adaptativas
   - Confirmar creación de initiative

---

## ✅ Checklist Final

- [ ] Código commiteado y pusheado
- [ ] Deploy completado en Render
- [ ] Health check OK
- [ ] Variables de entorno verificadas
- [ ] Test de conversación exitoso
- [ ] Tarjeta adaptativa correcta
- [ ] Initiative creada en BD con campos correctos
- [ ] Equipo notificado del deploy

---

## 📞 Soporte

Si hay problemas:
1. Revisar logs en Render
2. Verificar variables de entorno
3. Testear con curl el health endpoint
4. Revisar AGENT_GONVARRI_UPDATE.md para detalles

**¡Todo listo para producción! 🚀**
