import { GoogleGenAI } from '@google/genai';
import type { Conversation, TicketProposal } from './types';

export class GeminiService {
  private client: GoogleGenAI;

  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    
    // The client gets the API key from the environment variable `GEMINI_API_KEY`.
    this.client = new GoogleGenAI({});
  }

  /**
   * Determines if we have enough information to create a ticket
   */
  async shouldCreateTicket(conversation: Conversation): Promise<boolean> {
    const prompt = `
Eres Sapira, un asistente de soporte técnico. Analiza esta conversación:

${conversation.getHistory()}

¿Tienes suficiente información para crear un ticket de soporte? 

CRITERIOS:
- ✅ Problema claramente identificado
- ✅ Contexto suficiente (dispositivo, cuándo, cómo)
- ✅ Usuario ha proporcionado detalles específicos
- ❌ Problema muy vago o genérico
- ❌ Faltan detalles importantes

Responde SOLO: true o false`;

    try {
      const response = await this.client.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt
      });
      const responseText = response.text.toLowerCase().trim();
      return responseText.includes('true');
    } catch (error) {
      console.error('Error checking if should create ticket:', error);
      // Fallback: if more than 3 exchanges, probably enough info
      return conversation.messages.length >= 6; // 3 back-and-forth
    }
  }

  /**
   * Continues conversation by asking relevant questions
   */
  async continueConversation(conversation: Conversation): Promise<string> {
    const prompt = `
Eres Sapira, asistente de soporte técnico de la empresa. Eres amigable, profesional y eficiente.

Conversación hasta ahora:
${conversation.getHistory()}

INSTRUCCIONES:
- Haz una pregunta específica para entender mejor el problema
- Sé empático y profesional
- Mantén respuestas cortas (máximo 2 frases)
- Enfócate en obtener información técnica relevante
- No repitas preguntas ya hechas

INFORMACIÓN ÚTIL A OBTENER:
- ¿Qué error específico aparece?
- ¿Desde qué dispositivo/navegador?
- ¿Cuándo empezó el problema?
- ¿Has probado alguna solución?
- ¿Afecta a otros usuarios?

Responde SOLO con tu siguiente pregunta o mensaje (sin prefijos como "Sapira:"):`;

    try {
      const response = await this.client.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt
      });
      return response.text.trim();
    } catch (error) {
      console.error('Error continuing conversation:', error);
      return "Cuéntame más detalles sobre el problema que estás experimentando.";
    }
  }

  /**
   * Generates ticket proposal based on conversation
   */
  async generateTicketProposal(conversation: Conversation): Promise<TicketProposal> {
    const prompt = `
Conversación de soporte técnico:
${conversation.getHistory()}

Genera un ticket basado en esta conversación. Responde SOLO con JSON válido:

{
  "title": "título descriptivo del problema (máx 100 chars)",
  "description": "descripción detallada del problema con contexto",
  "priority": "P0|P1|P2|P3",
  "origin": "teams",
  "suggested_labels": ["etiqueta1", "etiqueta2"],
  "assignee_suggestion": "Tech Team|Product Team|Infraestructura",
  "confidence": "high|medium|low"
}

REGLAS DE PRIORIDAD:
- P0: Sistema completamente caído, crítico para negocio
- P1: Funcionalidad importante rota, afecta muchos usuarios
- P2: Problema que impide trabajo normal, bug molesto
- P3: Mejora, consulta, problema menor

LABELS COMUNES:
login, authentication, performance, bug, mobile, desktop, api, database, ui, error-500, timeout, feature-request, network, browser

ASSIGNEE:
- Tech Team: bugs técnicos, errores de código, APIs
- Product Team: UX/UI, funcionalidades, mejoras de producto  
- Infraestructura: servidores, despliegue, base de datos, red

CONFIDENCE:
- high: problema claro con suficientes detalles
- medium: problema identificado pero faltan algunos detalles
- low: problema vago o información incompleta`;

    try {
      const response = await this.client.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt
      });
      const responseText = response.text.trim();
      
      // Extract JSON from response (remove any markdown formatting)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      
      const ticketData = JSON.parse(jsonMatch[0]);
      
      // Validate required fields
      if (!ticketData.title || !ticketData.priority) {
        throw new Error('Missing required fields in ticket proposal');
      }
      
      return {
        title: ticketData.title,
        description: ticketData.description || 'Descripción generada automáticamente desde conversación de Teams',
        priority: ticketData.priority,
        origin: 'teams',
        suggested_labels: ticketData.suggested_labels || [],
        assignee_suggestion: ticketData.assignee_suggestion || 'Tech Team',
        confidence: ticketData.confidence || 'medium'
      };
      
    } catch (error) {
      console.error('Error generating ticket proposal:', error);
      
      // Fallback ticket generation
      return {
        title: 'Problema reportado desde Teams',
        description: `Ticket generado automáticamente desde conversación de Teams:\n\n${conversation.getHistory()}`,
        priority: 'P3',
        origin: 'teams',
        suggested_labels: ['teams', 'auto-generated'],
        assignee_suggestion: 'Tech Team',
        confidence: 'low'
      };
    }
  }

  /**
   * Analyzes if user wants to modify the ticket proposal
   */
  async analyzeTicketFeedback(message: string, currentProposal: TicketProposal): Promise<{
    action: 'confirm' | 'modify' | 'cancel';
    modifications?: Partial<TicketProposal>;
    followUpQuestion?: string;
  }> {
    const prompt = `
Usuario ha respondido a una propuesta de ticket: "${message}"
Propuesta actual: ${JSON.stringify(currentProposal)}

Analiza la respuesta del usuario:

Si quiere CONFIRMAR (palabras como: "sí", "ok", "perfecto", "correcto", "crear", "adelante"):
{"action": "confirm"}

Si quiere CANCELAR (palabras como: "no", "cancelar", "mejor no", "no crear"):
{"action": "cancel"}

Si quiere MODIFICAR (menciona cambios específicos):
{"action": "modify", "modifications": {"campo": "nuevo_valor"}, "followUpQuestion": "¿hay algo más que quieras cambiar?"}

Responde SOLO con JSON válido:`;

    try {
      const response = await this.client.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt
      });
      const responseText = response.text.trim();
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('Error analyzing ticket feedback:', error);
    }
    
    // Fallback: simple keyword analysis
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes('sí') || lowerMessage.includes('ok') || lowerMessage.includes('correcto')) {
      return { action: 'confirm' };
    }
    if (lowerMessage.includes('no') || lowerMessage.includes('cancelar')) {
      return { action: 'cancel' };
    }
    
    return { 
      action: 'modify', 
      followUpQuestion: '¿Qué te gustaría cambiar del ticket propuesto?' 
    };
  }
}
