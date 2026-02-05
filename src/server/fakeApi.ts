import {
  demoScenarios,
  plateStateToScenarioId,
  vinToScenarioId,
  type PolicyHolder,
  type Vehicle,
} from './fakeDb'
import { hashString } from './hash'

const withLatency = async <T,>(key: string, task: () => T | Promise<T>) => {
  const hash = hashString(key)
  const delay = 250 + (hash % 351)
  return new Promise<T>((resolve, reject) => {
    setTimeout(async () => {
      try {
        resolve(await task())
      } catch (error) {
        reject(error)
      }
    }, delay)
  })
}

const pickScenarioBySeed = (seed: string) => {
  const index = hashString(seed) % demoScenarios.length
  return demoScenarios[index]
}

const normalizePlate = (plate: string) => plate.trim().toUpperCase()
const normalizeState = (state: string) => state.trim().toUpperCase()
const normalizeVin = (vin: string) => vin.trim().toUpperCase()

export async function listDemoScenarios(): Promise<{ id: string; label: string }[]> {
  return withLatency('list-scenarios', () =>
    demoScenarios.map((scenario) => ({ id: scenario.id, label: scenario.label })),
  )
}

export async function getPolicyHolderByScenario(id: string): Promise<PolicyHolder> {
  return withLatency(`policy-${id}`, () => {
    const scenario = demoScenarios.find((item) => item.id === id) ?? demoScenarios[0]
    return scenario.policyHolder
  })
}

export async function lookupVehicleByPlateState(state: string, plate: string): Promise<Vehicle> {
  const normalizedState = normalizeState(state)
  const normalizedPlate = normalizePlate(plate)
  return withLatency(`plate-${normalizedState}-${normalizedPlate}`, () => {
    if (normalizedPlate.endsWith('9')) {
      throw new Error('Plate lookup failed (simulated). Try VIN.')
    }
    const key = `${normalizedState}:${normalizedPlate}`
    const scenarioId = plateStateToScenarioId[key]
    const scenario = scenarioId
      ? demoScenarios.find((item) => item.id === scenarioId)
      : pickScenarioBySeed(key)
    return (scenario ?? demoScenarios[0]).vehicle
  })
}

export async function lookupVehicleByVin(vin: string): Promise<Vehicle> {
  const normalizedVin = normalizeVin(vin)
  return withLatency(`vin-${normalizedVin}`, () => {
    if (normalizedVin.endsWith('Z')) {
      throw new Error('VIN lookup failed (simulated).')
    }
    const scenarioId = vinToScenarioId[normalizedVin]
    const scenario = scenarioId
      ? demoScenarios.find((item) => item.id === scenarioId)
      : pickScenarioBySeed(normalizedVin)
    return (scenario ?? demoScenarios[0]).vehicle
  })
}

const buildExtractionNotes = (confidence: number, blurry: boolean) => {
  if (blurry || confidence <= 0.55) {
    return 'Low image quality detected. Confirm manually.'
  }
  if (confidence < 0.75) {
    return 'Some characters may be ambiguous. Confirm before lookup.'
  }
  return 'Extraction appears clear. Confirm before lookup.'
}

const selectScenarioForExtraction = (seed: string, type: 'plate' | 'vin') => {
  const candidates = demoScenarios.filter((scenario) =>
    type === 'plate' ? scenario.defaultPlateState : scenario.defaultVin,
  )
  if (candidates.length === 0) {
    return demoScenarios[0]
  }
  const index = hashString(seed) % candidates.length
  return candidates[index]
}

export async function extractPlateStateFromImage(file: File): Promise<{
  plate: string
  state?: string
  confidence: number
  notes: string
}> {
  const name = file.name.toLowerCase()
  return withLatency(`extract-plate-${file.name}`, () => {
    const blurry = name.includes('blurry')
    const highConfidence = name.includes('plate')
    const scenario = selectScenarioForExtraction(file.name, 'plate')
    const plate = scenario.defaultPlateState?.plate ?? '7ABC123'
    const state = scenario.defaultPlateState?.state ?? 'CA'
    const confidence = blurry ? 0.52 : highConfidence ? 0.86 : 0.55
    return {
      plate,
      state: highConfidence ? state : scenario.defaultPlateState?.state,
      confidence,
      notes: buildExtractionNotes(confidence, blurry),
    }
  })
}

export async function extractVinFromImage(file: File): Promise<{
  vin: string
  confidence: number
  notes: string
}> {
  const name = file.name.toLowerCase()
  return withLatency(`extract-vin-${file.name}`, () => {
    const blurry = name.includes('blurry')
    const highConfidence = name.includes('vin')
    const scenario = selectScenarioForExtraction(file.name, 'vin')
    const vin = scenario.defaultVin ?? '1HGCM82633A123456'
    const confidence = blurry ? 0.5 : highConfidence ? 0.88 : 0.55
    return {
      vin,
      confidence,
      notes: buildExtractionNotes(confidence, blurry),
    }
  })
}

export async function getVehicleValue(vehicle: Vehicle): Promise<number> {
  return withLatency(`value-${vehicle.year}-${vehicle.make}-${vehicle.model}`, () => vehicle.estimatedValue)
}
