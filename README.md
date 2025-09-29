# Sapira Teams Bot

Bot de soporte técnico para Microsoft Teams con IA (Gemini).

## 🚀 Deploy en Render

1. **Crear nuevo Web Service en Render**
2. **Conectar este repositorio**
3. **Configurar variables de entorno:**
   ```
   MICROSOFT_APP_ID = your_app_id_here
   MICROSOFT_APP_PASSWORD = your_app_password_here
   MICROSOFT_APP_TYPE = SingleTenant
   GEMINI_API_KEY = your_gemini_api_key_here
   NODE_ENV = production
   ```

4. **Build & Start Commands:**
   - Build Command: `npm install`
   - Start Command: `npm start`

## 🔗 Endpoints

- **Health Check**: `GET /health`
- **Teams Webhook**: `POST /api/messages`

## 📱 Teams Manifest

El archivo `teams-manifest/manifest.json` debe actualizarse con la URL de Render una vez deployado.

## 🧪 Desarrollo Local

```bash
npm install
cp env.example .env
# Editar .env con tus credenciales
npm start
```
