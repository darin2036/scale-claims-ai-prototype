import type { AIAssessment as DamageAssessment, VehicleLookupResult } from './mockAI'
import type { Policy, Vehicle } from '../server/fakeDb'

export interface EstimateLineItem {
  label: string
  amount: number
}

export interface RepairEstimate {
  estimatedRepairCost: number
  lineItems: EstimateLineItem[]
  estimateConfidence: number
  isPotentialTotalLoss: boolean
  totalLossReason?: string
  estimatedVehicleValue: number
  customerPays: number
  insurerPays: number
  aboveDeductible: boolean
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const toSeedFromString = (value: string) => {
  let hash = 0
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) % 100000
  }
  return hash
}

const mapSeverityRange = (severity: DamageAssessment['severity']) => {
  if (severity === 'Low') {
    return { min: 400, max: 1200 }
  }
  if (severity === 'Medium') {
    return { min: 1500, max: 5000 }
  }
  return { min: 6000, max: 15000 }
}

const damageAdjustments: Array<{ keyword: string; amount: number }> = [
  { keyword: 'bumper', amount: 350 },
  { keyword: 'door', amount: 650 },
  { keyword: 'hood', amount: 520 },
  { keyword: 'headlight', amount: 280 },
  { keyword: 'windshield', amount: 420 },
  { keyword: 'quarter', amount: 720 },
  { keyword: 'fender', amount: 480 },
  { keyword: 'structural', amount: 1600 },
]

type VehicleLike = VehicleLookupResult | Vehicle

const estimateVehicleValue = (vehicle: VehicleLike) => {
  if ('estimatedValue' in vehicle && typeof vehicle.estimatedValue === 'number') {
    return vehicle.estimatedValue
  }
  const year = vehicle.year
  // Simple, deterministic value bands. This is a prototype heuristic, not a valuation model.
  const baseValue =
    year >= 2023 ? 35000 : year >= 2021 ? 28000 : year >= 2018 ? 18000 : year >= 2015 ? 12000 : 9000
  const bodyType = vehicle.bodyType?.toLowerCase() ?? ''
  let adjustment = 0
  if (bodyType.includes('suv')) {
    adjustment += 2500
  } else if (bodyType.includes('truck')) {
    adjustment += 3000
  } else if (bodyType.includes('wagon')) {
    adjustment += 1500
  } else if (bodyType.includes('sedan')) {
    adjustment -= 1000
  }
  return Math.max(3000, baseValue + adjustment)
}

export function generateRepairEstimate(args: {
  vehicle: VehicleLike
  assessment: DamageAssessment
  policy: Policy
}): RepairEstimate {
  const { vehicle, assessment, policy } = args
  const range = mapSeverityRange(assessment.severity)
  const seed = toSeedFromString(`${vehicle.year}-${vehicle.make}-${vehicle.model}-${assessment.damageTypes.join('|')}`)
  const baseCost = range.min + (seed % (range.max - range.min + 1))

  const typeAdjustment = assessment.damageTypes.reduce((total, type) => {
    const normalized = type.toLowerCase()
    const adjustment = damageAdjustments.find((item) => normalized.includes(item.keyword))
    return total + (adjustment?.amount ?? 0)
  }, 0)

  const estimatedRepairCost = Math.round((baseCost + typeAdjustment) / 10) * 10
  const estimatedVehicleValue = estimateVehicleValue(vehicle)
  const isPotentialTotalLoss = estimatedRepairCost >= 0.7 * estimatedVehicleValue
  const totalLossReason = isPotentialTotalLoss
    ? `Estimated repair cost is ${Math.round((estimatedRepairCost / estimatedVehicleValue) * 100)}% of vehicle value.`
    : undefined

  const estimateConfidence = clamp(assessment.confidence / 100, 0.4, 0.9)
  const aboveDeductible = estimatedRepairCost >= policy.deductible
  const customerPays = Math.min(policy.deductible, estimatedRepairCost)
  const insurerPays = Math.max(0, estimatedRepairCost - customerPays)

  const lineItems: EstimateLineItem[] = [
    { label: 'Labor', amount: Math.round(estimatedRepairCost * 0.45) },
    { label: 'Parts', amount: Math.round(estimatedRepairCost * 0.35) },
    { label: 'Paint', amount: Math.round(estimatedRepairCost * 0.12) },
    { label: 'Misc', amount: Math.round(estimatedRepairCost * 0.08) },
  ]

  return {
    estimatedRepairCost,
    lineItems,
    estimateConfidence,
    isPotentialTotalLoss,
    totalLossReason,
    estimatedVehicleValue,
    customerPays,
    insurerPays,
    aboveDeductible,
  }
}
