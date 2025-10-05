require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { BotFrameworkAdapter, TurnContext } = require('botbuilder');

// Import bot logic
const { GeminiService } = require('./lib/gemini-service');
const { ConversationManager, TicketCreationService } = require('./lib/conversation-manager');

const app = express();
const port = process.env.PORT || 3978;

// Middleware
app.use(cors());
app.use(express.json());

// Create Bot Framework adapter with explicit authentication configuration
const adapter = new BotFrameworkAdapter({
  appId: process.env.MICROSOFT_APP_ID,
  appPassword: process.env.MICROSOFT_APP_PASSWORD,
  channelAuthTenant: process.env.MICROSOFT_APP_TENANT_ID || '43b89735-ea65-4f21-a5a3-8f552126a8f9'
});

// Log adapter configuration
console.log('🔧 Bot Framework Adapter initialized:', {
  appId: process.env.MICROSOFT_APP_ID,
  hasPassword: !!process.env.MICROSOFT_APP_PASSWORD,
  tenant: process.env.MICROSOFT_APP_TENANT_ID || '43b89735-ea65-4f21-a5a3-8f552126a8f9'
});

// Error handler for adapter
adapter.onTurnError = async (context, error) => {
  console.error('❌ Bot Framework Adapter Error:', error);
  console.error('Error details:', {
    message: error.message,
    stack: error.stack,
    statusCode: error.statusCode,
    conversationId: context?.activity?.conversation?.id
  });
  
  // Send a message to the user
  try {
    await context.sendActivity('Lo siento, ocurrió un error. Por favor intenta de nuevo.');
  } catch (sendError) {
    console.error('Failed to send error message:', sendError);
  }
};

// Services - lazy initialization
let geminiService = null;
let ticketService = null;
const conversations = new Map();

function getGeminiService() {
  if (!geminiService) {
    geminiService = new GeminiService();
  }
  return geminiService;
}

function getTicketService() {
  if (!ticketService) {
    ticketService = new TicketCreationService();
  }
  return ticketService;
}

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Sapira Teams Bot',
    status: 'healthy',
    message: 'Bot de soporte técnico para Microsoft Teams',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      messages: '/api/messages'
    },
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    message: 'Sapira Teams Bot is running',
    configured: {
      gemini: !!process.env.GEMINI_API_KEY,
      teams: !!process.env.MICROSOFT_APP_ID && !!process.env.MICROSOFT_APP_PASSWORD
    },
    timestamp: new Date().toISOString()
  });
});

app.get('/api/messages', (req, res) => {
  res.json({
    status: 'healthy',
    message: 'Sapira Teams Bot API endpoint',
    method: 'POST',
    timestamp: new Date().toISOString()
  });
});

// Endpoint para verificar configuración
app.get('/api/config-check', (req, res) => {
  const appId = process.env.MICROSOFT_APP_ID;
  const hasPassword = !!process.env.MICROSOFT_APP_PASSWORD;
  const passwordLength = process.env.MICROSOFT_APP_PASSWORD?.length || 0;
  const passwordPrefix = process.env.MICROSOFT_APP_PASSWORD?.substring(0, 5) || 'NOT_SET';
  
  res.json({
    appId,
    hasPassword,
    passwordLength,
    passwordPrefix,
    expectedPasswordPrefix: 'RwG8Q',
    passwordMatches: passwordPrefix === 'RwG8Q',
    timestamp: new Date().toISOString()
  });
});

// Endpoint para diagnosticar requests de Teams
app.all('/api/debug', (req, res) => {
  console.log('🔍 DEBUG Request:', {
    method: req.method,
    headers: req.headers,
    body: req.body,
    query: req.query,
    timestamp: new Date().toISOString()
  });
  
  res.json({
    method: req.method,
    headers: req.headers,
    body: req.body,
    received: true,
    timestamp: new Date().toISOString()
  });
});

// Teams bot endpoint - using Bot Framework adapter
app.post('/api/messages', (req, res) => {
  adapter.processActivity(req, res, async (context) => {
    try {
    const activity = context.activity;
    console.log('📩 Received Teams message:', {
      type: activity.type,
      text: activity.text,
      from: activity.from?.name,
      conversationId: activity.conversation?.id,
      serviceUrl: activity.serviceUrl
    });

    // Solo procesar mensajes de texto
    if (activity.type !== 'message' || !activity.text) {
      // Bot Framework handles the response automatically
      return;
    }

    // Extraer información del usuario
    const userId = activity.from.id;
    const userName = activity.from.name || 'Usuario';
    const userEmail = activity.from.aadObjectId;
    const conversationId = activity.conversation.id;

    // Obtener o crear conversación
    const conversation = getOrCreateConversation(
      conversationId,
      userId,
      userName,
      userEmail
    );
    
    const conversationKey = `${conversationId}:${userId}`;
    console.log('🔑 Conversation key:', conversationKey);
    console.log('📦 Conversations in memory:', conversations.size);
    console.log('📝 Messages before adding:', conversation.messages.length);

    // Añadir mensaje del usuario
    conversation.addMessage(activity.text, 'user');
    console.log('💬 User message added to conversation:', {
      messageCount: conversation.messages.length,
      state: conversation.state,
      hasProposal: !!conversation.ticketProposal,
      fullHistory: conversation.getHistory()
    });
    
    // ⭐ NUEVO: Detectar si conversación ya está completada
    if (conversation.state === 'completed') {
      const lowerText = activity.text.toLowerCase().trim();
      const newConversationKeywords = [
        'nueva idea', 'otro problema', 'otra cosa', 'nuevo ticket', 
        'hola', 'buenas', 'hey', 'tengo otra idea', 'tengo un problema',
        'otra iniciativa', 'otra propuesta'
      ];
      
      const isStartingNew = newConversationKeywords.some(kw => lowerText.includes(kw));
      
      if (isStartingNew) {
        console.log('🔄 Starting new conversation - resetting state');
        
        // Resetear conversación pero mantener info del usuario
        const key = `${conversationId}:${userId}`;
        conversations.delete(key);
        
        // Crear nueva conversación limpia
        const newConversation = getOrCreateConversation(
          conversationId,
          userId,
          userName,
          userEmail
        );
        
        // Agregar el mensaje inicial
        newConversation.addMessage(activity.text, 'user');
        
        // Responder con bienvenida
        const responseText = await getGeminiService().continueConversation(newConversation);
        newConversation.addMessage(responseText, 'bot');
        
        await context.sendActivity({ type: 'message', text: responseText });
        console.log('✅ New conversation started');
        return; // Salir del flujo principal
      } else {
        // Si no está empezando de nuevo, recordarle que ya completó
        await context.sendActivity({ 
          type: 'message', 
          text: 'Ya completamos tu ticket anterior. Si tienes otra idea o problema, dime "nueva idea" o "tengo otro problema" y empezamos de cero.' 
        });
        console.log('✅ Reminded user to start new conversation');
        return;
      }
    }
    
    // Detectar si es el primer mensaje (conversación nueva)
    const isFirstMessage = conversation.messages.length === 1;

    // Decidir si crear ticket o continuar conversación
    const shouldCreateTicket = await getGeminiService().shouldCreateTicket(conversation);
    
    let responseText = '';
    
    // Si es el primer mensaje, dar bienvenida natural
    if (isFirstMessage && !shouldCreateTicket) {
      // Detectar si el primer mensaje ya tiene contenido útil
      const firstMessageText = activity.text.toLowerCase().trim();
      const isJustGreeting = ['hola', 'hey', 'buenas', 'buenos dias', 'buenas tardes'].includes(firstMessageText);
      const isNewIdeaKeyword = ['nueva idea', 'otro problema', 'otra cosa'].includes(firstMessageText);
      
      // Si es solo un saludo o keyword, responder con bienvenida
      if (isJustGreeting || isNewIdeaKeyword) {
        responseText = "¡Hola! ¿En qué puedo ayudarte hoy?";
      } else {
        // Si ya viene con contenido, usar Gemini para responder específicamente
        responseText = await getGeminiService().continueConversation(conversation);
      }
      
    } else if (shouldCreateTicket && conversation.state !== 'awaiting_confirmation') {
      // Generar propuesta de ticket
      const proposal = await getGeminiService().generateTicketProposal(conversation);
      conversation.setTicketProposal(proposal);
      
      // Presentar propuesta de forma más conversacional
      const techInfo = proposal.core_technology ? `usando ${proposal.core_technology}` : '';
      const labels = proposal.suggested_labels && proposal.suggested_labels.length > 0 
        ? `\n🏷️ Etiquetas: ${proposal.suggested_labels.join(', ')}`
        : '';
      
      responseText = `Vale, creo que tengo suficiente info. Te preparo una propuesta:

📋 **${proposal.title}**

${proposal.short_description || proposal.description}${techInfo ? ` ${techInfo}` : ''}

🎯 Prioridad que sugiero: **${proposal.priority}** 
👥 Esto creo que encajaría bien con: ${proposal.assignee_suggestion}${labels}

¿Qué te parece? Si te vale, la creo ahora mismo. Si quieres cambiar algo, dime.`;
      
    } else if (conversation.isWaitingForConfirmation()) {
      // Analizar respuesta del usuario
      const feedback = await getGeminiService().analyzeTicketFeedback(
        activity.text,
        conversation.ticketProposal
      );
      
      if (feedback.action === 'confirm') {
        try {
          // Build conversation reference for proactive messaging
          const conversationReference = {
            serviceUrl: activity.serviceUrl,
            channelId: activity.channelId,
            conversation: {
              id: activity.conversation.id,
              isGroup: activity.conversation.isGroup,
              conversationType: activity.conversation.conversationType,
              tenantId: activity.conversation.tenantId
            },
            user: {
              id: activity.from.id,
              name: activity.from.name,
              aadObjectId: activity.from.aadObjectId
            },
            bot: {
              id: activity.recipient?.id || `28:${process.env.MICROSOFT_APP_ID}`,
              name: 'Sapira Soporte'
            }
          };
          
          // Crear ticket
          const result = await getTicketService().createTicketFromConversation(
            conversation,
            conversation.ticketProposal,
            conversationReference
          );
          
          responseText = `🎉 ¡Listo! Ya está creado el ticket **${result.ticket_key}**.

Puedes verlo aquí: ${result.ticket_url}

El equipo responsable lo revisará y te mantendrá informado. Si tienes otra idea o problema, solo dime "nueva idea" o "tengo otro problema".`;
          
          conversation.setState('completed');
          
          // Limpiar la conversación del Map después de 2 minutos
          setTimeout(() => {
            const key = `${conversationId}:${userId}`;
            conversations.delete(key);
            console.log('🧹 Conversation cleaned:', key);
          }, 120000); // 2 minutos
          
        } catch (error) {
          console.error('Error creating ticket:', error);
          responseText = 'Uy, algo ha fallado al crear el ticket. ¿Probamos de nuevo en un momento?';
        }
      } else if (feedback.action === 'reject') {
        // Usuario rechaza la propuesta
        responseText = feedback.natural_response || 'Entendido, lo dejamos. Si más adelante quieres retomarlo, aquí estaré.';
        conversation.setState('completed');
      } else if (feedback.action === 'modify') {
        // Usuario quiere hacer cambios significativos
        responseText = feedback.natural_response || '¿Qué te gustaría cambiar de la propuesta?';
        // Volver a estado activo para recopilar más info
        conversation.setState('active');
      } else {
        // unclear o cualquier otro caso
        responseText = feedback.natural_response || '¿Te vale la propuesta así o prefieres cambiar algo?';
      }
      
    } else {
      // Continuar conversación normal
      console.log('🤖 Calling Gemini continueConversation...');
      try {
        responseText = await getGeminiService().continueConversation(conversation);
        console.log('✅ Gemini responded:', {
          length: responseText.length,
          preview: responseText.substring(0, 100)
        });
      } catch (error) {
        console.error('❌ Gemini error:', error);
        responseText = "Lo siento, tengo un problema técnico. ¿Puedes repetir lo último?";
      }
    }

    // Añadir respuesta del bot a la conversación
    conversation.addMessage(responseText, 'bot');
    console.log('🤖 Bot response prepared');

    // Responder usando Bot Framework context
    await context.sendActivity({ type: 'message', text: responseText });
    console.log('✅ Response sent to Teams via Bot Framework');

  } catch (error) {
    console.error('❌ Bot error:', error);
    
    // Intentar enviar mensaje de error
    try {
      await context.sendActivity({ 
        type: 'message', 
        text: 'Lo siento, hubo un error interno. Por favor inténtalo de nuevo.' 
      });
    } catch (fallbackError) {
      console.error('Failed to send fallback message:', fallbackError);
    }
  }
  });
});

// Helper functions
function getOrCreateConversation(conversationId, userId, userName, userEmail) {
  const key = `${conversationId}:${userId}`;
  
  if (!conversations.has(key)) {
    const conversation = new ConversationManager({
      id: conversationId,
      userId,
      userName,
      userEmail,
      channelId: conversationId,
    });
    conversations.set(key, conversation);
  }
  
  return conversations.get(key);
}

// Las funciones sendTeamsMessage y getAccessToken ya no son necesarias
// El Bot Framework adapter maneja todo automáticamente

// Proactive messaging endpoint
app.post('/api/proactive-message', async (req, res) => {
  try {
    const { teams_context, message } = req.body;
    
    if (!teams_context || !message) {
      return res.status(400).json({ 
        error: 'Missing required fields: teams_context and message' 
      });
    }

    // Build conversation reference from teams_context
    const conversationReference = {
      serviceUrl: teams_context.service_url,
      channelId: teams_context.channel_id,
      conversation: {
        id: teams_context.conversation.id,
        isGroup: teams_context.conversation.isGroup,
        conversationType: teams_context.conversation.conversationType,
        tenantId: teams_context.conversation.tenantId || teams_context.tenant_id
      },
      bot: {
        id: teams_context.bot.id,
        name: teams_context.bot.name
      },
      user: {
        id: teams_context.user.id,
        name: teams_context.user.name,
        aadObjectId: teams_context.user.aadObjectId
      }
    };

    console.log('📤 Sending proactive message:', {
      conversationId: conversationReference.conversation.id,
      messagePreview: message.substring(0, 50) + '...'
    });

    // Use Bot Framework adapter to send proactive message
    await adapter.continueConversation(conversationReference, async (turnContext) => {
      await turnContext.sendActivity({ 
        type: 'message', 
        text: message 
      });
    });

    console.log('✅ Proactive message sent successfully');
    
    res.json({ 
      success: true, 
      message: 'Proactive message sent successfully' 
    });

  } catch (error) {
    console.error('❌ Error sending proactive message:', error);
    res.status(500).json({ 
      error: 'Failed to send proactive message',
      details: error.message 
    });
  }
});

app.listen(port, () => {
  console.log(`🤖 Sapira Teams Bot running on port ${port}`);
  console.log(`📋 Health check: http://localhost:${port}/health`);
  console.log(`🔗 Teams endpoint: http://localhost:${port}/api/messages`);
  console.log(`📤 Proactive messaging: http://localhost:${port}/api/proactive-message`);
});

module.exports = app;
