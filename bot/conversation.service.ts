import { ConversationManager, ConversationReference } from './types';

/**
 * Service to manage conversation state and persistence
 * In production, this would use Redis or database storage
 */
export class ConversationService {
  private conversations = new Map<string, ConversationManager>();
  
  /**
   * Get or create conversation from Teams context
   */
  getOrCreateConversation(
    conversationId: string,
    userId: string,
    userName: string,
    userEmail?: string,
    channelId?: string
  ): ConversationManager {
    const key = this.getConversationKey(conversationId, userId);
    
    if (!this.conversations.has(key)) {
      const conversation = new ConversationManager({
        id: conversationId,
        userId,
        userName,
        userEmail,
        channelId: channelId || conversationId,
      });
      
      this.conversations.set(key, conversation);
    }
    
    return this.conversations.get(key)!;
  }

  /**
   * Get existing conversation
   */
  getConversation(conversationId: string, userId: string): ConversationManager | null {
    const key = this.getConversationKey(conversationId, userId);
    return this.conversations.get(key) || null;
  }

  /**
   * Update conversation
   */
  updateConversation(conversation: ConversationManager): void {
    const key = this.getConversationKey(conversation.id, conversation.userId);
    this.conversations.set(key, conversation);
  }

  /**
   * Remove conversation (after ticket creation or timeout)
   */
  removeConversation(conversationId: string, userId: string): void {
    const key = this.getConversationKey(conversationId, userId);
    this.conversations.delete(key);
  }

  /**
   * Cleanup old conversations (older than 24 hours)
   */
  cleanupOldConversations(): void {
    const now = new Date();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    for (const [key, conversation] of this.conversations.entries()) {
      if (now.getTime() - conversation.updatedAt.getTime() > maxAge) {
        this.conversations.delete(key);
      }
    }
  }

  /**
   * Get all active conversations (for monitoring/debugging)
   */
  getAllConversations(): ConversationManager[] {
    return Array.from(this.conversations.values());
  }

  /**
   * Get conversation statistics
   */
  getStats(): {
    totalConversations: number;
    byState: Record<string, number>;
    averageMessages: number;
  } {
    const conversations = Array.from(this.conversations.values());
    const byState: Record<string, number> = {};
    let totalMessages = 0;

    conversations.forEach(conv => {
      byState[conv.state] = (byState[conv.state] || 0) + 1;
      totalMessages += conv.messages.length;
    });

    return {
      totalConversations: conversations.length,
      byState,
      averageMessages: conversations.length > 0 ? totalMessages / conversations.length : 0
    };
  }

  private getConversationKey(conversationId: string, userId: string): string {
    return `${conversationId}:${userId}`;
  }
}

/**
 * Service to manage conversation references for proactive messaging
 */
export class ConversationReferenceService {
  private references = new Map<string, ConversationReference>();

  /**
   * Store conversation reference for proactive messaging
   */
  storeReference(conversationId: string, userId: string, reference: ConversationReference): void {
    const key = this.getReferenceKey(conversationId, userId);
    this.references.set(key, reference);
  }

  /**
   * Get conversation reference for proactive messaging
   */
  getReference(conversationId: string, userId: string): ConversationReference | null {
    const key = this.getReferenceKey(conversationId, userId);
    return this.references.get(key) || null;
  }

  /**
   * Remove conversation reference
   */
  removeReference(conversationId: string, userId: string): void {
    const key = this.getReferenceKey(conversationId, userId);
    this.references.delete(key);
  }

  /**
   * Cleanup old references
   */
  cleanup(): void {
    // In production, you'd track timestamps and cleanup based on age
    // For now, we keep all references for potential proactive messaging
  }

  private getReferenceKey(conversationId: string, userId: string): string {
    return `${conversationId}:${userId}`;
  }
}

// Singleton instances
export const conversationService = new ConversationService();
export const conversationReferenceService = new ConversationReferenceService();

// Cleanup task that runs every hour
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    conversationService.cleanupOldConversations();
    conversationReferenceService.cleanup();
  }, 60 * 60 * 1000); // 1 hour
}
