require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { BotFrameworkAdapter, TurnContext } = require('botbuilder');

// Import bot logic
const { GeminiService } = require('./lib/gemini-service');
const { ConversationManager, TicketCreationService } = require('./lib/conversation-manager');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Create Bot Framework adapter
const adapter = new BotFrameworkAdapter({
  appId: process.env.MICROSOFT_APP_ID,
  appPassword: process.env.MICROSOFT_APP_PASSWORD
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

    // Validar que el mensaje viene de Teams real (no de pruebas)
    const authHeader = req.headers.authorization;
    const isRealTeams = activity.serviceUrl && activity.serviceUrl !== 'https://test.service.url';
    
    if (isRealTeams && !authHeader) {
      console.error('❌ Missing authorization header from Teams');
      return res.status(401).json({ error: 'Unauthorized - Missing auth header' });
    }
    
    // Log para debug
    if (isRealTeams) {
      console.log('🔐 Teams auth header present:', !!authHeader);
    }

    // Solo procesar mensajes de texto
    if (activity.type !== 'message' || !activity.text) {
      return res.json({ status: 'ignored' });
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

    // Añadir mensaje del usuario
    conversation.addMessage(activity.text, 'user');
    console.log('💬 User message added to conversation');

    // Decidir si crear ticket o continuar conversación
    const shouldCreateTicket = await getGeminiService().shouldCreateTicket(conversation);
    
    let responseText = '';
    
    if (shouldCreateTicket && conversation.state !== 'awaiting_confirmation') {
      // Generar propuesta de ticket
      const proposal = await getGeminiService().generateTicketProposal(conversation);
      conversation.setTicketProposal(proposal);
      
      responseText = `He analizado tu problema y preparé este ticket:

📋 **${proposal.title}**
🔍 Prioridad: ${proposal.priority}
👥 Equipo: ${proposal.assignee_suggestion}
🏷️ Etiquetas: ${proposal.suggested_labels.join(', ')}

📝 **Descripción:**
${proposal.description}

¿Te parece correcto? Responde "sí" para crear el ticket o "no" si quieres hacer cambios.`;
      
    } else if (conversation.isWaitingForConfirmation()) {
      // Analizar respuesta del usuario
      const feedback = await getGeminiService().analyzeTicketFeedback(
        activity.text,
        conversation.ticketProposal
      );
      
      if (feedback.action === 'confirm') {
        try {
          // Crear ticket
          const result = await getTicketService().createTicketFromConversation(
            conversation,
            conversation.ticketProposal
          );
          
          responseText = `🎉 ¡Perfecto! Tu ticket **${result.ticket_key}** ha sido creado exitosamente.

🔗 Ver ticket: ${result.ticket_url}

El equipo de soporte lo revisará y te contactará si necesita información adicional.`;
          
          conversation.setState('completed');
          
        } catch (error) {
          console.error('Error creating ticket:', error);
          responseText = 'Lo siento, hubo un error al crear el ticket. ¿Puedes intentarlo de nuevo?';
        }
      } else if (feedback.action === 'cancel') {
        responseText = 'Entendido, no se creará el ticket. Si necesitas ayuda en el futuro, no dudes en escribirme.';
        conversation.setState('completed');
      } else {
        responseText = feedback.followUpQuestion || '¿Qué te gustaría cambiar del ticket propuesto?';
      }
      
    } else {
      // Continuar conversación normal
      responseText = await getGeminiService().continueConversation(conversation);
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

app.listen(port, () => {
  console.log(`🤖 Sapira Teams Bot running on port ${port}`);
  console.log(`📋 Health check: http://localhost:${port}/health`);
  console.log(`🔗 Teams endpoint: http://localhost:${port}/api/messages`);
});

module.exports = app;
