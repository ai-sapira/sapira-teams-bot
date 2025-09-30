const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiService {
  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    
    this.client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }

  /**
   * Determines if we have enough information to create an initiative
   */
  async shouldCreateTicket(conversation) {
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
      const model = this.client.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
      const response = await model.generateContent(prompt);
      const responseText = response.response.text().toLowerCase().trim();
      return responseText.includes('true');
    } catch (error) {
      console.error('Error checking if should create ticket:', error);
      return conversation.messages.length >= 6;
    }
  }

  /**
   * Continues conversation by asking relevant questions
   */
  async continueConversation(conversation) {
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
      const model = this.client.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
      const response = await model.generateContent(prompt);
      return response.response.text().trim();
    } catch (error) {
      console.error('Error continuing conversation:', error);
      return "Cuéntame más sobre la initiative que tienes en mente.";
    }
  }

  /**
   * Generates initiative proposal based on conversation
   */
  async generateTicketProposal(conversation) {
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
      const model = this.client.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
      const response = await model.generateContent(prompt);
      const responseText = response.response.text().trim();
      
      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      
      const ticketData = JSON.parse(jsonMatch[0]);
      
      // Validate required fields
      if (!ticketData.title || !ticketData.priority || !ticketData.difficulty || !ticketData.impact_score) {
        throw new Error('Missing required fields in ticket proposal');
      }

      // Calculate priority from difficulty + impact_score
      const totalScore = ticketData.difficulty + ticketData.impact_score;
      let calculatedPriority;
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
}

module.exports = { GeminiService };