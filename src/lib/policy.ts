export type CoverageType = 'collision' | 'comprehensive'

export interface Policy {
  policyId: string
  deductible: number
  coverage: CoverageType
  rentalCoverage: boolean
  outOfPocketMax?: number
}

export interface PolicyHolder {
  name: string
  policy: Policy
}

export function getMockPolicyHolder(): PolicyHolder {
  return {
    name: 'Jordan Smith',
    policy: {
      policyId: 'POL-482190',
      deductible: 1000,
      coverage: 'collision',
      rentalCoverage: true,
      outOfPocketMax: 1500,
    },
  }
}
