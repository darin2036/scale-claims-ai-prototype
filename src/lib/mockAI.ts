export type Severity = 'Low' | 'Medium' | 'High'
export type RecommendedNextStep = 'Approve' | 'Review' | 'Escalate'

export interface AIAssessment {
  damageTypes: string[]
  severity: Severity
  confidence: number
  recommendedNextStep: RecommendedNextStep
}

const DAMAGE_TYPES = [
  'Front bumper',
  'Rear bumper',
  'Driver-side door',
  'Passenger-side door',
  'Quarter panel',
  'Hood',
  'Headlight',
  'Windshield',
]

const SEVERITY_LEVELS: Severity[] = ['Low', 'Medium', 'High']

const toSeed = (file: File) => {
  let hash = 0
  for (const char of file.name) {
    hash = (hash * 31 + char.charCodeAt(0)) % 100000
  }

  hash = (hash + file.size + file.lastModified) % 100000
  return hash
}

export const assessDamage = (file: File): Promise<AIAssessment> => {
  const seed = toSeed(file)
  const severity = SEVERITY_LEVELS[seed % SEVERITY_LEVELS.length]
  const confidence = 65 + (seed % 31)
  const firstTypeIndex = seed % DAMAGE_TYPES.length
  const secondTypeIndex = (firstTypeIndex + 3) % DAMAGE_TYPES.length
  const damageTypes =
    seed % 2 === 0
      ? [DAMAGE_TYPES[firstTypeIndex]]
      : [DAMAGE_TYPES[firstTypeIndex], DAMAGE_TYPES[secondTypeIndex]]

  let recommendedNextStep: RecommendedNextStep = 'Approve'
  if (severity === 'High' || confidence < 70) {
    recommendedNextStep = 'Escalate'
  } else if (severity === 'Medium' || confidence < 85) {
    recommendedNextStep = 'Review'
  }

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        damageTypes,
        severity,
        confidence,
        recommendedNextStep,
      })
    }, 500)
  })
}
