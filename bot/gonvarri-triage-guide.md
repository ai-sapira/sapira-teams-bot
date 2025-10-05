# Guía de Triage para Initiatives Gonvarri

## Campos de Initiative/Issue

Cada issue/initiative de Gonvarri tiene los siguientes campos:

### Campos Principales
- **title**: Nombre de la iniciativa
- **short_description**: Descripción breve del alcance
- **impact**: Impacto en el negocio (ej: "Reduced repetitive tasks", "Increased productivity")
- **core_technology**: Tecnología core utilizada
- **priority**: Calculada automáticamente desde difficulty + impact_score

### Cálculo de Prioridad
- **difficulty** (1-3) + **impact_score** (1-3) = **prioridad**
  - Total 6: **P0** (Crítica)
  - Total 5: **P1** (Alta)
  - Total 3-4: **P2** (Media)
  - Total 2: **P3** (Baja)

## Ejemplos de Referencia

### Ejemplo 1: Agile Pricing (GON-6)
```json
{
  "key": "GON-6",
  "title": "Agile pricing",
  "short_description": "AI for pricing and discount margins",
  "impact": "Reduced repetitive tasks",
  "core_technology": "Predictive AI",
  "difficulty": 2,
  "impact_score": 3,
  "priority": "P1",
  "business_unit": "Finance",
  "project": "Pricing"
}
```

**Características clave:**
- Automatización de pricing usando IA predictiva
- Reduce tareas repetitivas
- Dificultad media (2) pero alto impacto (3) = Prioridad alta

### Ejemplo 2: FraudFinder AI (GON-50)
```json
{
  "key": "GON-50",
  "title": "FraudFinder AI",
  "short_description": "Fraudulent transactions detection",
  "impact": "Reduce time on investigations",
  "core_technology": "IDP + Predictive AI",
  "difficulty": 3,
  "impact_score": 3,
  "priority": "P0",
  "business_unit": "Finance",
  "project": "Invoicing"
}
```

**Características clave:**
- Detección de fraude con IA
- Reduce tiempo de investigaciones
- Alta dificultad (3) y alto impacto (3) = Prioridad crítica
- Combina IDP (Intelligent Document Processing) con IA Predictiva

## Categorías de Tecnología Core

### IA Generativa (GenAI)
- GenAI (Chatbot) - para asistentes virtuales
- GenAI (Copilot) - para asistentes de trabajo
- GenAI (Translation) - para traducción
- GenAI + Analytics - combinado con análisis de datos

### IA Predictiva
- Predictive AI - para predicciones y detección
- Predictive AI + Analytics - combinado con análisis

### Automatización
- RPA (Robotic Process Automation) - automatización de procesos
- RPA + IDP - automatización con procesamiento de documentos
- RPA + GenAI - automatización inteligente

### Procesamiento de Datos
- IDP (Intelligent Document Processing) - procesamiento inteligente de documentos
- IDP + GenAI - procesamiento con generación de contenido
- Data - soluciones basadas en datos
- Advanced Analytics - análisis avanzados

## Tipos de Impacto Comunes

1. **Reducción de Esfuerzo**
   - "Reduced repetitive tasks"
   - "Reduced manual effort"
   - "Reduced manual work"
   - "Reduce expenses"

2. **Aumento de Eficiencia**
   - "Increased productivity"
   - "Increased efficiency"
   - "Reduction in onboarding time"
   - "Reduce time on investigations"

3. **Mejora de Decisiones**
   - "Improving decision-making"
   - "Reduced acquisition costs"
   - "Decrease attrition"

4. **Reducción de Costes**
   - "Reduced processing costs"
   - "Reduced labor costs"
   - "Reduced recruitment costs"
   - "Reduce payable processing cost"

## Guía de Sugerencias en Triage

Cuando analices una conversación para crear un issue/initiative:

1. **Identifica la tecnología**: Busca menciones de IA, automatización, análisis, etc.
2. **Determina el impacto**: ¿Qué problema resuelve? ¿Qué mejora?
3. **Evalúa dificultad**:
   - 1: Solución simple, tecnología madura
   - 2: Complejidad media, requiere integración
   - 3: Alta complejidad, tecnología emergente o múltiples sistemas
4. **Evalúa impacto en negocio**:
   - 1: Mejora menor, afecta pocos usuarios
   - 2: Mejora significativa, afecta departamento
   - 3: Impacto crítico, afecta toda la organización

## Plantilla de Sugerencia

Cuando sugieras un issue en triage, estructura así:

```
Título: [Nombre descriptivo de la iniciativa]

Resumen: [1 línea describiendo qué hace]

Impacto: [Cómo ayuda al negocio]

Tecnología: [Tecnología core a usar]

Dificultad estimada: [1-3] porque [razón]
Impacto estimado: [1-3] porque [razón]
Prioridad sugerida: [P0/P1/P2/P3]
```

## Notas Importantes

- Las initiatives de Gonvarri se enfocan en **automatización inteligente** y **reducción de esfuerzo manual**
- La combinación de tecnologías (ej: "RPA + IDP", "GenAI + Analytics") indica soluciones más robustas
- El impacto debe ser **específico y medible** (ej: no solo "mejora", sino "reduce 50% tiempo de procesamiento")
- La prioridad se calcula **automáticamente**, pero tu estimación de difficulty e impact_score debe ser bien fundamentada
