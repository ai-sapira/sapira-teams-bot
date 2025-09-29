import { CardFactory, Attachment } from 'botbuilder';
import type { TicketProposal } from './types';

/**
 * Creates adaptive cards for Teams bot interactions
 */
export class AdaptiveCardsService {
  
  /**
   * Creates a ticket proposal card with confirm/modify actions
   */
  static createTicketProposalCard(proposal: TicketProposal, conversationId: string): Attachment {
    const card = {
      $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
      type: "AdaptiveCard",
      version: "1.4",
      body: [
        {
          type: "Container",
          style: "emphasis",
          items: [
            {
              type: "ColumnSet",
              columns: [
                {
                  type: "Column",
                  width: "auto",
                  items: [
                    {
                      type: "Image",
                      url: "https://img.icons8.com/color/48/000000/ticket.png",
                      width: "32px",
                      height: "32px"
                    }
                  ]
                },
                {
                  type: "Column",
                  width: "stretch",
                  items: [
                    {
                      type: "TextBlock",
                      text: "🎫 Propuesta de Ticket",
                      weight: "Bolder",
                      size: "Medium",
                      color: "Accent"
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          type: "Container",
          items: [
            {
              type: "TextBlock",
              text: "He analizado nuestra conversación y preparé este ticket:",
              wrap: true,
              size: "Small",
              color: "Default"
            }
          ]
        },
        {
          type: "Container",
          style: "default",
          items: [
            {
              type: "FactSet",
              facts: [
                {
                  title: "**Título:**",
                  value: proposal.title
                },
                {
                  title: "**Prioridad:**",
                  value: `${proposal.priority} ${this.getPriorityDescription(proposal.priority)}`
                },
                {
                  title: "**Equipo sugerido:**",
                  value: proposal.assignee_suggestion
                },
                {
                  title: "**Etiquetas:**",
                  value: proposal.suggested_labels.length > 0 
                    ? proposal.suggested_labels.join(', ') 
                    : 'Sin etiquetas'
                }
              ]
            }
          ]
        },
        {
          type: "Container",
          items: [
            {
              type: "TextBlock",
              text: "**Descripción:**",
              weight: "Bolder",
              size: "Small"
            },
            {
              type: "TextBlock",
              text: proposal.description,
              wrap: true,
              size: "Small"
            }
          ]
        },
        {
          type: "Container",
          items: [
            {
              type: "TextBlock",
              text: `Confianza del análisis: ${this.getConfidenceEmoji(proposal.confidence)} ${proposal.confidence}`,
              size: "Small",
              color: "Good",
              isSubtle: true
            }
          ]
        }
      ],
      actions: [
        {
          type: "Action.Submit",
          title: "✅ Crear ticket",
          style: "positive",
          data: {
            action: "confirm_ticket",
            conversation_id: conversationId,
            proposal: proposal
          }
        },
        {
          type: "Action.Submit",
          title: "✏️ Necesita cambios",
          data: {
            action: "modify_ticket",
            conversation_id: conversationId,
            proposal: proposal
          }
        },
        {
          type: "Action.Submit",
          title: "❌ No crear ticket",
          data: {
            action: "cancel_ticket",
            conversation_id: conversationId
          }
        }
      ]
    };

    return CardFactory.adaptiveCard(card);
  }

  /**
   * Creates a ticket created confirmation card
   */
  static createTicketCreatedCard(ticketKey: string, ticketUrl: string, title: string): Attachment {
    const card = {
      $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
      type: "AdaptiveCard",
      version: "1.4",
      body: [
        {
          type: "Container",
          style: "good",
          items: [
            {
              type: "ColumnSet",
              columns: [
                {
                  type: "Column",
                  width: "auto",
                  items: [
                    {
                      type: "Image",
                      url: "https://img.icons8.com/color/48/000000/checked.png",
                      width: "32px",
                      height: "32px"
                    }
                  ]
                },
                {
                  type: "Column",
                  width: "stretch",
                  items: [
                    {
                      type: "TextBlock",
                      text: "✅ Ticket Creado Exitosamente",
                      weight: "Bolder",
                      size: "Medium",
                      color: "Good"
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          type: "Container",
          items: [
            {
              type: "FactSet",
              facts: [
                {
                  title: "**Número de ticket:**",
                  value: ticketKey
                },
                {
                  title: "**Título:**",
                  value: title
                },
                {
                  title: "**Estado:**",
                  value: "En triage - Pendiente de revisión"
                }
              ]
            }
          ]
        },
        {
          type: "Container",
          items: [
            {
              type: "TextBlock",
              text: "El equipo de soporte revisará tu ticket y te contactará si necesita información adicional.",
              wrap: true,
              size: "Small"
            }
          ]
        }
      ],
      actions: [
        {
          type: "Action.OpenUrl",
          title: "🔗 Ver ticket completo",
          url: ticketUrl
        }
      ]
    };

    return CardFactory.adaptiveCard(card);
  }

  /**
   * Creates an error card when ticket creation fails
   */
  static createErrorCard(error: string): Attachment {
    const card = {
      $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
      type: "AdaptiveCard",
      version: "1.4",
      body: [
        {
          type: "Container",
          style: "attention",
          items: [
            {
              type: "ColumnSet",
              columns: [
                {
                  type: "Column",
                  width: "auto",
                  items: [
                    {
                      type: "Image",
                      url: "https://img.icons8.com/color/48/000000/error.png",
                      width: "32px",
                      height: "32px"
                    }
                  ]
                },
                {
                  type: "Column",
                  width: "stretch",
                  items: [
                    {
                      type: "TextBlock",
                      text: "❌ Error al Crear Ticket",
                      weight: "Bolder",
                      size: "Medium",
                      color: "Attention"
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          type: "Container",
          items: [
            {
              type: "TextBlock",
              text: "Lo siento, hubo un problema al crear tu ticket:",
              wrap: true,
              size: "Small"
            },
            {
              type: "TextBlock",
              text: error,
              wrap: true,
              size: "Small",
              color: "Attention"
            },
            {
              type: "TextBlock",
              text: "Por favor, inténtalo de nuevo o contacta con el administrador del sistema.",
              wrap: true,
              size: "Small"
            }
          ]
        }
      ],
      actions: [
        {
          type: "Action.Submit",
          title: "🔄 Intentar de nuevo",
          data: {
            action: "retry_ticket_creation"
          }
        }
      ]
    };

    return CardFactory.adaptiveCard(card);
  }

  /**
   * Creates a welcome card for new conversations
   */
  static createWelcomeCard(): Attachment {
    const card = {
      $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
      type: "AdaptiveCard",
      version: "1.4",
      body: [
        {
          type: "Container",
          style: "emphasis",
          items: [
            {
              type: "ColumnSet",
              columns: [
                {
                  type: "Column",
                  width: "auto",
                  items: [
                    {
                      type: "Image",
                      url: "https://img.icons8.com/color/48/000000/bot.png",
                      width: "40px",
                      height: "40px"
                    }
                  ]
                },
                {
                  type: "Column",
                  width: "stretch",
                  items: [
                    {
                      type: "TextBlock",
                      text: "¡Hola! Soy Sapira 🤖",
                      weight: "Bolder",
                      size: "Large"
                    },
                    {
                      type: "TextBlock",
                      text: "Tu asistente de soporte técnico",
                      size: "Small",
                      color: "Accent"
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          type: "Container",
          items: [
            {
              type: "TextBlock",
              text: "Estoy aquí para ayudarte con cualquier problema técnico. Solo cuéntame qué está pasando y te ayudo a crear un ticket para resolverlo rápidamente.",
              wrap: true,
              size: "Small"
            }
          ]
        },
        {
          type: "Container",
          items: [
            {
              type: "TextBlock",
              text: "**Ejemplos de cosas que puedo ayudarte:**",
              weight: "Bolder",
              size: "Small"
            },
            {
              type: "TextBlock",
              text: "• Problemas de login o acceso\n• Errores en aplicaciones\n• Lentitud o problemas de rendimiento\n• Solicitudes de nuevas funcionalidades",
              wrap: true,
              size: "Small"
            }
          ]
        }
      ]
    };

    return CardFactory.adaptiveCard(card);
  }

  /**
   * Helper methods
   */
  private static getPriorityDescription(priority: string): string {
    switch (priority) {
      case 'P0': return '(Crítico - Sistema caído)';
      case 'P1': return '(Alto - Funcionalidad importante)';
      case 'P2': return '(Medio - Afecta trabajo)';
      case 'P3': return '(Bajo - Mejora/consulta)';
      default: return '';
    }
  }

  private static getConfidenceEmoji(confidence: string): string {
    switch (confidence) {
      case 'high': return '🎯';
      case 'medium': return '📊';
      case 'low': return '🤔';
      default: return '📊';
    }
  }
}
