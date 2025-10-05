/**
 * Conocimiento estructurado de Gonvarri basado en el CSV de initiatives
 * Este archivo alimenta al bot para que pueda inferir Business Unit y Project
 */

// Business Units de Gonvarri con sus keywords característicos
const BUSINESS_UNITS = {
  'Finance': {
    id: 'finance-bu-id', // Se actualizará con el ID real de Supabase
    keywords: ['pricing', 'invoice', 'invoicing', 'financial', 'fraud', 'debt', 'accounting', 'payment', 'receivable', 'payable', 'billing', 'consolidation', 'finance', 'cost', 'expense'],
    projects: ['Pricing', 'Invoicing', 'Accounting']
  },
  'Sales': {
    id: 'sales-bu-id',
    keywords: ['offer', 'proposal', 'bid', 'tender', 'customer', 'negotiation', 'crafter', 'sales', 'selling', 'rfp', 'quotation'],
    projects: ['Processing', 'Negotiation']
  },
  'Legal': {
    id: 'legal-bu-id',
    keywords: ['contract', 'legal', 'compliance', 'advisory', 'regulatory', 'law', 'agreement', 'terms'],
    projects: ['Advisory', 'Compliance']
  },
  'HR': {
    id: 'hr-bu-id',
    keywords: ['employee', 'talent', 'recruitment', 'onboarding', 'attrition', 'career', 'upskilling', 'sentiment', 'nps', 'hr', 'human resources', 'people', 'retention', 'satisfaction', 'training'],
    projects: ['NPS', 'Upskilling', 'Retention', 'Reporting']
  },
  'Procurement': {
    id: 'procurement-bu-id',
    keywords: ['supplier', 'procurement', 'purchasing', 'rfp', 'spend', 'acquisition', 'vendor', 'sourcing', 'buying'],
    projects: ['Negotiation', 'Operations', 'Outbound', 'Reporting']
  }
}

// Projects de Gonvarri con sus keywords
const PROJECTS = {
  'Pricing': {
    keywords: ['pricing', 'discount', 'margin', 'price', 'cost'],
    business_units: ['Finance']
  },
  'Processing': {
    keywords: ['processing', 'automation', 'rpa', 'workflow', 'process'],
    business_units: ['Sales', 'Procurement']
  },
  'Advisory': {
    keywords: ['contract', 'legal', 'compliance', 'advisory', 'consulting', 'advice'],
    business_units: ['Legal']
  },
  'Invoicing': {
    keywords: ['invoice', 'billing', 'payment', 'collection', 'receivable', 'payable'],
    business_units: ['Finance']
  },
  'Negotiation': {
    keywords: ['negotiation', 'supplier', 'customer', 'deal', 'bargain'],
    business_units: ['Procurement', 'Sales']
  },
  'NPS': {
    keywords: ['employee', 'sentiment', 'satisfaction', 'nps', 'onboarding', 'chatbot', 'experience'],
    business_units: ['HR']
  },
  'Upskilling': {
    keywords: ['career', 'training', 'upskilling', 'learning', 'development', 'education'],
    business_units: ['HR']
  },
  'Retention': {
    keywords: ['attrition', 'retention', 'turnover', 'quit', 'leave'],
    business_units: ['HR']
  },
  'Reporting': {
    keywords: ['reporting', 'analytics', 'insight', 'dashboard', 'analysis'],
    business_units: ['HR', 'Procurement', 'Finance']
  },
  'Compliance': {
    keywords: ['compliance', 'regulatory', 'risk', 'audit', 'regulation'],
    business_units: ['Legal']
  },
  'Accounting': {
    keywords: ['accounting', 'financial', 'consolidation', 'ledger', 'reconciliation'],
    business_units: ['Finance']
  },
  'Operations': {
    keywords: ['operations', 'inquiry', 'handling', 'operational'],
    business_units: ['Procurement']
  },
  'Outbound': {
    keywords: ['rfp', 'outbound', 'request'],
    business_units: ['Procurement']
  }
}

// Ejemplos reales del CSV para que el bot aprenda
const EXAMPLE_INITIATIVES = [
  {
    number: 6,
    title: 'Agile pricing',
    businessUnit: 'Finance',
    project: 'Pricing',
    shortDescription: 'AI for pricing and discount margins',
    impact: 'Reduced repetitive tasks',
    coreTechnology: 'Predictive AI'
  },
  {
    number: 8,
    title: 'Contract concierge',
    businessUnit: 'Legal',
    project: 'Advisory',
    shortDescription: 'Virtual assistant for legal documents',
    impact: 'Increased productivity',
    coreTechnology: 'IDP + GenAI'
  },
  {
    number: 11,
    title: 'GonvAlrri desk',
    businessUnit: 'HR',
    project: 'NPS',
    shortDescription: 'Virtual assistant chatbot for employee issues',
    impact: 'Increased productivity',
    coreTechnology: 'GenAI (Chatbot)'
  },
  {
    number: 36,
    title: 'Invoice AutoFlow',
    businessUnit: 'Finance',
    project: 'Invoicing',
    shortDescription: 'Automated invoice processing',
    impact: 'Increased efficiency',
    coreTechnology: 'RPA + IDP'
  },
  {
    number: 50,
    title: 'FraudFinder AI',
    businessUnit: 'Finance',
    project: 'Invoicing',
    shortDescription: 'Fraudulent transactions detection',
    impact: 'Reduce time on investigations',
    coreTechnology: 'IDP + Predictive AI'
  },
  {
    number: 64,
    title: 'Automated supplier inquiry handling',
    businessUnit: 'Procurement',
    project: 'Operations',
    shortDescription: 'Automate supplier interactions',
    impact: 'Increased efficiency',
    coreTechnology: 'RPA + GenAI'
  }
]

/**
 * Infiere el Business Unit basándose en el contenido del issue
 */
function inferBusinessUnit(text) {
  text = text.toLowerCase()
  
  let bestMatch = null
  let maxScore = 0
  
  for (const [bu, data] of Object.entries(BUSINESS_UNITS)) {
    let score = 0
    for (const keyword of data.keywords) {
      if (text.includes(keyword)) {
        score++
      }
    }
    
    if (score > maxScore) {
      maxScore = score
      bestMatch = bu
    }
  }
  
  return bestMatch
}

/**
 * Infiere el Project basándose en el contenido y el Business Unit
 */
function inferProject(text, businessUnit) {
  text = text.toLowerCase()
  
  let bestMatch = null
  let maxScore = 0
  
  for (const [project, data] of Object.entries(PROJECTS)) {
    // Solo considerar projects que pertenezcan al BU inferido
    if (businessUnit && !data.business_units.includes(businessUnit)) {
      continue
    }
    
    let score = 0
    for (const keyword of data.keywords) {
      if (text.includes(keyword)) {
        score++
      }
    }
    
    if (score > maxScore) {
      maxScore = score
      bestMatch = project
    }
  }
  
  return bestMatch
}

/**
 * Genera el contexto de Gonvarri para el prompt de Gemini
 */
function getGonvarriContext() {
  return `
CONTEXTO DE GONVARRI:

Gonvarri tiene estas BUSINESS UNITS (departamentos principales):
${Object.entries(BUSINESS_UNITS).map(([bu, data]) => 
  `- ${bu}: ${data.projects.join(', ')}`
).join('\n')}

Y estos PROJECTS (áreas de trabajo dentro de cada BU):
${Object.entries(PROJECTS).map(([project, data]) => 
  `- ${project}: Pertenece a ${data.business_units.join(' o ')}`
).join('\n')}

EJEMPLOS REALES de initiatives de Gonvarri:
${EXAMPLE_INITIATIVES.map(ex => 
  `• "${ex.title}" → BU: ${ex.businessUnit}, Project: ${ex.project}, Tech: ${ex.coreTechnology}, Impact: ${ex.impact}`
).join('\n')}

IMPORTANTE: 
- Analiza el contenido de la conversación para inferir a qué Business Unit y Project pertenece
- Por ejemplo: "facturas" o "invoice" → Finance + Invoicing
- Por ejemplo: "contratos" o "legal" → Legal + Advisory
- Por ejemplo: "empleados" o "HR" → HR + NPS o Retention
- Por ejemplo: "proveedores" o "supplier" → Procurement + Operations o Negotiation
`
}

module.exports = {
  BUSINESS_UNITS,
  PROJECTS,
  EXAMPLE_INITIATIVES,
  inferBusinessUnit,
  inferProject,
  getGonvarriContext
}

