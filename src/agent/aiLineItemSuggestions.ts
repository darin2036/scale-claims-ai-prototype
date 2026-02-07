import type { Severity } from '../lib/mockAI'
import type { AgentEstimateCategory, AgentEstimateLineItem } from './store'

interface GenerateAISuggestedLineItemsInput {
  claimId: string
  severity: Severity
  damageAreas: string[]
}

const toSeed = (value: string) => {
  let hash = 0
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) % 1000003
  }
  return hash
}

const severityMultiplier: Record<Severity, number> = {
  Low: 0.8,
  Medium: 1.15,
  High: 1.55,
}

const roundCurrency = (value: number) => Math.max(50, Math.round(value / 5) * 5)

const normalizeDamageArea = (value: string) => {
  const lower = value.toLowerCase()
  if (lower.includes('rear bumper')) {
    return 'Rear bumper'
  }
  if (lower.includes('front bumper')) {
    return 'Front bumper'
  }
  if (lower.includes('bumper')) {
    return 'Bumper'
  }
  if (lower.includes('quarter')) {
    return 'Quarter panel'
  }
  if (lower.includes('door')) {
    return 'Door panel'
  }
  if (lower.includes('fender')) {
    return 'Fender'
  }
  if (lower.includes('hood')) {
    return 'Hood'
  }
  if (lower.includes('headlight')) {
    return 'Headlight assembly'
  }
  if (lower.includes('windshield')) {
    return 'Windshield'
  }
  return value
}

const baseCostByDamageArea = (area: string) => {
  const lower = area.toLowerCase()
  if (lower.includes('headlight') || lower.includes('windshield')) {
    return { parts: 520, labor: 240 }
  }
  if (lower.includes('hood') || lower.includes('quarter')) {
    return { parts: 640, labor: 320 }
  }
  if (lower.includes('door') || lower.includes('fender')) {
    return { parts: 460, labor: 280 }
  }
  return { parts: 420, labor: 250 }
}

const createItem = (
  idPrefix: string,
  index: number,
  description: string,
  category: AgentEstimateCategory,
  amount: number,
): AgentEstimateLineItem => ({
  id: `${idPrefix}-${index}`,
  description,
  category,
  amount: roundCurrency(amount),
})

export const calculateLineItemsTotal = (lineItems: AgentEstimateLineItem[]) =>
  lineItems.reduce((sum, item) => sum + (item.amount || 0), 0)

export const generateAISuggestedLineItems = (
  input: GenerateAISuggestedLineItemsInput,
): AgentEstimateLineItem[] => {
  const normalizedAreas = [...new Set(input.damageAreas.map((area) => normalizeDamageArea(area)).filter(Boolean))]
  const fallbackAreas = normalizedAreas.length > 0 ? normalizedAreas : ['Damage area']
  const multiplier = severityMultiplier[input.severity]
  const seed = toSeed(`${input.claimId}|${input.severity}|${fallbackAreas.join('|')}`)
  const generated: AgentEstimateLineItem[] = []
  const idPrefix = `ai-${input.claimId.toLowerCase()}`
  let index = 1

  fallbackAreas.forEach((area, areaIndex) => {
    const base = baseCostByDamageArea(area)
    const variance = ((seed + areaIndex * 17) % 41) - 20
    generated.push(
      createItem(
        idPrefix,
        index++,
        `${area} parts replacement`,
        'Parts',
        (base.parts + variance * 2) * multiplier,
      ),
    )
    generated.push(
      createItem(
        idPrefix,
        index++,
        `${area} labor and alignment`,
        'Labor',
        (base.labor + variance) * multiplier,
      ),
    )
  })

  if (input.severity !== 'Low') {
    generated.push(createItem(idPrefix, index++, 'Blend and refinish affected panels', 'Paint', 340 * multiplier))
  }
  if (input.severity === 'High') {
    generated.push(createItem(idPrefix, index++, 'Post-repair calibration and scan', 'Misc', 420 * multiplier))
  }

  if (generated.length < 3) {
    generated.push(createItem(idPrefix, index++, 'Shop supplies and setup', 'Misc', 160 * multiplier))
  }

  return generated.slice(0, 6)
}
