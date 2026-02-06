type SeverityBand = 'minor' | 'moderate' | 'severe'

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const normalizeSeverity = (severity?: string): SeverityBand | null => {
  const raw = (severity ?? '').trim().toLowerCase()
  if (!raw) {
    return null
  }
  if (raw === 'low' || raw.includes('minor')) {
    return 'minor'
  }
  if (raw === 'medium' || raw.includes('moderate')) {
    return 'moderate'
  }
  if (raw === 'high' || raw.includes('severe')) {
    return 'severe'
  }
  return null
}

const normalizeDamageTypes = (damageType?: string | string[]) => {
  if (!damageType) {
    return []
  }
  return (Array.isArray(damageType) ? damageType : [damageType]).map((item) => item.trim()).filter(Boolean)
}

export function estimateRepairTime(args: {
  severity?: string
  damageType?: string | string[]
  vehicleBodyType?: string
  isPotentialTotalLoss?: boolean
}): {
  minDays: number
  maxDays: number
  confidence: number
  rationale: string[]
} {
  const severityBand = normalizeSeverity(args.severity)
  const damageTypes = normalizeDamageTypes(args.damageType)
  const hasDamageTypes = damageTypes.length > 0

  const bodyType = (args.vehicleBodyType ?? '').trim()
  const bodyTypeLower = bodyType.toLowerCase()

  const isTotalLossFlag = args.isPotentialTotalLoss === true

  const bumperOnly = !isTotalLossFlag && hasDamageTypes && damageTypes.every((t) => t.toLowerCase().includes('bumper'))

  let minDays = 5
  let maxDays = 9

  if (isTotalLossFlag) {
    minDays = 10
    maxDays = 21
  } else if (severityBand === 'minor') {
    minDays = 2
    maxDays = 4
  } else if (severityBand === 'moderate') {
    minDays = 5
    maxDays = 9
  } else if (severityBand === 'severe') {
    minDays = 10
    maxDays = 16
  }

  if (!isTotalLossFlag && !bumperOnly) {
    if (bodyTypeLower === 'ev' || bodyTypeLower.includes('electric') || bodyTypeLower === 'luxury') {
      minDays += 1
      maxDays += 2
    } else if (bodyTypeLower === 'truck') {
      maxDays += 1
    }
  }

  if (bumperOnly) {
    minDays = 2
    maxDays = 6
  }

  if (maxDays < minDays) {
    maxDays = minDays
  }

  let confidence = 0.65
  if (!severityBand) {
    confidence = 0.5
  }
  if (!hasDamageTypes) {
    confidence -= 0.05
  }
  confidence = clamp(confidence, 0.45, 0.9)

  const rationale: string[] = []
  if (isTotalLossFlag) {
    rationale.push('Potential total loss flagged — timeline may include inspection, parts, and valuation steps.')
  } else if (severityBand) {
    rationale.push(`Based on photo-based severity (${severityBand}) and typical shop timelines.`)
  } else {
    rationale.push('Based on typical shop timelines for similar claims when severity is not yet confirmed.')
  }

  if (bumperOnly) {
    rationale.push('Damage appears limited to bumper-related components, which often repairs faster.')
  } else if (hasDamageTypes) {
    rationale.push(`Damage types considered: ${damageTypes.slice(0, 2).join(', ')}${damageTypes.length > 2 ? '…' : ''}.`)
  } else {
    rationale.push('Damage type details were not provided; estimate may change after shop inspection.')
  }

  if (!isTotalLossFlag && (bodyTypeLower === 'ev' || bodyTypeLower === 'luxury' || bodyTypeLower === 'truck')) {
    const label = bodyType || args.vehicleBodyType || 'Vehicle type'
    rationale.push(`Adjusted for vehicle type (${label}) due to parts availability and calibrations.`)
  }

  return {
    minDays,
    maxDays,
    confidence,
    rationale: rationale.slice(0, 4),
  }
}

export function recommendRentalDays(maxDays: number): number {
  if (maxDays <= 3) {
    return 3
  }
  if (maxDays <= 5) {
    return 5
  }
  if (maxDays <= 7) {
    return 7
  }
  if (maxDays <= 10) {
    return 10
  }
  return 14
}

