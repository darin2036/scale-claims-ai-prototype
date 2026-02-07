import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import './App.css'
import fenderbenderLogo from './assets/fenderbender-logo.png'
import PhotoChecklistUploader, {
  type ChecklistPhotos,
  type PhotoKey,
} from './components/PhotoChecklistUploader'
import VehicleIdentifierEntry from './components/VehicleIdentifierEntry'
import OtherPartyInfo from './components/OtherPartyInfo'
import IncidentDescription from './components/IncidentDescription'
import IncidentNarratorCard from './components/IncidentNarratorCard'
import EstimateBreakdown from './components/EstimateBreakdown'
import PolicySummary from './components/PolicySummary'
import ProgressHeader from './components/ProgressHeader'
import SubmitClaimCard from './components/SubmitClaimCard'
import PostSubmissionNextSteps from './components/PostSubmissionNextSteps'
import type { OtherPartyDetails } from './types/claim'
import { assessDamage, type AIAssessment } from './lib/mockAI'
import { generateRepairEstimate } from './lib/estimation'
import { type CopilotContext } from './lib/aiCopilot'
import { generateIncidentNarration, type NarratorFacts } from './lib/incidentNarrator'
import { mockLookupLocation } from './lib/mockLocation'
import { estimateRepairTime } from './lib/repairTimeEstimator'
import {
  getPolicyHolderByScenario,
  listDemoScenarios,
  lookupVehicleByIdentifier,
} from './server/fakeApi'
import { hashString } from './server/hash'
import { persistMostRecentSubmissionFromCustomerFlow } from './components/agent/storage'
import {
  bookRental,
  bookRideHome,
  getTowStatus,
  requestTow,
  submitClaim,
  type RentalBooking,
  type RideBooking,
  type TowStatus,
} from './server/nextStepsApi'
import type { PolicyHolder, Vehicle } from './server/fakeDb'

const USE_NEW_ESTIMATE = true
const TOTAL_STEPS = 4

type ClaimStep = 1 | 2 | 3 | 4

export default function App() {
  const [scenarioOptions, setScenarioOptions] = useState<Array<{ id: string; label: string }>>([])
  const [selectedScenarioId, setSelectedScenarioId] = useState('')
  const [policyHolder, setPolicyHolder] = useState<PolicyHolder | null>(null)
  const [landingPanel, setLandingPanel] = useState<'insurance_card' | 'policy' | null>(null)

  const [flowStarted, setFlowStarted] = useState(false)
  const [currentStep, setCurrentStep] = useState<ClaimStep>(1)
  const [safetyStatus, setSafetyStatus] = useState<'ok' | 'need_help' | ''>('')

  const [hasOtherParty, setHasOtherParty] = useState<boolean | null>(null)
  const [drivable, setDrivable] = useState<boolean | null>(null)
  const [drivableAnswered, setDrivableAnswered] = useState(false)

  const [confirmedIdentifier, setConfirmedIdentifier] = useState<{
    mode: 'plate' | 'vin'
    plate?: string
    state?: string
    vin?: string
  } | null>(null)
  const [identifierDraft, setIdentifierDraft] = useState<{
    canConfirm: boolean
    payload: { mode: 'plate' | 'vin'; plate?: string; state?: string; vin?: string } | null
  } | null>(null)
  const [lookupKey, setLookupKey] = useState(0)
  const [vehicleResult, setVehicleResult] = useState<Vehicle | null>(null)
  const [suggestedVehicle, setSuggestedVehicle] = useState<Vehicle | null>(null)
  const [vehicleLookupStatus, setVehicleLookupStatus] = useState<'idle' | 'loading' | 'error'>(
    'idle',
  )
  const [vehicleLookupMessage, setVehicleLookupMessage] = useState('')

  const [photos, setPhotos] = useState<ChecklistPhotos>({
    damagePhoto: [],
    vehiclePhoto: null,
    otherInsurancePhoto: null,
  })

  const [assessment, setAssessment] = useState<AIAssessment | null>(null)
  const [isAssessing, setIsAssessing] = useState(false)
  const [photoAnalysisKey, setPhotoAnalysisKey] = useState('')
  const [photoAnalysisMinDelayDone, setPhotoAnalysisMinDelayDone] = useState(false)
  const [photoAnalysisDelayMs, setPhotoAnalysisDelayMs] = useState(0)

  const [otherPartyDetails, setOtherPartyDetails] = useState<OtherPartyDetails>({
    noInfo: false,
    otherDriverName: '',
    otherContact: '',
    otherVehiclePlate: '',
    otherVehicleState: '',
    otherVehicleMakeModel: '',
    insuranceCarrier: '',
    policyNumber: '',
    notes: '',
  })

  const [incidentDescription, setIncidentDescription] = useState('')
  const [additionalNotes, setAdditionalNotes] = useState('')
  const [incidentNarrator, setIncidentNarrator] = useState<{
    narration: string
    accepted: boolean
    edits?: Partial<NarratorFacts>
  } | null>(null)
  const [reviewTransition, setReviewTransition] = useState<{ delayMs: number } | null>(null)

  const [tow, setTow] = useState<{ towId?: string; status?: TowStatus } | null>(null)
  const [towDestination, setTowDestination] = useState<'home' | 'shop' | 'custom' | ''>('')
  const [towCustomAddress, setTowCustomAddress] = useState('')
  const [towLoading, setTowLoading] = useState(false)
  const [preSubmitRideRequested, setPreSubmitRideRequested] = useState(false)

  const [claimRecord, setClaimRecord] = useState<{
    claimId: string
    submittedAt: string
    vehicle: Vehicle
    photos: { damage: boolean; vehicle: boolean; otherInsurance: boolean }
    hasOtherParty?: boolean | null
    otherPartyDetails?: OtherPartyDetails | null
    incidentDescription?: string
    incidentNarrationText?: string
    incidentNarrationAccepted?: boolean
    estimatedRepairDaysMin?: number
    estimatedRepairDaysMax?: number
    repairTimeConfidence?: number
    estimate?: {
      estimatedRepairCost: number
      aboveDeductible: boolean
      customerPays: number
      insurerPays: number
    } | null
    drivable: boolean | null
    tow?: { requested: boolean; status?: TowStatus }
  } | null>(null)
  const claimId = claimRecord?.claimId ?? null
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [postSubmitTransition, setPostSubmitTransition] = useState<{ delayMs: number } | null>(null)
  const [postSubmitTransitionDone, setPostSubmitTransitionDone] = useState(false)
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null)
  const [rentalBooking, setRentalBooking] = useState<RentalBooking | null>(null)
  const [rideBooking, setRideBooking] = useState<RideBooking | null>(null)

  const [emergencyLocation, setEmergencyLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(
    null,
  )
  const [emergencyManualLocation, setEmergencyManualLocation] = useState('')

  const [viewMode, setViewMode] = useState<'app' | 'tow' | 'insurer'>('app')

  useEffect(() => {
    let active = true
    listDemoScenarios().then((items) => {
      if (!active) {
        return
      }
      setScenarioOptions(items)
      if (items.length > 0) {
        setSelectedScenarioId(items[0].id)
      }
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!selectedScenarioId) {
      return
    }
    let active = true
    getPolicyHolderByScenario(selectedScenarioId).then((holder) => {
      if (active) {
        setPolicyHolder(holder)
      }
    })
    return () => {
      active = false
    }
  }, [selectedScenarioId])

  const firstName = useMemo(() => {
    const name = policyHolder?.name?.trim()
    if (!name) {
      return ''
    }
    return name.split(/\s+/)[0] ?? ''
  }, [policyHolder?.name])

  const namePrefix = firstName ? `${firstName}, ` : ''

  const policyPreview = useMemo(() => {
    if (!policyHolder) {
      return null
    }
    const policyId = policyHolder.policy.policyId
    const seed = hashString(policyId)
    const effectiveYear = 2025
    const effectiveMonth = 1 + (seed % 9)
    const effectiveStart = `${effectiveYear}-${String(effectiveMonth).padStart(2, '0')}-01`
    const effectiveEnd = `${effectiveYear + 1}-${String(effectiveMonth).padStart(2, '0')}-01`
    const liabilityChoices = [
      { bi: '50/100', pd: '$50,000' },
      { bi: '100/300', pd: '$100,000' },
      { bi: '250/500', pd: '$250,000' },
    ] as const
    const uimChoices = [
      'Not selected',
      '50/100',
      '100/300',
      '250/500',
    ] as const
    const medpayChoices = ['None', '$1,000', '$5,000', '$10,000'] as const
    const liability = liabilityChoices[seed % liabilityChoices.length]
    const uninsuredMotorist = uimChoices[seed % uimChoices.length]
    const medicalPayments = medpayChoices[seed % medpayChoices.length]
    const roadside = seed % 2 === 0

    return {
      policyId,
      insuredName: policyHolder.name,
      coverage: policyHolder.policy.coverage,
      deductible: policyHolder.policy.deductible,
      rentalCoverage: policyHolder.policy.rentalCoverage,
      effectiveStart,
      effectiveEnd,
      liability,
      uninsuredMotorist,
      medicalPayments,
      roadside,
    }
  }, [policyHolder])

  const estimateSummary = useMemo(() => {
    if (!vehicleResult || !assessment || !policyHolder) {
      return null
    }
    return generateRepairEstimate({
      vehicle: vehicleResult,
      assessment,
      policy: policyHolder.policy,
    })
  }, [assessment, policyHolder, vehicleResult])

  const copilotCtx: CopilotContext = useMemo(
    () => ({
      drivable,
      assessment: assessment
        ? {
            severity: assessment.severity,
            confidence: assessment.confidence,
            damageType: assessment.damageTypes,
          }
        : undefined,
      vehicle: vehicleResult
        ? {
            year: vehicleResult.year,
            make: vehicleResult.make,
            model: vehicleResult.model,
            bodyType: vehicleResult.bodyType,
          }
        : undefined,
      estimate: estimateSummary
        ? {
            estimatedRepairCost: estimateSummary.estimatedRepairCost,
            aboveDeductible: estimateSummary.aboveDeductible,
            isPotentialTotalLoss: estimateSummary.isPotentialTotalLoss,
          }
        : undefined,
    }),
    [assessment, drivable, estimateSummary, vehicleResult],
  )

  const otherPartySummary = useMemo(() => {
    if (hasOtherParty !== true) {
      return undefined
    }
    const bits: string[] = []
    if (otherPartyDetails.otherDriverName.trim()) {
      bits.push(otherPartyDetails.otherDriverName.trim())
    }
    if (otherPartyDetails.otherVehiclePlate.trim()) {
      const state = otherPartyDetails.otherVehicleState.trim()
      bits.push(
        state
          ? `${otherPartyDetails.otherVehiclePlate.trim()} (${state})`
          : otherPartyDetails.otherVehiclePlate.trim(),
      )
    }
    if (otherPartyDetails.otherVehicleMakeModel.trim()) {
      bits.push(otherPartyDetails.otherVehicleMakeModel.trim())
    }
    return bits.length > 0 ? bits.slice(0, 3).join(' • ') : 'Other party details provided'
  }, [
    hasOtherParty,
    otherPartyDetails.otherDriverName,
    otherPartyDetails.otherVehicleMakeModel,
    otherPartyDetails.otherVehiclePlate,
    otherPartyDetails.otherVehicleState,
  ])

  const narratorFacts: NarratorFacts = useMemo(
    () => ({
      hasOtherParty: hasOtherParty ?? undefined,
      otherPartySummary,
      drivable,
      assessment: assessment
        ? {
            severity: assessment.severity,
            confidence: assessment.confidence,
            damageType: assessment.damageTypes,
          }
        : undefined,
      vehicle: vehicleResult
        ? {
            year: vehicleResult.year,
            make: vehicleResult.make,
            model: vehicleResult.model,
            bodyType: vehicleResult.bodyType,
          }
        : undefined,
      estimate: estimateSummary
        ? {
            estimatedRepairCost: estimateSummary.estimatedRepairCost,
            aboveDeductible: estimateSummary.aboveDeductible,
            isPotentialTotalLoss: estimateSummary.isPotentialTotalLoss,
          }
        : undefined,
      userNotes: incidentNarrator?.edits?.userNotes ?? undefined,
    }),
    [
      assessment,
      drivable,
      estimateSummary,
      hasOtherParty,
      incidentNarrator?.edits?.userNotes,
      otherPartySummary,
      vehicleResult,
    ],
  )

  const emergencyLocationLookup = useMemo(() => {
    if (!emergencyLocation) {
      return null
    }
    return mockLookupLocation({ lat: emergencyLocation.lat, lng: emergencyLocation.lng })
  }, [emergencyLocation])

  const pickupLocationLabel = emergencyLocationLookup
    ? `${emergencyLocationLookup.formattedAddress} (near ${emergencyLocationLookup.nearestCrossStreet})`
    : emergencyManualLocation || 'Not provided'
  const pickupDestination = emergencyLocationLookup ? emergencyLocationLookup.mapsQuery : emergencyManualLocation.trim()
  const hasPickupDestination = pickupDestination.length > 0
  const googleMapsDirectionsUrl = hasPickupDestination
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(pickupDestination)}`
    : ''
  const appleMapsDirectionsUrl = hasPickupDestination
    ? `https://maps.apple.com/?daddr=${encodeURIComponent(pickupDestination)}`
    : ''

  const vehicleLabel = vehicleResult ? `${vehicleResult.year} ${vehicleResult.make} ${vehicleResult.model}` : 'Pending'
  const identifierLabel = confirmedIdentifier
    ? confirmedIdentifier.mode === 'vin'
      ? `VIN ${confirmedIdentifier.vin ?? ''}`
      : `Plate ${confirmedIdentifier.state ?? ''} ${confirmedIdentifier.plate ?? ''}`
    : 'Not provided'
  const claimLabel = claimRecord?.claimId ?? 'Not submitted yet'
  const policyholderName = policyHolder?.name ?? 'Policyholder'
  const policyholderPhone = policyHolder ? '(555) 018-2471' : 'Not available'

  const hasDamagePhoto = photos.damagePhoto.length > 0
  const hasVehiclePhoto = Boolean(photos.vehiclePhoto)
  const hasRequiredPhotos = hasDamagePhoto && hasVehiclePhoto
  const photoAnalysisSeed = useMemo(() => {
    if (!hasRequiredPhotos) {
      return ''
    }
    const damageBits = photos.damagePhoto
      .slice(0, 2)
      .map((file) => `${file.name}:${file.size}`)
      .join('|')
    const vehicleBits = photos.vehiclePhoto ? `${photos.vehiclePhoto.name}:${photos.vehiclePhoto.size}` : ''
    return [damageBits, vehicleBits].filter(Boolean).join('|')
  }, [hasRequiredPhotos, photos.damagePhoto, photos.vehiclePhoto])

  const resetFlow = () => {
    setFlowStarted(false)
    setCurrentStep(1)
    setSafetyStatus('')
    setLandingPanel(null)
    setHasOtherParty(null)
    setDrivable(null)
    setDrivableAnswered(false)
    setConfirmedIdentifier(null)
    setIdentifierDraft(null)
    setLookupKey((prev) => prev + 1)
    setVehicleResult(null)
    setSuggestedVehicle(null)
    setVehicleLookupStatus('idle')
    setVehicleLookupMessage('')
    setPhotos({ damagePhoto: [], vehiclePhoto: null, otherInsurancePhoto: null })
    setAssessment(null)
    setIsAssessing(false)
    setOtherPartyDetails({
      noInfo: false,
      otherDriverName: '',
      otherContact: '',
      otherVehiclePlate: '',
      otherVehicleState: '',
      otherVehicleMakeModel: '',
      insuranceCarrier: '',
      policyNumber: '',
      notes: '',
    })
    setIncidentDescription('')
    setAdditionalNotes('')
    setIncidentNarrator(null)
    setReviewTransition(null)
    setTow(null)
    setTowDestination('')
    setTowCustomAddress('')
    setTowLoading(false)
    setPreSubmitRideRequested(false)
    setClaimRecord(null)
    setIsSubmitting(false)
    setPostSubmitTransition(null)
    setPostSubmitTransitionDone(false)
    setSelectedShopId(null)
    setRentalBooking(null)
    setRideBooking(null)
    setEmergencyLocation(null)
    setEmergencyManualLocation('')
  }

  const handleStartClaim = () => {
    resetFlow()
    setEmergencyLocation({ lat: 30.2672, lng: -97.7431, accuracy: 120 })
    setFlowStarted(true)
  }

  const handlePhotoChange = (key: PhotoKey, file: File | File[] | null) => {
    if (key === 'damagePhoto') {
      setPhotos((prev) => ({
        ...prev,
        damagePhoto: Array.isArray(file) ? file : file ? [file] : [],
      }))
      setAssessment(null)
      setPhotoAnalysisMinDelayDone(false)
      return
    }
    setPhotos((prev) => ({ ...prev, [key]: file as File | null }))
  }

  const handleRunAssessment = async () => {
    if (photos.damagePhoto.length === 0) {
      return
    }

    setIsAssessing(true)
    const results = await Promise.all(photos.damagePhoto.map((file) => assessDamage(file)))
    if (results.length === 1) {
      const base = results[0]
      const vehicleBodyType = vehicleResult?.bodyType
      const initialRepairTime = estimateRepairTime({
        severity: base.severity,
        damageType: base.damageTypes,
        vehicleBodyType,
      })

      const baseWithRepairTime: AIAssessment = {
        ...base,
        estimatedRepairDaysMin: initialRepairTime.minDays,
        estimatedRepairDaysMax: initialRepairTime.maxDays,
        repairTimeConfidence: initialRepairTime.confidence,
        repairTimeRationale: initialRepairTime.rationale,
      }

      const isPotentialTotalLoss =
        vehicleResult && policyHolder
          ? generateRepairEstimate({
              vehicle: vehicleResult,
              assessment: baseWithRepairTime,
              policy: policyHolder.policy,
            }).isPotentialTotalLoss
          : undefined

      const finalRepairTime = estimateRepairTime({
        severity: base.severity,
        damageType: base.damageTypes,
        vehicleBodyType,
        isPotentialTotalLoss,
      })

      setAssessment({
        ...base,
        estimatedRepairDaysMin: finalRepairTime.minDays,
        estimatedRepairDaysMax: finalRepairTime.maxDays,
        repairTimeConfidence: finalRepairTime.confidence,
        repairTimeRationale: finalRepairTime.rationale,
      })
      setIsAssessing(false)
      return
    }

    const severityRank: Record<AIAssessment['severity'], number> = {
      Low: 0,
      Medium: 1,
      High: 2,
    }
    const combinedSeverity = results.reduce((max, current) =>
      severityRank[current.severity] > severityRank[max.severity] ? current : max,
    ).severity
    const combinedDamageTypes = Array.from(new Set(results.flatMap((result) => result.damageTypes)))
    const avgConfidence = Math.round(
      results.reduce((sum, result) => sum + result.confidence, 0) / results.length,
    )
    let recommendedNextStep: AIAssessment['recommendedNextStep'] = 'Approve'
    if (combinedSeverity === 'High' || avgConfidence < 70) {
      recommendedNextStep = 'Escalate'
    } else if (combinedSeverity === 'Medium' || avgConfidence < 85) {
      recommendedNextStep = 'Review'
    }
    const vehicleBodyType = vehicleResult?.bodyType
    const initialRepairTime = estimateRepairTime({
      severity: combinedSeverity,
      damageType: combinedDamageTypes,
      vehicleBodyType,
    })
    const combinedWithRepairTime: AIAssessment = {
      damageTypes: combinedDamageTypes,
      severity: combinedSeverity,
      confidence: avgConfidence,
      recommendedNextStep,
      estimatedRepairDaysMin: initialRepairTime.minDays,
      estimatedRepairDaysMax: initialRepairTime.maxDays,
      repairTimeConfidence: initialRepairTime.confidence,
      repairTimeRationale: initialRepairTime.rationale,
    }

    const isPotentialTotalLoss =
      vehicleResult && policyHolder
        ? generateRepairEstimate({
            vehicle: vehicleResult,
            assessment: combinedWithRepairTime,
            policy: policyHolder.policy,
          }).isPotentialTotalLoss
        : undefined

    const finalRepairTime = estimateRepairTime({
      severity: combinedSeverity,
      damageType: combinedDamageTypes,
      vehicleBodyType,
      isPotentialTotalLoss,
    })

    setAssessment({
      ...combinedWithRepairTime,
      estimatedRepairDaysMin: finalRepairTime.minDays,
      estimatedRepairDaysMax: finalRepairTime.maxDays,
      repairTimeConfidence: finalRepairTime.confidence,
      repairTimeRationale: finalRepairTime.rationale,
    })
    setIsAssessing(false)
  }

  useEffect(() => {
    if (!flowStarted || claimRecord) {
      return
    }
    if (currentStep !== 2) {
      return
    }
    if (!hasDamagePhoto) {
      return
    }
    if (assessment || isAssessing) {
      return
    }
    void handleRunAssessment()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessment, claimRecord, currentStep, flowStarted, hasDamagePhoto, isAssessing, photos.damagePhoto])

  useEffect(() => {
    if (!hasRequiredPhotos) {
      setPhotoAnalysisKey('')
      setPhotoAnalysisMinDelayDone(false)
      setPhotoAnalysisDelayMs(0)
      return
    }
    if (!photoAnalysisSeed) {
      return
    }
    if (photoAnalysisSeed !== photoAnalysisKey) {
      setPhotoAnalysisKey(photoAnalysisSeed)
      setPhotoAnalysisMinDelayDone(false)
      const nextDelay = 1800 + (hashString(photoAnalysisSeed) % 1601)
      setPhotoAnalysisDelayMs(nextDelay)
    }
  }, [hasRequiredPhotos, photoAnalysisKey, photoAnalysisSeed])

  useEffect(() => {
    if (!hasRequiredPhotos) {
      return
    }
    if (!photoAnalysisKey) {
      return
    }
    if (photoAnalysisMinDelayDone) {
      return
    }
    const timer = window.setTimeout(() => {
      setPhotoAnalysisMinDelayDone(true)
    }, photoAnalysisDelayMs || 2000)
    return () => {
      window.clearTimeout(timer)
    }
  }, [hasRequiredPhotos, photoAnalysisDelayMs, photoAnalysisKey, photoAnalysisMinDelayDone])

  useEffect(() => {
    if (!flowStarted) {
      return
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [currentStep, flowStarted])

  const runVehicleLookup = async (payload: { mode: 'plate' | 'vin'; plate?: string; state?: string; vin?: string }) => {
    const identifier = payload.mode === 'vin' ? payload.vin ?? '' : payload.plate ?? ''
    const state = payload.mode === 'plate' ? payload.state : undefined
    setConfirmedIdentifier(payload)
    setSuggestedVehicle(null)
    setVehicleResult(null)
    setVehicleLookupStatus('loading')
    setVehicleLookupMessage('')

    try {
      const vehicle = await lookupVehicleByIdentifier({ state, identifier })
      setSuggestedVehicle(vehicle)
      setVehicleLookupStatus('idle')
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'Lookup failed. Please retry.'
      setVehicleLookupStatus('error')
      setVehicleLookupMessage(messageText)
    }
  }

  const handleTowRequest = async (destination?: 'home' | 'shop' | 'custom', customAddress?: string) => {
    if (towLoading) {
      return
    }
    if (destination) {
      setTowDestination(destination)
      if (destination === 'custom' && customAddress) {
        setTowCustomAddress(customAddress)
      }
    }
    setTowLoading(true)
    try {
      if (tow?.towId) {
        const update = await getTowStatus(tow.towId)
        setTow({ towId: tow.towId, status: update.status })
      } else {
        const seed =
          claimRecord?.claimId ??
          (vehicleResult ? `${vehicleResult.year}-${vehicleResult.make}-${vehicleResult.model}` : null) ??
          (confirmedIdentifier
            ? confirmedIdentifier.mode === 'vin'
              ? `vin-${confirmedIdentifier.vin ?? ''}`
              : `plate-${confirmedIdentifier.state ?? ''}-${confirmedIdentifier.plate ?? ''}`
            : null) ??
          selectedScenarioId ??
          'tow'
        const result = await requestTow({ seed })
        setTow({ towId: result.towId, status: result.status })
      }
    } finally {
      setTowLoading(false)
    }
  }

  const handleSubmitClaim = async () => {
    if (!vehicleResult || isSubmitting || claimRecord) {
      return
    }
    setIsSubmitting(true)
    setPostSubmitTransitionDone(false)
    const transitionSeed = [
      selectedScenarioId,
      confirmedIdentifier?.mode ?? '',
      confirmedIdentifier?.mode === 'vin' ? confirmedIdentifier?.vin ?? '' : '',
      confirmedIdentifier?.mode === 'plate' ? confirmedIdentifier?.state ?? '' : '',
      confirmedIdentifier?.mode === 'plate' ? confirmedIdentifier?.plate ?? '' : '',
      String(photos.damagePhoto.length),
      photos.vehiclePhoto ? 'vehicle-photo' : '',
    ]
      .filter(Boolean)
      .join('|')
    const delayMs = 5000 + (hashString(transitionSeed) % 5001)
    setPostSubmitTransition({ delayMs })
    try {
      const incidentDescriptionText = incidentDescription.trim()
      const notesText = additionalNotes.trim()
      const combinedIncidentDescription = [
        incidentDescriptionText,
        notesText ? (incidentDescriptionText ? `Additional notes: ${notesText}` : notesText) : '',
      ]
        .filter(Boolean)
        .join('\n\n')

      const draftNarrationText = generateIncidentNarration(narratorFacts).narration
      const narrationText = (incidentNarrator?.narration ?? draftNarrationText).trim()
      const incidentNarrationText = incidentNarrator?.accepted ? narrationText : undefined

      const claimPayload = {
        vehicle: vehicleResult,
        drivable,
        photos: {
          damage: photos.damagePhoto.length > 0,
          vehicle: Boolean(photos.vehiclePhoto),
          otherInsurance: false,
        },
        estimatedRepairDaysMin: assessment?.estimatedRepairDaysMin,
        estimatedRepairDaysMax: assessment?.estimatedRepairDaysMax,
        repairTimeConfidence: assessment?.repairTimeConfidence,
        estimate: estimateSummary
          ? {
              estimatedRepairCost: estimateSummary.estimatedRepairCost,
              aboveDeductible: estimateSummary.aboveDeductible,
              customerPays: estimateSummary.customerPays,
              insurerPays: estimateSummary.insurerPays,
            }
          : null,
        hasOtherParty,
        otherPartyDetails: hasOtherParty ? otherPartyDetails : null,
        incidentDescription: combinedIncidentDescription ? combinedIncidentDescription : undefined,
        incidentNarrationText: incidentNarrationText ? incidentNarrationText : undefined,
        incidentNarrationAccepted: Boolean(incidentNarrator?.accepted),
        tow: tow ? { requested: Boolean(tow.towId), status: tow.status } : undefined,
      }
      const response = await submitClaim(claimPayload)
      const nextClaimRecord = { claimId: response.claimId, submittedAt: response.submittedAt, ...claimPayload }
      setClaimRecord(nextClaimRecord)
      void persistMostRecentSubmissionFromCustomerFlow({
        claimId: response.claimId,
        submittedAt: response.submittedAt,
        vehicle: claimPayload.vehicle,
        drivable: claimPayload.drivable,
        hasOtherParty: claimPayload.hasOtherParty ?? null,
        policy: policyHolder
          ? {
              policyId: policyHolder.policy.policyId,
              insuredName: policyHolder.name,
              coverage: policyHolder.policy.coverage,
              deductible: policyHolder.policy.deductible,
              rentalCoverage: policyHolder.policy.rentalCoverage,
            }
          : undefined,
        incident: {
          incidentDescription: claimPayload.incidentDescription,
          incidentNarrationText: claimPayload.incidentNarrationText,
          hasOtherParty: claimPayload.hasOtherParty ?? null,
          otherPartyDetails: claimPayload.otherPartyDetails,
          towRequested: claimPayload.tow?.requested,
          towStatus: claimPayload.tow?.status,
        },
        damagePhotos: photos.damagePhoto,
        vehiclePhoto: photos.vehiclePhoto,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  useEffect(() => {
    if (!postSubmitTransition || postSubmitTransitionDone) {
      return
    }
    const timer = window.setTimeout(() => {
      setPostSubmitTransitionDone(true)
    }, postSubmitTransition.delayMs)
    return () => {
      window.clearTimeout(timer)
    }
  }, [postSubmitTransition, postSubmitTransitionDone])

  const handleSelectShop = (shopId: string) => {
    setSelectedShopId(shopId)
  }

  const handleBookRental = async (args: { startDate: string; days: number }) => {
    if (!claimRecord) {
      return
    }
    const booking = await bookRental({
      claimId: claimRecord.claimId,
      startDate: args.startDate,
      days: args.days,
    })
    setRentalBooking(booking)
  }

  const handleBookRide = async (provider: 'Uber' | 'Lyft') => {
    if (!claimRecord) {
      return
    }
    const booking = await bookRideHome({ claimId: claimRecord.claimId, provider })
    setRideBooking(booking)
  }

  useEffect(() => {
    if (!reviewTransition) {
      return
    }
    const timer = window.setTimeout(() => {
      setReviewTransition(null)
      setCurrentStep(4)
    }, reviewTransition.delayMs)
    return () => {
      window.clearTimeout(timer)
    }
  }, [reviewTransition])

  const { headerTitle, headerSubtitle, showProgress } = useMemo(() => {
    if (!flowStarted) {
      return {
        headerTitle: `Welcome${firstName ? `, ${firstName}` : ''}`,
        headerSubtitle: 'Start a claim or view your policy details.',
        showProgress: false,
      }
    }
    if (reviewTransition) {
      return {
        headerTitle: 'Preparing your review',
        headerSubtitle: "We're pulling everything together — this usually takes a few seconds.",
        showProgress: false,
      }
    }
    if (postSubmitTransition && !postSubmitTransitionDone) {
      return {
        headerTitle: 'Processing your claim',
        headerSubtitle: "We're reviewing your photos and details — this usually takes a few seconds.",
        showProgress: false,
      }
    }
    if (claimRecord) {
      return {
        headerTitle: 'Next steps',
        headerSubtitle: "You're all set. We'll take it from here.",
        showProgress: false,
      }
    }
    if (currentStep === 1) {
      return {
        headerTitle: 'Safety & basics',
        headerSubtitle: `${namePrefix}we'll keep this simple.`,
        showProgress: true,
      }
    }
    if (currentStep === 2) {
      return {
        headerTitle: 'Photos',
        headerSubtitle: `${namePrefix}add two photos to start — we’ll analyze the damage in the background.`,
        showProgress: true,
      }
    }
    if (currentStep === 3) {
      return {
        headerTitle: 'Details (optional)',
        headerSubtitle: 'Only add what you have — you can submit now and add later.',
        showProgress: true,
      }
    }
    return {
      headerTitle: 'Review & submit',
      headerSubtitle: 'Confirm everything looks right, then submit your claim.',
      showProgress: true,
    }
  }, [
    claimRecord,
    currentStep,
    firstName,
    flowStarted,
    namePrefix,
    reviewTransition,
    postSubmitTransition,
    postSubmitTransitionDone,
  ])

  const canGoNext = useMemo(() => {
    if (!flowStarted || claimRecord) {
      return false
    }
    if (currentStep === 2) {
      return hasRequiredPhotos
    }
    if (currentStep === 3) {
      return true
    }
    return false
  }, [claimRecord, currentStep, flowStarted, hasRequiredPhotos])

  const handleBack = () => {
    if (!flowStarted || claimRecord) {
      return
    }
    if (reviewTransition) {
      setReviewTransition(null)
      return
    }
    if (currentStep === 1) {
      setFlowStarted(false)
      return
    }
    setCurrentStep((prev) => (prev === 4 ? 3 : prev === 3 ? 2 : 1))
  }

  const handleNext = () => {
    if (!canGoNext) {
      return
    }
    if (currentStep === 3) {
      const seed = [
        selectedScenarioId,
        confirmedIdentifier?.mode ?? '',
        confirmedIdentifier?.mode === 'vin' ? confirmedIdentifier?.vin ?? '' : '',
        confirmedIdentifier?.mode === 'plate' ? confirmedIdentifier?.state ?? '' : '',
        confirmedIdentifier?.mode === 'plate' ? confirmedIdentifier?.plate ?? '' : '',
        String(photos.damagePhoto.length),
        photos.vehiclePhoto ? 'vehicle-photo' : '',
        hasOtherParty === null ? 'other-unknown' : hasOtherParty ? 'other-yes' : 'other-no',
        drivableAnswered ? (drivable === null ? 'drivable-unknown' : drivable ? 'drivable-yes' : 'drivable-no') : 'drivable-unanswered',
      ]
        .filter(Boolean)
        .join('|')
      const delayMs = 8500 + (hashString(seed) % 2501)
      setReviewTransition({ delayMs })
      return
    }
    setCurrentStep((prev) => (prev === 2 ? 3 : prev === 3 ? 4 : prev))
  }

  const nextLabel = useMemo(() => {
    if (currentStep === 2) {
      return 'Next: Details'
    }
    if (currentStep === 3) {
      return 'Next: Review'
    }
    return 'Next'
  }, [currentStep])

  const towStatusLabel = tow?.status ?? (drivableAnswered && drivable === false ? 'Not requested' : 'Not needed')

  const showProcessingScreen = Boolean(postSubmitTransition && !postSubmitTransitionDone)

  if (viewMode !== 'app') {
    return (
      <div className="app">
        <main className="app__shell">
          <div className="app__reset">
            <div className="app__resetPrimary">
              <Link to="/agent" className="link-button link-button--top">
                Claims Agent Review
              </Link>
            </div>
            <div className="app__resetSecondary">
              <button type="button" className="link-button link-button--top" onClick={() => setViewMode('app')}>
                Customer Workflow
              </button>
              <button type="button" className="link-button link-button--top" onClick={() => setViewMode('tow')}>
                Tow driver view
              </button>
            </div>
          </div>
          <section className="panel panel--step">
            <div className="panel__body">
              <button type="button" className="link-button" onClick={() => setViewMode('app')}>
                Back to claim flow
              </button>
	              {viewMode === 'tow' ? (
	                <>
	                  <div className="support callout">
	                    <p className="support__headline">Tow driver summary (AI-generated)</p>
	                    <p className="muted">Use this to coordinate pickup and drop-off.</p>
	                  </div>
                  <div className="summary">
                    <div>
                      <span className="summary__label">Claim</span>
                      <span className="summary__value">{claimLabel}</span>
                    </div>
                    <div>
                      <span className="summary__label">Vehicle</span>
                      <span className="summary__value">{vehicleLabel}</span>
                    </div>
                    <div>
                      <span className="summary__label">Contact</span>
                      <span className="summary__value">
                        {policyholderName} - {policyholderPhone}
                      </span>
                    </div>
                    <div>
                      <span className="summary__label">Pickup location</span>
                      <span className="summary__value">{pickupLocationLabel}</span>
                    </div>
                    <div>
                      <span className="summary__label">Tow status</span>
                      <span className="summary__value">{towStatusLabel}</span>
                    </div>
                    <div>
                      <span className="summary__label">Drivable</span>
                      <span className="summary__value">
                        {!drivableAnswered ? 'Not answered' : drivable === null ? 'Unknown' : drivable ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </div>
                  <div className="field-group">
                    <h3>Location</h3>
                    <p className="muted">{pickupLocationLabel}</p>
                    {hasPickupDestination ? (
                      <>
                        <div className="lookup__actions">
                          <a
                            className="button button--primary"
                            href={googleMapsDirectionsUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Get driving directions
                          </a>
                          <a
                            className="button button--ghost"
                            href={appleMapsDirectionsUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open in Apple Maps
                          </a>
                        </div>
                        <p className="muted">Opens your maps app in a new tab.</p>
                      </>
                    ) : (
                      <p className="muted">Pickup location not provided yet.</p>
                    )}
                  </div>
	                  <div className="support callout">
	                    <p className="support__headline">No further action is required here.</p>
	                    <p className="muted">This is a preview of what the tow driver receives.</p>
	                  </div>
	                </>
	              ) : (
	                <>
	                  {(() => {
	                    const narrationDraft = generateIncidentNarration(narratorFacts)
	                    const narrationText = (incidentNarrator?.narration ?? narrationDraft.narration).trim()
	                    const narrationAccepted = Boolean(incidentNarrator?.accepted)
	                    const narrationConfidence = Math.round(narrationDraft.confidence * 100)
	                    const deductible = policyHolder?.policy.deductible
	                    const needsTow = drivableAnswered && drivable === false
	                    const hasEstimate = Boolean(estimateSummary)
	                    const likelyTotalLoss = Boolean(estimateSummary?.isPotentialTotalLoss)
	                    const otherPartyFlag =
	                      hasOtherParty === null ? 'Not answered' : hasOtherParty ? 'Yes' : 'No'

	                    return (
	                      <div className="form-grid">
	                        <div className="support callout">
	                          <p className="support__headline">AI Summary (internal)</p>
	                          <p className="muted">
	                            {narrationText || 'We’re still gathering details from the intake flow.'}
	                          </p>
	                          <div className="summary summary--compact">
	                            <div>
	                              <span className="summary__label">Confidence</span>
	                              <span className="summary__value">{narrationConfidence}%</span>
	                            </div>
	                            <div>
	                              <span className="summary__label">Other party</span>
	                              <span className="summary__value">{otherPartyFlag}</span>
	                            </div>
	                            <div>
	                              <span className="summary__label">Drivable</span>
	                              <span className="summary__value">
	                                {!drivableAnswered ? 'Not answered' : drivable === null ? 'Unknown' : drivable ? 'Yes' : 'No'}
	                              </span>
	                            </div>
	                          </div>
	                          <div className="field-group">
	                            <h3>Recommended insurer actions</h3>
	                            <ul className="summary__list">
	                              <li>Confirm coverage and assign an adjuster.</li>
	                              <li>Contact insured to confirm safety, location, and drivable status.</li>
	                              {needsTow && <li>Coordinate roadside/tow logistics and confirm drop-off destination.</li>}
	                              {hasOtherParty === true && (
	                                <li>Open a liability review and request other-party contact/insurance details.</li>
	                              )}
	                              {hasEstimate && (
	                                <li>
	                                  Review estimate vs deductible{typeof deductible === 'number' ? ` ($${deductible})` : ''}{' '}
	                                  and set appropriate handling path.
	                                </li>
	                              )}
	                              {likelyTotalLoss && <li>Flag for total loss triage (potential significant damage).</li>}
	                              {assessment && <li>Review photo assessment and request additional photos if needed.</li>}
	                            </ul>
	                          </div>
	                        </div>

	                        <div className="field-group">
	                          <h3>Claim intake status</h3>
	                          <div className="summary summary--compact">
	                            <div>
	                              <span className="summary__label">Claim</span>
	                              <span className="summary__value">{claimLabel}</span>
	                            </div>
	                            <div>
	                              <span className="summary__label">Submitted</span>
	                              <span className="summary__value">{claimRecord ? claimRecord.submittedAt : 'Not submitted'}</span>
	                            </div>
	                            <div>
	                              <span className="summary__label">Scenario (demo)</span>
	                              <span className="summary__value">{selectedScenarioId || 'Not selected'}</span>
	                            </div>
	                            <div>
	                              <span className="summary__label">Safety check</span>
	                              <span className="summary__value">
	                                {safetyStatus === 'need_help' ? 'Help requested' : safetyStatus === 'ok' ? 'OK' : 'Not answered'}
	                              </span>
	                            </div>
	                          </div>
	                        </div>

	                        <div className="field-group">
	                          <h3>Policy & insured</h3>
	                          <div className="summary summary--compact">
	                            <div>
	                              <span className="summary__label">Policy</span>
	                              <span className="summary__value">{policyHolder?.policy.policyId ?? 'Not loaded'}</span>
	                            </div>
	                            <div>
	                              <span className="summary__label">Policyholder</span>
	                              <span className="summary__value">{policyholderName}</span>
	                            </div>
	                            <div>
	                              <span className="summary__label">Coverage</span>
	                              <span className="summary__value">{policyHolder?.policy.coverage ?? 'Unknown'}</span>
	                            </div>
	                            <div>
	                              <span className="summary__label">Deductible</span>
	                              <span className="summary__value">
	                                {typeof deductible === 'number' ? `$${deductible}` : 'Unknown'}
	                              </span>
	                            </div>
	                            <div>
	                              <span className="summary__label">Rental coverage</span>
	                              <span className="summary__value">
	                                {policyHolder ? (policyHolder.policy.rentalCoverage ? 'Yes' : 'No') : 'Unknown'}
	                              </span>
	                            </div>
	                            {policyPreview && (
	                              <div>
	                                <span className="summary__label">Policy term</span>
	                                <span className="summary__value">
	                                  {policyPreview.effectiveStart} – {policyPreview.effectiveEnd}
	                                </span>
	                              </div>
	                            )}
	                          </div>
	                        </div>

	                        <div className="field-group">
	                          <h3>Vehicle & identifier</h3>
	                          <div className="summary summary--compact">
	                            <div>
	                              <span className="summary__label">Vehicle</span>
	                              <span className="summary__value">{vehicleLabel}</span>
	                            </div>
	                            <div>
	                              <span className="summary__label">Identifier</span>
	                              <span className="summary__value">{identifierLabel}</span>
	                            </div>
	                            <div>
	                              <span className="summary__label">Lookup status</span>
	                              <span className="summary__value">
	                                {vehicleResult ? 'Matched' : suggestedVehicle ? 'Suggested (unconfirmed)' : 'Pending'}
	                              </span>
	                            </div>
	                          </div>
	                        </div>

	                        <div className="field-group">
	                          <h3>Loss details</h3>
	                          <div className="summary summary--compact">
	                            <div>
	                              <span className="summary__label">Other party involved</span>
	                              <span className="summary__value">{otherPartyFlag}</span>
	                            </div>
	                            <div>
	                              <span className="summary__label">Drivable</span>
	                              <span className="summary__value">
	                                {!drivableAnswered ? 'Not answered' : drivable === null ? 'Unknown' : drivable ? 'Yes' : 'No'}
	                              </span>
	                            </div>
	                            <div>
	                              <span className="summary__label">Photos</span>
	                              <span className="summary__value">
	                                Damage: {photos.damagePhoto.length > 0 ? `${photos.damagePhoto.length}` : '0'} • Vehicle:{' '}
	                                {photos.vehiclePhoto ? 'Yes' : 'No'}
	                              </span>
	                            </div>
	                            <div>
	                              <span className="summary__label">Pickup location</span>
	                              <span className="summary__value">{pickupLocationLabel}</span>
	                            </div>
	                            <div>
	                              <span className="summary__label">Tow</span>
	                              <span className="summary__value">{towStatusLabel}</span>
	                            </div>
	                          </div>
	                        </div>

	                        <div className="field-group">
	                          <h3>Photo assessment (mock AI)</h3>
	                          {assessment ? (
	                            <div className="summary summary--compact">
	                              <div>
	                                <span className="summary__label">Severity</span>
	                                <span className="summary__value">{assessment.severity}</span>
	                              </div>
	                              <div>
	                                <span className="summary__label">Confidence</span>
	                                <span className="summary__value">{assessment.confidence}%</span>
	                              </div>
	                              <div>
	                                <span className="summary__label">Damage types</span>
	                                <span className="summary__value">{assessment.damageTypes.join(', ')}</span>
	                              </div>
	                              <div>
	                                <span className="summary__label">Recommended</span>
	                                <span className="summary__value">{assessment.recommendedNextStep}</span>
	                              </div>
	                            </div>
	                          ) : (
	                            <p className="muted">No assessment yet.</p>
	                          )}
	                        </div>

	                        <div className="field-group">
	                          <h3>Estimate (mock)</h3>
	                          {estimateSummary ? (
	                            <div className="summary summary--compact">
	                              <div>
	                                <span className="summary__label">Estimated repair cost</span>
	                                <span className="summary__value">${estimateSummary.estimatedRepairCost}</span>
	                              </div>
	                              <div>
	                                <span className="summary__label">Deductible outcome</span>
	                                <span className="summary__value">
	                                  {estimateSummary.aboveDeductible ? 'Likely above' : 'Likely below'}
	                                </span>
	                              </div>
	                              <div>
	                                <span className="summary__label">Customer pays</span>
	                                <span className="summary__value">${estimateSummary.customerPays}</span>
	                              </div>
	                              <div>
	                                <span className="summary__label">Insurer pays</span>
	                                <span className="summary__value">${estimateSummary.insurerPays}</span>
	                              </div>
	                              <div>
	                                <span className="summary__label">Potential total loss</span>
	                                <span className="summary__value">{estimateSummary.isPotentialTotalLoss ? 'Yes' : 'No'}</span>
	                              </div>
	                            </div>
	                          ) : (
	                            <p className="muted">Estimate not available yet.</p>
	                          )}
	                        </div>

	                        {hasOtherParty === true && (
	                          <div className="field-group">
	                            <h3>Other party details</h3>
	                            <div className="summary summary--compact">
	                              <div>
	                                <span className="summary__label">No info provided</span>
	                                <span className="summary__value">{otherPartyDetails.noInfo ? 'Yes' : 'No'}</span>
	                              </div>
	                              <div>
	                                <span className="summary__label">Driver name</span>
	                                <span className="summary__value">{otherPartyDetails.otherDriverName || '—'}</span>
	                              </div>
	                              <div>
	                                <span className="summary__label">Contact</span>
	                                <span className="summary__value">{otherPartyDetails.otherContact || '—'}</span>
	                              </div>
	                              <div>
	                                <span className="summary__label">Vehicle plate</span>
	                                <span className="summary__value">
	                                  {otherPartyDetails.otherVehiclePlate
	                                    ? `${otherPartyDetails.otherVehiclePlate}${otherPartyDetails.otherVehicleState ? ` (${otherPartyDetails.otherVehicleState})` : ''}`
	                                    : '—'}
	                                </span>
	                              </div>
	                              <div>
	                                <span className="summary__label">Vehicle</span>
	                                <span className="summary__value">{otherPartyDetails.otherVehicleMakeModel || '—'}</span>
	                              </div>
	                              <div>
	                                <span className="summary__label">Carrier</span>
	                                <span className="summary__value">{otherPartyDetails.insuranceCarrier || '—'}</span>
	                              </div>
	                              <div>
	                                <span className="summary__label">Policy #</span>
	                                <span className="summary__value">{otherPartyDetails.policyNumber || '—'}</span>
	                              </div>
	                            </div>
	                            {otherPartyDetails.notes.trim() && (
	                              <div className="callout">
	                                <p className="muted" style={{ margin: 0 }}>
	                                  {otherPartyDetails.notes.trim()}
	                                </p>
	                              </div>
	                            )}
	                          </div>
	                        )}

	                        <div className="field-group">
	                          <h3>Customer-provided description</h3>
	                          <div className="callout">
	                            <p className="muted" style={{ margin: 0 }}>
	                              {incidentDescription.trim() || 'None provided.'}
	                            </p>
	                          </div>
	                        </div>

	                        <div className="field-group">
	                          <h3>AI incident narration</h3>
	                          <div className="summary summary--compact">
	                            <div>
	                              <span className="summary__label">Accepted by customer</span>
	                              <span className="summary__value">{narrationAccepted ? 'Yes' : 'No'}</span>
	                            </div>
	                            <div>
	                              <span className="summary__label">Headline</span>
	                              <span className="summary__value">{narrationDraft.headline}</span>
	                            </div>
	                          </div>
	                          <div className="callout">
	                            <p className="muted" style={{ margin: 0 }}>
	                              {narrationText || 'Not available.'}
	                            </p>
	                          </div>
	                          <ul className="summary__list">
	                            {narrationDraft.disclaimers.map((line) => (
	                              <li key={line}>{line}</li>
	                            ))}
	                          </ul>
	                        </div>
	                      </div>
	                    )
	                  })()}
	                </>
	              )}
	            </div>
	          </section>
          <footer className="app__footer">
            <a
              className="app__footerLink"
              href="https://www.linkedin.com/in/darinlaframboise/"
              target="_blank"
              rel="noreferrer"
            >
              This is a project by Darin LaFramboise
            </a>
          </footer>
        </main>
      </div>
    )
  }

  const step1ShowIncident = safetyStatus !== ''
  const step1ShowVehicle = step1ShowIncident && hasOtherParty !== null && drivableAnswered

  return (
    <div className="app">
      <main className="app__shell">
        <div className="app__reset">
          <div className="app__resetPrimary">
            <Link to="/agent" className="link-button link-button--top">
              Claims Agent Review
            </Link>
          </div>
          <div className="app__resetSecondary">
            <button type="button" className="link-button link-button--top" onClick={() => setViewMode('app')}>
              Customer Workflow
            </button>
            <button type="button" className="link-button link-button--top" onClick={() => setViewMode('tow')}>
              Tow driver view
            </button>
          </div>
        </div>

        <header className="app__brand">
          <img src={fenderbenderLogo} alt="FenderBender Mutual" className="app__brandLogo" />
        </header>

        <ProgressHeader
          currentStep={currentStep}
          totalSteps={TOTAL_STEPS}
          title={headerTitle}
          subtitle={headerSubtitle}
          showProgress={showProgress}
        />

        <section className="panel panel--step">
          <div className="panel__body">
            {!flowStarted && (
              <div className="form-grid">
                <div className="action-grid">
                  <button
                    type="button"
                    className="button button--primary"
                    onClick={handleStartClaim}
                    disabled={!selectedScenarioId}
                  >
                    Start a claim
                  </button>
                  <button
                    type="button"
                    className="button button--ghost"
                    onClick={() => setLandingPanel('insurance_card')}
                    disabled={!policyPreview}
                  >
                    View insurance card
                  </button>
                  <button
                    type="button"
                    className="button button--ghost"
                    onClick={() => setLandingPanel('policy')}
                    disabled={!policyPreview}
                  >
                    Review my policy
                  </button>
                </div>

                {USE_NEW_ESTIMATE && scenarioOptions.length > 0 && (
                  <details className="field-group" open>
                    <summary>Demo setup</summary>
                    <p className="field__hint">Prototype data only. This does not submit a real claim.</p>
                    <label className="field">
                      <span className="field__label">Scenario</span>
                      <select
                        className="field__input"
                        value={selectedScenarioId}
                        onChange={(event) => setSelectedScenarioId(event.target.value)}
                      >
                        {scenarioOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </details>
                )}

                {landingPanel !== null && policyPreview && (
                  <div className="overlay" role="dialog" aria-modal="true">
                    <div className="dialog">
                      <div className="dialog__header">
                        <div>
                          <h2 className="dialog__title">
                            {landingPanel === 'insurance_card' ? 'Insurance card' : 'Policy details'}
                          </h2>
                          <p className="muted" style={{ margin: '4px 0 0 0' }}>
                            {landingPanel === 'insurance_card'
                              ? 'For reference only (demo).'
                              : 'This is a simplified mock policy declaration.'}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="button button--ghost"
                          onClick={() => setLandingPanel(null)}
                        >
                          Close
                        </button>
                      </div>

                      {landingPanel === 'insurance_card' ? (
                        <div className="insurance-card">
                          <div className="insurance-card__row">
                            <div>
                              <div className="insurance-card__brand">FenderBender Mutual</div>
                              <div className="insurance-card__sub">Auto insurance ID card</div>
                            </div>
                            <img
                              src={fenderbenderLogo}
                              alt="FenderBender Mutual"
                              className="insurance-card__logo"
                            />
                          </div>

                          <div className="insurance-card__grid">
                            <div>
                              <div className="insurance-card__label">Named insured</div>
                              <div className="insurance-card__value">{policyPreview.insuredName}</div>
                            </div>
                            <div>
                              <div className="insurance-card__label">Policy</div>
                              <div className="insurance-card__value">{policyPreview.policyId}</div>
                            </div>
                            <div>
                              <div className="insurance-card__label">Effective dates</div>
                              <div className="insurance-card__value">
                                {policyPreview.effectiveStart} – {policyPreview.effectiveEnd}
                              </div>
                            </div>
                            <div>
                              <div className="insurance-card__label">Claims</div>
                              <div className="insurance-card__value">(555) 014-CLAIM</div>
                            </div>
                          </div>

                          <div className="insurance-card__grid">
                            <div>
                              <div className="insurance-card__label">Coverage</div>
                              <div className="insurance-card__value">{policyPreview.coverage}</div>
                            </div>
                            <div>
                              <div className="insurance-card__label">Deductible</div>
                              <div className="insurance-card__value">${policyPreview.deductible}</div>
                            </div>
                            <div>
                              <div className="insurance-card__label">Rental</div>
                              <div className="insurance-card__value">{policyPreview.rentalCoverage ? 'Yes' : 'No'}</div>
                            </div>
                            <div>
                              <div className="insurance-card__label">Roadside</div>
                              <div className="insurance-card__value">{policyPreview.roadside ? 'Yes' : 'No'}</div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="form-grid">
                          <div className="summary summary--compact">
                            <div>
                              <span className="summary__label">Policy</span>
                              <span className="summary__value">{policyPreview.policyId}</span>
                            </div>
                            <div>
                              <span className="summary__label">Named insured</span>
                              <span className="summary__value">{policyPreview.insuredName}</span>
                            </div>
                            <div>
                              <span className="summary__label">Policy term</span>
                              <span className="summary__value">
                                {policyPreview.effectiveStart} – {policyPreview.effectiveEnd}
                              </span>
                            </div>
                          </div>

                          <div className="field-group">
                            <h3>Coverages & limits</h3>
                            <ul className="summary__list">
                              <li>
                                <span className="summary__label">Bodily injury liability</span>{' '}
                                {policyPreview.liability.bi}
                              </li>
                              <li>
                                <span className="summary__label">Property damage liability</span>{' '}
                                {policyPreview.liability.pd}
                              </li>
                              <li>
                                <span className="summary__label">Uninsured/Underinsured motorist</span>{' '}
                                {policyPreview.uninsuredMotorist}
                              </li>
                              <li>
                                <span className="summary__label">Medical payments / PIP</span>{' '}
                                {policyPreview.medicalPayments}
                              </li>
                              <li>
                                <span className="summary__label">Collision / Comprehensive</span>{' '}
                                {policyPreview.coverage} (deductible ${policyPreview.deductible})
                              </li>
                              <li>
                                <span className="summary__label">Rental reimbursement</span>{' '}
                                {policyPreview.rentalCoverage ? 'Included' : 'Not included'}
                              </li>
                              <li>
                                <span className="summary__label">Roadside assistance</span>{' '}
                                {policyPreview.roadside ? 'Included' : 'Not included'}
                              </li>
                            </ul>
                            <p className="muted">
                              Limits shown are typical declaration-style summaries. Actual coverage depends on the full policy.
                            </p>
                          </div>

                          <div className="field-group">
                            <h3>Contacts</h3>
                            <div className="summary summary--compact">
                              <div>
                                <span className="summary__label">Claims</span>
                                <span className="summary__value">(555) 014-CLAIM</span>
                              </div>
                              <div>
                                <span className="summary__label">Roadside</span>
                                <span className="summary__value">(555) 014-TOWS</span>
                              </div>
                              <div>
                                <span className="summary__label">Member services</span>
                                <span className="summary__value">(555) 014-HELP</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {flowStarted && claimRecord && (
              <>
                {showProcessingScreen ? (
                  <div className="field-group">
                    <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                      <div className="ai-sparkle" aria-hidden="true" />
                      <div style={{ flex: 1 }}>
                        <h2 style={{ margin: 0 }}>AI is finishing up</h2>
                        <p className="muted" style={{ margin: '6px 0 0 0' }}>
                          Reviewing photos, confirming your vehicle, and preparing next steps
                          <span className="thinking-dots" aria-hidden="true">
                            <span className="thinking-dots__dot">.</span>
                            <span className="thinking-dots__dot thinking-dots__dot--2">.</span>
                            <span className="thinking-dots__dot thinking-dots__dot--3">.</span>
                          </span>
                        </p>
                        <p className="muted" style={{ margin: '6px 0 0 0' }}>
                          You can relax — we’ll guide you through what happens next.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <PostSubmissionNextSteps
                    claimId={claimId ?? ''}
                    drivable={drivable !== false}
                    vehicle={vehicleResult!}
                    policy={policyHolder?.policy ?? null}
                    repairTime={
                      claimRecord.estimatedRepairDaysMin !== undefined &&
                      claimRecord.estimatedRepairDaysMax !== undefined
                        ? {
                            minDays: claimRecord.estimatedRepairDaysMin,
                            maxDays: claimRecord.estimatedRepairDaysMax,
                            confidence: claimRecord.repairTimeConfidence ?? 0.65,
                          }
                        : assessment
                          ? {
                              minDays: assessment.estimatedRepairDaysMin,
                              maxDays: assessment.estimatedRepairDaysMax,
                              confidence: assessment.repairTimeConfidence,
                            }
                          : null
                    }
                    tow={tow}
                    towDestination={towDestination}
                    towCustomAddress={towCustomAddress}
                    towLoading={towLoading}
                    selectedShopId={selectedShopId}
                    rentalBooking={rentalBooking}
                    rideBooking={rideBooking}
                    onRequestTow={() => handleTowRequest()}
                    onSelectShop={handleSelectShop}
                    onBookRental={handleBookRental}
                    onBookRide={handleBookRide}
                  />
                )}
              </>
            )}

            {flowStarted && !claimRecord && isSubmitting && showProcessingScreen && (
              <div className="form-grid">
                <div className="field-group">
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                    <div className="ai-sparkle" aria-hidden="true" />
                    <div style={{ flex: 1 }}>
                      <h2 style={{ margin: 0 }}>Submitting your claim</h2>
                      <p className="muted" style={{ margin: '6px 0 0 0' }}>
                        Reviewing photos, confirming details, and generating your next steps
                        <span className="thinking-dots" aria-hidden="true">
                          <span className="thinking-dots__dot">.</span>
                          <span className="thinking-dots__dot thinking-dots__dot--2">.</span>
                          <span className="thinking-dots__dot thinking-dots__dot--3">.</span>
                        </span>
                      </p>
                      <p className="muted" style={{ margin: '6px 0 0 0' }}>
                        This usually takes a few seconds.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {flowStarted && !claimRecord && currentStep === 1 && (
              <div className="form-grid">
                <fieldset className="field-group">
                  <legend>Safety check</legend>
                  <div className="support callout">
                    <p className="support__headline">{namePrefix}first: is everyone safe?</p>
                    <p className="muted">If you need immediate help, call 911.</p>
                  </div>
                  <div className="option-grid">
                    <button
                      type="button"
                      className={`button option-card ${safetyStatus === 'ok' ? 'option-card--selected' : ''}`}
                      onClick={() => setSafetyStatus('ok')}
                    >
                      <span className="option-card__icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none">
                          <path
                            d="M12 22s8-4.6 8-12V6.8L12 3 4 6.8V10c0 7.4 8 12 8 12Z"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M8.5 12.2 11 14.7l4.7-5.1"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                      <span className="option-card__text">
                        <span className="option-card__title">Yes, we’re safe</span>
                        <span className="option-card__hint">Continue your claim</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className={`button option-card ${
                        safetyStatus === 'need_help' ? 'option-card--selected option-card--warn' : ''
                      }`}
                      onClick={() => setSafetyStatus('need_help')}
                    >
                      <span className="option-card__icon option-card__icon--warn" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none">
                          <path
                            d="M12 9v4"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                          <path
                            d="M12 17h.01"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                          />
                          <path
                            d="M10.3 4.6 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.6a2 2 0 0 0-3.4 0Z"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                      <span className="option-card__text">
                        <span className="option-card__title">Need help now</span>
                        <span className="option-card__hint">Call 911 if urgent</span>
                      </span>
                    </button>
                  </div>
                  {safetyStatus === 'need_help' && (
                    <div className="callout callout--warn">
                      <strong>If this is an emergency, call 911.</strong> You can continue the claim when you're ready.
                    </div>
                  )}
                </fieldset>

                {step1ShowIncident && (
                  <fieldset className="field-group">
                    <legend>Incident basics</legend>

                    <div className="field">
                      <span className="field__label">Was another vehicle or person involved?</span>
                      <div className="option-grid option-grid--two">
                        <button
                          type="button"
                          className={`button option-card ${hasOtherParty === true ? 'option-card--selected' : ''}`}
                          onClick={() => setHasOtherParty(true)}
                        >
                          <span className="option-card__icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24" fill="none">
                              <path
                                d="M5 16.5V12a2 2 0 0 1 2-2h8.8a2 2 0 0 1 1.6.8l1.6 2.1a2 2 0 0 1 .4 1.2v2.4"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinejoin="round"
                              />
                              <path
                                d="M7.5 18.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"
                                stroke="currentColor"
                                strokeWidth="2"
                              />
                              <path
                                d="M17 18.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"
                                stroke="currentColor"
                                strokeWidth="2"
                              />
                              <path
                                d="M8 10V7.5A1.5 1.5 0 0 1 9.5 6h4A1.5 1.5 0 0 1 15 7.5V10"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </span>
                          <span className="option-card__text">
                            <span className="option-card__title">Yes</span>
                            <span className="option-card__hint">Another party involved</span>
                          </span>
                        </button>
                        <button
                          type="button"
                          className={`button option-card ${hasOtherParty === false ? 'option-card--selected' : ''}`}
                          onClick={() => setHasOtherParty(false)}
                        >
                          <span className="option-card__icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24" fill="none">
                              <path
                                d="M4 14.5V12a2 2 0 0 1 2-2h9a2 2 0 0 1 1.6.8l1.6 2.1a2 2 0 0 1 .4 1.2v.4"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinejoin="round"
                              />
                              <path
                                d="M7 18.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"
                                stroke="currentColor"
                                strokeWidth="2"
                              />
                              <path
                                d="M16.5 18.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"
                                stroke="currentColor"
                                strokeWidth="2"
                              />
                              <path
                                d="M20 6 6 20"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                              />
                            </svg>
                          </span>
                          <span className="option-card__text">
                            <span className="option-card__title">No</span>
                            <span className="option-card__hint">Just my vehicle</span>
                          </span>
                        </button>
                      </div>
                    </div>

                    <div className="field">
                      <span className="field__label">Is the car drivable?</span>
                      <div className="option-grid">
                        <button
                          type="button"
                          className={`button option-card ${
                            drivableAnswered && drivable === true ? 'option-card--selected' : ''
                          }`}
                          onClick={() => {
                            setDrivable(true)
                            setDrivableAnswered(true)
                          }}
                        >
                          <span className="option-card__icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24" fill="none">
                              <path
                                d="M7 17a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
                                stroke="currentColor"
                                strokeWidth="2"
                              />
                              <path
                                d="M17 17a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
                                stroke="currentColor"
                                strokeWidth="2"
                              />
                              <path
                                d="M10 14h4"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                              />
                              <path
                                d="M8.5 8h7l1.5 3H7l1.5-3Z"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </span>
                          <span className="option-card__text">
                            <span className="option-card__title">Yes</span>
                            <span className="option-card__hint">It can be driven</span>
                          </span>
                        </button>
                        <button
                          type="button"
                          className={`button option-card ${
                            drivableAnswered && drivable === false ? 'option-card--selected' : ''
                          }`}
                          onClick={() => {
                            setDrivable(false)
                            setDrivableAnswered(true)
                          }}
                        >
                          <span className="option-card__icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24" fill="none">
                              <path
                                d="M4 16h2l2-5h8l2 5h2"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinejoin="round"
                              />
                              <path
                                d="M7 16v3M17 16v3"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                              />
                              <path
                                d="M3 9h6"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                              />
                              <path
                                d="M9 7 7 9l2 2"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </span>
                          <span className="option-card__text">
                            <span className="option-card__title">No</span>
                            <span className="option-card__hint">May need a tow</span>
                          </span>
                        </button>
                        <button
                          type="button"
                          className={`button option-card ${
                            drivableAnswered && drivable === null ? 'option-card--selected' : ''
                          }`}
                          onClick={() => {
                            setDrivable(null)
                            setDrivableAnswered(true)
                          }}
                        >
                          <span className="option-card__icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24" fill="none">
                              <path
                                d="M12 18h.01"
                                stroke="currentColor"
                                strokeWidth="3"
                                strokeLinecap="round"
                              />
                              <path
                                d="M9.1 9a3 3 0 1 1 5.2 2c-.9.8-1.3 1.2-1.3 2v.5"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <path
                                d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z"
                                stroke="currentColor"
                                strokeWidth="2"
                              />
                            </svg>
                          </span>
                          <span className="option-card__text">
                            <span className="option-card__title">Not sure</span>
                            <span className="option-card__hint">That’s okay</span>
                          </span>
                        </button>
                      </div>
                      {!drivableAnswered && <p className="field__hint">Choose the best option — “Not sure” is okay.</p>}
                    </div>
                  </fieldset>
                )}

                {step1ShowIncident && drivableAnswered && drivable === false && (
                  <div className="field-group">
                    <div className="summary summary--compact">
                      <div>
                        <span className="summary__label">Pickup location (mock)</span>
                        <span className="summary__value">{pickupLocationLabel}</span>
                      </div>
                      <div>
                        <span className="summary__label">Tow status</span>
                        <span className="summary__value">{tow?.status ?? 'Not requested'}</span>
                      </div>
                    </div>
                    <div className="lookup__actions">
                      <button
                        type="button"
                        className="button button--primary"
                        onClick={() => void handleTowRequest(towDestination || 'shop', towCustomAddress)}
                        disabled={towLoading}
                      >
                        {tow?.towId
                          ? towLoading
                            ? 'Updating tow...'
                            : 'Update tow status'
                          : towLoading
                            ? 'Requesting tow...'
                            : 'Request tow now'}
                      </button>
                      <button
                        type="button"
                        className="button button--ghost"
                        onClick={() => setPreSubmitRideRequested(true)}
                      >
                        Book ride home
                      </button>
                    </div>
                    {preSubmitRideRequested && <p className="muted">We’ll help you book a ride right after you submit.</p>}
                  </div>
                )}

                {step1ShowVehicle && (
                  <fieldset className="field-group">
                    <legend>Vehicle identifier</legend>
                    <p className="muted">Enter your plate + state, or your VIN (17 characters).</p>

                    {vehicleResult ? (
                      <>
                        <div className="summary summary--compact">
                          <div>
                            <span className="summary__label">Vehicle</span>
                            <div className="summary__split">
                              <span className="summary__value">{vehicleLabel}</span>
                              <button
                                type="button"
                                className="link-button"
                                onClick={() => {
                                  setVehicleResult(null)
                                  setSuggestedVehicle(null)
                                  setVehicleLookupStatus('idle')
                                  setVehicleLookupMessage('')
                                  setConfirmedIdentifier(null)
                                  setLookupKey((prev) => prev + 1)
                                }}
                              >
                                Edit
                              </button>
                            </div>
                          </div>
                          <div>
                            <span className="summary__label">Identifier</span>
                            <span className="summary__value">{identifierLabel}</span>
                          </div>
                        </div>
                        <button type="button" className="button button--primary" onClick={() => setCurrentStep(2)}>
                          Continue
                        </button>
                      </>
                    ) : suggestedVehicle ? (
                      <>
                        <div className="summary summary--compact">
                          <div>
                            <span className="summary__label">We found</span>
                            <span className="summary__value">
                              {suggestedVehicle.year} {suggestedVehicle.make} {suggestedVehicle.model}
                            </span>
                          </div>
                          <div>
                            <span className="summary__label">Body type</span>
                            <span className="summary__value">{suggestedVehicle.bodyType}</span>
                          </div>
                          <div>
                            <span className="summary__label">Identifier</span>
                            <span className="summary__value">{identifierLabel}</span>
                          </div>
                        </div>

                        <div className="lookup__actions">
                          <button
                            type="button"
                            className="button button--primary"
                            onClick={() => {
                              setVehicleResult(suggestedVehicle)
                              setSuggestedVehicle(null)
                              setCurrentStep(2)
                            }}
                          >
                            Confirm this vehicle
                          </button>
                          <button
                            type="button"
                            className="button button--ghost"
                            onClick={() => {
                              setSuggestedVehicle(null)
                              setVehicleLookupStatus('idle')
                              setVehicleLookupMessage('')
                              setLookupKey((prev) => prev + 1)
                            }}
                          >
                            Edit plate or VIN
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <VehicleIdentifierEntry
                          key={lookupKey}
                          initialStateCode={
                            confirmedIdentifier?.mode === 'plate' ? confirmedIdentifier.state : undefined
                          }
                          hideConfirm
                          onDraft={(draft) => {
                            setIdentifierDraft(draft)
                            if (vehicleLookupStatus === 'error') {
                              setVehicleLookupStatus('idle')
                              setVehicleLookupMessage('')
                            }
                          }}
                        />

                        {identifierDraft?.canConfirm && (
                          <div className="lookup__actions">
                            <button
                              type="button"
                              className="button button--primary"
                              onClick={() => {
                                const payload = identifierDraft.payload
                                if (!payload || vehicleLookupStatus === 'loading') {
                                  return
                                }
                                void runVehicleLookup(payload)
                              }}
                              disabled={vehicleLookupStatus === 'loading'}
                            >
                              {vehicleLookupStatus === 'loading' ? 'Looking up…' : 'Continue'}
                            </button>
                            <p className="muted">Lookup runs on continue. We’ll show what we found to confirm.</p>
                          </div>
                        )}

                        {vehicleLookupStatus === 'error' && (
                          <p className="field__hint text-error">{vehicleLookupMessage}</p>
                        )}
                      </>
                    )}
                  </fieldset>
                )}
              </div>
            )}

            {flowStarted && !claimRecord && !isSubmitting && currentStep === 2 && (
              <div className="form-grid">
                <div className="support callout">
                  <p className="support__headline">{namePrefix}two quick photos is enough to start.</p>
                  <p className="muted">Start with the damage, then add one full-vehicle photo.</p>
                </div>

                <fieldset className="field-group">
                  <legend>Damage photo</legend>
                  <p className="muted">A clear close-up is great. Add a couple angles if you can.</p>
                  <PhotoChecklistUploader
                    photos={{ ...photos, otherInsurancePhoto: null }}
                    includeOtherInsurance={false}
                    visibleKeys={['damagePhoto']}
                    onPhotoChange={handlePhotoChange}
                  />
                </fieldset>

                {hasDamagePhoto && (
                  <fieldset className="field-group">
                    <legend>Full vehicle photo</legend>
                    <p className="muted">A wide shot that shows the whole vehicle.</p>
                    <PhotoChecklistUploader
                      photos={{ ...photos, otherInsurancePhoto: null }}
                      includeOtherInsurance={false}
                      visibleKeys={['vehiclePhoto']}
                      onPhotoChange={handlePhotoChange}
                    />

                    {hasRequiredPhotos && (isAssessing || assessment || !photoAnalysisMinDelayDone) && (
                      <div className="callout" style={{ marginTop: 12 }}>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                          <div className="ai-sparkle" aria-hidden="true" />
                          <div style={{ flex: 1 }}>
                            <p style={{ margin: 0, fontWeight: 600 }}>
                              {assessment && photoAnalysisMinDelayDone && !isAssessing
                                ? 'Photo analysis ready'
                                : 'AI is analyzing your photos…'}
                            </p>
                            <p className="muted" style={{ margin: '4px 0 0 0' }}>
                              {assessment && photoAnalysisMinDelayDone && !isAssessing
                                ? 'This is a preliminary read — a repair shop will confirm final damage and cost.'
                                : `This helps us estimate severity and next steps. Usually ~${Math.max(
                                    2,
                                    Math.round((photoAnalysisDelayMs || 2000) / 1000),
                                  )} seconds.`}
                            </p>
                          </div>
                        </div>

                        {!photoAnalysisMinDelayDone || isAssessing || !assessment ? (
                          <p className="muted" style={{ margin: '10px 0 0 0' }}>
                            Processing
                            <span className="thinking-dots" aria-hidden="true">
                              <span className="thinking-dots__dot">.</span>
                              <span className="thinking-dots__dot thinking-dots__dot--2">.</span>
                              <span className="thinking-dots__dot thinking-dots__dot--3">.</span>
                            </span>
                          </p>
                        ) : (
                          <div className="summary summary--compact" style={{ marginTop: 12 }}>
                            <div>
                              <span className="summary__label">Severity</span>
                              <span className="summary__value">{assessment.severity}</span>
                            </div>
                            <div>
                              <span className="summary__label">Confidence</span>
                              <span className="summary__value">{assessment.confidence}%</span>
                            </div>
                            <div>
                              <span className="summary__label">Damage types</span>
                              <span className="summary__value">{assessment.damageTypes.join(', ')}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </fieldset>
                )}
              </div>
            )}

            {flowStarted && !claimRecord && !isSubmitting && currentStep === 3 && !reviewTransition && (
              <div className="form-grid">
                <div className="support callout">
                  <p className="support__headline">Only add what you have.</p>
                  <p className="muted">You can submit now and add details later.</p>
                </div>

                {hasOtherParty === true && (
                  <details className="field-group">
                    <summary>Other driver / vehicle</summary>
                    <OtherPartyInfo value={otherPartyDetails} onChange={setOtherPartyDetails} />
                  </details>
                )}

                <details className="field-group">
                  <summary>Incident description (optional)</summary>
                  <IncidentDescription
                    ctx={copilotCtx}
                    value={incidentDescription}
                    onChange={setIncidentDescription}
                    hasOtherParty={hasOtherParty === true}
                    otherParty={hasOtherParty === true ? otherPartyDetails : undefined}
                  />
                </details>

                <details className="field-group">
                  <summary>Additional notes</summary>
                  <label className="field">
                    <span className="field__label">Notes (optional)</span>
                    <textarea
                      className="field__input"
                      rows={4}
                      value={additionalNotes}
                      placeholder="Optional: Anything else you want us to know."
                      onChange={(event) => setAdditionalNotes(event.target.value)}
                    />
                  </label>
                </details>
              </div>
            )}

            {flowStarted && !claimRecord && !isSubmitting && currentStep === 3 && reviewTransition && (
              <div className="form-grid">
                <div className="field-group">
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                    <div className="ai-sparkle" aria-hidden="true" />
                    <div style={{ flex: 1 }}>
                      <h2 style={{ margin: 0 }}>AI is preparing your review</h2>
                      <p className="muted" style={{ margin: '6px 0 0 0' }}>
                        Summarizing photos, estimate, and details you provided
                        <span className="thinking-dots" aria-hidden="true">
                          <span className="thinking-dots__dot">.</span>
                          <span className="thinking-dots__dot thinking-dots__dot--2">.</span>
                          <span className="thinking-dots__dot thinking-dots__dot--3">.</span>
                        </span>
                      </p>
                      <p className="muted" style={{ margin: '6px 0 0 0' }}>
                        Take a breath — you’re doing great. You can submit now and adjust anything later.
                      </p>
                    </div>
                  </div>

                  <div className="callout" style={{ marginTop: 12 }}>
                    <p style={{ margin: 0, fontWeight: 600 }}>Quick tips while you wait</p>
                    <ul className="summary__list" style={{ marginTop: 8 }}>
                      <li>If you feel unsafe or anyone is hurt, call 911 first.</li>
                      <li>Move to a safe location if you can do so safely.</li>
                      <li>Try not to discuss fault — just exchange details if appropriate.</li>
                      <li>We’ll guide you through the next steps and logistics.</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {flowStarted && !claimRecord && !isSubmitting && currentStep === 4 && (
              <div className="form-grid">
                {USE_NEW_ESTIMATE && policyHolder && (
                  <PolicySummary
                    policyId={policyHolder.policy.policyId}
                    deductible={policyHolder.policy.deductible}
                    coverage={policyHolder.policy.coverage}
                    rentalCoverage={policyHolder.policy.rentalCoverage}
                    estimatedRepairCost={estimateSummary?.estimatedRepairCost}
                  />
                )}

                {assessment && (
                  <div className="summary summary--compact">
                    <div>
                      <span className="summary__label">Estimated repair time</span>
                      <span className="summary__value">
                        {assessment.estimatedRepairDaysMin}–{assessment.estimatedRepairDaysMax} days
                      </span>
                    </div>
                    <div>
                      <span className="summary__label">Repair time confidence</span>
                      <span className="summary__value">
                        {Math.round(assessment.repairTimeConfidence * 100)}%
                      </span>
                    </div>
                    <div className="summary__full">
                      <p className="muted" style={{ margin: 0 }}>
                        Preliminary — a shop confirms final timeline.
                      </p>
                    </div>
                  </div>
                )}

                {hasOtherParty === true && (
                  <div className="field-group">
                    <div className="summary summary--compact">
                      <div>
                        <span className="summary__label">Other driver / vehicle</span>
                        <div className="summary__split">
                          <span className="summary__value">
                            {otherPartyDetails.noInfo ? 'No info provided' : 'Details captured'}
                          </span>
                          <button type="button" className="link-button" onClick={() => setCurrentStep(3)}>
                            Edit
                          </button>
                        </div>
                      </div>
                      {!otherPartyDetails.noInfo && (
                        <>
                          <div>
                            <span className="summary__label">Driver</span>
                            <span className="summary__value">{otherPartyDetails.otherDriverName || '—'}</span>
                          </div>
                          <div>
                            <span className="summary__label">Contact</span>
                            <span className="summary__value">{otherPartyDetails.otherContact || '—'}</span>
                          </div>
                          <div>
                            <span className="summary__label">Other vehicle</span>
                            <span className="summary__value">{otherPartyDetails.otherVehicleMakeModel || '—'}</span>
                          </div>
                          <div>
                            <span className="summary__label">Plate</span>
                            <span className="summary__value">
                              {otherPartyDetails.otherVehiclePlate
                                ? `${otherPartyDetails.otherVehiclePlate}${
                                    otherPartyDetails.otherVehicleState
                                      ? ` (${otherPartyDetails.otherVehicleState})`
                                      : ''
                                  }`
                                : '—'}
                            </span>
                          </div>
                          <div>
                            <span className="summary__label">Insurance</span>
                            <span className="summary__value">{otherPartyDetails.insuranceCarrier || '—'}</span>
                          </div>
                          <div>
                            <span className="summary__label">Policy #</span>
                            <span className="summary__value">{otherPartyDetails.policyNumber || '—'}</span>
                          </div>
                        </>
                      )}
                    </div>

                    {!otherPartyDetails.noInfo && otherPartyDetails.notes.trim() && (
                      <div className="callout">
                        <p className="muted" style={{ margin: 0 }}>
                          {otherPartyDetails.notes.trim()}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {vehicleResult && assessment && (
                  <IncidentNarratorCard
                    facts={narratorFacts}
                    value={incidentNarrator}
                    onChange={setIncidentNarrator}
                    compact
                  />
                )}

                <SubmitClaimCard
                  vehicle={vehicleResult}
                  drivable={drivableAnswered ? drivable : null}
                  hasOtherParty={hasOtherParty}
                  photosSummary={{
                    damageCount: photos.damagePhoto.length,
                    vehicle: Boolean(photos.vehiclePhoto),
                    otherInsurance: false,
                  }}
                  estimateSummary={
                    estimateSummary
                      ? {
                          estimatedRepairCost: estimateSummary.estimatedRepairCost,
                          aboveDeductible: estimateSummary.aboveDeductible,
                          customerPays: estimateSummary.customerPays,
                          insurerPays: estimateSummary.insurerPays,
                        }
                      : null
                  }
                  onEditVehicle={() => setCurrentStep(1)}
                  onChangeDrivable={() => setCurrentStep(1)}
                  onChangeOtherParty={() => setCurrentStep(1)}
                  onEditPhotos={() => setCurrentStep(2)}
                  disabled={
                    !vehicleResult ||
                    !hasRequiredPhotos ||
                    safetyStatus === '' ||
                    hasOtherParty === null ||
                    !drivableAnswered ||
                    isSubmitting
                  }
                  submitting={isSubmitting}
                  claimId={claimId}
                  onSubmit={handleSubmitClaim}
                />

                {estimateSummary && vehicleResult && assessment && policyHolder && (
                  <details className="field-group">
                    <summary>Estimate details (optional)</summary>
                    <EstimateBreakdown vehicle={vehicleResult} assessment={assessment} policy={policyHolder.policy} />
                  </details>
                )}
              </div>
            )}
          </div>

          {flowStarted && !claimRecord && (
            <div className="panel__footer">
              <button type="button" className="link-button" onClick={() => {}}>
                Save &amp; continue later
              </button>
              <div className="stepper-actions">
                <button type="button" className="button button--ghost" onClick={handleBack}>
                  Back
                </button>
                {currentStep > 1 && currentStep < TOTAL_STEPS && !reviewTransition && (
                  <button
                    type="button"
                    className="button button--primary"
                    onClick={handleNext}
                    disabled={!canGoNext}
                  >
                    {nextLabel}
                  </button>
                )}
              </div>
            </div>
          )}
        </section>

        <footer className="app__footer">
          <a
            className="app__footerLink"
            href="https://www.linkedin.com/in/darinlaframboise/"
            target="_blank"
            rel="noreferrer"
          >
            This is a project by Darin LaFramboise
          </a>
        </footer>
      </main>
    </div>
  )
}
