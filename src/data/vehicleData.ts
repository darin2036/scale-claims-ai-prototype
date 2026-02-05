import makesAndModels from './makes_and_models.json'

export type VehicleData = Record<string, Record<string, string[]>>

type RawModel = {
  model_id: number
  model_name: string
  model_styles: Record<string, unknown>
  vehicle_type: string
  years: number[]
}

type RawMake = {
  first_year: number
  last_year: number
  make_id: number
  make_name: string
  make_slug: string
  models: Record<string, RawModel | undefined>
}

const buildVehicleData = (rawMakes: RawMake[]): VehicleData => {
  const byYear: Record<string, Record<string, Set<string>>> = {}

  for (const make of rawMakes) {
    const makeName = make.make_name
    const models = Object.values(make.models ?? {})
    for (const model of models) {
      if (!model) {
        continue
      }
      const modelName = model.model_name
      for (const year of model.years ?? []) {
        const yearKey = String(year)
        if (!byYear[yearKey]) {
          byYear[yearKey] = {}
        }
        if (!byYear[yearKey][makeName]) {
          byYear[yearKey][makeName] = new Set()
        }
        byYear[yearKey][makeName].add(modelName)
      }
    }
  }

  const result: VehicleData = {}
  for (const [year, makes] of Object.entries(byYear)) {
    result[year] = {}
    for (const [makeName, modelSet] of Object.entries(makes)) {
      result[year][makeName] = Array.from(modelSet).sort()
    }
  }

  return result
}

export const vehicleData: VehicleData = buildVehicleData(makesAndModels as RawMake[])

export const vehicleYears = Object.keys(vehicleData).sort(
  (first, second) => Number(second) - Number(first),
)

export const getMakesForYear = (year: string) =>
  year ? Object.keys(vehicleData[year] ?? {}).sort() : []

export const getModelsForYearMake = (year: string, make: string) =>
  year && make ? vehicleData[year]?.[make] ?? [] : []
