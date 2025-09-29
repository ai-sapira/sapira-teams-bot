require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Import bot logic
const { GeminiService } = require('./lib/gemini-service');
const { ConversationManager, TicketCreationService } = require('./lib/conversation-manager');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

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

// Teams bot endpoint
app.post('/api/messages', async (req, res) => {
  let activity;
  
  try {
    activity = req.body;
    console.log('📩 Received Teams message:', {
      type: activity.type,
      text: activity.text,
      from: activity.from?.name,
      conversationId: activity.conversation?.id
    });

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

    // Responder a Teams
    await sendTeamsMessage(
      activity.serviceUrl,
      activity.conversation,
      activity.from,
      responseText,
      activity.id
    );

    console.log('✅ Response sent to Teams');
    res.json({ status: 'ok', sent: true });

  } catch (error) {
    console.error('❌ Bot error:', error);
    
    // Respuesta de fallback
    if (activity) {
      try {
        await sendTeamsMessage(
          activity.serviceUrl,
          activity.conversation,
          activity.from,
          'Lo siento, hubo un error interno. Por favor inténtalo de nuevo.',
          activity.id
        );
      } catch (fallbackError) {
        console.error('Failed to send fallback message:', fallbackError);
      }
    }
    
    res.status(500).json({
      error: 'Bot processing failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
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

async function sendTeamsMessage(serviceUrl, conversation, recipient, text, replyToId) {
  const token = await getAccessToken();
  
  const url = replyToId 
    ? `${serviceUrl}v3/conversations/${conversation.id}/activities/${replyToId}`
    : `${serviceUrl}v3/conversations/${conversation.id}/activities`;
  
  console.log('📤 Sending Teams message to:', url);
  
  const payload = {
    type: 'message',
    text: text,
    from: {
      id: `28:${process.env.MICROSOFT_APP_ID}`,
      name: 'Sapira Soporte'
    },
    ...(replyToId ? {} : { recipient: recipient })
  };
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ Failed to send Teams message:', {
      status: response.status,
      statusText: response.statusText,
      error: errorText,
      url,
      payload
    });
    throw new Error(`Failed to send Teams message: ${response.status} - ${errorText}`);
  }

  console.log('✅ Teams message sent successfully');
  return response.json();
}

async function getAccessToken() {
  const tokenUrl = 'https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token';
  
  console.log('🔑 Requesting access token with:', {
    client_id: process.env.MICROSOFT_APP_ID,
    has_secret: !!process.env.MICROSOFT_APP_PASSWORD
  });
  
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.MICROSOFT_APP_ID,
      client_secret: process.env.MICROSOFT_APP_PASSWORD,
      scope: 'https://api.botframework.com/.default'
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ Failed to get access token:', response.status, errorText);
    throw new Error(`Failed to get access token: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log('✅ Access token obtained successfully');
  return data.access_token;
}

app.listen(port, () => {
  console.log(`🤖 Sapira Teams Bot running on port ${port}`);
  console.log(`📋 Health check: http://localhost:${port}/health`);
  console.log(`🔗 Teams endpoint: http://localhost:${port}/api/messages`);
});

module.exports = app;
