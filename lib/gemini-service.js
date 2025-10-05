const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getGonvarriContext, inferBusinessUnit, inferProject } = require('./gonvarri-knowledge');

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
Analiza esta conversación entre un usuario y Sapira (asistente de IA):

${conversation.getHistory()}

¿Tienes suficiente contexto para generar una propuesta de initiative coherente?

EVALÚA ESTOS ASPECTOS:

✅ SUFICIENTE SI:
- El usuario explicó qué proceso/problema quiere resolver
- Se mencionó o se puede inferir una tecnología o enfoque (IA, automatización, RPA, analytics, etc.)
- Hay alguna indicación de beneficio o impacto (ahorro tiempo, reducción costes, mejora calidad, etc.)
- El contexto es suficiente para escribir una descripción con sentido

❌ INSUFICIENTE SI:
- Solo hubo un saludo o mensaje inicial muy vago ("tengo una idea")
- El usuario hizo una pregunta genérica pero no explicó su caso
- Faltan todos los detalles clave (qué, cómo, por qué)
- La conversación es demasiado ambigua o abstracta

⚠️ IMPORTANTE:
- No necesitas TODOS los detalles perfectos, solo suficiente para hacer una propuesta razonable
- Si después de 4-5 intercambios ya hay una idea clara, probablemente es suficiente
- Si el usuario ya dio bastante info pero falta algún detalle menor, probablemente es suficiente

EJEMPLOS:

Conversación A:
user: "Hola, tengo una idea"
bot: "¡Hola! Me encantaría escucharla. ¿De qué va?"
user: "Quiero automatizar las facturas"
RESPUESTA: false (muy vago aún)

Conversación B:
user: "Quiero automatizar el procesamiento de facturas que nos llegan por email"
bot: "Interesante. ¿Qué os lleva más tiempo ahora?"
user: "Tenemos que leerlas todas y meter los datos a mano en SAP"
bot: "Entiendo. ¿Cuántas facturas suelen ser al mes?"
user: "Unas 500, nos lleva horas"
RESPUESTA: true (hay suficiente contexto)

Conversación C:
user: "Me gustaría usar IA para mejorar la producción"
bot: "¿Qué aspecto de la producción querrías mejorar?"
user: "Pues no estoy seguro, a ver qué se puede hacer"
RESPUESTA: false (demasiado vago)

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
Eres Sapira, asistente de IA para Gonvarri especializado en ayudar a las personas a documentar sus ideas de automatización e IA.

PERSONALIDAD:
- Natural y conversacional, como un compañero de trabajo útil
- Empático y adaptable al tono del usuario (formal/informal)
- Curioso e interesado genuinamente en entender el problema
- Paciente, sin presionar por información
- Usas lenguaje natural, no hablas como formulario

CONTEXTO DE LA CONVERSACIÓN:
${conversation.getHistory()}

TU OBJETIVO (sin ser obvio):
Entender la idea/problema del usuario para ayudarle a crear una initiative bien documentada. Necesitas captar:
1. El problema o proceso que quieren mejorar/automatizar
2. Qué tecnología o enfoque están considerando (IA, RPA, Analytics, etc.)
3. Qué beneficio o impacto esperan conseguir
4. Quién se beneficiaría (departamento, equipo)

IMPORTANTE:
- NO hagas preguntas mecánicas tipo checklist
- SI el usuario saluda, devuelve el saludo naturalmente antes de continuar
- SI el usuario hace una pregunta off-topic, responde brevemente y redirige con naturalidad
- SI el usuario da mucha info de golpe, reconoce lo que entendiste y pregunta por lo que falta
- SI el usuario parece frustrado o perdido, sé más guiador y empático
- ADAPTA tu tono al del usuario (si es informal, sé informal; si es formal, mantén profesionalismo)
- Mantén respuestas cortas (máximo 2-3 frases), conversacionales

EJEMPLOS DE CÓMO RESPONDER:

Usuario: "Hola, tengo una idea"
✅ Bueno: "¡Hola! Me encantaría escucharla. ¿De qué va?"
❌ Malo: "Por favor describe el proceso que quieres automatizar."

Usuario: "Quiero automatizar las facturas que llegan por email"
✅ Bueno: "Interesante, las facturas por email son un buen caso para automatizar. ¿Qué es lo que más tiempo os lleva ahora con ellas? ¿La extracción de datos, la validación, o todo el flujo?"
❌ Malo: "¿Qué tecnología considerarías para este proyecto?"

Usuario: "¿Tú qué piensas que sería mejor?"
✅ Bueno: "Por lo que me cuentas, suena a que algo de IDP (procesamiento inteligente de documentos) podría ir bien. Pero cuéntame, ¿ahora los tenéis que meter a mano o cómo funciona?"
❌ Malo: "Por favor especifica el impacto en el negocio primero."

Responde de forma NATURAL como Sapira. Solo el mensaje, sin prefijos:`;

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
   * Analyzes user feedback on ticket proposal
   */
  async analyzeTicketFeedback(userResponse, ticketProposal) {
    const prompt = `
Eres Sapira. Le mostraste al usuario esta propuesta de initiative:

📋 **${ticketProposal.title}**
📝 ${ticketProposal.description}
🔍 Prioridad: ${ticketProposal.priority}

El usuario respondió: "${userResponse}"

Analiza su intención de forma natural:

1. CONFIRM - Está de acuerdo y quiere crear el ticket
   - Ejemplos: "sí", "ok", "perfecto", "adelante", "crear", "me parece bien", "vale"
   - También frases como "sí pero cambiarle el título" → CONFIRM (cambios menores no impiden creación)

2. REJECT - No quiere crear el ticket o abandonar
   - Ejemplos: "no", "cancelar", "olvídalo", "déjalo", "mejor no"
   - Claramente rechaza la idea

3. MODIFY - Quiere hacer cambios significativos antes de crear
   - Ejemplos: "falta mencionar X", "la prioridad debería ser mayor", "no es para ese equipo"
   - Pide cambios sustanciales que requieren regenerar propuesta

4. UNCLEAR - No está claro qué quiere (pregunta algo, divaga, etc.)
   - Ejemplos: "¿y esto cuánto tardaría?", "¿quién lo va a hacer?", respuestas vagas
   - Necesita aclaración antes de decidir

Responde SOLO con JSON válido:
{
  "action": "confirm|reject|modify|unclear",
  "changes": "descripción específica de cambios si action es modify/unclear, null si confirm/reject",
  "natural_response": "mensaje natural de 1-2 frases para responder al usuario según su feedback",
  "confidence": "high|medium|low"
}

EJEMPLOS de natural_response:

Si CONFIRM: "¡Genial! Creo tu ticket ahora mismo."
Si REJECT: "Entendido, lo dejamos. Si más adelante quieres retomarlo, aquí estaré."
Si MODIFY con cambios de prioridad: "Vale, ¿qué prioridad crees que debería tener? ¿Es algo urgente o puede esperar?"
Si UNCLEAR: "Mmm, no estoy seguro de si quieres que lo cree así o prefieres cambiar algo. ¿Te parece bien como está?"`;

    try {
      const model = this.client.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
      const response = await model.generateContent(prompt);
      const responseText = response.response.text().trim();
      
      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      
      const feedback = JSON.parse(jsonMatch[0]);
      
      return {
        action: feedback.action || 'modify',
        changes: feedback.changes || null,
        natural_response: feedback.natural_response || '¿Qué te gustaría cambiar?',
        confidence: feedback.confidence || 'medium'
      };
      
    } catch (error) {
      console.error('Error analyzing ticket feedback:', error);
      
      // Simple fallback logic
      const lowerResponse = userResponse.toLowerCase().trim();
      
      if (['si', 'sí', 'ok', 'vale', 'correcto', 'adelante', 'crear', 'yes', 'perfecto'].some(word => lowerResponse.includes(word))) {
        return { 
          action: 'confirm', 
          changes: null, 
          natural_response: '¡Genial! Creo tu ticket ahora mismo.',
          confidence: 'medium' 
        };
      } else if (['no', 'cancelar', 'olvidar', 'olvida', 'déjalo'].some(word => lowerResponse.includes(word))) {
        return { 
          action: 'reject', 
          changes: null,
          natural_response: 'Entendido, lo dejamos. Si más adelante quieres retomarlo, aquí estaré.',
          confidence: 'medium' 
        };
      } else {
        return { 
          action: 'modify', 
          changes: userResponse,
          natural_response: '¿Qué te gustaría cambiar de la propuesta?',
          confidence: 'low' 
        };
      }
    }
  }

  /**
   * Generates initiative proposal based on conversation
   */
  async generateTicketProposal(conversation) {
    // Inferir Business Unit y Project del contexto
    const fullText = conversation.getHistory().toLowerCase()
    const inferredBU = inferBusinessUnit(fullText)
    const inferredProject = inferProject(fullText, inferredBU)
    
    const prompt = `
Conversación sobre initiative de automatización/IA:
${conversation.getHistory()}

${getGonvarriContext()}

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
  "business_unit": "Finance|Sales|Legal|HR|Procurement (inferir del contenido)",
  "project": "Pricing|Invoicing|Advisory|NPS|Operations|etc (inferir del BU y contenido)",
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
      
      // Use Gemini's suggestion or fallback to inferred values
      const businessUnit = ticketData.business_unit || inferredBU || 'Finance'
      const project = ticketData.project || inferredProject || null
      
      return {
        title: ticketData.title,
        short_description: ticketData.short_description || ticketData.title,
        description: ticketData.description || 'Descripción generada automáticamente desde conversación de Teams',
        impact: ticketData.impact || 'Por determinar',
        core_technology: ticketData.core_technology || 'Por determinar',
        difficulty: ticketData.difficulty,
        impact_score: ticketData.impact_score,
        priority: calculatedPriority,
        business_unit: businessUnit,
        project: project,
        origin: 'teams',
        suggested_labels: ticketData.suggested_labels || [],
        assignee_suggestion: ticketData.assignee_suggestion || 'AI Team',
        confidence: ticketData.confidence || 'medium'
      };
      
    } catch (error) {
      console.error('Error generating ticket proposal:', error);
      
      // Fallback ticket generation with inferred values
      return {
        title: 'Initiative reportada desde Teams',
        short_description: 'Initiative de automatización/IA',
        description: `Initiative generada automáticamente desde conversación de Teams:\n\n${conversation.getHistory()}`,
        impact: 'Por determinar',
        core_technology: 'Por determinar',
        difficulty: 2,
        impact_score: 2,
        priority: 'P2',
        business_unit: inferredBU || 'Finance',
        project: inferredProject || null,
        origin: 'teams',
        suggested_labels: ['teams', 'auto-generated'],
        assignee_suggestion: 'AI Team',
        confidence: 'low'
      };
    }
  }
}

module.exports = { GeminiService };