import type { AIAssessment } from '../lib/mockAI'
import type { AgentOverlayRegion, AgentPhoto } from './store'

interface OverlaySeedInput {
  claimId: string
  photos: AgentPhoto[]
  aiAssessment: AIAssessment
}

const toSeed = (value: string) => {
  let hash = 0
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) % 1000003
  }
  return hash
}

const seedToFloat = (seed: number, offset: number) => {
  const next = (seed * (offset * 9301 + 49297)) % 233280
  return next / 233280
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

const normalizeLabel = (label: string) => {
  const lower = label.toLowerCase().trim()
  if (lower.includes('rear')) {
    return 'Rear bumper'
  }
  if (lower.includes('front')) {
    return 'Front bumper'
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
    return 'Headlight'
  }
  if (lower.includes('windshield')) {
    return 'Windshield'
  }
  return label
}

export const generateMockOverlayRegions = (
  input: OverlaySeedInput,
): Record<string, AgentOverlayRegion[]> => {
  const labels = input.aiAssessment.damageTypes.length > 0 ? input.aiAssessment.damageTypes.map(normalizeLabel) : ['Damage area']

  const byPhoto: Record<string, AgentOverlayRegion[]> = {}

  input.photos.forEach((photo, photoIndex) => {
    const seed = toSeed(`${input.claimId}|${photo.id}|${input.aiAssessment.severity}|${photoIndex}`)
    const targetCount = Math.min(5, Math.max(2, labels.length + (seed % 2)))
    const regions: AgentOverlayRegion[] = []

    for (let index = 0; index < targetCount; index += 1) {
      const label = labels[index % labels.length]
      const x = seedToFloat(seed, index * 11 + 1) * 0.72 + 0.04
      const y = seedToFloat(seed, index * 13 + 2) * 0.62 + 0.06
      const width = seedToFloat(seed, index * 17 + 3) * 0.22 + 0.16
      const height = seedToFloat(seed, index * 19 + 4) * 0.2 + 0.14
      const safeWidth = Math.min(width, 0.96 - x)
      const safeHeight = Math.min(height, 0.94 - y)
      const confidenceBase = 58 + Math.round(seedToFloat(seed, index * 23 + 5) * 38)

      regions.push({
        id: `${photo.id}-overlay-${index + 1}`,
        photoId: photo.id,
        x: clamp01(x),
        y: clamp01(y),
        width: clamp01(safeWidth),
        height: clamp01(safeHeight),
        label,
        confidence: confidenceBase,
        source: 'ai',
      })
    }

    byPhoto[photo.id] = regions
  })

  return byPhoto
}
