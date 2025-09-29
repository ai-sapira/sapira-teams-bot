/**
 * Types for Teams Bot integration
 */

export interface ConversationMessage {
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  attachments?: MessageAttachment[];
}

export interface MessageAttachment {
  name: string;
  contentType: string;
  contentUrl: string;
  content?: any; // For adaptive cards
}

export interface Conversation {
  id: string;
  userId: string;
  userName: string;
  userEmail?: string;
  channelId: string;
  messages: ConversationMessage[];
  state: ConversationState;
  ticketProposal?: TicketProposal;
  createdAt: Date;
  updatedAt: Date;
}

export type ConversationState = 
  | 'initial'           // First message
  | 'gathering_info'    // Asking questions
  | 'awaiting_confirmation' // Proposed ticket, waiting for user response
  | 'creating_ticket'   // Processing ticket creation
  | 'completed'         // Ticket created successfully
  | 'cancelled';        // User cancelled

export interface TicketProposal {
  title: string;
  description: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  origin: 'teams';
  suggested_labels: string[];
  assignee_suggestion: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface ConversationReference {
  user: {
    id: string;
    name: string;
    aadObjectId?: string;
  };
  bot: {
    id: string;
    name: string;
  };
  conversation: {
    id: string;
    isGroup?: boolean;
    conversationType?: string;
    tenantId?: string;
  };
  channelId: string;
  serviceUrl: string;
}

// Extend existing types for Teams integration
export interface TeamsTicketData {
  title: string;
  description: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  origin: 'teams';
  reporter_id?: string;
  labels?: string[];
  conversation_id: string;
  conversation_reference: ConversationReference;
}

// Conversation class implementation
export class ConversationManager {
  id: string;
  userId: string;
  userName: string;
  userEmail?: string;
  channelId: string;
  messages: ConversationMessage[] = [];
  state: ConversationState = 'initial';
  ticketProposal?: TicketProposal;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: Partial<Conversation>) {
    this.id = data.id || '';
    this.userId = data.userId || '';
    this.userName = data.userName || '';
    this.userEmail = data.userEmail;
    this.channelId = data.channelId || '';
    this.messages = data.messages || [];
    this.state = data.state || 'initial';
    this.ticketProposal = data.ticketProposal;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = new Date();
  }

  addMessage(text: string, sender: 'user' | 'bot', attachments?: MessageAttachment[]): void {
    this.messages.push({
      text,
      sender,
      timestamp: new Date(),
      attachments
    });
    this.updatedAt = new Date();
  }

  getHistory(): string {
    return this.messages
      .map(m => `${m.sender === 'user' ? 'Usuario' : 'Sapira'}: ${m.text}`)
      .join('\n');
  }

  getLastUserMessage(): string {
    const lastUserMessage = this.messages
      .filter(m => m.sender === 'user')
      .pop();
    return lastUserMessage?.text || '';
  }

  setState(state: ConversationState): void {
    this.state = state;
    this.updatedAt = new Date();
  }

  setTicketProposal(proposal: TicketProposal): void {
    this.ticketProposal = proposal;
    this.setState('awaiting_confirmation');
  }

  isWaitingForConfirmation(): boolean {
    return this.state === 'awaiting_confirmation' && !!this.ticketProposal;
  }

  needsMoreInfo(): boolean {
    return this.state === 'initial' || this.state === 'gathering_info';
  }

  canCreateTicket(): boolean {
    return this.messages.length >= 2 && this.getLastUserMessage().length > 0;
  }
}
