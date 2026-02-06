import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import fenderbenderLogo from '../assets/fenderbender-logo.png'
import { assessDamage, type AIAssessment, type Severity } from '../lib/mockAI'
import {
  clearAgentDemoData,
  loadClaimOverrides,
  loadMostRecentSubmission,
  saveClaimOverride,
  type AgentClaimOverride,
  type AgentClaimRecord,
  type AgentClaimStatus,
} from '../components/agent/storage'
import './AgentReview.css'

interface QueueClaim extends AgentClaimRecord {
  queueLabel?: string
}

const buildMockPolicy = (claim: Pick<AgentClaimRecord, 'id' | 'vehicle'>): NonNullable<AgentClaimRecord['policy']> => {
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
    coverage: seed % 2 === 0 ? 'collision' : 'comprehensive',
    deductible: deductibles[seed % deductibles.length],
    rentalCoverage: seed % 3 !== 0,
  }
}

const createPhoto = (title: string, bg: string, accent: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0%" stop-color="${bg}"/><stop offset="100%" stop-color="${accent}"/></linearGradient></defs><rect width="640" height="400" fill="url(#g)"/><circle cx="160" cy="120" r="56" fill="rgba(255,255,255,0.2)"/><rect x="68" y="238" width="504" height="82" rx="14" fill="rgba(15,23,42,0.25)"/><text x="320" y="287" text-anchor="middle" font-family="Manrope, Arial, sans-serif" font-size="30" font-weight="700" fill="#fff">${title}</text></svg>`
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

const MOCK_CLAIMS: AgentClaimRecord[] = [
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
    status: 'In Review',
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
    status: 'In Review',
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
    status: 'In Review',
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
    status: 'In Review',
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

const COST_BANDS: Record<Severity, { min: number; max: number }> = {
  Low: { min: 500, max: 1500 },
  Medium: { min: 1500, max: 4000 },
  High: { min: 4000, max: 9000 },
}

const formatSubmittedAt = (value: string) => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return parsed.toLocaleString()
}

const statusClassName = (status: AgentClaimStatus) =>
  `agent-status agent-status--${status.toLowerCase().replace(/\s+/g, '-')}`

export default function AgentReview() {
  const [mostRecentSubmission, setMostRecentSubmission] = useState<AgentClaimRecord | null>(() =>
    loadMostRecentSubmission(),
  )
  const [claimOverrides, setClaimOverrides] = useState<Record<string, AgentClaimOverride>>(() =>
    loadClaimOverrides(),
  )
  const [assessmentByClaim, setAssessmentByClaim] = useState<Record<string, AIAssessment>>({})
  const [assessingClaimId, setAssessingClaimId] = useState<string | null>(null)
  const [banner, setBanner] = useState<{ tone: 'info' | 'success'; message: string } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'All' | AgentClaimStatus>('All')
  const [sourceFilter, setSourceFilter] = useState<'All' | 'customer_flow' | 'mock'>('All')
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'status'>('newest')

  const queueClaims = useMemo<QueueClaim[]>(() => {
    const baseClaims = mostRecentSubmission
      ? [{ ...mostRecentSubmission, queueLabel: 'Most Recent Submission' }, ...MOCK_CLAIMS]
      : [...MOCK_CLAIMS]
    const deduped = baseClaims.filter(
      (claim, index, list) => list.findIndex((otherClaim) => otherClaim.id === claim.id) === index,
    )

    const claimsWithOverrides = deduped.map((claim) => ({
      ...claim,
      status: claimOverrides[claim.id]?.status ?? claim.status,
      policy: claim.policy ?? buildMockPolicy(claim),
    }))

    const filtered = claimsWithOverrides.filter((claim) => {
      const haystack = `${claim.id} ${claim.vehicle.year} ${claim.vehicle.make} ${claim.vehicle.model} ${
        claim.policy?.policyId ?? ''
      } ${claim.policy?.insuredName ?? ''}`.toLowerCase()
      const searchText = searchQuery.trim().toLowerCase()
      if (searchText && !haystack.includes(searchText)) {
        return false
      }
      if (statusFilter !== 'All' && claim.status !== statusFilter) {
        return false
      }
      if (sourceFilter !== 'All' && claim.source !== sourceFilter) {
        return false
      }
      return true
    })

    const statusRank: Record<AgentClaimStatus, number> = {
      New: 0,
      'In Review': 1,
      Authorized: 2,
    }

    return filtered.sort((a, b) => {
      const timeA = new Date(a.submittedAt).getTime()
      const timeB = new Date(b.submittedAt).getTime()

      if (sortOrder === 'oldest') {
        return timeA - timeB
      }
      if (sortOrder === 'status') {
        const byStatus = statusRank[a.status] - statusRank[b.status]
        if (byStatus !== 0) {
          return byStatus
        }
        return timeB - timeA
      }
      return timeB - timeA
    })
  }, [claimOverrides, mostRecentSubmission, searchQuery, sortOrder, sourceFilter, statusFilter])

  const [selectedClaimId, setSelectedClaimId] = useState<string>(
    () => mostRecentSubmission?.id ?? MOCK_CLAIMS[0]?.id ?? '',
  )
  const lastSyncedClaimIdRef = useRef<string | null>(null)
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null)
  const [estimatedRepairCost, setEstimatedRepairCost] = useState('')
  const [agentNotes, setAgentNotes] = useState('')

  useEffect(() => {
    if (!queueClaims.some((claim) => claim.id === selectedClaimId) && queueClaims[0]) {
      setSelectedClaimId(queueClaims[0].id)
    }
  }, [queueClaims, selectedClaimId])

  const selectedClaim = queueClaims.find((claim) => claim.id === selectedClaimId) ?? null

  useEffect(() => {
    if (!selectedClaim) {
      setActivePhotoId(null)
      return
    }
    if (selectedClaim.photos.length === 0) {
      setActivePhotoId(null)
      return
    }
    if (!selectedClaim.photos.some((photo) => photo.id === activePhotoId)) {
      setActivePhotoId(selectedClaim.photos[0].id)
    }
  }, [activePhotoId, selectedClaim])

  useEffect(() => {
    if (!selectedClaim) {
      lastSyncedClaimIdRef.current = null
      return
    }
    if (lastSyncedClaimIdRef.current === selectedClaim.id) {
      return
    }
    const override = claimOverrides[selectedClaim.id]
    setEstimatedRepairCost(
      typeof override?.estimatedRepairCost === 'number' ? String(override.estimatedRepairCost) : '',
    )
    setAgentNotes(override?.agentNotes ?? '')
    setBanner(null)
    lastSyncedClaimIdRef.current = selectedClaim.id
  }, [claimOverrides, selectedClaim])

  const selectedPhoto =
    selectedClaim?.photos.find((photo) => photo.id === activePhotoId) ?? selectedClaim?.photos[0] ?? null
  const aiAssessment = selectedClaim ? assessmentByClaim[selectedClaim.id] : undefined
  const aiCostBand = aiAssessment ? COST_BANDS[aiAssessment.severity] : null

  const applyOverride = (claimId: string, patch: AgentClaimOverride) => {
    setClaimOverrides((current) => {
      const nextForClaim = { ...current[claimId], ...patch }
      const next = { ...current, [claimId]: nextForClaim }
      saveClaimOverride(claimId, nextForClaim)
      return next
    })
  }

  const getNormalizedCost = () => {
    if (!estimatedRepairCost.trim()) {
      return null
    }
    const parsed = Number(estimatedRepairCost)
    if (!Number.isFinite(parsed)) {
      return null
    }
    return Math.max(0, Math.round(parsed))
  }

  const handleRunAssessment = async () => {
    if (!selectedClaim) {
      return
    }

    setAssessingClaimId(selectedClaim.id)
    try {
      const seedPayload = [
        selectedClaim.id,
        selectedClaim.vehicle.make,
        selectedClaim.vehicle.model,
        selectedClaim.submittedAt,
        selectedClaim.photos[0]?.name ?? 'no-photo',
      ].join('|')
      const fakeImage = new File([seedPayload], `${selectedClaim.id}.jpg`, {
        type: 'image/jpeg',
        lastModified: Date.now(),
      })
      const result = await assessDamage(fakeImage)
      setAssessmentByClaim((current) => ({ ...current, [selectedClaim.id]: result }))

      if (selectedClaim.status === 'New') {
        applyOverride(selectedClaim.id, { status: 'In Review' })
      }
    } finally {
      setAssessingClaimId(null)
    }
  }

  const handleSaveDraft = () => {
    if (!selectedClaim) {
      return
    }
    applyOverride(selectedClaim.id, {
      status: selectedClaim.status === 'Authorized' ? 'Authorized' : 'In Review',
      estimatedRepairCost: getNormalizedCost(),
      agentNotes: agentNotes.trim(),
    })
    setBanner({ tone: 'info', message: 'Draft saved.' })
  }

  const handleApprove = () => {
    if (!selectedClaim) {
      return
    }
    applyOverride(selectedClaim.id, {
      status: 'Authorized',
      estimatedRepairCost: getNormalizedCost(),
      agentNotes: agentNotes.trim(),
      approvedAt: new Date().toISOString(),
    })
    setBanner({ tone: 'success', message: 'Authorized (Simulated senior adjuster approval)' })
  }

  const handleResetDemo = () => {
    clearAgentDemoData()
    setMostRecentSubmission(null)
    setClaimOverrides({})
    setAssessmentByClaim({})
    setAssessingClaimId(null)
    setSelectedClaimId(MOCK_CLAIMS[0]?.id ?? '')
    setActivePhotoId(null)
    setEstimatedRepairCost('')
    setAgentNotes('')
    setSearchQuery('')
    setStatusFilter('All')
    setSourceFilter('All')
    setSortOrder('newest')
    lastSyncedClaimIdRef.current = null
    setBanner({ tone: 'info', message: 'Agent demo reset to default mocked claims.' })
  }

  return (
    <div className="agent-review">
      <div className="agent-review__shell">
        <div className="agent-review__nav">
          <Link to="/" className="button button--ghost">
            ← Back to Customer Flow
          </Link>
          <button type="button" className="button button--ghost" onClick={handleResetDemo}>
            Reset Agent Demo
          </button>
        </div>

        <header className="agent-review__header">
          <div className="agent-review__headerTop">
            <img src={fenderbenderLogo} alt="FenderBender Mutual" className="agent-review__logo" />
            <div>
              <p className="agent-review__eyebrow">Claims Agent Workspace</p>
              <h1>Claims Agent Review</h1>
            </div>
          </div>
          <p className="muted">
            Manual queue triage with AI-assisted damage assessment, estimate drafting, and simulated authorization.
          </p>
        </header>

        <div className="agent-review__roles">
          <div className="agent-role-card">
            <span className="agent-pill agent-pill--ai">AI Suggested</span>
            <ul>
              <li>Damage areas</li>
              <li>Severity + confidence</li>
              <li>Suggested cost band</li>
            </ul>
          </div>
          <div className="agent-role-card">
            <span className="agent-pill agent-pill--agent">Agent Finalized</span>
            <ul>
              <li>Review claim details</li>
              <li>Edit estimate + notes</li>
              <li>Approve authorization</li>
            </ul>
          </div>
        </div>

        <div className="agent-review__grid">
          <section className="agent-queue">
            <div className="agent-queue__header">
              <h2>Claim Queue</h2>
              <p className="muted">{queueClaims.length} active claims</p>
              <label className="agent-queue__search">
                <span>Search</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Find by claim ID or vehicle"
                />
              </label>
              <div className="agent-queue__controls">
                <label className="agent-queue__control">
                  <span>Status</span>
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'All' | AgentClaimStatus)}>
                    <option value="All">All</option>
                    <option value="New">New</option>
                    <option value="In Review">In Review</option>
                    <option value="Authorized">Authorized</option>
                  </select>
                </label>
                <label className="agent-queue__control">
                  <span>Source</span>
                  <select
                    value={sourceFilter}
                    onChange={(event) => setSourceFilter(event.target.value as 'All' | 'customer_flow' | 'mock')}
                  >
                    <option value="All">All</option>
                    <option value="customer_flow">Customer flow</option>
                    <option value="mock">Mocked</option>
                  </select>
                </label>
                <label className="agent-queue__control">
                  <span>Sort</span>
                  <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value as 'newest' | 'oldest' | 'status')}>
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                    <option value="status">Status</option>
                  </select>
                </label>
              </div>
            </div>
            <div className="agent-queue__list">
              {queueClaims.map((claim) => (
                <button
                  type="button"
                  key={claim.id}
                  className={`agent-queue__item ${selectedClaimId === claim.id ? 'is-selected' : ''}`}
                  onClick={() => setSelectedClaimId(claim.id)}
                >
                  <div className="agent-queue__top">
                    <strong>{claim.id}</strong>
                    <span className={statusClassName(claim.status)}>{claim.status}</span>
                  </div>
                  {claim.queueLabel && <span className="agent-queue__label">{claim.queueLabel}</span>}
                  <p className="agent-queue__vehicle">
                    {claim.vehicle.year} {claim.vehicle.make} {claim.vehicle.model}
                  </p>
                  <p className="muted">{formatSubmittedAt(claim.submittedAt)}</p>
                </button>
              ))}
            </div>
          </section>

          <section className="agent-detail">
            {!selectedClaim ? (
              <p className="muted">No claim selected.</p>
            ) : (
              <>
                {banner && (
                  <div className={`agent-banner agent-banner--${banner.tone}`} role="status">
                    {banner.message}
                  </div>
                )}

                <div className="agent-section">
                  <h2>Claim Summary</h2>
                  <div className="agent-summary-grid">
                    <div>
                      <span className="summary__label">Claim ID</span>
                      <span className="summary__value">{selectedClaim.id}</span>
                    </div>
                    <div>
                      <span className="summary__label">Vehicle</span>
                      <span className="summary__value">
                        {selectedClaim.vehicle.year} {selectedClaim.vehicle.make} {selectedClaim.vehicle.model}
                      </span>
                    </div>
                    <div>
                      <span className="summary__label">Drivable</span>
                      <span className="summary__value">{selectedClaim.drivable === true ? 'Yes' : 'No'}</span>
                    </div>
                    <div>
                      <span className="summary__label">Other party involved</span>
                      <span className="summary__value">{selectedClaim.hasOtherParty === true ? 'Yes' : 'No'}</span>
                    </div>
                    <div>
                      <span className="summary__label">Submitted</span>
                      <span className="summary__value">{formatSubmittedAt(selectedClaim.submittedAt)}</span>
                    </div>
                    <div>
                      <span className="summary__label">Policy ID</span>
                      <span className="summary__value">{selectedClaim.policy?.policyId ?? 'Not captured'}</span>
                    </div>
                    <div>
                      <span className="summary__label">Named insured</span>
                      <span className="summary__value">{selectedClaim.policy?.insuredName ?? 'Not captured'}</span>
                    </div>
                    <div>
                      <span className="summary__label">Coverage</span>
                      <span className="summary__value">
                        {selectedClaim.policy?.coverage ? selectedClaim.policy.coverage : 'Not captured'}
                      </span>
                    </div>
                    <div>
                      <span className="summary__label">Deductible</span>
                      <span className="summary__value">
                        {typeof selectedClaim.policy?.deductible === 'number'
                          ? `$${selectedClaim.policy.deductible}`
                          : 'Not captured'}
                      </span>
                    </div>
                    <div>
                      <span className="summary__label">Rental coverage</span>
                      <span className="summary__value">
                        {selectedClaim.policy ? (selectedClaim.policy.rentalCoverage ? 'Yes' : 'No') : 'Not captured'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="agent-section">
                  <div className="agent-section__header">
                    <h2>Photo Viewer</h2>
                  </div>
                  {selectedPhoto ? (
                    <>
                      <div className="agent-photo-main">
                        <img src={selectedPhoto.url} alt={selectedPhoto.name} />
                      </div>
                      <div className="agent-photo-row">
                        {selectedClaim.photos.map((photo) => (
                          <button
                            type="button"
                            key={photo.id}
                            className={`agent-photo-thumb ${selectedPhoto.id === photo.id ? 'is-active' : ''}`}
                            onClick={() => setActivePhotoId(photo.id)}
                          >
                            <img src={photo.url} alt={photo.name} />
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="muted">No photos were attached to this claim.</p>
                  )}
                </div>

                <div className="agent-section">
                  <div className="agent-section__header">
                    <h2>AI Damage Assessment</h2>
                    <span className="agent-pill agent-pill--ai">AI Suggested</span>
                  </div>
                  <button
                    type="button"
                    className="button button--primary"
                    onClick={() => void handleRunAssessment()}
                    disabled={assessingClaimId === selectedClaim.id}
                  >
                    {assessingClaimId === selectedClaim.id
                      ? 'Assessing...'
                      : 'Run AI Damage Assessment'}
                  </button>

                  {aiAssessment && (
                    <div className="agent-ai-card">
                      <div>
                        <span className="summary__label">Damage areas</span>
                        <span className="summary__value">{aiAssessment.damageTypes.join(', ')}</span>
                      </div>
                      <div>
                        <span className="summary__label">Severity</span>
                        <span className="summary__value">{aiAssessment.severity}</span>
                      </div>
                      <div>
                        <span className="summary__label">Confidence</span>
                        <span className="summary__value">{aiAssessment.confidence}%</span>
                      </div>
                      <div>
                        <span className="summary__label">Suggested next step</span>
                        <span className="summary__value">{aiAssessment.recommendedNextStep}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="agent-section">
                  <div className="agent-section__header">
                    <h2>Estimate & Authorization</h2>
                    <span className="agent-pill agent-pill--agent">Agent Finalized</span>
                  </div>

                  <div className="agent-ai-cost">
                    <span className="summary__label">AI suggested cost band</span>
                    <span className="summary__value">
                      {aiCostBand
                        ? `$${aiCostBand.min.toLocaleString()} - $${aiCostBand.max.toLocaleString()}`
                        : 'Run AI assessment to generate'}
                    </span>
                  </div>

                  <label className="agent-field">
                    <span>Estimated Repair Cost</span>
                    <input
                      type="number"
                      min={0}
                      className="agent-input"
                      value={estimatedRepairCost}
                      onChange={(event) => setEstimatedRepairCost(event.target.value)}
                      placeholder="Enter final estimate"
                    />
                  </label>

                  <label className="agent-field">
                    <span>Agent Notes</span>
                    <textarea
                      className="agent-textarea"
                      rows={4}
                      value={agentNotes}
                      onChange={(event) => setAgentNotes(event.target.value)}
                      placeholder="Add review notes for file history"
                    />
                  </label>

                  <div className="agent-actions">
                    <button type="button" className="button button--ghost" onClick={handleSaveDraft}>
                      Save Draft
                    </button>
                    <button type="button" className="button button--primary" onClick={handleApprove}>
                      Approve & Authorize Repairs
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
