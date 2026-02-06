import { estimateRepairTime } from './repairTimeEstimator'

export type Severity = 'Low' | 'Medium' | 'High'
export type RecommendedNextStep = 'Approve' | 'Review' | 'Escalate'

export interface AIAssessment {
  damageTypes: string[]
  severity: Severity
  confidence: number
  recommendedNextStep: RecommendedNextStep
  estimatedRepairDaysMin: number
  estimatedRepairDaysMax: number
  repairTimeConfidence: number
  repairTimeRationale: string[]
}

export interface PlateExtraction {
  plate: string
  state?: string
  confidence: number
  notes: string
}

export interface VinExtraction {
  vin: string
  confidence: number
  notes: string
}

export interface VehicleLookupResult {
  year: number
  make: string
  model: string
  bodyType?: string
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

const PLATE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const PLATE_NUMBERS = '0123456789'
const PLATE_PATTERNS = ['LLLDDD', 'LLDDLL', 'DLLLDD', 'LLLDDL', 'LLDDDL']
const VIN_CHARS = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789'
const US_STATE_CODES = [
  'AL',
  'AK',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DE',
  'FL',
  'GA',
  'HI',
  'ID',
  'IL',
  'IN',
  'IA',
  'KS',
  'KY',
  'LA',
  'ME',
  'MD',
  'MA',
  'MI',
  'MN',
  'MS',
  'MO',
  'MT',
  'NE',
  'NV',
  'NH',
  'NJ',
  'NM',
  'NY',
  'NC',
  'ND',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VT',
  'VA',
  'WA',
  'WV',
  'WI',
  'WY',
  'DC',
]
const VEHICLE_CATALOG: Array<{ make: string; model: string; bodyType?: string }> = [
  { make: 'Toyota', model: 'Camry', bodyType: 'Sedan' },
  { make: 'Honda', model: 'Civic', bodyType: 'Sedan' },
  { make: 'Ford', model: 'F-150', bodyType: 'Truck' },
  { make: 'Tesla', model: 'Model 3', bodyType: 'Sedan' },
  { make: 'Chevrolet', model: 'Tahoe', bodyType: 'SUV' },
  { make: 'Subaru', model: 'Outback', bodyType: 'Wagon' },
  { make: 'Jeep', model: 'Wrangler', bodyType: 'SUV' },
  { make: 'BMW', model: 'X5', bodyType: 'SUV' },
  { make: 'Nissan', model: 'Rogue', bodyType: 'SUV' },
  { make: 'Hyundai', model: 'Elantra', bodyType: 'Sedan' },
  { make: 'Kia', model: 'Sportage', bodyType: 'SUV' },
  { make: 'Volkswagen', model: 'Jetta', bodyType: 'Sedan' },
]

const toSeed = (file: File) => {
  let hash = 0
  for (const char of file.name) {
    hash = (hash * 31 + char.charCodeAt(0)) % 100000
  }

  hash = (hash + file.size + file.lastModified) % 100000
  return hash
}

const toSeedFromString = (value: string) => {
  let hash = 0
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) % 100000
  }
  return hash
}

const normalizeTokens = (value: string) =>
  value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, ' ')
    .split(' ')
    .filter(Boolean)

const pickFrom = (seed: number, pool: string, offset: number) =>
  pool[(seed + offset) % pool.length]

const extractStateFromName = (name: string) => {
  const tokens = normalizeTokens(name)
  return tokens.find((token) => token.length === 2 && US_STATE_CODES.includes(token))
}

const extractPlateFromName = (name: string) => {
  const tokens = normalizeTokens(name)
  return tokens.find(
    (token) =>
      token.length >= 5 &&
      token.length <= 7 &&
      /[A-Z]/.test(token) &&
      /[0-9]/.test(token),
  )
}

const buildPlate = (seed: number, name: string) => {
  const candidate = extractPlateFromName(name)
  if (candidate) {
    return candidate
  }

  const pattern = PLATE_PATTERNS[seed % PLATE_PATTERNS.length]
  let plate = ''
  for (let i = 0; i < pattern.length; i += 1) {
    plate +=
      pattern[i] === 'L'
        ? pickFrom(seed, PLATE_LETTERS, i * 7)
        : pickFrom(seed, PLATE_NUMBERS, i * 5)
  }
  return plate
}

const buildVin = (seed: number, name: string) => {
  const cleaned = name.toUpperCase()
  const vinMatch = cleaned.match(/[A-HJ-NPR-Z0-9]{11,17}/)
  let vin = vinMatch?.[0] ?? ''
  const baseSeed = seed + toSeedFromString(vin)

  while (vin.length < 17) {
    vin += pickFrom(baseSeed, VIN_CHARS, vin.length * 11)
  }

  return vin.slice(0, 17)
}

const deriveConfidence = (seed: number, name: string, min: number, max: number) => {
  const lower = name.toLowerCase()
  let confidence = min + (seed % (max - min + 1))

  if (lower.includes('clear') || lower.includes('sharp')) {
    confidence += 6
  }
  if (lower.includes('blur') || lower.includes('dark')) {
    confidence -= 12
  }
  if (lower.includes('glare') || lower.includes('reflect')) {
    confidence -= 6
  }

  return Math.min(max, Math.max(min, confidence))
}

const buildNotes = (confidence: number, type: 'plate' | 'vin') => {
  if (confidence < 60) {
    return type === 'plate'
      ? 'Low visibility detected; verify characters carefully.'
      : 'VIN plate is hard to read; confirm with the vehicle label.'
  }
  if (confidence < 75) {
    return type === 'plate'
      ? 'Minor glare or obstruction detected; confirm before lookup.'
      : 'Some characters may be ambiguous; double-check the VIN.'
  }
  return type === 'plate'
    ? 'Characters appear clear. Confirm state before lookup.'
    : 'VIN appears legible. Confirm before lookup.'
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

  const repairTime = estimateRepairTime({
    severity,
    damageType: damageTypes,
  })

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        damageTypes,
        severity,
        confidence,
        recommendedNextStep,
        estimatedRepairDaysMin: repairTime.minDays,
        estimatedRepairDaysMax: repairTime.maxDays,
        repairTimeConfidence: repairTime.confidence,
        repairTimeRationale: repairTime.rationale,
      })
    }, 500)
  })
}

export const mockExtractPlateAndStateFromImage = (file: File): Promise<PlateExtraction> => {
  const seed = toSeed(file)
  const plate = buildPlate(seed, file.name)
  const stateFromName = extractStateFromName(file.name)
  const state = seed % 5 === 0 ? undefined : stateFromName ?? US_STATE_CODES[seed % US_STATE_CODES.length]
  const confidence = deriveConfidence(seed, file.name, 55, 96)
  const notes = buildNotes(confidence, 'plate')

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        plate,
        state,
        confidence,
        notes,
      })
    }, 450)
  })
}

export const mockExtractVinFromImage = (file: File): Promise<VinExtraction> => {
  const seed = toSeed(file)
  const vin = buildVin(seed, file.name)
  const confidence = deriveConfidence(seed, file.name, 52, 94)
  const notes = buildNotes(confidence, 'vin')

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        vin,
        confidence,
        notes,
      })
    }, 450)
  })
}

export const mockLookupVehicleByPlateState = (
  plate: string,
  state: string,
): Promise<VehicleLookupResult> => {
  const normalizedPlate = plate.trim().toUpperCase()
  const normalizedState = state.trim().toUpperCase()
  const seed = toSeedFromString(`${normalizedPlate}-${normalizedState}`)
  const vehicle = VEHICLE_CATALOG[seed % VEHICLE_CATALOG.length]
  const year = 2012 + (seed % 13)

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        year,
        make: vehicle.make,
        model: vehicle.model,
        bodyType: vehicle.bodyType,
      })
    }, 400)
  })
}

export const mockLookupVehicleByVin = (vin: string): Promise<VehicleLookupResult> => {
  const normalizedVin = vin.trim().toUpperCase()
  const seed = toSeedFromString(normalizedVin)
  const vehicle = VEHICLE_CATALOG[(seed + 3) % VEHICLE_CATALOG.length]
  const year = 2011 + (seed % 14)

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        year,
        make: vehicle.make,
        model: vehicle.model,
        bodyType: vehicle.bodyType,
      })
    }, 400)
  })
}
