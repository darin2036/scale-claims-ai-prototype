import type { Vehicle } from '../../server/fakeDb'
import type { TowStatus } from '../../server/nextStepsApi'
import type { OtherPartyDetails } from '../../types/claim'

export const AGENT_MOST_RECENT_SUBMISSION_KEY = 'claims-agent-most-recent-submission-v1'
export const AGENT_CLAIM_OVERRIDES_KEY = 'claims-agent-claim-overrides-v1'

export type AgentClaimStatus = 'New' | 'In Review' | 'Authorized'

export interface AgentPhoto {
  id: string
  name: string
  url: string
}

export interface AgentClaimRecord {
  id: string
  vehicle: Pick<Vehicle, 'year' | 'make' | 'model'>
  status: AgentClaimStatus
  submittedAt: string
  drivable: boolean | null
  hasOtherParty: boolean | null
  policy?: {
    policyId: string
    insuredName?: string
    coverage: 'collision' | 'comprehensive'
    deductible: number
    rentalCoverage: boolean
  }
  incident?: {
    incidentDescription?: string
    incidentNarrationText?: string
    hasOtherParty: boolean | null
    otherPartyDetails?: OtherPartyDetails | null
    towRequested?: boolean
    towStatus?: TowStatus
  }
  photos: AgentPhoto[]
  source: 'customer_flow' | 'mock'
}

export interface AgentClaimOverride {
  status?: AgentClaimStatus
  estimatedRepairCost?: number | null
  agentNotes?: string
  approvedAt?: string
}

interface PersistCustomerSubmissionArgs {
  claimId: string
  submittedAt: string
  vehicle: Pick<Vehicle, 'year' | 'make' | 'model'>
  drivable: boolean | null
  hasOtherParty: boolean | null
  policy?: AgentClaimRecord['policy']
  incident?: AgentClaimRecord['incident']
  damagePhotos: File[]
  vehiclePhoto: File | null
}

const canUseStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'

const readJson = <T>(key: string, fallback: T): T => {
  if (!canUseStorage()) {
    return fallback
  }

  try {
    const value = window.localStorage.getItem(key)
    if (!value) {
      return fallback
    }
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

const writeJson = (key: string, value: unknown) => {
  if (!canUseStorage()) {
    return
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignore storage failures in prototype mode.
  }
}

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

export const loadMostRecentSubmission = (): AgentClaimRecord | null => {
  const value = readJson<AgentClaimRecord | null>(AGENT_MOST_RECENT_SUBMISSION_KEY, null)
  if (!value || typeof value !== 'object') {
    return null
  }
  return value
}

export const loadClaimOverrides = (): Record<string, AgentClaimOverride> =>
  readJson<Record<string, AgentClaimOverride>>(AGENT_CLAIM_OVERRIDES_KEY, {})

export const saveClaimOverride = (claimId: string, override: AgentClaimOverride) => {
  const current = loadClaimOverrides()
  current[claimId] = { ...current[claimId], ...override }
  writeJson(AGENT_CLAIM_OVERRIDES_KEY, current)
}

export const clearAgentDemoData = () => {
  if (!canUseStorage()) {
    return
  }

  try {
    window.localStorage.removeItem(AGENT_MOST_RECENT_SUBMISSION_KEY)
    window.localStorage.removeItem(AGENT_CLAIM_OVERRIDES_KEY)
  } catch {
    // Ignore storage failures in prototype mode.
  }
}

export const persistMostRecentSubmissionFromCustomerFlow = async (
  args: PersistCustomerSubmissionArgs,
) => {
  const files = [...args.damagePhotos.slice(0, 4), ...(args.vehiclePhoto ? [args.vehiclePhoto] : [])]
  let photos: AgentPhoto[] = []

  try {
    photos = await Promise.all(
      files.map(async (file, index) => ({
        id: `photo-${index + 1}`,
        name: file.name || `claim-photo-${index + 1}.jpg`,
        url: await fileToDataUrl(file),
      })),
    )
  } catch {
    photos = []
  }

  const submission: AgentClaimRecord = {
    id: args.claimId,
    vehicle: args.vehicle,
    status: 'New',
    submittedAt: args.submittedAt,
    drivable: args.drivable,
    hasOtherParty: args.hasOtherParty,
    policy: args.policy,
    incident: args.incident,
    photos,
    source: 'customer_flow',
  }

  writeJson(AGENT_MOST_RECENT_SUBMISSION_KEY, submission)
}
