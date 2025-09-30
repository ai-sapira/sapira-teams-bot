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
Eres Sapira, un asistente para la gestión de initiatives de automatización e IA en Gonvarri. Analiza esta conversación:

${conversation.getHistory()}

¿Tienes suficiente información para crear una initiative/issue? 

CRITERIOS:
- ✅ Initiative claramente identificada (automatización, IA, mejora de proceso)
- ✅ Tecnología o enfoque mencionado (IA, RPA, Analytics, etc.)
- ✅ Impacto en el negocio claro (reducción de costes, aumento eficiencia, etc.)
- ✅ Contexto suficiente sobre el problema o oportunidad
- ❌ Idea muy vaga o genérica
- ❌ Faltan detalles importantes sobre tecnología o impacto

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
Eres Sapira, asistente especializado en initiatives de automatización e IA para Gonvarri. Eres amigable, profesional y eficiente.

Conversación hasta ahora:
${conversation.getHistory()}

INSTRUCCIONES:
- Haz una pregunta específica para entender mejor la initiative propuesta
- Sé empático y profesional
- Mantén respuestas cortas (máximo 2 frases)
- Enfócate en obtener información sobre tecnología e impacto en negocio
- No repitas preguntas ya hechas

INFORMACIÓN ÚTIL A OBTENER:
- ¿Qué proceso o tarea se quiere automatizar/mejorar?
- ¿Qué tecnología se considera usar? (IA, RPA, Analytics, IDP, GenAI, etc.)
- ¿Cuál es el impacto esperado en el negocio? (reducción costes, aumento eficiencia, etc.)
- ¿Qué departamento o Business Unit se beneficiaría?
- ¿Cuál es la complejidad técnica estimada?

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
Conversación sobre initiative de automatización/IA:
${conversation.getHistory()}

Genera una initiative basada en esta conversación. Responde SOLO con JSON válido:

{
  "title": "Nombre descriptivo de la initiative (máx 100 chars)",
  "short_description": "Descripción breve del alcance en 1 línea",
  "description": "Descripción detallada con contexto completo",
  "impact": "Impacto en el negocio (ej: 'Reduced repetitive tasks', 'Increased productivity')",
  "core_technology": "Tecnología core a usar (ej: 'Predictive AI', 'RPA + IDP', 'GenAI')",
  "difficulty": 1|2|3,
  "impact_score": 1|2|3,
  "priority": "P0|P1|P2|P3",
  "origin": "teams",
  "suggested_labels": ["etiqueta1", "etiqueta2"],
  "assignee_suggestion": "Tech Team|Product Team|AI Team",
  "confidence": "high|medium|low"
}

TECNOLOGÍAS CORE COMUNES:
- GenAI (Chatbot) - asistentes virtuales
- GenAI (Copilot) - asistentes de trabajo
- GenAI (Translation) - traducción
- Predictive AI - predicciones y detección
- RPA - automatización de procesos
- IDP - procesamiento inteligente de documentos
- Advanced Analytics - análisis avanzados
- Combinaciones: "RPA + IDP", "GenAI + Analytics", "IDP + Predictive AI"

IMPACTOS COMUNES:
- "Reduced repetitive tasks" - reducción tareas manuales
- "Increased productivity" - aumento productividad
- "Reduced processing costs" - reducción costes
- "Improve decision-making" - mejora toma de decisiones
- "Reduce time on investigations" - reducción tiempo investigaciones

DIFFICULTY (complejidad técnica):
- 1: Solución simple, tecnología madura, pocas integraciones
- 2: Complejidad media, requiere integración, desarrollo moderado
- 3: Alta complejidad, tecnología emergente, múltiples sistemas

IMPACT_SCORE (impacto en negocio):
- 1: Mejora menor, afecta pocos usuarios/procesos
- 2: Mejora significativa, afecta departamento
- 3: Impacto crítico, afecta toda la organización

CÁLCULO DE PRIORIDAD (difficulty + impact_score):
- Total 6: P0 (Crítica)
- Total 5: P1 (Alta)  
- Total 3-4: P2 (Media)
- Total 2: P3 (Baja)

LABELS COMUNES:
automation, ai, rpa, genai, predictive-ai, analytics, idp, finance, operations, hr, sales, process-improvement

ASSIGNEE:
- AI Team: initiatives de IA, ML, automatización inteligente
- Tech Team: desarrollo técnico, integraciones
- Product Team: funcionalidades, mejoras de producto

CONFIDENCE:
- high: initiative clara con tecnología e impacto bien definidos
- medium: initiative identificada pero faltan algunos detalles
- low: idea vaga o información incompleta`;

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
      if (!ticketData.title || !ticketData.priority || !ticketData.difficulty || !ticketData.impact_score) {
        throw new Error('Missing required fields in ticket proposal');
      }

      // Calculate priority from difficulty + impact_score if needed
      let calculatedPriority = ticketData.priority;
      const totalScore = ticketData.difficulty + ticketData.impact_score;
      if (totalScore === 6) calculatedPriority = 'P0';
      else if (totalScore === 5) calculatedPriority = 'P1';
      else if (totalScore >= 3) calculatedPriority = 'P2';
      else calculatedPriority = 'P3';
      
      return {
        title: ticketData.title,
        short_description: ticketData.short_description || ticketData.title,
        description: ticketData.description || 'Descripción generada automáticamente desde conversación de Teams',
        impact: ticketData.impact || 'Por determinar',
        core_technology: ticketData.core_technology || 'Por determinar',
        difficulty: ticketData.difficulty,
        impact_score: ticketData.impact_score,
        priority: calculatedPriority,
        origin: 'teams',
        suggested_labels: ticketData.suggested_labels || [],
        assignee_suggestion: ticketData.assignee_suggestion || 'AI Team',
        confidence: ticketData.confidence || 'medium'
      };
      
    } catch (error) {
      console.error('Error generating ticket proposal:', error);
      
      // Fallback ticket generation
      return {
        title: 'Initiative reportada desde Teams',
        short_description: 'Initiative de automatización/IA',
        description: `Initiative generada automáticamente desde conversación de Teams:\n\n${conversation.getHistory()}`,
        impact: 'Por determinar',
        core_technology: 'Por determinar',
        difficulty: 2,
        impact_score: 2,
        priority: 'P2',
        origin: 'teams',
        suggested_labels: ['teams', 'auto-generated'],
        assignee_suggestion: 'AI Team',
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
