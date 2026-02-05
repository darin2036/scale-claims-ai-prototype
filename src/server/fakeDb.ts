export type CoverageType = 'collision' | 'comprehensive'

export interface Policy {
  policyId: string
  deductible: number
  coverage: CoverageType
  rentalCoverage: boolean
}

export interface PolicyHolder {
  name: string
  policy: Policy
}

export interface Vehicle {
  year: number
  make: string
  model: string
  bodyType: 'Sedan' | 'SUV' | 'Truck' | 'EV' | 'Luxury'
  estimatedValue: number
}

export interface DemoScenario {
  id: string
  label: string
  policyHolder: PolicyHolder
  defaultPlateState?: { plate: string; state: string }
  defaultVin?: string
  vehicle: Vehicle
}

export const demoScenarios: DemoScenario[] = [
  {
    id: 'scenario-a',
    label: 'A: $500 deductible / 2018 Toyota Camry (Sedan)',
    policyHolder: {
      name: 'Jordan Smith',
      policy: {
        policyId: 'POL-500-A',
        deductible: 500,
        coverage: 'collision',
        rentalCoverage: true,
      },
    },
    defaultPlateState: { plate: '7ABC123', state: 'CA' },
    defaultVin: '4T1BF1FK2JU123456',
    vehicle: {
      year: 2018,
      make: 'Toyota',
      model: 'Camry',
      bodyType: 'Sedan',
      estimatedValue: 18000,
    },
  },
  {
    id: 'scenario-b',
    label: 'B: $1000 deductible / 2021 Honda CR-V (SUV)',
    policyHolder: {
      name: 'Morgan Lee',
      policy: {
        policyId: 'POL-1000-B',
        deductible: 1000,
        coverage: 'collision',
        rentalCoverage: false,
      },
    },
    defaultPlateState: { plate: '8HJK542', state: 'WA' },
    defaultVin: '2HKRW2H55MH654321',
    vehicle: {
      year: 2021,
      make: 'Honda',
      model: 'CR-V',
      bodyType: 'SUV',
      estimatedValue: 28000,
    },
  },
  {
    id: 'scenario-c',
    label: 'C: $2000 deductible / 2023 Tesla Model Y (EV)',
    policyHolder: {
      name: 'Avery Chen',
      policy: {
        policyId: 'POL-2000-C',
        deductible: 2000,
        coverage: 'comprehensive',
        rentalCoverage: true,
      },
    },
    defaultPlateState: { plate: '9TES123', state: 'CA' },
    defaultVin: '7SAYGDEE8PF456789',
    vehicle: {
      year: 2023,
      make: 'Tesla',
      model: 'Model Y',
      bodyType: 'EV',
      estimatedValue: 38000,
    },
  },
  {
    id: 'scenario-d',
    label: 'D: $1000 deductible / 2017 Ford F-150 (Truck)',
    policyHolder: {
      name: 'Riley Johnson',
      policy: {
        policyId: 'POL-1000-D',
        deductible: 1000,
        coverage: 'collision',
        rentalCoverage: true,
      },
    },
    defaultPlateState: { plate: '6TRK777', state: 'TX' },
    defaultVin: '1FTEW1EP1HFA98765',
    vehicle: {
      year: 2017,
      make: 'Ford',
      model: 'F-150',
      bodyType: 'Truck',
      estimatedValue: 24000,
    },
  },
]

export const plateStateToScenarioId: Record<string, string> = demoScenarios.reduce(
  (acc, scenario) => {
    if (scenario.defaultPlateState) {
      const key = `${scenario.defaultPlateState.state}:${scenario.defaultPlateState.plate}`
      acc[key] = scenario.id
    }
    return acc
  },
  {} as Record<string, string>,
)

export const vinToScenarioId: Record<string, string> = demoScenarios.reduce(
  (acc, scenario) => {
    if (scenario.defaultVin) {
      acc[scenario.defaultVin] = scenario.id
    }
    return acc
  },
  {} as Record<string, string>,
)
