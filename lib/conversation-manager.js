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
  async createTicketFromConversation(conversation, proposal) {
    // Mock implementation - en producción conectaría con tu sistema de tickets
    console.log('Creating ticket:', proposal);
    
    const ticketKey = `TICK-${Date.now()}`;
    const ticketUrl = `https://your-platform.com/tickets/${ticketKey}`;
    
    return {
      ticket_key: ticketKey,
      ticket_url: ticketUrl,
      status: 'created'
    };
  }
}

module.exports = { ConversationManager, TicketCreationService };
