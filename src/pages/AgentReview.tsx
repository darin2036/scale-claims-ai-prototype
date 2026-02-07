import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import fenderbenderLogo from '../assets/fenderbender-logo.png'
import { assessDamage, type RecommendedNextStep, type Severity } from '../lib/mockAI'
import {
  appendClaimEvent,
  type AgentClaimStatus,
  loadAgentClaims,
  resetAgentClaimsForDemo,
  updateClaim,
  type AgentClaim,
  type AgentDecision,
  type AgentEstimateCategory,
  type AgentEstimateLineItem,
} from '../agent/store'
import { findComparableClaims, type ComparableClaimMatch } from '../agent/comparableClaims'
import './AgentReview.css'

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

const formatDurationMs = (durationMs: number) => {
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return '—'
  }
  const minutes = Math.round(durationMs / 60000)
  if (minutes < 60) {
    return `${minutes} min`
  }
  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60
  if (hours < 24) {
    return `${hours}h ${remaining}m`
  }
  const days = Math.floor(hours / 24)
  const hoursLeft = hours % 24
  return `${days}d ${hoursLeft}h`
}

const formatDuration = (start?: string, end?: string) => {
  if (!start || !end) {
    return '—'
  }
  const startMs = new Date(start).getTime()
  const endMs = new Date(end).getTime()
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    return '—'
  }
  return formatDurationMs(endMs - startMs)
}

const statusClassName = (status: AgentClaimStatus) =>
  `agent-status agent-status--${status.toLowerCase().replace(/\s+/g, '-')}`

const CURRENT_AGENT_NAME = 'Alex Rivera'
const REQUESTED_SHOT_CHECKLIST = [
  'Close-up of the primary damage area',
  'Wide shot of the full vehicle',
  'Opposite-side angle for context',
  'Photo in brighter lighting',
  'Photo including nearby reference point (curb/line)',
]
const ESTIMATE_CATEGORIES: AgentEstimateCategory[] = ['Parts', 'Labor', 'Paint', 'Misc']
const toNormalizedConfidence = (confidence: number) => (confidence <= 1 ? confidence : confidence / 100)
const createEmptyLineItem = (): AgentEstimateLineItem => ({
  id: `${Date.now()}-${Math.round(Math.random() * 10_000)}`,
  description: '',
  category: 'Misc',
  amount: 0,
})
const sanitizeAmount = (value: string): number => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return 0
  }
  return Math.max(0, Math.round(parsed))
}

export default function AgentReview() {
  const [claims, setClaims] = useState<AgentClaim[]>(() => loadAgentClaims())
  const [assessingClaimId, setAssessingClaimId] = useState<string | null>(null)
  const [banner, setBanner] = useState<{ tone: 'info' | 'success'; message: string } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'All' | AgentClaimStatus>('All')
  const [sourceFilter, setSourceFilter] = useState<'All' | 'customer_flow' | 'mock'>('All')
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'status'>('newest')

  const [selectedClaimId, setSelectedClaimId] = useState<string>(() => loadAgentClaims()[0]?.id ?? '')
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null)
  const [agentFinalSeverity, setAgentFinalSeverity] = useState<Severity | ''>('')
  const [agentFinalNextStep, setAgentFinalNextStep] = useState<RecommendedNextStep | ''>('')
  const [lineItems, setLineItems] = useState<AgentEstimateLineItem[]>([])
  const [estimatedRepairCost, setEstimatedRepairCost] = useState('')
  const [finalEstimateManuallyEdited, setFinalEstimateManuallyEdited] = useState(false)
  const [agentNotes, setAgentNotes] = useState('')
  const [seniorAdjusterReviewed, setSeniorAdjusterReviewed] = useState(false)
  const [seniorAdjusterNote, setSeniorAdjusterNote] = useState('')
  const [comparableRefreshTick, setComparableRefreshTick] = useState(0)
  const [overrideReasons, setOverrideReasons] = useState<{
    severity?: string
    recommendedNextStep?: string
    estimatedRepairCost?: string
    finalEstimateVsTotal?: string
  }>({})

  const queueClaims = useMemo(() => {
    const filtered = claims.filter((claim) => {
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
      'Needs More Photos': 2,
      'Pending Approval': 3,
      Authorized: 4,
    }

    return [...filtered].sort((a, b) => {
      const timeA = new Date(a.lastUpdatedAt).getTime()
      const timeB = new Date(b.lastUpdatedAt).getTime()

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
  }, [claims, searchQuery, sortOrder, sourceFilter, statusFilter])

  const metrics = useMemo(() => {
    const counts: Record<AgentClaimStatus, number> = {
      New: 0,
      'In Review': 0,
      'Needs More Photos': 0,
      'Pending Approval': 0,
      Authorized: 0,
    }
    let overrideCount = 0
    let lowConfidenceCount = 0
    let authorizedWithTiming = 0
    let totalAuthorizeMs = 0

    claims.forEach((claim) => {
      counts[claim.status] += 1
      if (claim.agentDecision?.overrideReasons && Object.keys(claim.agentDecision.overrideReasons).length > 0) {
        overrideCount += 1
      }
      const confidence = claim.aiAssessment?.confidence
      if (typeof confidence === 'number') {
        const normalized = toNormalizedConfidence(confidence)
        if (normalized < 0.6) {
          lowConfidenceCount += 1
        }
      }
      if (claim.authorizedAt && claim.openedAt) {
        const openMs = new Date(claim.openedAt).getTime()
        const authMs = new Date(claim.authorizedAt).getTime()
        if (Number.isFinite(openMs) && Number.isFinite(authMs) && authMs >= openMs) {
          totalAuthorizeMs += authMs - openMs
          authorizedWithTiming += 1
        }
      }
    })

    const totalClaims = claims.length
    const totalAssessed = claims.filter((claim) => claim.aiAssessment).length
    const overridePercent = totalClaims > 0 ? Math.round((overrideCount / totalClaims) * 100) : 0
    const lowConfidencePercent = totalAssessed > 0 ? Math.round((lowConfidenceCount / totalAssessed) * 100) : 0
    const avgAuthorizeMs = authorizedWithTiming > 0 ? totalAuthorizeMs / authorizedWithTiming : null

    return {
      counts,
      overridePercent,
      lowConfidencePercent,
      avgAuthorizeMs,
    }
  }, [claims])

  useEffect(() => {
    if (!queueClaims.some((claim) => claim.id === selectedClaimId) && queueClaims[0]) {
      setSelectedClaimId(queueClaims[0].id)
    }
  }, [queueClaims, selectedClaimId])

  const selectedClaim = claims.find((claim) => claim.id === selectedClaimId) ?? null

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
      return
    }
    const aiSuggestedSeverity = selectedClaim.aiAssessment?.severity
    const aiSuggestedNextStep = selectedClaim.aiAssessment?.recommendedNextStep
    const aiSuggestedCostBand = aiSuggestedSeverity ? COST_BANDS[aiSuggestedSeverity] : null
    const aiSuggestedCost =
      aiSuggestedCostBand ? Math.round((aiSuggestedCostBand.min + aiSuggestedCostBand.max) / 2) : null
    const decision = selectedClaim.agentDecision
    const nextLineItems =
      decision?.lineItems && decision.lineItems.length > 0
        ? decision.lineItems
        : aiSuggestedCost !== null
          ? [
              {
                id: 'seed-ai-estimate',
                description: 'Initial AI estimate',
                category: 'Labor' as AgentEstimateCategory,
                amount: aiSuggestedCost,
              },
            ]
          : [createEmptyLineItem()]
    const nextLineItemsTotal = nextLineItems.reduce((sum, item) => sum + (item.amount || 0), 0)
    setAgentFinalSeverity((decision?.severity ?? aiSuggestedSeverity ?? '') as Severity | '')
    setAgentFinalNextStep((decision?.recommendedNextStep ?? aiSuggestedNextStep ?? '') as RecommendedNextStep | '')
    setLineItems(nextLineItems)
    setEstimatedRepairCost(
      typeof decision?.estimatedRepairCost === 'number'
        ? String(decision.estimatedRepairCost)
        : String(nextLineItemsTotal),
    )
    setFinalEstimateManuallyEdited(
      typeof decision?.estimatedRepairCost === 'number' && decision.estimatedRepairCost !== nextLineItemsTotal,
    )
    setOverrideReasons(decision?.overrideReasons ?? {})
    setAgentNotes(selectedClaim.agentNotes ?? '')
    setSeniorAdjusterReviewed(Boolean(selectedClaim.seniorApproval?.reviewed))
    setSeniorAdjusterNote(selectedClaim.seniorApproval?.note ?? '')
    setBanner(null)
  }, [selectedClaimId])

  const selectedPhoto =
    selectedClaim?.photos.find((photo) => photo.id === activePhotoId) ?? selectedClaim?.photos[0] ?? null
  const aiAssessment = selectedClaim?.aiAssessment
  const comparableSeverity = (agentFinalSeverity || aiAssessment?.severity || null) as Severity | null
  const aiConfidenceNormalized = aiAssessment ? toNormalizedConfidence(aiAssessment.confidence) : null
  const isLowConfidence = aiConfidenceNormalized !== null && aiConfidenceNormalized < 0.6
  const aiCostBand = aiAssessment ? COST_BANDS[aiAssessment.severity] : null
  const aiSuggestedEstimate = aiCostBand ? Math.round((aiCostBand.min + aiCostBand.max) / 2) : null
  const comparableClaims = useMemo<ComparableClaimMatch[]>(() => {
    if (!selectedClaim || !aiAssessment || !comparableSeverity) {
      return []
    }
    return findComparableClaims(
      {
        vehicleMake: selectedClaim.vehicle.make,
        vehicleModel: selectedClaim.vehicle.model,
        severity: comparableSeverity,
        damageAreas: aiAssessment.damageTypes,
      },
      5,
    )
  }, [
    aiAssessment?.damageTypes.join('|'),
    aiAssessment?.severity,
    comparableRefreshTick,
    comparableSeverity,
    selectedClaim?.id,
    selectedClaim?.vehicle.make,
    selectedClaim?.vehicle.model,
  ])
  const comparableCostRange =
    comparableClaims.length > 0
      ? {
          min: Math.min(...comparableClaims.map((claim) => claim.finalRepairCost)),
          max: Math.max(...comparableClaims.map((claim) => claim.finalRepairCost)),
        }
      : null
  const lineItemsTotal = lineItems.reduce((sum, item) => sum + (item.amount || 0), 0)
  const normalizedEstimate = (() => {
    if (!estimatedRepairCost.trim()) {
      return null
    }
    const parsed = Number(estimatedRepairCost)
    if (!Number.isFinite(parsed)) {
      return null
    }
    return Math.max(0, Math.round(parsed))
  })()
  const severityOverridden = Boolean(aiAssessment && agentFinalSeverity && agentFinalSeverity !== aiAssessment.severity)
  const nextStepOverridden = Boolean(
    aiAssessment && agentFinalNextStep && agentFinalNextStep !== aiAssessment.recommendedNextStep,
  )
  const estimateOverridden = Boolean(
    aiSuggestedEstimate !== null && normalizedEstimate !== null && normalizedEstimate !== aiSuggestedEstimate,
  )
  const finalEstimateDiffRatio =
    normalizedEstimate !== null && lineItemsTotal > 0
      ? Math.abs(normalizedEstimate - lineItemsTotal) / lineItemsTotal
      : 0
  const finalEstimateDiffOverThreshold = Boolean(
    normalizedEstimate !== null && lineItemsTotal > 0 && finalEstimateDiffRatio > 0.1,
  )
  const overrideSummary: Array<{ field: string; reason: string }> = [
    severityOverridden
      ? {
          field: 'Severity',
          reason: overrideReasons.severity?.trim() || 'Reason required',
        }
      : null,
    nextStepOverridden
      ? {
          field: 'Recommended Next Step',
          reason: overrideReasons.recommendedNextStep?.trim() || 'Reason required',
        }
      : null,
    estimateOverridden
      ? {
          field: 'Estimate',
          reason: overrideReasons.estimatedRepairCost?.trim() || 'Reason required',
        }
      : null,
    finalEstimateDiffOverThreshold
      ? {
          field: 'Final Estimate vs Line-Item Total',
          reason: overrideReasons.finalEstimateVsTotal?.trim() || 'Reason required',
        }
      : null,
  ].filter((item): item is { field: string; reason: string } => item !== null)
  const isImportedReadOnly = Boolean(selectedClaim?.readOnlyImported)
  const isPendingApproval = selectedClaim?.status === 'Pending Approval'
  const isAuthorized = selectedClaim?.status === 'Authorized'
  const isEditLocked = Boolean(isImportedReadOnly || isPendingApproval || isAuthorized)
  const isSeniorPanelLocked = Boolean(isImportedReadOnly || isAuthorized)
  const photoRequest = selectedClaim?.photoRequest

  useEffect(() => {
    if (!finalEstimateManuallyEdited) {
      setEstimatedRepairCost(String(lineItemsTotal))
    }
  }, [finalEstimateManuallyEdited, lineItemsTotal])

  const refreshClaims = () => {
    setClaims(loadAgentClaims())
  }

  useEffect(() => {
    if (!selectedClaim) {
      return
    }
    if (selectedClaim.readOnlyImported || selectedClaim.openedAt) {
      return
    }
    updateClaim(selectedClaim.id, { openedAt: new Date().toISOString() })
    refreshClaims()
  }, [selectedClaim?.id])

  const getReadOnlyMessage = (claim: AgentClaim) => {
    if (claim.readOnlyImported) {
      return 'Imported customer claim is read-only in agent mode.'
    }
    if (claim.status === 'Pending Approval') {
      return 'Claim is locked while pending senior adjuster review.'
    }
    if (claim.status === 'Authorized') {
      return 'Authorized claims are read-only.'
    }
    return null
  }

  const guardEditableClaim = (claim: AgentClaim | null) => {
    if (!claim) {
      return null
    }
    const readOnlyMessage = getReadOnlyMessage(claim)
    if (readOnlyMessage) {
      setBanner({ tone: 'info', message: readOnlyMessage })
      return null
    }
    return claim
  }

  const handleAddLineItem = () => {
    if (!guardEditableClaim(selectedClaim)) {
      return
    }
    setLineItems((current) => {
      if (current.length >= 8) {
        setBanner({ tone: 'info', message: 'You can add up to 8 line items.' })
        return current
      }
      return [...current, createEmptyLineItem()]
    })
  }

  const handleRemoveLineItem = (id: string) => {
    if (!guardEditableClaim(selectedClaim)) {
      return
    }
    setLineItems((current) => {
      const next = current.filter((item) => item.id !== id)
      if (next.length === 0) {
        return [createEmptyLineItem()]
      }
      return next
    })
  }

  const handleUpdateLineItem = (
    id: string,
    patch: Partial<Pick<AgentEstimateLineItem, 'description' | 'category' | 'amount'>>,
  ) => {
    if (!guardEditableClaim(selectedClaim)) {
      return
    }
    setLineItems((current) =>
      current.map((item) => {
        if (item.id !== id) {
          return item
        }
        return { ...item, ...patch }
      }),
    )
  }

  const hasMissingOverrideReason = () => {
    if (severityOverridden && !overrideReasons.severity?.trim()) {
      return true
    }
    if (nextStepOverridden && !overrideReasons.recommendedNextStep?.trim()) {
      return true
    }
    if (estimateOverridden && !overrideReasons.estimatedRepairCost?.trim()) {
      return true
    }
    if (finalEstimateDiffOverThreshold && !overrideReasons.finalEstimateVsTotal?.trim()) {
      return true
    }
    return false
  }

  const buildAgentDecision = (): AgentDecision => {
    const nextDecision: AgentDecision = {
      severity: (agentFinalSeverity || aiAssessment?.severity) as Severity | undefined,
      recommendedNextStep: (agentFinalNextStep || aiAssessment?.recommendedNextStep) as
        | RecommendedNextStep
        | undefined,
      estimatedRepairCost: normalizedEstimate,
      lineItems,
    }

    const nextOverrideReasons: NonNullable<AgentDecision['overrideReasons']> = {}
    if (severityOverridden && overrideReasons.severity?.trim()) {
      nextOverrideReasons.severity = overrideReasons.severity.trim()
    }
    if (nextStepOverridden && overrideReasons.recommendedNextStep?.trim()) {
      nextOverrideReasons.recommendedNextStep = overrideReasons.recommendedNextStep.trim()
    }
    if (estimateOverridden && overrideReasons.estimatedRepairCost?.trim()) {
      nextOverrideReasons.estimatedRepairCost = overrideReasons.estimatedRepairCost.trim()
    }
    if (finalEstimateDiffOverThreshold && overrideReasons.finalEstimateVsTotal?.trim()) {
      nextOverrideReasons.finalEstimateVsTotal = overrideReasons.finalEstimateVsTotal.trim()
    }

    if (Object.keys(nextOverrideReasons).length > 0) {
      nextDecision.overrideReasons = nextOverrideReasons
    }
    return nextDecision
  }

  const handleRunAssessment = async () => {
    const editableClaim = guardEditableClaim(selectedClaim)
    if (!editableClaim) {
      return
    }

    setAssessingClaimId(editableClaim.id)
    try {
      const seedPayload = [
        editableClaim.id,
        editableClaim.vehicle.make,
        editableClaim.vehicle.model,
        editableClaim.submittedAt,
        editableClaim.photos[0]?.name ?? 'no-photo',
      ].join('|')
      const fakeImage = new File([seedPayload], `${editableClaim.id}.jpg`, {
        type: 'image/jpeg',
        lastModified: Date.now(),
      })
      const result = await assessDamage(fakeImage)
      const normalizedConfidence = toNormalizedConfidence(result.confidence)
      const lowConfidence = normalizedConfidence < 0.6

      const nextStatus =
        lowConfidence
          ? 'Needs More Photos'
          : editableClaim.status === 'New' || editableClaim.status === 'Needs More Photos'
            ? 'In Review'
            : editableClaim.status

    updateClaim(editableClaim.id, {
      aiAssessment: result,
      status: nextStatus,
      aiAssessedAt: new Date().toISOString(),
      photoRequest: lowConfidence
        ? {
              requested: true,
              requestedAt: new Date().toISOString(),
              photosReceived: false,
              checklist: REQUESTED_SHOT_CHECKLIST,
            }
          : editableClaim.photoRequest,
      })
      appendClaimEvent(editableClaim.id, {
        type: 'ai_assessment',
        message: `AI assessment run: ${result.severity} severity at ${result.confidence}% confidence. Status: ${nextStatus}.`,
      })
      if (lowConfidence) {
        appendClaimEvent(editableClaim.id, {
          type: 'guardrail_low_confidence',
          message: 'Confidence below 0.6. Default recommendation set to Needs More Photos.',
        })
      }
      refreshClaims()
      setAgentFinalSeverity((current) => current || result.severity)
      setAgentFinalNextStep((current) => current || result.recommendedNextStep)
    } finally {
      setAssessingClaimId(null)
    }
  }

  const handleSaveDraft = () => {
    const editableClaim = guardEditableClaim(selectedClaim)
    if (!editableClaim) {
      return
    }
    if (hasMissingOverrideReason()) {
      setBanner({ tone: 'info', message: 'Reason for override is required for all changed AI-suggested fields.' })
      return
    }

    updateClaim(editableClaim.id, {
      status:
        editableClaim.status === 'New' || editableClaim.status === 'Needs More Photos'
          ? 'In Review'
          : editableClaim.status,
      agentDecision: buildAgentDecision(),
      agentNotes: agentNotes.trim(),
      draftSavedAt: new Date().toISOString(),
    })
    appendClaimEvent(editableClaim.id, {
      type: 'draft_saved',
      message: 'Agent draft saved.',
    })
    refreshClaims()
    setBanner({ tone: 'info', message: 'Draft saved.' })
  }

  const handleApprove = () => {
    if (!selectedClaim) {
      return
    }
    if (selectedClaim.readOnlyImported) {
      setBanner({ tone: 'info', message: 'Imported customer claim is read-only in agent mode.' })
      return
    }
    if (selectedClaim.status !== 'Pending Approval') {
      setBanner({ tone: 'info', message: 'Claim must be Pending Approval before authorization.' })
      return
    }
    if (!seniorAdjusterReviewed) {
      setBanner({ tone: 'info', message: 'Senior adjuster review must be checked before authorization.' })
      return
    }
    const nowIso = new Date().toISOString()
    const trimmedNote = seniorAdjusterNote.trim()

    updateClaim(selectedClaim.id, {
      status: 'Authorized',
      agentDecision: buildAgentDecision(),
      agentNotes: agentNotes.trim(),
      approvedAt: nowIso,
      authorizedAt: nowIso,
      seniorApproval: {
        reviewed: true,
        reviewedAt: selectedClaim.seniorApproval?.reviewedAt ?? nowIso,
        note: trimmedNote,
        approvedAt: nowIso,
      },
    })
    appendClaimEvent(selectedClaim.id, {
      type: 'authorized',
      message: 'Authorized (Simulated senior adjuster approval).',
    })
    refreshClaims()
    setBanner({ tone: 'success', message: 'Authorized (Simulated senior adjuster approval)' })
  }

  const handleAssignToMe = () => {
    const editableClaim = guardEditableClaim(selectedClaim)
    if (!editableClaim) {
      return
    }
    updateClaim(editableClaim.id, { assignee: CURRENT_AGENT_NAME })
    appendClaimEvent(editableClaim.id, {
      type: 'assignment',
      message: `Assigned to ${CURRENT_AGENT_NAME}.`,
    })
    refreshClaims()
    setBanner({ tone: 'info', message: `Assigned to ${CURRENT_AGENT_NAME}.` })
  }

  const handleMarkNeedsMorePhotos = () => {
    const editableClaim = guardEditableClaim(selectedClaim)
    if (!editableClaim) {
      return
    }
    updateClaim(editableClaim.id, { status: 'Needs More Photos' })
    appendClaimEvent(editableClaim.id, {
      type: 'status_change',
      message: 'Status changed to Needs More Photos.',
    })
    refreshClaims()
    setBanner({ tone: 'info', message: 'Marked as Needs More Photos.' })
  }

  const handleSubmitForApproval = () => {
    const editableClaim = guardEditableClaim(selectedClaim)
    if (!editableClaim) {
      return
    }
    if (editableClaim.status !== 'In Review') {
      setBanner({ tone: 'info', message: 'Claim must be In Review before submitting for approval.' })
      return
    }
    if (hasMissingOverrideReason()) {
      setBanner({ tone: 'info', message: 'Reason for override is required for all changed AI-suggested fields.' })
      return
    }
    updateClaim(editableClaim.id, {
      status: 'Pending Approval',
      agentDecision: buildAgentDecision(),
      agentNotes: agentNotes.trim(),
      submittedForApprovalAt: new Date().toISOString(),
      seniorApproval: {
        reviewed: false,
        note: '',
      },
    })
    appendClaimEvent(editableClaim.id, {
      type: 'submitted_for_approval',
      message: 'Submitted for senior adjuster approval. Claim edits locked.',
    })
    refreshClaims()
    setSeniorAdjusterReviewed(false)
    setSeniorAdjusterNote('')
    setBanner({ tone: 'info', message: 'Submitted for approval.' })
  }

  const handleRequestAdditionalPhotos = () => {
    const editableClaim = guardEditableClaim(selectedClaim)
    if (!editableClaim) {
      return
    }
    updateClaim(editableClaim.id, {
      status: 'Needs More Photos',
      photoRequest: {
        requested: true,
        requestedAt: new Date().toISOString(),
        photosReceived: false,
        checklist: REQUESTED_SHOT_CHECKLIST,
      },
    })
    appendClaimEvent(editableClaim.id, {
      type: 'photo_request',
      message: 'Requested additional photos from customer.',
    })
    refreshClaims()
    setBanner({ tone: 'info', message: 'Requested additional photos.' })
  }

  const handlePhotosReceived = () => {
    const editableClaim = guardEditableClaim(selectedClaim)
    if (!editableClaim) {
      return
    }
    updateClaim(editableClaim.id, {
      status: 'In Review',
      photoRequest: {
        ...(editableClaim.photoRequest ?? {
          requested: true,
          checklist: REQUESTED_SHOT_CHECKLIST,
        }),
        requested: true,
        photosReceived: true,
      },
    })
    appendClaimEvent(editableClaim.id, {
      type: 'photos_received',
      message: 'Additional photos received. Claim moved back to In Review.',
    })
    refreshClaims()
    setBanner({ tone: 'info', message: 'Photos received. Claim moved to In Review.' })
  }

  const handleResetSeverityToAI = () => {
    if (!aiAssessment) {
      return
    }
    const editableClaim = guardEditableClaim(selectedClaim)
    if (!editableClaim) {
      return
    }
    setAgentFinalSeverity(aiAssessment.severity)
    setOverrideReasons((current) => ({ ...current, severity: undefined }))
    appendClaimEvent(editableClaim.id, {
      type: 'reset_to_ai',
      message: 'Severity reset to AI suggestion.',
    })
    refreshClaims()
  }

  const handleResetNextStepToAI = () => {
    if (!aiAssessment) {
      return
    }
    const editableClaim = guardEditableClaim(selectedClaim)
    if (!editableClaim) {
      return
    }
    setAgentFinalNextStep(aiAssessment.recommendedNextStep)
    setOverrideReasons((current) => ({ ...current, recommendedNextStep: undefined }))
    appendClaimEvent(editableClaim.id, {
      type: 'reset_to_ai',
      message: 'Recommended next step reset to AI suggestion.',
    })
    refreshClaims()
  }

  const handleResetEstimateToAI = () => {
    if (aiSuggestedEstimate === null) {
      return
    }
    const editableClaim = guardEditableClaim(selectedClaim)
    if (!editableClaim) {
      return
    }
    setFinalEstimateManuallyEdited(true)
    setEstimatedRepairCost(String(aiSuggestedEstimate))
    setOverrideReasons((current) => ({
      ...current,
      estimatedRepairCost: undefined,
      finalEstimateVsTotal: undefined,
    }))
    appendClaimEvent(editableClaim.id, {
      type: 'reset_to_ai',
      message: 'Estimate reset to AI suggestion.',
    })
    refreshClaims()
  }

  const handleRefreshComparableClaims = () => {
    setComparableRefreshTick((current) => current + 1)
  }

  const handleSeniorReviewToggle = (checked: boolean) => {
    if (!selectedClaim || selectedClaim.readOnlyImported || selectedClaim.status !== 'Pending Approval') {
      return
    }
    const reviewedAt = checked ? new Date().toISOString() : undefined
    const trimmedNote = seniorAdjusterNote.trim()
    setSeniorAdjusterReviewed(checked)
    updateClaim(selectedClaim.id, {
      seniorApproval: {
        reviewed: checked,
        reviewedAt,
        note: trimmedNote,
      },
    })
    appendClaimEvent(selectedClaim.id, {
      type: 'senior_review',
      message: checked
        ? 'Senior adjuster marked assessment and estimate as reviewed.'
        : 'Senior adjuster review checkbox cleared.',
    })
    refreshClaims()
  }

  const handleSaveSeniorNote = () => {
    if (!selectedClaim || selectedClaim.readOnlyImported || selectedClaim.status !== 'Pending Approval') {
      return
    }
    const trimmedNote = seniorAdjusterNote.trim()
    updateClaim(selectedClaim.id, {
      seniorApproval: {
        reviewed: seniorAdjusterReviewed,
        reviewedAt: seniorAdjusterReviewed ? selectedClaim.seniorApproval?.reviewedAt ?? new Date().toISOString() : undefined,
        note: trimmedNote,
      },
    })
    appendClaimEvent(selectedClaim.id, {
      type: 'senior_note',
      message: trimmedNote ? 'Senior adjuster note saved.' : 'Senior adjuster note cleared.',
    })
    refreshClaims()
    setBanner({ tone: 'info', message: 'Senior adjuster note saved.' })
  }

  const handleResetDemo = () => {
    const nextClaims = resetAgentClaimsForDemo()
    setClaims(nextClaims)
    setSelectedClaimId(nextClaims[0]?.id ?? '')
    setActivePhotoId(null)
    setAgentFinalSeverity('')
    setAgentFinalNextStep('')
    setLineItems([createEmptyLineItem()])
    setEstimatedRepairCost('')
    setFinalEstimateManuallyEdited(false)
    setOverrideReasons({})
    setAgentNotes('')
    setSeniorAdjusterReviewed(false)
    setSeniorAdjusterNote('')
    setComparableRefreshTick(0)
    setSearchQuery('')
    setStatusFilter('All')
    setSourceFilter('All')
    setSortOrder('newest')
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

        <section className="agent-metrics">
          <div className="agent-metrics__header">
            <h2>Agent Metrics</h2>
            <p className="muted">Live agent-only metrics from the current queue.</p>
          </div>
          <div className="agent-metrics__grid">
            <div className="agent-metrics__card">
              <span className="summary__label">Queue by status</span>
              <div className="agent-metrics__list">
                <div>
                  <strong>{metrics.counts.New}</strong> New
                </div>
                <div>
                  <strong>{metrics.counts['In Review']}</strong> In Review
                </div>
                <div>
                  <strong>{metrics.counts['Needs More Photos']}</strong> Needs More Photos
                </div>
                <div>
                  <strong>{metrics.counts['Pending Approval']}</strong> Pending Approval
                </div>
                <div>
                  <strong>{metrics.counts.Authorized}</strong> Authorized
                </div>
              </div>
            </div>
            <div className="agent-metrics__card">
              <span className="summary__label">Avg time to authorize</span>
              <p className="agent-metrics__value">
                {metrics.avgAuthorizeMs === null ? '—' : formatDurationMs(metrics.avgAuthorizeMs)}
              </p>
              <p className="muted">Based on claims with open + authorized timestamps.</p>
            </div>
            <div className="agent-metrics__card">
              <span className="summary__label">Overrides</span>
              <p className="agent-metrics__value">{metrics.overridePercent}%</p>
              <p className="muted">Claims with at least one agent override.</p>
            </div>
            <div className="agent-metrics__card">
              <span className="summary__label">Low confidence</span>
              <p className="agent-metrics__value">{metrics.lowConfidencePercent}%</p>
              <p className="muted">AI assessments below 0.60 confidence.</p>
            </div>
          </div>
        </section>

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
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value as 'All' | AgentClaimStatus)}
                  >
                    <option value="All">All</option>
                    <option value="New">New</option>
                    <option value="In Review">In Review</option>
                    <option value="Pending Approval">Pending Approval</option>
                    <option value="Needs More Photos">Needs More Photos</option>
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
                  <select
                    value={sortOrder}
                    onChange={(event) => setSortOrder(event.target.value as 'newest' | 'oldest' | 'status')}
                  >
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
                  <p className="agent-queue__meta">
                    Assignee: <strong>{claim.assignee || 'Unassigned'}</strong>
                  </p>
                  <p className="muted">Updated: {formatSubmittedAt(claim.lastUpdatedAt)}</p>
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

                {isLowConfidence && (
                  <div className="agent-banner agent-banner--warn" role="alert">
                    Low AI confidence ({Math.round((aiConfidenceNormalized ?? 0) * 100)}%). Default recommendation:
                    Needs More Photos.
                  </div>
                )}

                {isImportedReadOnly && (
                  <div className="callout">
                    <p className="muted" style={{ margin: 0 }}>
                      Imported from customer flow as a read-only snapshot. Use this view for review context.
                    </p>
                  </div>
                )}

                {isPendingApproval && (
                  <div className="agent-banner agent-banner--info" role="status">
                    Pending senior adjuster review. Claim edits are locked until final authorization.
                  </div>
                )}

                {isAuthorized && (
                  <div className="agent-banner agent-banner--success" role="status">
                    Authorized (Simulated senior adjuster approval)
                  </div>
                )}

                <div className="agent-section">
                  <div className="agent-section__header">
                    <h2>Claim Summary</h2>
                    <button
                      type="button"
                      className="button button--ghost"
                      onClick={handleAssignToMe}
                      disabled={isEditLocked}
                    >
                      Assign to me
                    </button>
                  </div>
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
                      <span className="summary__label">Status</span>
                      <span className="summary__value">{selectedClaim.status}</span>
                    </div>
                    <div>
                      <span className="summary__label">Assignee</span>
                      <span className="summary__value">{selectedClaim.assignee || 'Unassigned'}</span>
                    </div>
                    <div>
                      <span className="summary__label">Last updated</span>
                      <span className="summary__value">{formatSubmittedAt(selectedClaim.lastUpdatedAt)}</span>
                    </div>
                    <div>
                      <span className="summary__label">Open → AI</span>
                      <span className="summary__value">
                        {formatDuration(selectedClaim.openedAt, selectedClaim.aiAssessedAt)}
                      </span>
                    </div>
                    <div>
                      <span className="summary__label">Open → Draft</span>
                      <span className="summary__value">
                        {formatDuration(selectedClaim.openedAt, selectedClaim.draftSavedAt)}
                      </span>
                    </div>
                    <div>
                      <span className="summary__label">Open → Authorized</span>
                      <span className="summary__value">
                        {formatDuration(selectedClaim.openedAt, selectedClaim.authorizedAt)}
                      </span>
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
                  <h2>Incident Intake Details</h2>
                  <div className="agent-summary-grid">
                    <div>
                      <span className="summary__label">Tow requested</span>
                      <span className="summary__value">{selectedClaim.incident?.towRequested ? 'Yes' : 'No'}</span>
                    </div>
                    <div>
                      <span className="summary__label">Tow status</span>
                      <span className="summary__value">{selectedClaim.incident?.towStatus ?? 'Not requested'}</span>
                    </div>
                    <div>
                      <span className="summary__label">Other party details</span>
                      <span className="summary__value">
                        {selectedClaim.incident?.hasOtherParty ? 'Captured' : 'Not involved'}
                      </span>
                    </div>
                  </div>

                  <div className="callout">
                    <span className="summary__label">Customer incident description</span>
                    <p className="muted" style={{ marginTop: 6 }}>
                      {selectedClaim.incident?.incidentDescription?.trim() || 'No incident description provided.'}
                    </p>
                  </div>

                  <div className="callout">
                    <span className="summary__label">AI-assisted intake narration</span>
                    <p className="muted" style={{ marginTop: 6 }}>
                      {selectedClaim.incident?.incidentNarrationText?.trim() || 'No narration was accepted.'}
                    </p>
                  </div>

                  {selectedClaim.incident?.hasOtherParty === true && (
                    <div className="summary summary--compact">
                      <div>
                        <span className="summary__label">Other driver</span>
                        <span className="summary__value">
                          {selectedClaim.incident.otherPartyDetails?.otherDriverName || 'Not captured'}
                        </span>
                      </div>
                      <div>
                        <span className="summary__label">Contact</span>
                        <span className="summary__value">
                          {selectedClaim.incident.otherPartyDetails?.otherContact || 'Not captured'}
                        </span>
                      </div>
                      <div>
                        <span className="summary__label">Vehicle</span>
                        <span className="summary__value">
                          {selectedClaim.incident.otherPartyDetails?.otherVehicleMakeModel || 'Not captured'}
                        </span>
                      </div>
                      <div>
                        <span className="summary__label">Insurance carrier</span>
                        <span className="summary__value">
                          {selectedClaim.incident.otherPartyDetails?.insuranceCarrier || 'Not captured'}
                        </span>
                      </div>
                    </div>
                  )}
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
                    disabled={assessingClaimId === selectedClaim.id || isEditLocked}
                  >
                    {assessingClaimId === selectedClaim.id ? 'Assessing...' : 'Run AI Damage Assessment'}
                  </button>

                  <div className="agent-actions">
                    <button
                      type="button"
                      className="button button--ghost"
                      onClick={handleRequestAdditionalPhotos}
                      disabled={isEditLocked}
                    >
                      Request additional photos
                    </button>
                    <button
                      type="button"
                      className="button button--ghost"
                      onClick={handlePhotosReceived}
                      disabled={isEditLocked || !photoRequest?.requested || Boolean(photoRequest?.photosReceived)}
                    >
                      {photoRequest?.photosReceived ? 'Photos received' : 'Mark photos received'}
                    </button>
                  </div>

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

                  {photoRequest?.requested && (
                    <div className="agent-photo-checklist">
                      <p className="agent-photo-checklist__title">Suggested additional shots</p>
                      <ul className="agent-photo-checklist__list">
                        {(photoRequest.checklist && photoRequest.checklist.length > 0
                          ? photoRequest.checklist
                          : REQUESTED_SHOT_CHECKLIST
                        ).map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="agent-section">
                  <div className="agent-section__header">
                    <h2>Similar Past Claims</h2>
                    <button
                      type="button"
                      className="button button--ghost"
                      onClick={handleRefreshComparableClaims}
                      disabled={!aiAssessment}
                    >
                      Refresh matches
                    </button>
                  </div>
                  <span className="agent-pill agent-pill--ai">Based on AI-detected damage pattern</span>

                  {!aiAssessment ? (
                    <p className="muted">Run AI assessment to find comparable claims</p>
                  ) : (
                    <>
                      <div className="agent-comparable__range">
                        <span className="summary__label">Estimated cost range from similar claims:</span>
                        <strong>
                          {comparableCostRange
                            ? `$${comparableCostRange.min.toLocaleString()} - $${comparableCostRange.max.toLocaleString()} typical range`
                            : 'No comparable matches found'}
                        </strong>
                      </div>

                      {severityOverridden && (
                        <p className="agent-comparable__overrideNote">Updated based on agent-adjusted severity</p>
                      )}

                      {comparableClaims.length === 0 ? (
                        <p className="muted">No strong local matches found for this damage pattern.</p>
                      ) : (
                        <div className="agent-comparable__list">
                          {comparableClaims.map((match) => (
                            <article key={match.id} className="agent-comparable__item">
                              <div className="agent-comparable__top">
                                <strong>
                                  {match.vehicleMake} {match.vehicleModel}
                                </strong>
                                <span className="agent-status">
                                  {match.severity.charAt(0).toUpperCase()}
                                  {match.severity.slice(1)}
                                </span>
                              </div>
                              <p className="agent-comparable__meta">
                                Impacted areas: {match.damageAreas.join(', ')}
                              </p>
                              <p className="agent-comparable__meta">
                                Final repair cost: ${match.finalRepairCost.toLocaleString()} | Repair duration:{' '}
                                {match.repairDurationDays} days
                              </p>
                              <p className="muted">{match.shortDescription}</p>
                            </article>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="agent-section">
                  <div className="agent-section__header">
                    <h2>Estimate & Authorization</h2>
                    <span className="agent-pill agent-pill--agent">Agent Finalized</span>
                  </div>

                  <div className="agent-compare-grid">
                    <div className="agent-compare-row">
                      <span className="summary__label">Severity</span>
                      <span className="agent-compare__ai">
                        AI suggested: {aiAssessment?.severity ?? 'Not available'}
                      </span>
                      <div className="agent-compare__final">
                        <span className="agent-compare__finalLabel">Agent final</span>
                        <select
                          className="agent-input"
                          value={agentFinalSeverity}
                          onChange={(event) => setAgentFinalSeverity(event.target.value as Severity | '')}
                          disabled={isEditLocked}
                        >
                          <option value="">Select</option>
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                        </select>
                      </div>
                      {severityOverridden && (
                        <div className="agent-override-controls">
                          <label className="agent-field">
                            <span>Reason for override</span>
                            <textarea
                              className="agent-textarea"
                              rows={2}
                              value={overrideReasons.severity ?? ''}
                              onChange={(event) =>
                                setOverrideReasons((current) => ({
                                  ...current,
                                  severity: event.target.value,
                                }))
                              }
                              placeholder="Why did you override AI severity?"
                              disabled={isEditLocked}
                            />
                          </label>
                          <button
                            type="button"
                            className="button button--ghost"
                            onClick={handleResetSeverityToAI}
                            disabled={isEditLocked || !aiAssessment}
                          >
                            Reset to AI
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="agent-compare-row">
                      <span className="summary__label">Recommended next step</span>
                      <span className="agent-compare__ai">
                        AI suggested: {aiAssessment?.recommendedNextStep ?? 'Not available'}
                      </span>
                      <div className="agent-compare__final">
                        <span className="agent-compare__finalLabel">Agent final</span>
                        <select
                          className="agent-input"
                          value={agentFinalNextStep}
                          onChange={(event) => setAgentFinalNextStep(event.target.value as RecommendedNextStep | '')}
                          disabled={isEditLocked}
                        >
                          <option value="">Select</option>
                          <option value="Approve">Approve</option>
                          <option value="Review">Review</option>
                          <option value="Escalate">Escalate</option>
                        </select>
                      </div>
                      {nextStepOverridden && (
                        <div className="agent-override-controls">
                          <label className="agent-field">
                            <span>Reason for override</span>
                            <textarea
                              className="agent-textarea"
                              rows={2}
                              value={overrideReasons.recommendedNextStep ?? ''}
                              onChange={(event) =>
                                setOverrideReasons((current) => ({
                                  ...current,
                                  recommendedNextStep: event.target.value,
                                }))
                              }
                              placeholder="Why did you override AI recommendation?"
                              disabled={isEditLocked}
                            />
                          </label>
                          <button
                            type="button"
                            className="button button--ghost"
                            onClick={handleResetNextStepToAI}
                            disabled={isEditLocked || !aiAssessment}
                          >
                            Reset to AI
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="agent-compare-row">
                      <span className="summary__label">Estimate</span>
                      <span className="agent-compare__ai">
                        AI suggested:{' '}
                        {aiCostBand
                          ? `$${aiCostBand.min.toLocaleString()} - $${aiCostBand.max.toLocaleString()}`
                          : 'Run AI assessment to generate'}
                      </span>
                      <div className="agent-line-items">
                        <table className="agent-line-items__table">
                          <thead>
                            <tr>
                              <th>Description</th>
                              <th>Category</th>
                              <th>Amount</th>
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {lineItems.map((item) => (
                              <tr key={item.id}>
                                <td>
                                  <input
                                    className="agent-input"
                                    value={item.description}
                                    onChange={(event) =>
                                      handleUpdateLineItem(item.id, { description: event.target.value })
                                    }
                                    placeholder="e.g., Front bumper replacement"
                                    disabled={isEditLocked}
                                  />
                                </td>
                                <td>
                                  <select
                                    className="agent-input"
                                    value={item.category}
                                    onChange={(event) =>
                                      handleUpdateLineItem(item.id, {
                                        category: event.target.value as AgentEstimateCategory,
                                      })
                                    }
                                    disabled={isEditLocked}
                                  >
                                    {ESTIMATE_CATEGORIES.map((category) => (
                                      <option key={category} value={category}>
                                        {category}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    min={0}
                                    className="agent-input"
                                    value={item.amount}
                                    onChange={(event) =>
                                      handleUpdateLineItem(item.id, { amount: sanitizeAmount(event.target.value) })
                                    }
                                    disabled={isEditLocked}
                                  />
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    className="button button--ghost"
                                    onClick={() => handleRemoveLineItem(item.id)}
                                    disabled={isEditLocked || lineItems.length <= 1}
                                  >
                                    Remove line
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="agent-actions">
                        <button
                          type="button"
                          className="button button--ghost"
                          onClick={handleAddLineItem}
                          disabled={isEditLocked || lineItems.length >= 8}
                        >
                          Add line
                        </button>
                      </div>

                      <div className="agent-compare__final">
                        <span className="agent-compare__finalLabel">Line-item total</span>
                        <span className="summary__value">${lineItemsTotal.toLocaleString()}</span>
                      </div>

                      <div className="agent-compare__final">
                        <span className="agent-compare__finalLabel">Final estimate (Agent final)</span>
                        <input
                          type="number"
                          min={0}
                          className="agent-input"
                          value={estimatedRepairCost}
                          onChange={(event) => {
                            setFinalEstimateManuallyEdited(true)
                            setEstimatedRepairCost(event.target.value)
                          }}
                          placeholder="Defaults to line-item total"
                          disabled={isEditLocked}
                        />
                      </div>

                      {estimateOverridden && (
                        <div className="agent-override-controls">
                          <label className="agent-field">
                            <span>Reason for override (AI suggestion)</span>
                            <textarea
                              className="agent-textarea"
                              rows={2}
                              value={overrideReasons.estimatedRepairCost ?? ''}
                              onChange={(event) =>
                                setOverrideReasons((current) => ({
                                  ...current,
                                  estimatedRepairCost: event.target.value,
                                }))
                              }
                              placeholder="Why did you override AI estimate?"
                              disabled={isEditLocked}
                            />
                          </label>
                          <button
                            type="button"
                            className="button button--ghost"
                            onClick={handleResetEstimateToAI}
                            disabled={isEditLocked || aiSuggestedEstimate === null}
                          >
                            Reset to AI
                          </button>
                        </div>
                      )}

                      {finalEstimateDiffOverThreshold && (
                        <div className="agent-override-controls">
                          <label className="agent-field">
                            <span>
                              Reason for override ({Math.round(finalEstimateDiffRatio * 100)}% difference from total)
                            </span>
                            <textarea
                              className="agent-textarea"
                              rows={2}
                              value={overrideReasons.finalEstimateVsTotal ?? ''}
                              onChange={(event) =>
                                setOverrideReasons((current) => ({
                                  ...current,
                                  finalEstimateVsTotal: event.target.value,
                                }))
                              }
                              placeholder="Final estimate differs materially from line-item total. Why?"
                              disabled={isEditLocked}
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  </div>

                  <label className="agent-field">
                    <span>Agent Notes</span>
                    <textarea
                      className="agent-textarea"
                      rows={4}
                      value={agentNotes}
                      onChange={(event) => setAgentNotes(event.target.value)}
                      placeholder="Add review notes for file history"
                      disabled={isEditLocked}
                    />
                  </label>

                  {overrideSummary.length > 0 && (
                    <div className="agent-overrides">
                      <p className="agent-overrides__title">Overrides</p>
                      <ul className="agent-overrides__list">
                        {overrideSummary.map((item) => (
                          <li key={item.field}>
                            <strong>{item.field}:</strong> {item.reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="agent-actions">
                    <button
                      type="button"
                      className="button button--ghost"
                      onClick={handleSaveDraft}
                      disabled={isEditLocked}
                    >
                      Save Draft
                    </button>
                    <button
                      type="button"
                      className="button button--ghost"
                      onClick={handleMarkNeedsMorePhotos}
                      disabled={isEditLocked}
                    >
                      Needs More Photos
                    </button>
                    <button
                      type="button"
                      className="button button--ghost"
                      onClick={handleSubmitForApproval}
                      disabled={isEditLocked || selectedClaim.status !== 'In Review'}
                    >
                      Submit for Approval
                    </button>
                  </div>

                  <div className="agent-senior-panel">
                    <div className="agent-section__header">
                      <h3>Senior adjuster (simulated)</h3>
                      <span className="agent-status agent-status--pending-approval">{selectedClaim.status}</span>
                    </div>

                    <label className="agent-senior-panel__check">
                      <input
                        type="checkbox"
                        checked={seniorAdjusterReviewed}
                        onChange={(event) => handleSeniorReviewToggle(event.target.checked)}
                        disabled={isSeniorPanelLocked || selectedClaim.status !== 'Pending Approval'}
                      />
                      <span>Reviewed assessment and estimate</span>
                    </label>

                    <label className="agent-field">
                      <span>Optional note</span>
                      <textarea
                        className="agent-textarea"
                        rows={3}
                        value={seniorAdjusterNote}
                        onChange={(event) => setSeniorAdjusterNote(event.target.value)}
                        placeholder="Add a note before final authorization"
                        disabled={isSeniorPanelLocked || selectedClaim.status !== 'Pending Approval'}
                      />
                    </label>

                    <div className="agent-actions">
                      <button
                        type="button"
                        className="button button--ghost"
                        onClick={handleSaveSeniorNote}
                        disabled={isSeniorPanelLocked || selectedClaim.status !== 'Pending Approval'}
                      >
                        Save review note
                      </button>
                      <button
                        type="button"
                        className="button button--primary"
                        onClick={handleApprove}
                        disabled={
                          isSeniorPanelLocked || selectedClaim.status !== 'Pending Approval' || !seniorAdjusterReviewed
                        }
                      >
                        Approve & Authorize Repairs
                      </button>
                    </div>

                    {selectedClaim.seniorApproval?.approvedAt && (
                      <p className="muted">Approved at: {formatSubmittedAt(selectedClaim.seniorApproval.approvedAt)}</p>
                    )}
                  </div>
                </div>

                <div className="agent-section">
                  <h2>Activity Timeline</h2>
                  {selectedClaim.events.length === 0 ? (
                    <p className="muted">No activity recorded yet.</p>
                  ) : (
                    <div className="agent-timeline">
                      {[...selectedClaim.events]
                        .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
                        .map((event) => (
                          <div key={event.id} className="agent-timeline__item">
                            <div className="agent-timeline__row">
                              <span className="agent-timeline__type">{event.type}</span>
                              <span className="agent-timeline__at">{formatSubmittedAt(event.at)}</span>
                            </div>
                            <p className="agent-timeline__message">{event.message}</p>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
