import type { AIAssessment, RecommendedNextStep, Severity } from '../lib/mockAI'
import type { TowStatus } from '../server/nextStepsApi'
import type { OtherPartyDetails } from '../types/claim'

export type AgentClaimStatus =
  | 'New'
  | 'In Review'
  | 'Pending Approval'
  | 'Needs More Photos'
  | 'Authorized'

export interface AgentPhoto {
  id: string
  name: string
  url: string
}

export interface AgentClaimEvent {
  id: string
  at: string
  type: string
  message: string
}

export type AgentEstimateCategory = 'Parts' | 'Labor' | 'Paint' | 'Misc'

export interface AgentEstimateLineItem {
  id: string
  description: string
  category: AgentEstimateCategory
  amount: number
}

export interface AgentDecision {
  severity?: Severity
  recommendedNextStep?: RecommendedNextStep
  estimatedRepairCost?: number | null
  lineItems?: AgentEstimateLineItem[]
  overrideReasons?: {
    severity?: string
    recommendedNextStep?: string
    estimatedRepairCost?: string
    finalEstimateVsTotal?: string
  }
}

export interface AgentSeniorApproval {
  reviewed: boolean
  note?: string
  reviewedAt?: string
  approvedAt?: string
}

export interface AgentClaim {
  id: string
  vehicle: { year: number; make: string; model: string }
  status: AgentClaimStatus
  submittedAt: string
  drivable: boolean | null
  hasOtherParty: boolean | null
  source: 'mock' | 'customer_flow'
  queueLabel?: string
  readOnlyImported?: boolean
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
  photoRequest?: {
    requested: boolean
    requestedAt?: string
    photosReceived?: boolean
    checklist?: string[]
  }
  photos: AgentPhoto[]
  aiAssessment?: AIAssessment
  agentDecision?: AgentDecision
  seniorApproval?: AgentSeniorApproval
  agentNotes?: string
  assignee?: string | null
  openedAt?: string
  aiAssessedAt?: string
  draftSavedAt?: string
  submittedForApprovalAt?: string
  approvedAt?: string
  authorizedAt?: string
  lastUpdatedAt: string
  events: AgentClaimEvent[]
}

const AGENT_CLAIMS_KEY = 'agent:claims'
const AGENT_IMPORTED_CLAIM_KEY = 'agent:importedClaim'

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

const removeStorageKey = (key: string) => {
  if (!canUseStorage()) {
    return
  }
  try {
    window.localStorage.removeItem(key)
  } catch {
    // Ignore storage failures in prototype mode.
  }
}

const createPhoto = (title: string, bg: string, accent: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0%" stop-color="${bg}"/><stop offset="100%" stop-color="${accent}"/></linearGradient></defs><rect width="640" height="400" fill="url(#g)"/><circle cx="160" cy="120" r="56" fill="rgba(255,255,255,0.2)"/><rect x="68" y="238" width="504" height="82" rx="14" fill="rgba(15,23,42,0.25)"/><text x="320" y="287" text-anchor="middle" font-family="Manrope, Arial, sans-serif" font-size="30" font-weight="700" fill="#fff">${title}</text></svg>`
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

const buildMockPolicy = (claim: Pick<AgentClaim, 'id'>) => {
  const seed = claim.id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  const deductibles = [500, 1000, 1500, 2000] as const
  const insuredNames = [
    'Jordan Smith',
    'Morgan Lee',
    'Avery Chen',
    'Riley Johnson',
    'Casey Patel',
    'Taylor Brooks',
  ] as const

  return {
    policyId: `POL-AGT-${claim.id.slice(-4)}`,
    insuredName: insuredNames[seed % insuredNames.length],
    coverage: seed % 2 === 0 ? ('collision' as const) : ('comprehensive' as const),
    deductible: deductibles[seed % deductibles.length],
    rentalCoverage: seed % 3 !== 0,
  }
}

const buildMockIncident = (claim: Pick<AgentClaim, 'status' | 'vehicle' | 'hasOtherParty' | 'drivable'>) => {
  const severityHint =
    claim.status === 'Authorized'
      ? 'Repairs are already authorized and a shop assignment is pending.'
      : claim.status === 'Pending Approval'
        ? 'Estimate is prepared and waiting for approval.'
        : claim.status === 'Needs More Photos'
          ? 'Additional photos are required before final review.'
      : claim.status === 'In Review'
        ? 'Agent review is in progress pending final estimate confirmation.'
        : 'Awaiting full agent review and estimate finalization.'

  return {
    hasOtherParty: claim.hasOtherParty,
    incidentDescription: `Customer reported impact to ${claim.vehicle.make} ${claim.vehicle.model}. ${severityHint}`,
    incidentNarrationText: `Vehicle ${claim.drivable ? 'remained drivable' : 'was not drivable'} at intake.`,
    towRequested: claim.drivable === false,
    towStatus: claim.drivable === false ? ('dispatched' as TowStatus) : undefined,
    otherPartyDetails:
      claim.hasOtherParty === true
        ? {
            noInfo: false,
            otherDriverName: 'Collected at scene',
            otherContact: 'On file',
            otherVehiclePlate: 'On file',
            otherVehicleState: 'CA',
            otherVehicleMakeModel: 'On file',
            insuranceCarrier: 'On file',
            policyNumber: 'On file',
            notes: 'Captured during intake workflow.',
          }
        : null,
  }
}

const defaultMockClaims = (): AgentClaim[] => {
  const claims: Array<Omit<AgentClaim, 'lastUpdatedAt' | 'events'>> = [
    {
      id: 'CLM-210301',
      vehicle: { year: 2021, make: 'Toyota', model: 'RAV4' },
      status: 'New',
      submittedAt: '2026-02-05T16:40:00.000Z',
      drivable: true,
      hasOtherParty: false,
      photos: [
        { id: 'rav4-front', name: 'rav4-front.jpg', url: createPhoto('Front Bumper', '#f97316', '#0ea5e9') },
        { id: 'rav4-wide', name: 'rav4-wide.jpg', url: createPhoto('Wide Vehicle', '#2563eb', '#14b8a6') },
      ],
      source: 'mock',
    },
    {
      id: 'CLM-210302',
      vehicle: { year: 2020, make: 'Honda', model: 'Accord' },
      status: 'In Review',
      submittedAt: '2026-02-05T18:12:00.000Z',
      drivable: false,
      hasOtherParty: true,
      photos: [
        { id: 'accord-rear', name: 'accord-rear.jpg', url: createPhoto('Rear Quarter Panel', '#0f766e', '#0284c7') },
        { id: 'accord-side', name: 'accord-side.jpg', url: createPhoto('Passenger Side', '#0369a1', '#1d4ed8') },
      ],
      source: 'mock',
    },
    {
      id: 'CLM-210303',
      vehicle: { year: 2019, make: 'Ford', model: 'F-150' },
      status: 'Authorized',
      submittedAt: '2026-02-04T21:25:00.000Z',
      drivable: true,
      hasOtherParty: false,
      photos: [{ id: 'f150-front', name: 'f150-front.jpg', url: createPhoto('Front Grill', '#065f46', '#0891b2') }],
      source: 'mock',
    },
    {
      id: 'CLM-210304',
      vehicle: { year: 2022, make: 'Nissan', model: 'Altima' },
      status: 'New',
      submittedAt: '2026-02-04T18:32:00.000Z',
      drivable: true,
      hasOtherParty: true,
      photos: [{ id: 'altima-side', name: 'altima-side.jpg', url: createPhoto('Driver Door', '#0ea5e9', '#2563eb') }],
      source: 'mock',
    },
    {
      id: 'CLM-210305',
      vehicle: { year: 2018, make: 'Chevrolet', model: 'Malibu' },
      status: 'Pending Approval',
      submittedAt: '2026-02-04T16:18:00.000Z',
      drivable: false,
      hasOtherParty: true,
      photos: [{ id: 'malibu-rear', name: 'malibu-rear.jpg', url: createPhoto('Rear Impact', '#0f766e', '#1d4ed8') }],
      source: 'mock',
    },
    {
      id: 'CLM-210306',
      vehicle: { year: 2023, make: 'Hyundai', model: 'Tucson' },
      status: 'Authorized',
      submittedAt: '2026-02-04T14:50:00.000Z',
      drivable: true,
      hasOtherParty: false,
      photos: [{ id: 'tucson-front', name: 'tucson-front.jpg', url: createPhoto('Front Corner', '#f97316', '#0ea5e9') }],
      source: 'mock',
    },
    {
      id: 'CLM-210307',
      vehicle: { year: 2020, make: 'Subaru', model: 'Outback' },
      status: 'New',
      submittedAt: '2026-02-04T13:21:00.000Z',
      drivable: true,
      hasOtherParty: false,
      photos: [{ id: 'outback-quarter', name: 'outback-quarter.jpg', url: createPhoto('Quarter Panel', '#7c3aed', '#0284c7') }],
      source: 'mock',
    },
    {
      id: 'CLM-210308',
      vehicle: { year: 2021, make: 'Kia', model: 'Sportage' },
      status: 'Needs More Photos',
      submittedAt: '2026-02-04T11:59:00.000Z',
      drivable: false,
      hasOtherParty: true,
      photos: [{ id: 'sportage-bumper', name: 'sportage-bumper.jpg', url: createPhoto('Rear Bumper', '#0369a1', '#0f766e') }],
      source: 'mock',
    },
    {
      id: 'CLM-210309',
      vehicle: { year: 2017, make: 'Jeep', model: 'Cherokee' },
      status: 'Authorized',
      submittedAt: '2026-02-04T10:45:00.000Z',
      drivable: true,
      hasOtherParty: false,
      photos: [{ id: 'cherokee-side', name: 'cherokee-side.jpg', url: createPhoto('Passenger Side', '#15803d', '#2563eb') }],
      source: 'mock',
    },
    {
      id: 'CLM-210310',
      vehicle: { year: 2024, make: 'Tesla', model: 'Model 3' },
      status: 'New',
      submittedAt: '2026-02-04T09:22:00.000Z',
      drivable: true,
      hasOtherParty: true,
      photos: [{ id: 'model3-front', name: 'model3-front.jpg', url: createPhoto('Front Bumper', '#0891b2', '#4f46e5') }],
      source: 'mock',
    },
    {
      id: 'CLM-210311',
      vehicle: { year: 2019, make: 'BMW', model: 'X3' },
      status: 'Pending Approval',
      submittedAt: '2026-02-04T08:14:00.000Z',
      drivable: false,
      hasOtherParty: true,
      photos: [{ id: 'x3-rear', name: 'x3-rear.jpg', url: createPhoto('Rear Hatch', '#f59e0b', '#0284c7') }],
      source: 'mock',
    },
    {
      id: 'CLM-210312',
      vehicle: { year: 2016, make: 'Mazda', model: 'CX-5' },
      status: 'Authorized',
      submittedAt: '2026-02-04T06:37:00.000Z',
      drivable: true,
      hasOtherParty: false,
      photos: [{ id: 'cx5-side', name: 'cx5-side.jpg', url: createPhoto('Side Swipe', '#0ea5e9', '#0f766e') }],
      source: 'mock',
    },
    {
      id: 'CLM-210313',
      vehicle: { year: 2022, make: 'Volkswagen', model: 'Jetta' },
      status: 'New',
      submittedAt: '2026-02-03T22:19:00.000Z',
      drivable: true,
      hasOtherParty: false,
      photos: [{ id: 'jetta-front', name: 'jetta-front.jpg', url: createPhoto('Front Fender', '#2563eb', '#22c55e') }],
      source: 'mock',
    },
    {
      id: 'CLM-210314',
      vehicle: { year: 2018, make: 'Toyota', model: 'Corolla' },
      status: 'Needs More Photos',
      submittedAt: '2026-02-03T20:50:00.000Z',
      drivable: false,
      hasOtherParty: true,
      photos: [{ id: 'corolla-rear', name: 'corolla-rear.jpg', url: createPhoto('Rear End', '#0284c7', '#ef4444') }],
      source: 'mock',
    },
    {
      id: 'CLM-210315',
      vehicle: { year: 2021, make: 'Ford', model: 'Escape' },
      status: 'Authorized',
      submittedAt: '2026-02-03T19:06:00.000Z',
      drivable: true,
      hasOtherParty: false,
      photos: [{ id: 'escape-front', name: 'escape-front.jpg', url: createPhoto('Front Damage', '#4f46e5', '#06b6d4') }],
      source: 'mock',
    },
  ]

  return claims.map((claim) => ({
    ...claim,
    policy: buildMockPolicy(claim),
    incident: buildMockIncident(claim),
    assignee: null,
    seniorApproval:
      claim.status === 'Authorized'
        ? {
            reviewed: true,
            note: 'Seeded as previously approved in demo data.',
            reviewedAt: claim.submittedAt,
            approvedAt: claim.submittedAt,
          }
        : claim.status === 'Pending Approval'
          ? {
              reviewed: false,
              note: '',
            }
          : undefined,
    approvedAt: claim.status === 'Authorized' ? claim.submittedAt : undefined,
    lastUpdatedAt: claim.submittedAt,
    events: [
      {
        id: `${claim.id}-created`,
        at: claim.submittedAt,
        type: 'claim_created',
        message: 'Claim entered agent queue.',
      },
    ],
  }))
}

const normalizeImportedClaim = (value: Partial<AgentClaim>): AgentClaim | null => {
  if (!value.id || !value.vehicle || !value.submittedAt) {
    return null
  }

  return {
    id: value.id,
    vehicle: value.vehicle,
    status: value.status ?? 'New',
    submittedAt: value.submittedAt,
    drivable: value.drivable ?? null,
    hasOtherParty: value.hasOtherParty ?? null,
    source: 'customer_flow',
    queueLabel: 'Most Recent Submission',
    readOnlyImported: true,
    policy: value.policy,
    incident: value.incident,
    photos: Array.isArray(value.photos) ? value.photos : [],
    agentDecision: value.agentDecision,
    openedAt: value.openedAt,
    aiAssessedAt: value.aiAssessedAt,
    draftSavedAt: value.draftSavedAt,
    submittedForApprovalAt: value.submittedForApprovalAt,
    authorizedAt: value.authorizedAt,
    seniorApproval: value.seniorApproval,
    assignee: null,
    lastUpdatedAt: value.lastUpdatedAt ?? value.submittedAt,
    events: Array.isArray(value.events)
      ? value.events
      : [
          {
            id: `${value.id}-imported`,
            at: value.submittedAt,
            type: 'claim_imported',
            message: 'Imported from customer workflow snapshot.',
          },
        ],
  }
}

const syncImportedClaimSnapshot = (): AgentClaim | null => {
  const existing = readJson<AgentClaim | null>(AGENT_IMPORTED_CLAIM_KEY, null)
  if (existing) {
    const normalized = normalizeImportedClaim(existing)
    if (!normalized) {
      return null
    }
    if (JSON.stringify(existing) !== JSON.stringify(normalized)) {
      writeJson(AGENT_IMPORTED_CLAIM_KEY, normalized)
    }
    return normalized
  }
  return null
}

const withImportedMerged = (claims: AgentClaim[]): AgentClaim[] => {
  const imported = syncImportedClaimSnapshot()
  const withoutImported = claims.filter((claim) => !claim.readOnlyImported)
  if (!imported) {
    return withoutImported
  }
  return [imported, ...withoutImported.filter((claim) => claim.id !== imported.id)]
}

const normalizeClaimStatus = (status: string | undefined): AgentClaimStatus => {
  if (
    status === 'New' ||
    status === 'In Review' ||
    status === 'Pending Approval' ||
    status === 'Needs More Photos' ||
    status === 'Authorized'
  ) {
    return status
  }
  return 'New'
}

const normalizeSeniorApproval = (
  claim: AgentClaim,
  status: AgentClaimStatus,
): AgentClaim['seniorApproval'] => {
  if (claim.seniorApproval) {
    return {
      reviewed: Boolean(claim.seniorApproval.reviewed),
      note: claim.seniorApproval.note ?? '',
      reviewedAt: claim.seniorApproval.reviewedAt,
      approvedAt: claim.seniorApproval.approvedAt ?? claim.approvedAt,
    }
  }

  if (status === 'Pending Approval') {
    return {
      reviewed: false,
      note: '',
    }
  }

  if (status === 'Authorized') {
    const approvedAt = claim.approvedAt ?? claim.lastUpdatedAt ?? claim.submittedAt
    return {
      reviewed: true,
      note: '',
      reviewedAt: approvedAt,
      approvedAt,
    }
  }

  return undefined
}

const normalizeStoredClaim = (claim: AgentClaim): AgentClaim => {
  const status = normalizeClaimStatus(claim.status)
  const seniorApproval = normalizeSeniorApproval(claim, status)

  return {
    ...claim,
    status,
    photoRequest: claim.photoRequest ?? {
      requested: false,
      photosReceived: false,
      checklist: [],
    },
    agentDecision: claim.agentDecision
      ? {
          ...claim.agentDecision,
          lineItems: Array.isArray(claim.agentDecision.lineItems) ? claim.agentDecision.lineItems : [],
        }
      : {
          estimatedRepairCost: (claim as AgentClaim & { estimatedRepairCost?: number | null }).estimatedRepairCost ?? null,
          lineItems: [],
        },
    openedAt: claim.openedAt,
    aiAssessedAt: claim.aiAssessedAt,
    draftSavedAt: claim.draftSavedAt,
    submittedForApprovalAt: claim.submittedForApprovalAt,
    authorizedAt: claim.authorizedAt ?? claim.approvedAt,
    seniorApproval,
    assignee: claim.assignee ?? null,
    approvedAt: claim.approvedAt ?? seniorApproval?.approvedAt,
    lastUpdatedAt:
      claim.lastUpdatedAt ??
      claim.authorizedAt ??
      seniorApproval?.approvedAt ??
      claim.approvedAt ??
      claim.submittedAt,
    events: Array.isArray(claim.events) ? claim.events : [],
  }
}

export const loadAgentClaims = (): AgentClaim[] => {
  const stored = readJson<AgentClaim[]>(AGENT_CLAIMS_KEY, [])
  const baseClaims = stored.length > 0 ? stored.map(normalizeStoredClaim) : defaultMockClaims()
  const merged = withImportedMerged(baseClaims)
  if (stored.length === 0 || JSON.stringify(stored) !== JSON.stringify(merged)) {
    writeJson(AGENT_CLAIMS_KEY, merged)
  }
  return merged
}

export const saveAgentClaims = (claims: AgentClaim[]) => {
  writeJson(AGENT_CLAIMS_KEY, claims)
}

export const updateClaim = (id: string, patch: Partial<AgentClaim>) => {
  const claims = loadAgentClaims()
  const nowIso = new Date().toISOString()
  const nextClaims = claims.map((claim) => {
    if (claim.id !== id) {
      return claim
    }
    if (claim.readOnlyImported) {
      return claim
    }
    return {
      ...claim,
      ...patch,
      lastUpdatedAt: patch.lastUpdatedAt ?? nowIso,
      events: claim.events ?? [],
    }
  })
  saveAgentClaims(nextClaims)
  return nextClaims
}

export const appendClaimEvent = (
  id: string,
  event: { type: string; message: string; at?: string; id?: string },
) => {
  const claims = loadAgentClaims()
  const nextClaims = claims.map((claim) => {
    if (claim.id !== id || claim.readOnlyImported) {
      return claim
    }
    const nextEvent: AgentClaimEvent = {
      id: event.id ?? `${Date.now()}-${Math.round(Math.random() * 10_000)}`,
      at: event.at ?? new Date().toISOString(),
      type: event.type,
      message: event.message,
    }
    return {
      ...claim,
      lastUpdatedAt: nextEvent.at,
      events: [...(claim.events ?? []), nextEvent],
    }
  })
  saveAgentClaims(nextClaims)
  return nextClaims
}

export const resetAgentClaimsForDemo = () => {
  const nextClaims = withImportedMerged(defaultMockClaims())
  saveAgentClaims(nextClaims)
  return nextClaims
}

export const clearAgentImportedSnapshot = () => {
  removeStorageKey(AGENT_IMPORTED_CLAIM_KEY)
}
