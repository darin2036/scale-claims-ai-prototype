import { assessDamage } from '../lib/mockAI'
import { findComparableClaims } from './comparableClaims'
import { evaluateAISignals } from './aiSignals'
import { calculateLineItemsTotal, generateAISuggestedLineItems } from './aiLineItemSuggestions'
import type {
  AgentAICaseFile,
  AgentCaseDecision,
  AgentCaseNextStep,
  AgentClaim,
  AgentComparableClaimSnapshot,
  AgentDurationPrediction,
  AgentEstimateLineItem,
  AgentSignal,
} from './store'

export const AI_CASE_PIPELINE_STEPS = [
  'Analyzing damage and localization cues',
  'Estimating severity and recommended next step',
  'Generating estimate line items and cost range',
  'Retrieving similar historical claims',
  'Evaluating anomaly / needs-review signals',
  'Preparing final recommendation package',
] as const

const COST_BANDS = {
  Low: { min: 500, max: 1500 },
  Medium: { min: 1500, max: 4000 },
  High: { min: 4000, max: 9000 },
} as const

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))
const toNormalizedConfidence = (confidence: number) => clamp01(confidence <= 1 ? confidence : confidence / 100)

const mapCaseNextStep = (claim: AgentClaim, severity: 'Low' | 'Medium' | 'High'): AgentCaseNextStep => {
  if (claim.drivable === false || severity === 'High') {
    return 'Tow'
  }
  if (severity === 'Low') {
    return 'Repair'
  }
  return 'Inspection'
}

const buildSeverityExplanation = (claim: AgentClaim, impactedAreas: string[], confidence: number) => {
  const drivingContext = claim.drivable === false ? 'Vehicle is not drivable, increasing impact concern.' : ''
  const areaContext = impactedAreas.length > 0 ? `Detected impact areas: ${impactedAreas.join(', ')}.` : ''
  return `${areaContext} ${drivingContext} Confidence ${Math.round(confidence * 100)}% from mocked visual pattern matching.`.trim()
}

const buildNextStepExplanation = (step: AgentCaseNextStep, severity: string, drivable: boolean | null) => {
  if (step === 'Tow') {
    return `Tow is recommended due to ${severity.toLowerCase()} severity and drivable status ${drivable === false ? 'not drivable' : 'requiring caution'}.`
  }
  if (step === 'Repair') {
    return 'Repair routing is recommended directly with no additional escalation required.'
  }
  return 'Inspection is recommended before authorization to validate estimate assumptions.'
}

const buildEstimateExplanation = (lineItems: AgentEstimateLineItem[], severity: string) => {
  return `Generated ${lineItems.length} AI line items from ${severity.toLowerCase()} severity and impacted areas.`
}

const buildDurationExplanation = (minDays: number, maxDays: number, severity: string) => {
  return `${severity} severity typically requires staged parts, labor, and paint operations over ${minDays}-${maxDays} days.`
}

const toComparableSnapshot = (match: ReturnType<typeof findComparableClaims>[number]): AgentComparableClaimSnapshot => ({
  id: match.id,
  vehicleMake: match.vehicleMake,
  vehicleModel: match.vehicleModel,
  severity: match.severity,
  damageAreas: match.damageAreas,
  finalRepairCost: match.finalRepairCost,
  repairDurationDays: match.repairDurationDays,
  shortDescription: match.shortDescription,
  score: match.score,
})

const deriveFinalRecommendation = (input: {
  claim: AgentClaim
  lowConfidence: boolean
  nextStep: AgentCaseNextStep
  signals: AgentSignal[]
  severity: 'Low' | 'Medium' | 'High'
  confidenceFloor: number
}): { decision: AgentCaseDecision; confidence: number; explanation: string } => {
  if (input.lowConfidence) {
    return {
      decision: 'Needs More Photos',
      confidence: clamp01(Math.min(0.58, input.confidenceFloor)),
      explanation: 'Confidence is below threshold; request additional photos before final authorization.',
    }
  }

  if (input.signals.some((signal) => signal.severity === 'Warning')) {
    return {
      decision: 'Escalate',
      confidence: clamp01(Math.max(0.62, input.confidenceFloor - 0.08)),
      explanation: 'Warning-level AI signals indicate additional senior review is recommended.',
    }
  }

  if (input.nextStep === 'Tow' || input.severity === 'High') {
    return {
      decision: 'Escalate',
      confidence: clamp01(Math.max(0.64, input.confidenceFloor - 0.05)),
      explanation: 'Tow/high-severity profile indicates escalation before authorization.',
    }
  }

  return {
    decision: 'Authorize',
    confidence: clamp01(Math.max(0.66, input.confidenceFloor)),
    explanation: 'Damage pattern and confidence are sufficient for direct authorization.',
  }
}

export interface GeneratedAICaseFileBundle {
  caseFile: AgentAICaseFile
  assessment: NonNullable<AgentClaim['aiAssessment']>
  durationPrediction: AgentDurationPrediction
  suggestedLineItems: AgentEstimateLineItem[]
  signals: AgentSignal[]
}

export const generateAICaseFileBundle = async (claim: AgentClaim): Promise<GeneratedAICaseFileBundle> => {
  const seedPayload = [
    claim.id,
    claim.vehicle.make,
    claim.vehicle.model,
    claim.submittedAt,
    claim.photos[0]?.name ?? 'no-photo',
  ].join('|')

  const fakeImage = new File([seedPayload], `${claim.id}.jpg`, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  })

  const assessment = await assessDamage(fakeImage)
  const severityConfidence = toNormalizedConfidence(assessment.confidence)
  const caseNextStep = mapCaseNextStep(claim, assessment.severity)
  const nextStepConfidence = clamp01(severityConfidence - (caseNextStep === 'Inspection' ? 0.06 : 0.02))

  const suggestedLineItems = generateAISuggestedLineItems({
    claimId: claim.id,
    severity: assessment.severity,
    damageAreas: assessment.damageTypes,
  })
  const estimateTotal = calculateLineItemsTotal(suggestedLineItems)
  const estimateConfidence = clamp01((severityConfidence + toNormalizedConfidence(assessment.repairTimeConfidence)) / 2)

  const durationPrediction: AgentDurationPrediction = {
    predictedDurationDaysMin: assessment.estimatedRepairDaysMin,
    predictedDurationDaysMax: assessment.estimatedRepairDaysMax,
    confidence: toNormalizedConfidence(assessment.repairTimeConfidence),
    explanation: buildDurationExplanation(
      assessment.estimatedRepairDaysMin,
      assessment.estimatedRepairDaysMax,
      assessment.severity,
    ),
  }

  const comparableMatches = findComparableClaims(
    {
      vehicleMake: claim.vehicle.make,
      vehicleModel: claim.vehicle.model,
      severity: assessment.severity,
      damageAreas: assessment.damageTypes,
    },
    3,
  ).map(toComparableSnapshot)

  const comparableCosts = comparableMatches.map((item) => item.finalRepairCost)
  const typicalCostRange =
    comparableCosts.length > 0
      ? {
          min: Math.min(...comparableCosts),
          max: Math.max(...comparableCosts),
        }
      : null

  const signals = evaluateAISignals({ ...claim, aiAssessment: assessment })

  const confidenceFloor = Math.min(
    severityConfidence,
    nextStepConfidence,
    estimateConfidence,
    durationPrediction.confidence,
  )
  const lowConfidence = confidenceFloor < 0.6

  const finalRecommendation = deriveFinalRecommendation({
    claim,
    lowConfidence,
    nextStep: caseNextStep,
    signals,
    severity: assessment.severity,
    confidenceFloor,
  })

  const costBand = COST_BANDS[assessment.severity]

  const caseFile: AgentAICaseFile = {
    createdAt: new Date().toISOString(),
    damageSummary: {
      impactedAreas: assessment.damageTypes,
      photoCount: claim.photos.length,
      drivable: claim.drivable,
      hasOtherParty: claim.hasOtherParty,
    },
    severity: {
      value: assessment.severity,
      confidence: severityConfidence,
      explanation: buildSeverityExplanation(claim, assessment.damageTypes, severityConfidence),
    },
    nextStep: {
      value: caseNextStep,
      confidence: nextStepConfidence,
      explanation: buildNextStepExplanation(caseNextStep, assessment.severity, claim.drivable),
    },
    estimate: {
      costBand,
      lineItems: suggestedLineItems,
      total: estimateTotal,
      confidence: estimateConfidence,
      explanation: buildEstimateExplanation(suggestedLineItems, assessment.severity),
    },
    duration: {
      minDays: durationPrediction.predictedDurationDaysMin,
      maxDays: durationPrediction.predictedDurationDaysMax,
      confidence: durationPrediction.confidence,
      explanation: durationPrediction.explanation,
    },
    similarClaims: {
      matches: comparableMatches,
      typicalCostRange,
    },
    signals,
    finalRecommendation,
  }

  return {
    caseFile,
    assessment,
    durationPrediction,
    suggestedLineItems,
    signals,
  }
}
