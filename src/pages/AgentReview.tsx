import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import fenderbenderLogo from '../assets/fenderbender-logo.png'
import type { Severity } from '../lib/mockAI'
import { AI_CASE_PIPELINE_STEPS, generateAICaseFileBundle } from '../agent/aiCaseFile'
import {
  appendClaimEvent,
  loadAgentClaims,
  resetAgentClaimsForDemo,
  updateClaim,
  type AgentAICaseFile,
  type AgentCaseDecision,
  type AgentCaseNextStep,
  type AgentClaim,
  type AgentClaimStatus,
} from '../agent/store'
import './AgentReview.css'

const CURRENT_AGENT_NAME = 'Alex Rivera'
const REQUESTED_SHOT_CHECKLIST = [
  'Close-up of the primary damage area',
  'Wide shot of the full vehicle',
  'Opposite-side angle for context',
  'Photo in brighter lighting',
]

const STATUS_FILTERS: Array<'All' | AgentClaimStatus> = [
  'All',
  'New',
  'In Review',
  'Needs More Photos',
  'Pending Approval',
  'Authorized',
]

const DECISION_OPTIONS: Array<{ value: AgentCaseDecision; label: string }> = [
  { value: 'Authorize', label: 'Authorize Repairs (simulated)' },
  { value: 'Needs More Photos', label: 'Request More Photos' },
  { value: 'Escalate', label: 'Escalate to Senior Adjuster (simulated)' },
]

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const formatDateTime = (value?: string) => {
  if (!value) {
    return '—'
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return parsed.toLocaleString()
}

const formatCurrency = (amount: number) => `$${Math.round(amount).toLocaleString()}`

const formatConfidence = (value: number) => `${Math.round((value <= 1 ? value : value / 100) * 100)}%`

const parseNonNegativeInteger = (value: string): number | null => {
  if (!value.trim()) {
    return null
  }
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return null
  }
  return Math.max(0, Math.round(parsed))
}

const formatDurationMs = (durationMs: number) => {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return '—'
  }
  const minutes = Math.round(durationMs / 60000)
  if (minutes < 60) {
    return `${minutes}m`
  }
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  if (hours < 24) {
    return `${hours}h ${remainder}m`
  }
  const days = Math.floor(hours / 24)
  const hoursRemainder = hours % 24
  return `${days}d ${hoursRemainder}h`
}

const hasLowConfidenceCaseFile = (caseFile: AgentAICaseFile) =>
  [
    caseFile.severity.confidence,
    caseFile.nextStep.confidence,
    caseFile.estimate.confidence,
    caseFile.duration.confidence,
    caseFile.finalRecommendation.confidence,
  ].some((confidence) => confidence < 0.6)

const statusClassName = (status: AgentClaimStatus) =>
  `agent-status agent-status--${status.toLowerCase().replace(/\s+/g, '-')}`

const decisionToStatus = (decision: AgentCaseDecision): AgentClaimStatus => {
  if (decision === 'Authorize') {
    return 'Authorized'
  }
  if (decision === 'Escalate') {
    return 'Pending Approval'
  }
  return 'Needs More Photos'
}

const humanDecisionLabel = (decision: AgentCaseDecision) =>
  DECISION_OPTIONS.find((option) => option.value === decision)?.label ?? decision

export default function AgentReview() {
  const [claims, setClaims] = useState<AgentClaim[]>(() => loadAgentClaims())
  const [selectedClaimId, setSelectedClaimId] = useState<string>(() => loadAgentClaims()[0]?.id ?? '')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'All' | AgentClaimStatus>('All')
  const [sortOrder, setSortOrder] = useState<'updated_desc' | 'updated_asc'>('updated_desc')

  const [pipeline, setPipeline] = useState<{ claimId: string; stepIndex: number } | null>(null)
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null)
  const [reviewedConfirmation, setReviewedConfirmation] = useState(false)
  const [selectedDecision, setSelectedDecision] = useState<AgentCaseDecision>('Needs More Photos')

  const [reviewSeverity, setReviewSeverity] = useState<Severity | ''>('')
  const [reviewNextStep, setReviewNextStep] = useState<AgentCaseNextStep | ''>('')
  const [reviewEstimateTotal, setReviewEstimateTotal] = useState('')
  const [reviewDurationMin, setReviewDurationMin] = useState('')
  const [reviewDurationMax, setReviewDurationMax] = useState('')
  const [reviewNotes, setReviewNotes] = useState('')
  const [reasonForChange, setReasonForChange] = useState<{
    severity?: string
    nextStep?: string
    estimate?: string
    duration?: string
    notes?: string
  }>({})

  const [banner, setBanner] = useState<{ tone: 'info' | 'success' | 'warn'; message: string } | null>(null)

  const refreshClaims = () => {
    setClaims(loadAgentClaims())
  }

  const queueClaims = useMemo(() => {
    const search = searchQuery.trim().toLowerCase()
    const filtered = claims.filter((claim) => {
      if (statusFilter !== 'All' && claim.status !== statusFilter) {
        return false
      }
      if (!search) {
        return true
      }
      const haystack = [
        claim.id,
        claim.vehicle.make,
        claim.vehicle.model,
        claim.vehicle.year,
        claim.policy?.policyId ?? '',
        claim.policy?.insuredName ?? '',
        claim.assignee ?? '',
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(search)
    })

    return [...filtered].sort((left, right) => {
      const leftMs = new Date(left.lastUpdatedAt).getTime()
      const rightMs = new Date(right.lastUpdatedAt).getTime()
      return sortOrder === 'updated_asc' ? leftMs - rightMs : rightMs - leftMs
    })
  }, [claims, searchQuery, sortOrder, statusFilter])

  useEffect(() => {
    if (queueClaims.length === 0) {
      setSelectedClaimId('')
      return
    }
    if (!queueClaims.some((claim) => claim.id === selectedClaimId)) {
      setSelectedClaimId(queueClaims[0].id)
    }
  }, [queueClaims, selectedClaimId])

  const selectedClaim = claims.find((claim) => claim.id === selectedClaimId) ?? null
  const selectedCaseFile = selectedClaim?.aiCaseFile ?? null
  const selectedPhoto =
    selectedClaim?.photos.find((photo) => photo.id === activePhotoId) ?? selectedClaim?.photos[0] ?? null

  useEffect(() => {
    if (!selectedClaim) {
      setActivePhotoId(null)
      return
    }
    if (!selectedPhoto) {
      setActivePhotoId(null)
      return
    }
    if (!activePhotoId || !selectedClaim.photos.some((photo) => photo.id === activePhotoId)) {
      setActivePhotoId(selectedPhoto.id)
    }
  }, [selectedClaim?.id, selectedClaim?.photos.length, selectedPhoto?.id, activePhotoId])

  useEffect(() => {
    if (!selectedClaim || selectedClaim.readOnlyImported || selectedClaim.openedAt) {
      return
    }
    updateClaim(selectedClaim.id, { openedAt: new Date().toISOString() })
    refreshClaims()
  }, [selectedClaim?.id])

  const resetReviewStateFromClaim = (claim: AgentClaim | null) => {
    if (!claim || !claim.aiCaseFile) {
      setReviewSeverity('')
      setReviewNextStep('')
      setReviewEstimateTotal('')
      setReviewDurationMin('')
      setReviewDurationMax('')
      setReviewNotes(claim?.agentNotes ?? '')
      setReasonForChange({})
      setReviewedConfirmation(false)
      setSelectedDecision('Needs More Photos')
      return
    }

    const decision = claim.agentDecision
    const caseFile = claim.aiCaseFile
    const lowConfidence = hasLowConfidenceCaseFile(caseFile)
    const defaultDecision = lowConfidence ? 'Needs More Photos' : caseFile.finalRecommendation.decision

    setReviewSeverity((decision?.severity ?? caseFile.severity.value) as Severity)
    setReviewNextStep((decision?.caseFileNextStep ?? caseFile.nextStep.value) as AgentCaseNextStep)
    setReviewEstimateTotal(String(decision?.estimatedRepairCost ?? caseFile.estimate.total))
    setReviewDurationMin(String(decision?.predictedDurationDaysMin ?? caseFile.duration.minDays))
    setReviewDurationMax(String(decision?.predictedDurationDaysMax ?? caseFile.duration.maxDays))
    setReviewNotes(claim.agentNotes ?? '')
    setReasonForChange({
      severity: decision?.overrideReasons?.severity,
      nextStep: decision?.overrideReasons?.nextStep,
      estimate: decision?.overrideReasons?.estimatedRepairCost,
      duration: decision?.overrideReasons?.durationRange,
      notes: decision?.overrideReasons?.notes,
    })
    setReviewedConfirmation(false)
    setSelectedDecision(decision?.decisionChoice ?? defaultDecision)
  }

  useEffect(() => {
    resetReviewStateFromClaim(selectedClaim)
  }, [selectedClaimId, selectedClaim?.lastUpdatedAt])

  const metrics = useMemo(() => {
    const counts: Record<AgentClaimStatus, number> = {
      New: 0,
      'In Review': 0,
      'Needs More Photos': 0,
      'Pending Approval': 0,
      Authorized: 0,
    }

    let overrides = 0
    let lowConfidenceCount = 0
    let lowConfidenceBase = 0
    let totalAuthorizeMs = 0
    let authorizeCount = 0

    claims.forEach((claim) => {
      counts[claim.status] += 1

      const reasonCount = claim.agentDecision?.overrideReasons
        ? Object.values(claim.agentDecision.overrideReasons).filter((value) => Boolean(value?.trim())).length
        : 0
      if (reasonCount > 0) {
        overrides += 1
      }

      if (claim.aiCaseFile) {
        lowConfidenceBase += 1
        if (hasLowConfidenceCaseFile(claim.aiCaseFile)) {
          lowConfidenceCount += 1
        }
      }

      if (claim.openedAt && claim.authorizedAt) {
        const openMs = new Date(claim.openedAt).getTime()
        const authMs = new Date(claim.authorizedAt).getTime()
        if (Number.isFinite(openMs) && Number.isFinite(authMs) && authMs > openMs) {
          totalAuthorizeMs += authMs - openMs
          authorizeCount += 1
        }
      }
    })

    return {
      counts,
      overridePercent: claims.length > 0 ? Math.round((overrides / claims.length) * 100) : 0,
      lowConfidencePercent: lowConfidenceBase > 0 ? Math.round((lowConfidenceCount / lowConfidenceBase) * 100) : 0,
      avgAuthorizeTime: authorizeCount > 0 ? formatDurationMs(totalAuthorizeMs / authorizeCount) : '—',
    }
  }, [claims])

  const parsedEstimateTotal = parseNonNegativeInteger(reviewEstimateTotal)
  const parsedDurationMin = parseNonNegativeInteger(reviewDurationMin)
  const parsedDurationMax = parseNonNegativeInteger(reviewDurationMax)
  const durationIsValid =
    parsedDurationMin !== null &&
    parsedDurationMax !== null &&
    Number.isFinite(parsedDurationMin) &&
    Number.isFinite(parsedDurationMax) &&
    parsedDurationMax >= parsedDurationMin

  const changes = useMemo(() => {
    if (!selectedCaseFile) {
      return [] as Array<{ field: 'severity' | 'nextStep' | 'estimate' | 'duration' | 'notes'; reason: string }>
    }

    const next: Array<{ field: 'severity' | 'nextStep' | 'estimate' | 'duration' | 'notes'; reason: string }> = []

    if (reviewSeverity && reviewSeverity !== selectedCaseFile.severity.value) {
      next.push({ field: 'severity', reason: reasonForChange.severity?.trim() ?? '' })
    }
    if (reviewNextStep && reviewNextStep !== selectedCaseFile.nextStep.value) {
      next.push({ field: 'nextStep', reason: reasonForChange.nextStep?.trim() ?? '' })
    }
    if (parsedEstimateTotal !== null && parsedEstimateTotal !== selectedCaseFile.estimate.total) {
      next.push({ field: 'estimate', reason: reasonForChange.estimate?.trim() ?? '' })
    }
    if (
      durationIsValid &&
      (parsedDurationMin !== selectedCaseFile.duration.minDays || parsedDurationMax !== selectedCaseFile.duration.maxDays)
    ) {
      next.push({ field: 'duration', reason: reasonForChange.duration?.trim() ?? '' })
    }
    if (reviewNotes.trim()) {
      next.push({ field: 'notes', reason: reasonForChange.notes?.trim() ?? '' })
    }

    return next
  }, [
    selectedCaseFile,
    reviewSeverity,
    reviewNextStep,
    parsedEstimateTotal,
    parsedDurationMin,
    parsedDurationMax,
    durationIsValid,
    reviewNotes,
    reasonForChange,
  ])

  const hasMissingChangeReason = changes.some((change) => !change.reason)

  const isReadOnly = Boolean(selectedClaim?.readOnlyImported || selectedClaim?.status === 'Authorized')
  const lowConfidence = selectedCaseFile ? hasLowConfidenceCaseFile(selectedCaseFile) : false
  const defaultDecision: AgentCaseDecision = selectedCaseFile
    ? lowConfidence
      ? 'Needs More Photos'
      : selectedCaseFile.finalRecommendation.decision
    : 'Needs More Photos'

  const assignSelectedClaimToMe = () => {
    if (!selectedClaim || selectedClaim.readOnlyImported || selectedClaim.assignee === CURRENT_AGENT_NAME) {
      return
    }
    updateClaim(selectedClaim.id, { assignee: CURRENT_AGENT_NAME })
    appendClaimEvent(selectedClaim.id, {
      type: 'assigned',
      message: `Claim assigned to ${CURRENT_AGENT_NAME}.`,
    })
    refreshClaims()
  }

  const handleGenerateCaseFile = async () => {
    if (!selectedClaim) {
      return
    }
    if (selectedClaim.readOnlyImported) {
      setBanner({ tone: 'info', message: 'Imported customer snapshot is read-only in agent mode.' })
      return
    }

    setBanner(null)
    setPipeline({ claimId: selectedClaim.id, stepIndex: 0 })

    try {
      for (let i = 0; i < AI_CASE_PIPELINE_STEPS.length; i += 1) {
        setPipeline({ claimId: selectedClaim.id, stepIndex: i })
        await sleep(180)
      }

      const bundle = await generateAICaseFileBundle(selectedClaim)
      const lowConfidenceRecommendation = hasLowConfidenceCaseFile(bundle.caseFile)
      const now = new Date().toISOString()

      updateClaim(selectedClaim.id, {
        status: selectedClaim.status === 'New' ? 'In Review' : selectedClaim.status,
        aiCaseFile: bundle.caseFile,
        aiAssessment: bundle.assessment,
        aiDurationPrediction: bundle.durationPrediction,
        aiSuggestedLineItems: bundle.suggestedLineItems,
        aiSignals: bundle.signals,
        aiSignalsEvaluatedAt: now,
        aiAssessedAt: now,
        agentDecision: {
          ...(selectedClaim.agentDecision ?? {}),
          severity: bundle.caseFile.severity.value,
          caseFileNextStep: bundle.caseFile.nextStep.value,
          estimatedRepairCost: bundle.caseFile.estimate.total,
          predictedDurationDaysMin: bundle.caseFile.duration.minDays,
          predictedDurationDaysMax: bundle.caseFile.duration.maxDays,
          lineItems: bundle.caseFile.estimate.lineItems,
          overrideReasons: {},
        },
      })

      appendClaimEvent(selectedClaim.id, {
        type: 'ai_case_file_generated',
        message: `Generated AI case file. Recommendation: ${bundle.caseFile.finalRecommendation.decision}.`,
      })
      if (lowConfidenceRecommendation) {
        appendClaimEvent(selectedClaim.id, {
          type: 'low_confidence_guardrail',
          message: 'Low confidence detected. Default decision set to Request More Photos.',
        })
      }

      refreshClaims()
      setSelectedDecision(lowConfidenceRecommendation ? 'Needs More Photos' : bundle.caseFile.finalRecommendation.decision)
      setReviewedConfirmation(false)
      setBanner({ tone: 'success', message: 'AI Case File generated and saved to agent storage.' })
    } finally {
      setPipeline(null)
    }
  }

  const persistHumanReview = (eventType: 'review_saved' | 'review_applied_before_decision') => {
    if (!selectedClaim || !selectedCaseFile) {
      setBanner({ tone: 'info', message: 'Generate AI Case File before saving review changes.' })
      return false
    }
    if (selectedClaim.readOnlyImported) {
      setBanner({ tone: 'info', message: 'Imported customer snapshot is read-only in agent mode.' })
      return false
    }
    if (!reviewSeverity || !reviewNextStep || parsedEstimateTotal === null || !durationIsValid || parsedDurationMin === null || parsedDurationMax === null) {
      setBanner({ tone: 'info', message: 'Complete all Human Review fields before saving.' })
      return false
    }
    if (hasMissingChangeReason) {
      setBanner({ tone: 'info', message: 'Reason for change is required for each field that differs from AI.' })
      return false
    }

    const overrideReasons: NonNullable<NonNullable<AgentClaim['agentDecision']>['overrideReasons']> = {}
    changes.forEach((change) => {
      if (!change.reason) {
        return
      }
      if (change.field === 'severity') {
        overrideReasons.severity = change.reason
      }
      if (change.field === 'nextStep') {
        overrideReasons.nextStep = change.reason
      }
      if (change.field === 'estimate') {
        overrideReasons.estimatedRepairCost = change.reason
      }
      if (change.field === 'duration') {
        overrideReasons.durationRange = change.reason
      }
      if (change.field === 'notes') {
        overrideReasons.notes = change.reason
      }
    })

    const now = new Date().toISOString()

    updateClaim(selectedClaim.id, {
      status: selectedClaim.status === 'New' ? 'In Review' : selectedClaim.status,
      draftSavedAt: now,
      agentNotes: reviewNotes,
      agentDecision: {
        ...(selectedClaim.agentDecision ?? {}),
        severity: reviewSeverity,
        caseFileNextStep: reviewNextStep,
        estimatedRepairCost: parsedEstimateTotal,
        predictedDurationDaysMin: parsedDurationMin,
        predictedDurationDaysMax: parsedDurationMax,
        lineItems: selectedCaseFile.estimate.lineItems,
        overrideReasons,
      },
    })

    appendClaimEvent(selectedClaim.id, {
      type: eventType,
      message:
        eventType === 'review_saved'
          ? `Human review saved (${changes.length} change${changes.length === 1 ? '' : 's'}).`
          : `Human review auto-saved before decision (${changes.length} change${changes.length === 1 ? '' : 's'}).`,
    })

    refreshClaims()
    return true
  }

  const handleSaveReview = () => {
    const persisted = persistHumanReview('review_saved')
    if (!persisted) {
      return
    }
    setBanner({ tone: 'success', message: 'Human review saved.' })
  }

  const handleDecisionAction = (decision: AgentCaseDecision) => {
    if (!selectedClaim || !selectedCaseFile) {
      setBanner({ tone: 'info', message: 'Generate AI Case File before taking a decision.' })
      return
    }
    if (selectedClaim.readOnlyImported) {
      setBanner({ tone: 'info', message: 'Imported customer snapshot is read-only in agent mode.' })
      return
    }
    if (!reviewedConfirmation) {
      setBanner({ tone: 'info', message: 'Confirm that you reviewed the AI Case File and changes.' })
      return
    }

    const persisted = persistHumanReview('review_applied_before_decision')
    if (!persisted) {
      return
    }

    const now = new Date().toISOString()
    const nextStatus = decisionToStatus(decision)

    updateClaim(selectedClaim.id, {
      status: nextStatus,
      submittedForApprovalAt: decision === 'Escalate' ? now : selectedClaim.submittedForApprovalAt,
      authorizedAt: decision === 'Authorize' ? now : selectedClaim.authorizedAt,
      approvedAt: decision === 'Authorize' ? now : selectedClaim.approvedAt,
      photoRequest:
        decision === 'Needs More Photos'
          ? {
              requested: true,
              requestedAt: now,
              photosReceived: false,
              checklist: REQUESTED_SHOT_CHECKLIST,
            }
          : selectedClaim.photoRequest,
      agentDecision: {
        ...(selectedClaim.agentDecision ?? {}),
        decisionChoice: decision,
        decisionConfirmedAt: now,
      },
    })

    appendClaimEvent(selectedClaim.id, {
      type: 'decision_applied',
      message: `Decision applied: ${humanDecisionLabel(decision)}. Status set to ${nextStatus}.`,
    })

    refreshClaims()
    setSelectedDecision(decision)
    setReviewedConfirmation(false)
    setBanner({ tone: 'success', message: `Decision applied: ${humanDecisionLabel(decision)}.` })
  }

  const handleResetDemo = () => {
    const nextClaims = resetAgentClaimsForDemo()
    setClaims(nextClaims)
    setSelectedClaimId(nextClaims[0]?.id ?? '')
    setSearchQuery('')
    setStatusFilter('All')
    setSortOrder('updated_desc')
    setPipeline(null)
    setBanner({ tone: 'info', message: 'Agent demo queue reset.' })
  }

  return (
    <div className="agent-review">
      <div className="agent-review__shell">
        <nav className="agent-top-links" aria-label="Top navigation">
          <span className="agent-top-links__item is-active">Claims Agent Review</span>
          <div className="agent-top-links__group">
            <Link to="/" className="agent-top-links__item">
              Customer Workflow
            </Link>
            <Link to="/" className="agent-top-links__item">
              Tow driver view
            </Link>
          </div>
        </nav>

        <header className="agent-hero">
          <div className="agent-hero__brand">
            <img src={fenderbenderLogo} alt="FenderBender Mutual" className="agent-hero__logo" />
            <div>
              <p className="agent-hero__eyebrow">Claims Agent Workspace</p>
              <h1>AI Case File Review</h1>
              <p className="muted">
                AI generates a complete recommended case package. Human agent reviews, adjusts if needed, and makes the
                final decision.
              </p>
            </div>
          </div>
          <div className="agent-hero__actions">
            <button type="button" className="button button--ghost" onClick={handleResetDemo}>
              Reset Demo
            </button>
          </div>
        </header>

        <section className="agent-metrics">
          <article className="agent-metrics__card">
            <p className="summary__label">Queue by status</p>
            <p>
              New <strong>{metrics.counts.New}</strong>
            </p>
            <p>
              In Review <strong>{metrics.counts['In Review']}</strong>
            </p>
            <p>
              Needs More Photos <strong>{metrics.counts['Needs More Photos']}</strong>
            </p>
            <p>
              Pending Approval <strong>{metrics.counts['Pending Approval']}</strong>
            </p>
            <p>
              Authorized <strong>{metrics.counts.Authorized}</strong>
            </p>
          </article>
          <article className="agent-metrics__card">
            <p className="summary__label">Average time to authorize</p>
            <p className="agent-metrics__value">{metrics.avgAuthorizeTime}</p>
          </article>
          <article className="agent-metrics__card">
            <p className="summary__label">Claims with overrides</p>
            <p className="agent-metrics__value">{metrics.overridePercent}%</p>
          </article>
          <article className="agent-metrics__card">
            <p className="summary__label">Low-confidence assessments</p>
            <p className="agent-metrics__value">{metrics.lowConfidencePercent}%</p>
          </article>
        </section>

        {banner && (
          <div
            className={`agent-banner ${
              banner.tone === 'success' ? 'agent-banner--success' : banner.tone === 'warn' ? 'agent-banner--warn' : ''
            }`}
            role="status"
          >
            {banner.message}
          </div>
        )}

        <section className="agent-layout">
          <aside className="agent-queue">
            <div className="agent-section__header">
              <h2>Claim Queue</h2>
            </div>

            <div className="agent-controls">
              <label className="agent-field">
                <span>Search</span>
                <input
                  type="text"
                  className="agent-input"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Claim id, vehicle, policy, assignee"
                />
              </label>
              <label className="agent-field">
                <span>Status</span>
                <select
                  className="agent-input"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as 'All' | AgentClaimStatus)}
                >
                  {STATUS_FILTERS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <label className="agent-field">
                <span>Sort</span>
                <select
                  className="agent-input"
                  value={sortOrder}
                  onChange={(event) => setSortOrder(event.target.value as 'updated_desc' | 'updated_asc')}
                >
                  <option value="updated_desc">Last updated (newest)</option>
                  <option value="updated_asc">Last updated (oldest)</option>
                </select>
              </label>
            </div>

            <div className="agent-queue__list">
              {queueClaims.map((claim) => (
                <button
                  key={claim.id}
                  type="button"
                  className={`agent-queue__item ${selectedClaimId === claim.id ? 'is-active' : ''}`}
                  onClick={() => setSelectedClaimId(claim.id)}
                >
                  <div className="agent-queue__row">
                    <strong>{claim.id}</strong>
                    <span className={statusClassName(claim.status)}>{claim.status}</span>
                  </div>
                  <p>
                    {claim.vehicle.year} {claim.vehicle.make} {claim.vehicle.model}
                  </p>
                  <p className="muted">Assignee: {claim.assignee ?? 'Unassigned'}</p>
                  <p className="muted">Updated: {formatDateTime(claim.lastUpdatedAt)}</p>
                </button>
              ))}
              {queueClaims.length === 0 && <p className="muted">No claims match current filters.</p>}
            </div>
          </aside>

          <section className="agent-detail">
            {!selectedClaim && <p className="muted">Select a claim to start review.</p>}

            {selectedClaim && (
              <>
                <div className="agent-card">
                  <div className="agent-section__header">
                    <h2>Claim Summary</h2>
                    <div className="agent-actions">
                      <button
                        type="button"
                        className="button button--ghost"
                        onClick={assignSelectedClaimToMe}
                        disabled={selectedClaim.readOnlyImported || selectedClaim.assignee === CURRENT_AGENT_NAME}
                      >
                        {selectedClaim.assignee === CURRENT_AGENT_NAME ? 'Assigned to me' : 'Assign to me'}
                      </button>
                    </div>
                  </div>

                  <div className="summary-grid">
                    <div>
                      <span className="summary__label">Claim</span>
                      <span className="summary__value">{selectedClaim.id}</span>
                    </div>
                    <div>
                      <span className="summary__label">Vehicle</span>
                      <span className="summary__value">
                        {selectedClaim.vehicle.year} {selectedClaim.vehicle.make} {selectedClaim.vehicle.model}
                      </span>
                    </div>
                    <div>
                      <span className="summary__label">Policy</span>
                      <span className="summary__value">{selectedClaim.policy?.policyId ?? 'N/A'}</span>
                    </div>
                    <div>
                      <span className="summary__label">Submitted</span>
                      <span className="summary__value">{formatDateTime(selectedClaim.submittedAt)}</span>
                    </div>
                    <div>
                      <span className="summary__label">Drivable</span>
                      <span className="summary__value">
                        {selectedClaim.drivable === null ? 'Unknown' : selectedClaim.drivable ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div>
                      <span className="summary__label">Other party</span>
                      <span className="summary__value">
                        {selectedClaim.hasOtherParty === null ? 'Unknown' : selectedClaim.hasOtherParty ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </div>

                  {selectedClaim.photos.length > 0 && (
                    <>
                      <div className="agent-photo-viewer">
                        {selectedPhoto && <img src={selectedPhoto.url} alt={selectedPhoto.name} />}
                      </div>
                      <div className="agent-photo-strip">
                        {selectedClaim.photos.map((photo) => (
                          <button
                            key={photo.id}
                            type="button"
                            className={`agent-photo-thumb ${selectedPhoto?.id === photo.id ? 'is-active' : ''}`}
                            onClick={() => setActivePhotoId(photo.id)}
                          >
                            <img src={photo.url} alt={photo.name} />
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <div className="agent-card">
                  <div className="agent-section__header">
                    <h2>AI Case File</h2>
                    <button
                      type="button"
                      className="button button--primary"
                      onClick={handleGenerateCaseFile}
                      disabled={Boolean(pipeline && pipeline.claimId === selectedClaim.id) || selectedClaim.readOnlyImported}
                    >
                      {selectedCaseFile ? 'Regenerate AI Case File' : 'Generate AI Case File'}
                    </button>
                  </div>

                  {pipeline && pipeline.claimId === selectedClaim.id && (
                    <div className="agent-pipeline">
                      <p className="summary__label">AI pipeline running</p>
                      <ol>
                        {AI_CASE_PIPELINE_STEPS.map((step, index) => (
                          <li
                            key={step}
                            className={
                              index < pipeline.stepIndex ? 'is-complete' : index === pipeline.stepIndex ? 'is-active' : ''
                            }
                          >
                            {step}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {!selectedCaseFile && !pipeline && (
                    <p className="muted">Generate the AI Case File to produce one complete recommendation package.</p>
                  )}

                  {selectedCaseFile && (
                    <div className="agent-case-grid">
                      <article className="agent-case-card">
                        <h3>Damage summary</h3>
                        <p>Impacted areas: {selectedCaseFile.damageSummary.impactedAreas.join(', ') || 'None detected'}</p>
                        <p>Photos reviewed: {selectedCaseFile.damageSummary.photoCount}</p>
                      </article>

                      <article className="agent-case-card">
                        <h3>Severity</h3>
                        <p>
                          <strong>{selectedCaseFile.severity.value}</strong> ({formatConfidence(selectedCaseFile.severity.confidence)})
                        </p>
                        <p className="muted">{selectedCaseFile.severity.explanation}</p>
                      </article>

                      <article className="agent-case-card">
                        <h3>Recommended next step</h3>
                        <p>
                          <strong>{selectedCaseFile.nextStep.value}</strong> ({formatConfidence(selectedCaseFile.nextStep.confidence)})
                        </p>
                        <p className="muted">{selectedCaseFile.nextStep.explanation}</p>
                      </article>

                      <article className="agent-case-card">
                        <h3>Estimate</h3>
                        <p>
                          Cost band: {formatCurrency(selectedCaseFile.estimate.costBand.min)} -{' '}
                          {formatCurrency(selectedCaseFile.estimate.costBand.max)}
                        </p>
                        <p>
                          AI line-item total: <strong>{formatCurrency(selectedCaseFile.estimate.total)}</strong> (
                          {formatConfidence(selectedCaseFile.estimate.confidence)})
                        </p>
                        <p className="muted">{selectedCaseFile.estimate.explanation}</p>
                        <div className="agent-line-items">
                          {selectedCaseFile.estimate.lineItems.map((line) => (
                            <p key={line.id}>
                              {line.description} ({line.category}) - {formatCurrency(line.amount)}
                            </p>
                          ))}
                        </div>
                      </article>

                      <article className="agent-case-card">
                        <h3>Duration</h3>
                        <p>
                          {selectedCaseFile.duration.minDays}-{selectedCaseFile.duration.maxDays} days (
                          {formatConfidence(selectedCaseFile.duration.confidence)})
                        </p>
                        <p className="muted">{selectedCaseFile.duration.explanation}</p>
                      </article>

                      <article className="agent-case-card">
                        <h3>Similar claims</h3>
                        <p className="muted">Based on AI-detected damage pattern</p>
                        {selectedCaseFile.similarClaims.typicalCostRange && (
                          <p>
                            Typical range: {formatCurrency(selectedCaseFile.similarClaims.typicalCostRange.min)} -{' '}
                            {formatCurrency(selectedCaseFile.similarClaims.typicalCostRange.max)}
                          </p>
                        )}
                        <div className="agent-line-items">
                          {selectedCaseFile.similarClaims.matches.map((match) => (
                            <p key={match.id}>
                              {match.vehicleMake} {match.vehicleModel} / {match.severity} / {formatCurrency(match.finalRepairCost)}
                            </p>
                          ))}
                        </div>
                      </article>

                      <article className="agent-case-card">
                        <h3>AI signals</h3>
                        {selectedCaseFile.signals.length === 0 ? (
                          <p className="muted">No anomaly / needs-review signals.</p>
                        ) : (
                          <div className="agent-line-items">
                            {selectedCaseFile.signals.map((signal) => (
                              <p key={signal.id}>
                                <strong>{signal.severity}:</strong> {signal.title}
                              </p>
                            ))}
                          </div>
                        )}
                      </article>

                      <article className="agent-case-card">
                        <h3>Final AI recommendation</h3>
                        <p>
                          <strong>{selectedCaseFile.finalRecommendation.decision}</strong> (
                          {formatConfidence(selectedCaseFile.finalRecommendation.confidence)})
                        </p>
                        <p className="muted">{selectedCaseFile.finalRecommendation.explanation}</p>
                        <p className="muted">Generated at {formatDateTime(selectedCaseFile.createdAt)}</p>
                      </article>
                    </div>
                  )}
                </div>

                {selectedCaseFile && (
                  <>
                    <div className="agent-card">
                      <div className="agent-section__header">
                        <h2>Human Review</h2>
                        <button
                          type="button"
                          className="button button--ghost"
                          onClick={handleSaveReview}
                          disabled={isReadOnly}
                        >
                          Save Review
                        </button>
                      </div>

                      <div className="human-review-grid">
                        <label className="agent-field">
                          <span>Severity</span>
                          <select
                            className="agent-input"
                            value={reviewSeverity}
                            onChange={(event) => setReviewSeverity(event.target.value as Severity)}
                            disabled={isReadOnly}
                          >
                            <option value="">Select severity</option>
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                          </select>
                        </label>

                        <label className="agent-field">
                          <span>Next step</span>
                          <select
                            className="agent-input"
                            value={reviewNextStep}
                            onChange={(event) => setReviewNextStep(event.target.value as AgentCaseNextStep)}
                            disabled={isReadOnly}
                          >
                            <option value="">Select next step</option>
                            <option value="Tow">Tow</option>
                            <option value="Repair">Repair</option>
                            <option value="Inspection">Inspection</option>
                          </select>
                        </label>

                        <label className="agent-field">
                          <span>Final estimate total</span>
                          <input
                            type="number"
                            min={0}
                            className="agent-input"
                            value={reviewEstimateTotal}
                            onChange={(event) => setReviewEstimateTotal(event.target.value)}
                            disabled={isReadOnly}
                          />
                        </label>

                        <div className="human-review-grid__duration">
                          <label className="agent-field">
                            <span>Duration min (days)</span>
                            <input
                              type="number"
                              min={0}
                              className="agent-input"
                              value={reviewDurationMin}
                              onChange={(event) => setReviewDurationMin(event.target.value)}
                              disabled={isReadOnly}
                            />
                          </label>
                          <label className="agent-field">
                            <span>Duration max (days)</span>
                            <input
                              type="number"
                              min={0}
                              className="agent-input"
                              value={reviewDurationMax}
                              onChange={(event) => setReviewDurationMax(event.target.value)}
                              disabled={isReadOnly}
                            />
                          </label>
                        </div>

                        <label className="agent-field">
                          <span>Agent notes</span>
                          <textarea
                            className="agent-textarea"
                            rows={3}
                            value={reviewNotes}
                            onChange={(event) => setReviewNotes(event.target.value)}
                            disabled={isReadOnly}
                          />
                        </label>
                      </div>

                      {!durationIsValid && (reviewDurationMin.trim() || reviewDurationMax.trim()) && (
                        <p className="muted">Duration min/max must be valid and min must be less than or equal to max.</p>
                      )}

                      {changes.length > 0 && (
                        <div className="agent-changes">
                          <h3>Changes</h3>
                          {changes.map((change) => (
                            <label key={change.field} className="agent-field">
                              <span>
                                {change.field === 'severity'
                                  ? 'Severity'
                                  : change.field === 'nextStep'
                                    ? 'Next step'
                                    : change.field === 'estimate'
                                      ? 'Final estimate total'
                                      : change.field === 'duration'
                                        ? 'Duration range'
                                        : 'Notes'}{' '}
                                changed: reason required
                              </span>
                              <textarea
                                className="agent-textarea"
                                rows={2}
                                value={
                                  change.field === 'severity'
                                    ? reasonForChange.severity ?? ''
                                    : change.field === 'nextStep'
                                      ? reasonForChange.nextStep ?? ''
                                      : change.field === 'estimate'
                                        ? reasonForChange.estimate ?? ''
                                        : change.field === 'duration'
                                          ? reasonForChange.duration ?? ''
                                          : reasonForChange.notes ?? ''
                                }
                                onChange={(event) =>
                                  setReasonForChange((current) => ({
                                    ...current,
                                    [change.field]: event.target.value,
                                  }))
                                }
                                disabled={isReadOnly}
                                placeholder="Reason for change"
                              />
                            </label>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="agent-card">
                      <h2>Decision</h2>

                      <div className="agent-disclosure">
                        AI provides recommendations. Human agent is accountable for the final decision.
                      </div>

                      {lowConfidence && (
                        <div className="agent-banner agent-banner--warn" role="alert">
                          One or more AI confidence signals are below 0.6. Default decision is set to Request More
                          Photos.
                        </div>
                      )}

                      <p className="muted">
                        Default recommendation: <strong>{humanDecisionLabel(defaultDecision)}</strong>
                      </p>

                      <div className="agent-decision-options">
                        {DECISION_OPTIONS.map((option) => (
                          <label key={option.value} className="agent-radio">
                            <input
                              type="radio"
                              name="agent-decision"
                              value={option.value}
                              checked={selectedDecision === option.value}
                              onChange={() => setSelectedDecision(option.value)}
                              disabled={isReadOnly}
                            />
                            <span>{option.label}</span>
                          </label>
                        ))}
                      </div>

                      <label className="agent-checkbox">
                        <input
                          type="checkbox"
                          checked={reviewedConfirmation}
                          onChange={(event) => setReviewedConfirmation(event.target.checked)}
                          disabled={isReadOnly}
                        />
                        <span>Reviewed AI Case File and changes</span>
                      </label>

                      <div className="agent-actions">
                        <button
                          type="button"
                          className={`button ${selectedDecision === 'Authorize' ? 'button--primary' : 'button--ghost'}`}
                          onClick={() => handleDecisionAction('Authorize')}
                          disabled={isReadOnly}
                        >
                          Authorize Repairs (simulated)
                        </button>
                        <button
                          type="button"
                          className={`button ${selectedDecision === 'Needs More Photos' ? 'button--primary' : 'button--ghost'}`}
                          onClick={() => handleDecisionAction('Needs More Photos')}
                          disabled={isReadOnly}
                        >
                          Request More Photos
                        </button>
                        <button
                          type="button"
                          className={`button ${selectedDecision === 'Escalate' ? 'button--primary' : 'button--ghost'}`}
                          onClick={() => handleDecisionAction('Escalate')}
                          disabled={isReadOnly}
                        >
                          Escalate to Senior Adjuster (simulated)
                        </button>
                      </div>
                    </div>
                  </>
                )}

                <div className="agent-card">
                  <h2>Activity Timeline</h2>
                  <div className="agent-timeline">
                    {[...selectedClaim.events]
                      .sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime())
                      .map((event) => (
                        <article key={event.id} className="agent-timeline__item">
                          <p>
                            <strong>{event.type}</strong>
                          </p>
                          <p>{event.message}</p>
                          <p className="muted">{formatDateTime(event.at)}</p>
                        </article>
                      ))}
                  </div>
                </div>
              </>
            )}
          </section>
        </section>
      </div>
    </div>
  )
}
