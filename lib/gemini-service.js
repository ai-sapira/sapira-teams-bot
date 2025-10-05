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
    // ⭐ REQUISITOS MÍNIMOS MUY ESTRICTOS
    const messageCount = conversation.messages.length;
    
    // Si es el primer mensaje, NUNCA crear ticket
    if (messageCount <= 1) {
      return false;
    }
    
    // Si hay menos de 6 mensajes (3 intercambios), probablemente no hay info suficiente
    // Necesitamos al menos: saludo + problema + contexto técnico + beneficio
    if (messageCount < 6) {
      return false;
    }

    const prompt = `
Analiza esta conversación entre un usuario y Sapira (asistente de IA):

${conversation.getHistory()}

¿Tienes suficiente contexto para generar una propuesta de initiative coherente?

⚠️ CRITERIO BALANCEADO:

✅ SUFICIENTE SI (AL MENOS 4 de estos 5):
1. Se describe el PROBLEMA o PROCESO que se quiere mejorar/automatizar con cierta especificidad
2. Se mencionó o se puede inferir la TECNOLOGÍA/ENFOQUE (RPA, IA, GenAI, IDP, Analytics, chatbot, etc.)
3. Hay indicación de IMPACTO o BENEFICIO esperado (aunque sea aproximado: "ahorrar tiempo", "reducir errores")
4. Se mencionó algo de CONTEXTO (departamento, sistema, volumen aproximado, frecuencia)
5. La conversación tiene suficiente sustancia para generar un ticket con descripción coherente

❌ INSUFICIENTE SI:
- Solo hubo saludos sin contenido
- El usuario solo mencionó vagamente "quiero hacer algo con IA" sin detalles
- La conversación es muy abstracta sin un caso de uso identificable
- Solo hay 2-3 intercambios muy cortos

🎯 BALANCE:
- El objetivo es crear tickets ÚTILES, no perfectos
- Si hay suficiente para escribir una propuesta razonable → true
- Si aún está muy vago → false y pide lo mínimo necesario

EJEMPLOS:

❌ INSUFICIENTE:
user: "Buenas"
bot: "¡Hola! ¿En qué puedo ayudarte?"
user: "Quiero hacer algo con IA"
bot: "¿Qué te gustaría automatizar o mejorar?"
RESPUESTA: false (muy vago, sin detalles)

❌ INSUFICIENTE:
user: "Tengo un problema con las facturas"
bot: "Cuéntame más"
user: "Llegan por email y es un lío"
RESPUESTA: false (falta cómo quiere resolverlo, qué tecnología)

❌ INSUFICIENTE:
user: "Hola, tengo una idea"
bot: "¡Hola! ¿De qué va?"
user: "Quiero automatizar las facturas"
bot: "Interesante, ¿qué parte exactamente?"
RESPUESTA: false (muy vago aún, falta contexto)

✅ SUFICIENTE (justo el mínimo):
user: "Quiero hacer una herramienta de automatización de facturas"
bot: "¿Qué te gustaría conseguir automatizando ese proceso?"
user: "La idea es ahorrar tiempo al personal de facturación, pierden mucho tiempo con procesos manuales"
bot: "¿Qué parte del proceso lleva más tiempo?"
user: "Meter los datos en SAP, usamos RPA normalmente"
RESPUESTA: true (problema claro, tecnología identificada, beneficio claro, suficiente para crear propuesta)

✅ SUFICIENTE:
user: "Necesitamos automatizar algo en RRHH"
bot: "¿Qué proceso específico?"
user: "Las nóminas, es muy tedioso"
bot: "¿Cuánto tiempo lleva?"
user: "El equipo pasa unas 10 horas semanales"
RESPUESTA: true (proceso identificado, impacto claro, suficiente para propuesta aunque falte tecnología específica)

✅ SUFICIENTE:
user: "Necesitamos un chatbot con IA para responder preguntas de RRHH"
bot: "¿Qué tipo de preguntas reciben más?"
user: "Políticas, vacaciones, nóminas... siempre las mismas"
bot: "¿Cuánto tiempo consume esto?"
user: "El equipo de HR pasa bastante tiempo en esto"
RESPUESTA: true (problema claro, tecnología clara: chatbot GenAI, impacto identificado)

Responde SOLO: true o false`;

    try {
      const model = this.client.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
      const response = await model.generateContent(prompt);
      const responseText = response.response.text().toLowerCase().trim();
      
      const shouldCreate = responseText.includes('true');
      console.log(`🤔 shouldCreateTicket: ${shouldCreate} (messages: ${messageCount})`);
      
      return shouldCreate;
    } catch (error) {
      console.error('Error checking if should create ticket:', error);
      
      // Fallback: crear si hay suficientes mensajes (8+) asumiendo que hubo conversación sustancial
      const shouldCreate = messageCount >= 8;
      console.log(`⚠️ Gemini failed, using fallback: ${shouldCreate} (messages: ${messageCount})`);
      return shouldCreate;
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
- IMPORTANTE: Usa español neutro/estándar (tú/ustedes), nunca voseo argentino (querés, tenés, etc.)

CONTEXTO DE LA CONVERSACIÓN:
${conversation.getHistory()}

TU OBJETIVO:
Entender la idea del usuario para crear una initiative. Necesitas captar lo ESENCIAL:

✅ LO MÍNIMO QUE NECESITAS:
1. ¿Qué problema/proceso quiere mejorar?
2. ¿Cómo lo quiere resolver? (tecnología/enfoque aproximado)
3. ¿Qué beneficio espera? (aunque sea aproximado)
4. Algo de contexto (departamento, sistema, frecuencia aproximada)

⚠️ GUÍA PARA PREGUNTAS:
- Haz 1-2 preguntas MÁXIMO por turno
- Prioriza lo que falta: primero el problema, luego el enfoque, luego el impacto
- SI el usuario saluda → saludo + pregunta abierta
- SI menciona problema vago → pide un poco más de detalle
- SI ya tienes idea clara → pregunta por impacto/beneficio para cerrar
- NO pidas detalles innecesarios si ya hay suficiente para crear propuesta
- Sé BREVE (1-2 frases), conversacional
- Guía hacia crear el ticket, no hacia perfeccionarlo

EJEMPLOS DE CÓMO RESPONDER:

Usuario: "Buenas"
✅ Bueno: "¡Hola! ¿En qué puedo ayudarte hoy?"
❌ Malo: "¡Hola! Me encantaría escuchar tu idea. ¿De qué va?"

Usuario: "Hola, tengo una idea"
✅ Bueno: "¡Hola! Cuéntame, ¿de qué va?"
❌ Malo: "Por favor describe el proceso que quieres automatizar."

Usuario: "Nada, solo saludaba"
✅ Bueno: "Entendido, aquí estoy si necesitas algo 👍"
❌ Malo: "¿Seguro que no tienes ninguna idea sobre automatización?"

Usuario: "Quiero automatizar algo"
✅ Bueno: "Vale, ¿qué proceso o problema tienes en mente?"
❌ Malo: "¿Qué tecnología considerarías?"

Usuario: "Quiero automatizar las facturas que llegan por email"
✅ Bueno: "Interesante. ¿Cuántas facturas reciben al día o al mes más o menos?"
❌ Malo: "¿Qué tecnología considerarías para este proyecto?"

Usuario: "Ahorrar tiempo al personal de facturación, pierden mucho tiempo con procesos manuales"
✅ Bueno: "Claro. ¿Qué parte del proceso es la más manual?"
❌ Malo: "Genial, ¿y qué más?"

Usuario: "Unas 200 facturas al mes, las metemos en SAP"
✅ Bueno: "Entendido. ¿Han pensado en RPA o IDP para automatizarlo?"
❌ Malo: "Perfecto. ¿Cuántas personas trabajan en esto exactamente?"

Usuario: "Sí, algo con RPA estaría bien"
✅ Bueno: "Perfecto, creo que tengo suficiente. Te preparo una propuesta."
❌ Malo: "¿Y cuántas horas semanales exactamente dedican a esto?"

Usuario: "¿Tú qué piensas que sería mejor?"
✅ Bueno: "Por lo que dices, RPA + IDP podría funcionar bien para automatizar la entrada de facturas en SAP."
❌ Malo: "Por favor especifica primero todos los detalles técnicos."

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

IMPORTANTE: Usa español neutro/estándar (tú/ustedes), nunca voseo argentino (querés, tenés, etc.)

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
  "title": "Nombre DESCRIPTIVO del proyecto que resuma la propuesta específica de la conversación (máx 50 chars, 2-4 palabras)",
  "short_description": "Descripción breve del alcance en 1 línea (máx 80 chars)",
  "description": "Descripción NARRATIVA de 3-5 frases explicando: (1) qué problema resuelve, (2) cómo funciona ahora, (3) cómo funcionará con la solución y tecnología, (4) beneficio esperado. IMPORTANTE: SOLO texto narrativo en párrafo, NO incluir metadatos estructurados como 'Business Unit:', 'Project:', 'Impact:', etc.",
  "impact": "Impacto en el negocio en UNA línea (máx 50 chars, ej: 'Reduced repetitive tasks', 'Increased productivity')",
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

GUÍA PARA CREAR EL TÍTULO:
El título DEBE capturar LA ESENCIA ESPECÍFICA de la propuesta de la conversación. 
NO uses nombres genéricos como "Invoice Automation" o "HR Chatbot".
SÍ incluye el área específica o característica única mencionada en la conversación.

EJEMPLOS BASADOS EN CONVERSACIONES:
Si hablan de "automatizar facturas del personal de finance":
  ❌ "Invoice Automation" (muy genérico)
  ✅ "InvoiceAutoFlow" o "Finance Invoice Bot" (específico)

Si mencionan "chatbot de GenAI para consultas de empleados sobre carreras":
  ❌ "HR Chatbot" (muy genérico)
  ✅ "CareerPath AI" o "HRCareer Copilot" (específico)

Si hablan de "detectar fraude en cuentas por cobrar con IA":
  ❌ "Fraud Detection" (genérico)
  ✅ "FraudFinder AI" o "Receivables Guardian" (específico)

Si mencionan "automatizar extracción de datos de CET en propuestas":
  ❌ "Data Extraction" (genérico)
  ✅ "CET Proposal Bot" o "GMHS Offer Automation" (específico)

MÁS EJEMPLOS DE BUENOS TÍTULOS:
✅ "InvoiceGenius" - resume automatización inteligente de facturas
✅ "SmartBidder" - resume asistente para licitaciones
✅ "ComplyStreamline" - resume optimización de compliance
✅ "SupplierChat AI" - resume chatbot para proveedores
✅ "ContractConcierge" - resume asistente para contratos

EJEMPLOS DE DESCRIPCIÓN (description) CORRECTA:

✅ CORRECTO (narrativa de 3-5 frases):
"This initiative aims to automate the extraction of CET information and populate it into proposal documents. Currently, sales representatives manually copy this data from internal systems, which is time-consuming and error-prone. The bot will utilize RPA to extract data from CET databases and IDP to intelligently insert it into proposal templates. This will reduce repetitive tasks and improve accuracy while freeing up sales time for higher-value activities."

❌ INCORRECTO (metadatos estructurados):
"Business Unit: Sales
Project: Processing

Bot automating CET info to proposals

Impact: Reduced repetitive tasks
Core Technology: Data + RPA + IDP"

REGLAS IMPORTANTES:
- title: MÁXIMO 50 caracteres, 2-4 palabras, DEBE SER ESPECÍFICO a la propuesta de la conversación (no genérico)
- description: SOLO texto narrativo en párrafo, SIN metadatos estructurados

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