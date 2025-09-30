import { ConversationManager, TicketProposal } from './types';
import { TeamsIntegration, type TeamsConversationData } from '../api/teams-integration';

/**
 * Service for creating tickets from bot conversations
 */
export class TicketCreationService {
  private readonly organizationId = '01234567-8901-2345-6789-012345678901'; // TODO: Get from context
  private readonly aiAgentUserId = '11111111-1111-1111-1111-111111111111'; // Sapira AI agent user ID

  /**
   * Creates a ticket from a conversation and proposal
   */
  async createTicketFromConversation(
    conversation: ConversationManager,
    proposal: TicketProposal
  ): Promise<{ ticket_key: string; ticket_url: string }> {
    try {
      // Convert conversation to TeamsConversationData format with Gonvarri fields
      const teamsData: TeamsConversationData = {
        conversation_id: conversation.id,
        conversation_url: `https://teams.microsoft.com/l/chat/0/0?users=${conversation.userId}`,
        participants: [conversation.userEmail || conversation.userName, 'sapira-ai'],
        messages: conversation.messages.map(msg => ({
          author: msg.sender === 'user' ? conversation.userName : 'Sapira AI',
          content: msg.text,
          timestamp: msg.timestamp.toISOString()
        })),
        ai_analysis: {
          summary: proposal.description,
          short_description: proposal.short_description,
          impact: proposal.impact,
          core_technology: proposal.core_technology,
          difficulty: proposal.difficulty,
          impact_score: proposal.impact_score,
          priority: proposal.priority,
          suggested_labels: proposal.suggested_labels,
          key_points: this.extractKeyPoints(conversation.getHistory()),
          suggested_assignee: proposal.assignee_suggestion
        }
      };

      // Create the issue using TeamsIntegration
      const result = await TeamsIntegration.createIssueFromTeamsConversation(teamsData);

      // Format response for bot
      return {
        ticket_key: result.issue_key,
        ticket_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/triage-new?issue=${result.issue_id}`
      };

    } catch (error) {
      console.error('Error creating ticket from conversation:', error);
      throw new Error('No pude crear el ticket. Por favor, inténtalo de nuevo más tarde.');
    }
  }

  /**
   * Extracts key points from conversation history
   */
  private extractKeyPoints(history: string): string[] {
    const lines = history.split('\n');
    const userMessages = lines
      .filter(line => line.startsWith('Usuario:'))
      .map(line => line.replace('Usuario:', '').trim());

    // Extract key information from user messages
    const keyPoints: string[] = [];

    // Look for error messages
    const errorPatterns = /error|falla|problema|no funciona|no puedo|crash/i;
    userMessages.forEach(msg => {
      if (errorPatterns.test(msg)) {
        keyPoints.push(`Problema reportado: ${msg.slice(0, 100)}`);
      }
    });

    // Look for device/browser info
    const devicePatterns = /chrome|firefox|safari|edge|mobile|android|ios|iphone|windows|mac/i;
    userMessages.forEach(msg => {
      if (devicePatterns.test(msg)) {
        keyPoints.push(`Información de dispositivo: ${msg.slice(0, 100)}`);
      }
    });

    // Add conversation length as context
    keyPoints.push(`Conversación con ${userMessages.length} mensajes del usuario`);

    return keyPoints.slice(0, 5); // Limit to 5 key points
  }

  /**
   * Validates that the proposal is ready for ticket creation
   */
  private validateProposal(proposal: TicketProposal): void {
    if (!proposal.title || proposal.title.length < 5) {
      throw new Error('El título del ticket es demasiado corto');
    }

    if (!proposal.description || proposal.description.length < 10) {
      throw new Error('La descripción del ticket es demasiado corta');
    }

    if (!['P0', 'P1', 'P2', 'P3'].includes(proposal.priority)) {
      throw new Error('Prioridad de ticket inválida');
    }
  }

  /**
   * Gets organization context for ticket creation
   */
  private getOrganizationContext() {
    return {
      organizationId: this.organizationId,
      aiAgentUserId: this.aiAgentUserId,
      source: 'teams-bot',
      version: '1.0.0'
    };
  }
}