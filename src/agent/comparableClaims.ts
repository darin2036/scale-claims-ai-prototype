import type { Severity } from '../lib/mockAI'
import { MOCK_COMPARABLE_CLAIMS, type ComparableClaimRecord, type ComparableSeverity } from './mockComparableClaims'

export interface ComparableClaimInput {
  vehicleMake: string
  vehicleModel: string
  severity: Severity | ComparableSeverity
  damageAreas: string[]
}

export interface ComparableClaimMatch extends ComparableClaimRecord {
  score: number
  overlapAreas: string[]
}

const toComparableSeverity = (value: Severity | ComparableSeverity): ComparableSeverity =>
  value.toLowerCase() as ComparableSeverity

const normalizeDamageArea = (value: string): string[] => {
  const lower = value.toLowerCase()
  const normalized = new Set<string>()

  if (lower.includes('front')) {
    normalized.add('front')
  }
  if (lower.includes('rear')) {
    normalized.add('rear')
  }
  if (lower.includes('bumper')) {
    normalized.add('bumper')
  }
  if (lower.includes('door')) {
    normalized.add('door')
  }
  if (lower.includes('fender') || lower.includes('quarter')) {
    normalized.add('fender')
  }
  if (lower.includes('hood')) {
    normalized.add('hood')
  }
  if (lower.includes('headlight') || lower.includes('lamp')) {
    normalized.add('headlight')
  }
  if (lower.includes('windshield') || lower.includes('glass')) {
    normalized.add('windshield')
  }

  if (normalized.size === 0) {
    normalized.add(lower.trim())
  }

  return [...normalized]
}

const toNormalizedDamageAreas = (areas: string[]) =>
  [...new Set(areas.flatMap((area) => normalizeDamageArea(area)).filter(Boolean))]

const inferVehicleType = (make: string, model: string): string => {
  const value = `${make} ${model}`.toLowerCase()
  if (
    value.includes('f-150') ||
    value.includes('silverado') ||
    value.includes('ram') ||
    value.includes('tacoma')
  ) {
    return 'truck'
  }
  if (value.includes('outback') || value.includes('wagon')) {
    return 'wagon'
  }
  if (
    value.includes('rav4') ||
    value.includes('sportage') ||
    value.includes('x3') ||
    value.includes('cx-5') ||
    value.includes('escape') ||
    value.includes('tucson') ||
    value.includes('rogue') ||
    value.includes('suv') ||
    value.includes('wrangler')
  ) {
    return 'suv'
  }
  return 'sedan'
}

export const findComparableClaims = (
  currentClaim: ComparableClaimInput,
  limit = 5,
): ComparableClaimMatch[] => {
  const currentSeverity = toComparableSeverity(currentClaim.severity)
  const currentDamageAreas = toNormalizedDamageAreas(currentClaim.damageAreas)
  const currentDamageAreaSet = new Set(currentDamageAreas)
  const currentVehicleType = inferVehicleType(currentClaim.vehicleMake, currentClaim.vehicleModel)
  const currentMake = currentClaim.vehicleMake.trim().toLowerCase()

  const matches = MOCK_COMPARABLE_CLAIMS.map((candidate) => {
    let score = 0

    if (candidate.severity === currentSeverity) {
      score += 2
    }

    const candidateAreas = toNormalizedDamageAreas(candidate.damageAreas)
    const overlapAreas = candidateAreas.filter((area) => currentDamageAreaSet.has(area))
    score += overlapAreas.length

    const candidateMake = candidate.vehicleMake.trim().toLowerCase()
    const candidateType = inferVehicleType(candidate.vehicleMake, candidate.vehicleModel)
    if (candidateMake === currentMake || candidateType === currentVehicleType) {
      score += 1
    }

    return {
      ...candidate,
      score,
      overlapAreas,
    }
  })
    .filter((match) => match.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score
      }
      return a.finalRepairCost - b.finalRepairCost
    })

  return matches.slice(0, Math.max(3, Math.min(5, limit)))
}
