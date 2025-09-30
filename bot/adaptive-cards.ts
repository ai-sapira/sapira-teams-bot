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
                      text: "🚀 Propuesta de Initiative",
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
              text: "He analizado nuestra conversación y preparé esta initiative de automatización/IA:",
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
                  title: "**Alcance:**",
                  value: proposal.short_description
                },
                {
                  title: "**Tecnología Core:**",
                  value: proposal.core_technology
                },
                {
                  title: "**Impacto:**",
                  value: proposal.impact
                },
                {
                  title: "**Complejidad:**",
                  value: `${proposal.difficulty}/3 (${this.getDifficultyDescription(proposal.difficulty)})`
                },
                {
                  title: "**Impacto Negocio:**",
                  value: `${proposal.impact_score}/3 (${this.getImpactDescription(proposal.impact_score)})`
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
          title: "✅ Crear initiative",
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
          title: "❌ No crear initiative",
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
                      text: "✅ Initiative Creada Exitosamente",
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
                  title: "**Código:**",
                  value: ticketKey
                },
                {
                  title: "**Título:**",
                  value: title
                },
                {
                  title: "**Estado:**",
                  value: "En triage - Pendiente de revisión por SAP"
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
              text: "El equipo SAP revisará tu initiative y te contactará si necesita información adicional.",
              wrap: true,
              size: "Small"
            }
          ]
        }
      ],
      actions: [
        {
          type: "Action.OpenUrl",
          title: "🔗 Ver initiative completa",
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
                      text: "❌ Error al Crear Initiative",
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
              text: "Lo siento, hubo un problema al crear tu initiative:",
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
                      text: "Tu asistente para initiatives de IA y automatización",
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
              text: "Estoy aquí para ayudarte a proponer y gestionar initiatives de automatización e inteligencia artificial en Gonvarri. Cuéntame tu idea y te ayudo a crear una initiative estructurada.",
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
              text: "**Ejemplos de initiatives que puedo ayudarte:**",
              weight: "Bolder",
              size: "Small"
            },
            {
              type: "TextBlock",
              text: "• Automatización de procesos con RPA\n• Asistentes virtuales con GenAI\n• Detección y predicciones con IA\n• Análisis avanzado de datos\n• Procesamiento inteligente de documentos",
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
      case 'P0': return '(Crítica - Impacto máximo)';
      case 'P1': return '(Alta - Impacto significativo)';
      case 'P2': return '(Media - Impacto moderado)';
      case 'P3': return '(Baja - Mejora menor)';
      default: return '';
    }
  }

  private static getDifficultyDescription(difficulty: number): string {
    switch (difficulty) {
      case 1: return 'Simple';
      case 2: return 'Media';
      case 3: return 'Compleja';
      default: return 'Por determinar';
    }
  }

  private static getImpactDescription(impact: number): string {
    switch (impact) {
      case 1: return 'Menor';
      case 2: return 'Significativo';
      case 3: return 'Crítico';
      default: return 'Por determinar';
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
