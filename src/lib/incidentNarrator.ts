export interface NarratorFacts {
  hasOtherParty?: boolean
  otherPartySummary?: string
  drivable?: boolean | null
  locationHint?: string
  assessment?: { severity?: string; confidence?: number; damageType?: string | string[] }
  vehicle?: { year?: number; make?: string; model?: string; bodyType?: string }
  estimate?: {
    estimatedRepairCost?: number
    aboveDeductible?: boolean
    isPotentialTotalLoss?: boolean
  }
  userNotes?: string
}

export interface IncidentNarration {
  headline: string
  narration: string
  keyFacts: Array<{ label: string; value: string }>
  confidence: number
  disclaimers: string[]
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

const normalizeSeverity = (severity?: string) => {
  const value = (severity ?? '').trim().toLowerCase()
  if (value === 'severe') {
    return 'severe'
  }
  if (value === 'moderate') {
    return 'moderate'
  }
  if (value === 'minor') {
    return 'minor'
  }
  return 'unknown'
}

const formatVehicle = (vehicle?: NarratorFacts['vehicle']) => {
  const parts = [vehicle?.year ? String(vehicle.year) : '', vehicle?.make ?? '', vehicle?.model ?? ''].filter(
    (part) => part.trim().length > 0,
  )
  return parts.length > 0 ? parts.join(' ') : 'your vehicle'
}

const formatDamageTypes = (damageType?: string | string[]) => {
  if (!damageType) {
    return ''
  }
  const types = Array.isArray(damageType) ? damageType : [damageType]
  const cleaned = types.map((t) => t.trim()).filter((t) => t.length > 0)
  if (cleaned.length === 0) {
    return ''
  }
  return cleaned.slice(0, 3).join(', ')
}

export function generateIncidentNarration(facts: NarratorFacts): IncidentNarration {
  const severity = normalizeSeverity(facts.assessment?.severity)
  const rawConfidence =
    typeof facts.assessment?.confidence === 'number' ? facts.assessment.confidence : 0.62
  const confidence = clamp(rawConfidence, 0.45, 0.9)

  const vehicleLabel = formatVehicle(facts.vehicle)
  const damageTypes = formatDamageTypes(facts.assessment?.damageType)

  const severityPhrase =
    severity === 'severe' ? 'severe' : severity === 'moderate' ? 'moderate' : severity === 'minor' ? 'minor' : 'unclear'

  const totalLossClause = facts.estimate?.isPotentialTotalLoss ? ' The damage may be significant.' : ''

  const deductibleClause =
    typeof facts.estimate?.aboveDeductible === 'boolean'
      ? facts.estimate.aboveDeductible
        ? ' It may exceed your deductible.'
        : ' It may be below your deductible.'
      : ''

  const damageTypeClause = damageTypes ? ` Noted areas: ${damageTypes}.` : ''

  const drivableSentence =
    facts.drivable === true
      ? 'The vehicle is currently drivable.'
      : facts.drivable === false
        ? 'The vehicle may not be drivable right now.'
        : ''

  const otherPartySentence =
    facts.hasOtherParty === true
      ? `You indicated another vehicle or person was involved${
          facts.otherPartySummary?.trim() ? ` (${facts.otherPartySummary.trim()}).` : '.'
        }`
      : ''

  const userNotesSentence = facts.userNotes?.trim()
    ? `Additional details: ${facts.userNotes.trim().slice(0, 180)}.`
    : ''

  const sentences: string[] = []
  const baseSentences = [
    'Earlier today, you reported an auto incident.',
    `The vehicle involved is ${vehicleLabel}.`,
    `Based on the photos and details provided, the visible damage appears ${severityPhrase}.${damageTypeClause}${totalLossClause}${deductibleClause}`
      .replace(/\s+/g, ' ')
      .trim(),
  ]

  const optionalSentences = [drivableSentence, otherPartySentence, userNotesSentence].filter(
    (sentence) => sentence.trim().length > 0,
  )

  const finalSentence = 'A repair facility will confirm final damage and cost.'

  while (baseSentences.length + optionalSentences.length + 1 > 6) {
    optionalSentences.pop()
  }

  sentences.push(...baseSentences, ...optionalSentences, finalSentence)
  const narration = sentences.join(' ')

  const keyFacts: Array<{ label: string; value: string }> = []
  keyFacts.push({ label: 'Vehicle', value: vehicleLabel })
  keyFacts.push({ label: 'Severity', value: severityPhrase === 'unclear' ? 'Unknown' : severityPhrase })
  if (damageTypes) {
    keyFacts.push({ label: 'Noted areas', value: damageTypes })
  }
  if (facts.drivable === true) {
    keyFacts.push({ label: 'Drivable', value: 'Yes' })
  } else if (facts.drivable === false) {
    keyFacts.push({ label: 'Drivable', value: 'No' })
  }
  if (typeof facts.hasOtherParty === 'boolean') {
    keyFacts.push({ label: 'Other party involved', value: facts.hasOtherParty ? 'Yes' : 'No' })
  }
  if (typeof facts.estimate?.estimatedRepairCost === 'number') {
    keyFacts.push({
      label: 'Estimated repair cost',
      value: `$${Math.round(facts.estimate.estimatedRepairCost).toLocaleString('en-US')}`,
    })
  }
  if (facts.estimate?.isPotentialTotalLoss) {
    keyFacts.push({ label: 'Severity note', value: 'May be significant' })
  }
  if (typeof facts.estimate?.aboveDeductible === 'boolean' && keyFacts.length < 6) {
    keyFacts.push({
      label: 'Deductible',
      value: facts.estimate.aboveDeductible ? 'May exceed deductible' : 'May be below deductible',
    })
  }

  const disclaimers = [
    'This summary is based on the photos and details provided.',
    'Final repair cost and scope will be confirmed by a repair shop.',
    'You can edit any detail before submitting.',
  ]

  const headline =
    facts.drivable === false || facts.estimate?.isPotentialTotalLoss || severity === 'severe'
      ? "We’ll help you take the next steps."
      : 'Here’s a clear summary of what we have so far.'

  return {
    headline,
    narration,
    keyFacts: keyFacts.slice(0, 6),
    confidence,
    disclaimers,
  }
}
