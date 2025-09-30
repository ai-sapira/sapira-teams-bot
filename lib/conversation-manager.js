class ConversationManager {
  constructor({ id, userId, userName, userEmail, channelId }) {
    this.id = id;
    this.userId = userId;
    this.userName = userName;
    this.userEmail = userEmail;
    this.channelId = channelId;
    this.messages = [];
    this.state = 'active';
    this.ticketProposal = null;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  addMessage(content, sender) {
    this.messages.push({
      content,
      sender,
      timestamp: new Date()
    });
    this.updatedAt = new Date();
  }

  getHistory() {
    return this.messages
      .map(msg => `${msg.sender}: ${msg.content}`)
      .join('\n');
  }

  setState(newState) {
    this.state = newState;
    this.updatedAt = new Date();
  }

  setTicketProposal(proposal) {
    this.ticketProposal = proposal;
    this.state = 'awaiting_confirmation';
    this.updatedAt = new Date();
  }

  isWaitingForConfirmation() {
    return this.state === 'awaiting_confirmation';
  }
}

class TicketCreationService {
  async createTicketFromConversation(conversation, proposal, conversationReference = null) {
    try {
      // Get API URL from environment or use localhost for development
      const apiUrl = process.env.SAPIRA_API_URL || 'http://localhost:3000';
      const endpoint = `${apiUrl}/api/teams/create-issue`;
      
      console.log('🎫 Creating ticket via API:', endpoint);
      
      // Prepare request body
      const requestBody = {
        conversation_id: conversation.id,
        conversation_url: `https://teams.microsoft.com/l/chat/0/0?users=${conversation.userId}`,
        user_id: conversation.userId,
        user_name: conversation.userName,
        user_email: conversation.userEmail,
        participants: [conversation.userName, 'Sapira AI'],
        messages: conversation.messages.map(msg => ({
          author: msg.sender === 'user' ? conversation.userName : 'Sapira AI',
          content: msg.content,
          timestamp: msg.timestamp.toISOString()
        })),
        ai_analysis: {
          summary: proposal.description,
          priority: proposal.priority,
          suggested_labels: proposal.suggested_labels || [],
          key_points: [proposal.title]
        },
        // Add conversation reference for proactive messaging
        conversation_reference: conversationReference
      };
      
      // Call Sapira API to create issue
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`API error: ${response.status} - ${errorData.message || 'Unknown error'}`);
      }
      
      const result = await response.json();
      
      console.log('✅ Ticket created successfully:', result);
      
      return {
        ticket_key: result.issue_key,
        ticket_url: result.issue_url,
        status: 'created'
      };
      
    } catch (error) {
      console.error('❌ Error creating ticket:', error);
      
      // Fallback to mock if API fails (for development)
      console.log('⚠️ Falling back to mock ticket creation');
      const ticketKey = `MOCK-${Date.now()}`;
      const apiUrl = process.env.SAPIRA_API_URL || 'https://v0-internal-os-build.vercel.app';
      const ticketUrl = `${apiUrl}/triage-new`;
      
      return {
        ticket_key: ticketKey,
        ticket_url: ticketUrl,
        status: 'mock_created',
        error: error.message
      };
    }
  }
}

module.exports = { ConversationManager, TicketCreationService };
