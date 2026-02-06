export type UrgencyMode = 'minor' | 'moderate' | 'urgent'

export interface CopilotContext {
  drivable?: boolean | null
  assessment?: {
    severity?: string
    confidence?: number
    damageType?: string | string[]
  }
  vehicle?: {
    year?: number
    make?: string
    model?: string
    bodyType?: string
  }
  estimate?: {
    estimatedRepairCost?: number
    aboveDeductible?: boolean
    isPotentialTotalLoss?: boolean
  }
}

export interface IncidentSummary {
  title: string
  bullets: string[]
  reassurance: string
  recommendedNextSteps: string[]
  confidence: number
  mode: UrgencyMode
}

export interface DescriptionDraftInput {
  freeText?: string
  ctx: CopilotContext
  hasOtherParty?: boolean
  otherParty?: { name?: string; plate?: string; state?: string; makeModel?: string }
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const normalizeSeverity = (severity?: string) => {
  const raw = severity?.trim().toLowerCase()
  if (!raw) {
    return ''
  }
  if (raw === 'high') {
    return 'severe'
  }
  if (raw === 'medium') {
    return 'moderate'
  }
  if (raw === 'low') {
    return 'minor'
  }
  return raw
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)

const titleForMode = (mode: UrgencyMode) => {
  if (mode === 'urgent') {
    return "We'll take care of the next steps"
  }
  if (mode === 'moderate') {
    return "Here's what we're seeing"
  }
  return 'This looks manageable'
}

const reassuranceForMode = (mode: UrgencyMode) => {
  if (mode === 'urgent') {
    return "You're not alone—safety first. We'll help coordinate the logistics and keep things moving."
  }
  if (mode === 'moderate') {
    return "You're doing the right thing. We'll guide you through a few quick steps to keep this moving."
  }
  return "We'll keep this quick. You can correct anything as you go."
}

const nextStepsForMode = (mode: UrgencyMode) => {
  if (mode === 'urgent') {
    return ['Tow', 'Ride', 'Submit claim']
  }
  if (mode === 'moderate') {
    return ['Submit claim', 'Choose shop', 'Rental (if needed)']
  }
  return ['Submit claim', 'Choose shop (optional)']
}

const deriveConfidence = (assessmentConfidence?: number) => {
  if (typeof assessmentConfidence !== 'number' || !Number.isFinite(assessmentConfidence)) {
    return 0.55
  }
  const normalized = assessmentConfidence > 1 ? assessmentConfidence / 100 : assessmentConfidence
  return clamp(normalized, 0.45, 0.9)
}

const deriveDraftConfidence = (assessmentConfidence?: number) => {
  if (typeof assessmentConfidence !== 'number' || !Number.isFinite(assessmentConfidence)) {
    return 0.55
  }
  const normalized = assessmentConfidence > 1 ? assessmentConfidence / 100 : assessmentConfidence
  return clamp(normalized, 0.45, 0.85)
}

const formatVehicleBullet = (vehicle?: CopilotContext['vehicle']) => {
  if (!vehicle) {
    return 'Vehicle: details pending'
  }
  const bits: string[] = []
  if (typeof vehicle.year === 'number') {
    bits.push(String(vehicle.year))
  }
  if (vehicle.make) {
    bits.push(vehicle.make)
  }
  if (vehicle.model) {
    bits.push(vehicle.model)
  }
  const label = bits.join(' ').trim()
  if (!label) {
    return 'Vehicle: details pending'
  }
  return vehicle.bodyType ? `Vehicle: ${label} (${vehicle.bodyType})` : `Vehicle: ${label}`
}

const formatDamageBullet = (assessment?: CopilotContext['assessment']) => {
  if (!assessment) {
    return 'Damage: details pending'
  }

  const severity = normalizeSeverity(assessment.severity)
  const severityLabel = severity
    ? severity === 'severe'
      ? 'Severe'
      : severity === 'moderate'
        ? 'Moderate'
        : severity === 'minor'
          ? 'Minor'
          : severity
    : ''

  const damageTypes = Array.isArray(assessment.damageType)
    ? assessment.damageType
    : assessment.damageType
      ? [assessment.damageType]
      : []
  const cleanedDamageTypes = damageTypes
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 3)

  if (severityLabel && cleanedDamageTypes.length > 0) {
    return `Damage: ${severityLabel} — ${cleanedDamageTypes.join(', ')}`
  }
  if (severityLabel) {
    return `Damage: ${severityLabel}`
  }
  if (cleanedDamageTypes.length > 0) {
    return `Damage areas: ${cleanedDamageTypes.join(', ')}`
  }
  return 'Damage: details pending'
}

const formatDrivableBullet = (drivable?: boolean | null) => {
  if (drivable === true) {
    return 'Drivable: Yes'
  }
  if (drivable === false) {
    return 'Drivable: Not safely drivable'
  }
  return 'Drivable: Not sure yet'
}

const formatEstimateBullet = (estimate?: CopilotContext['estimate']) => {
  if (!estimate) {
    return null
  }
  const hasCost = typeof estimate.estimatedRepairCost === 'number' && Number.isFinite(estimate.estimatedRepairCost)
  const hasDeductibleSignal = typeof estimate.aboveDeductible === 'boolean'

  if (hasCost && hasDeductibleSignal) {
    return `Estimate: ${formatCurrency(estimate.estimatedRepairCost!)} (${estimate.aboveDeductible ? 'likely above' : 'likely below'} deductible)`
  }
  if (hasCost) {
    return `Estimate: ${formatCurrency(estimate.estimatedRepairCost!)}`
  }
  if (hasDeductibleSignal) {
    return `Deductible: likely ${estimate.aboveDeductible ? 'above' : 'below'}`
  }
  return null
}

export function computeUrgencyMode(ctx: CopilotContext): UrgencyMode {
  if (ctx.drivable === false) {
    return 'urgent'
  }
  if (ctx.estimate?.isPotentialTotalLoss) {
    return 'urgent'
  }

  const severity = normalizeSeverity(ctx.assessment?.severity)
  if (severity === 'severe') {
    return 'urgent'
  }
  if (severity === 'moderate') {
    return 'moderate'
  }
  return 'minor'
}

export function generateIncidentSummary(ctx: CopilotContext): IncidentSummary {
  const mode = computeUrgencyMode(ctx)
  const confidence = deriveConfidence(ctx.assessment?.confidence)

  const bullets: string[] = [
    formatVehicleBullet(ctx.vehicle),
    formatDamageBullet(ctx.assessment),
    formatDrivableBullet(ctx.drivable),
  ]

  const estimateBullet = formatEstimateBullet(ctx.estimate)
  if (estimateBullet) {
    bullets.push(estimateBullet)
  }

  if (ctx.estimate?.isPotentialTotalLoss) {
    bullets.push('Potential total loss: flagged for review based on the estimate')
  }

  return {
    title: titleForMode(mode),
    bullets,
    reassurance: reassuranceForMode(mode),
    recommendedNextSteps: nextStepsForMode(mode),
    confidence,
    mode,
  }
}

export function draftIncidentDescription(input: DescriptionDraftInput): {
  text: string
  confidence: number
  rationale: string[]
} {
  const severity = normalizeSeverity(input.ctx.assessment?.severity)
  const severitySentence =
    severity === 'severe'
      ? 'Based on the photos, the damage appears severe.'
      : severity === 'moderate'
        ? 'Based on the photos, the damage appears moderate.'
        : severity === 'minor'
          ? 'Based on the photos, the damage appears minor.'
          : 'Based on the photos, the damage level is still being confirmed.'

  const vehicleBits: string[] = []
  const vehicle = input.ctx.vehicle
  if (vehicle) {
    if (typeof vehicle.year === 'number') {
      vehicleBits.push(String(vehicle.year))
    }
    if (vehicle.make) {
      vehicleBits.push(vehicle.make)
    }
    if (vehicle.model) {
      vehicleBits.push(vehicle.model)
    }
  }
  const vehicleLabel = vehicleBits.join(' ').trim()
  const vehicleSentence = vehicleLabel ? `The vehicle is a ${vehicleLabel}.` : ''

  const opening = input.hasOtherParty
    ? 'Earlier today, there was an incident involving my vehicle and another vehicle/person.'
    : 'Earlier today, there was an incident involving my vehicle.'

  const drivableSentence =
    input.ctx.drivable === true
      ? 'At this time, the vehicle appears drivable.'
      : input.ctx.drivable === false
        ? 'At this time, the vehicle does not appear safely drivable.'
        : ''

  const rawFreeText = (input.freeText ?? '').replace(/\s+/g, ' ').trim()
  const trimmedFreeText = rawFreeText.length > 160 ? `${rawFreeText.slice(0, 157).trim()}...` : rawFreeText
  const additionalSentence = trimmedFreeText ? `Additional details: ${trimmedFreeText}.` : ''

  const closing = 'A repair facility will confirm final damage and cost.'

  const sentences: string[] = [opening]
  if (vehicleSentence) {
    sentences.push(vehicleSentence)
  }
  sentences.push(severitySentence)
  if (drivableSentence) {
    sentences.push(drivableSentence)
  }
  if (additionalSentence) {
    sentences.push(additionalSentence)
  }
  sentences.push(closing)

  const confidence = deriveDraftConfidence(input.ctx.assessment?.confidence)
  const rationale = [
    'Based on your uploaded photos and the damage assessment.',
    'Based on the vehicle identification details provided.',
    'Based on your answers (drivable status and other-party involvement).',
  ]

  return {
    text: sentences.slice(0, 6).join(' '),
    confidence,
    rationale,
  }
}
