import { useEffect, useMemo, useState } from 'react'
import './App.css'
import fenderbenderLogo from './assets/fenderbender-logo.png'
import PhotoChecklistUploader, {
  type ChecklistPhotos,
  type PhotoKey,
} from './components/PhotoChecklistUploader'
import OtherPartyInfo from './components/OtherPartyInfo'
import type { OtherPartyDetails } from './types/claim'
import VehicleIdentifierEntry from './components/VehicleIdentifierEntry'
import AIAssessmentPanel from './components/AIAssessmentPanel'
import EstimateBreakdown from './components/EstimateBreakdown'
import PolicySummary from './components/PolicySummary'
import ProgressHeader from './components/ProgressHeader'
import DrivableCheck from './components/DrivableCheck'
import SubmitClaimCard from './components/SubmitClaimCard'
import PostSubmissionNextSteps from './components/PostSubmissionNextSteps'
import IncidentNarratorCard from './components/IncidentNarratorCard'
import { getMakesForYear, getModelsForYearMake, vehicleYears } from './data/vehicleData'
import {
  assessDamage,
  type AIAssessment,
} from './lib/mockAI'
import { generateRepairEstimate } from './lib/estimation'
import { computeUrgencyMode, type CopilotContext } from './lib/aiCopilot'
import { generateIncidentNarration, type NarratorFacts } from './lib/incidentNarrator'
import { mockLookupLocation } from './lib/mockLocation'
import {
  getPolicyHolderByScenario,
  listDemoScenarios,
  lookupVehicleByIdentifier,
} from './server/fakeApi'
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
const BODY_TYPES: Array<Vehicle['bodyType']> = ['Sedan', 'SUV', 'Truck', 'EV', 'Luxury']

const estimateValueForManualVehicle = (year: number, bodyType: Vehicle['bodyType']) => {
  const baseValue =
    year >= 2023 ? 35000 : year >= 2021 ? 28000 : year >= 2018 ? 18000 : year >= 2015 ? 12000 : 9000
  let adjustment = 0
  if (bodyType === 'SUV') {
    adjustment += 2500
  } else if (bodyType === 'Truck') {
    adjustment += 3000
  } else if (bodyType === 'EV') {
    adjustment += 3500
  } else if (bodyType === 'Luxury') {
    adjustment += 6500
  } else if (bodyType === 'Sedan') {
    adjustment -= 1000
  }
  return Math.max(3000, baseValue + adjustment)
}

function App() {
  const [scenarioOptions, setScenarioOptions] = useState<Array<{ id: string; label: string }>>(
    [],
  )
  const [selectedScenarioId, setSelectedScenarioId] = useState('')
  const [policyHolder, setPolicyHolder] = useState<PolicyHolder | null>(null)
  const [photos, setPhotos] = useState<ChecklistPhotos>({
    damagePhoto: [],
    vehiclePhoto: null,
    otherInsurancePhoto: null,
  })
  const [hasOtherParty, setHasOtherParty] = useState<boolean | null>(null)
  const [otherPartyStatus, setOtherPartyStatus] = useState<'still' | 'left' | ''>('')
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
  const [confirmedIdentifier, setConfirmedIdentifier] = useState<{
    mode: 'plate' | 'vin'
    plate?: string
    state?: string
    vin?: string
  } | null>(null)
  const [lookupKey, setLookupKey] = useState(0)
  const [vehicleResult, setVehicleResult] = useState<Vehicle | null>(null)
  const [suggestedVehicle, setSuggestedVehicle] = useState<Vehicle | null>(null)
  const [vehicleLookupStatus, setVehicleLookupStatus] = useState<'idle' | 'loading' | 'error'>(
    'idle',
  )
  const [vehicleLookupMessage, setVehicleLookupMessage] = useState('')
  const [assessment, setAssessment] = useState<AIAssessment | null>(null)
  const [isAssessing, setIsAssessing] = useState(false)
  const [estimatedRepairCost, setEstimatedRepairCost] = useState<number | null>(null)
  const [currentStep, setCurrentStep] = useState(1)
  const [useManualVehicleEntry, setUseManualVehicleEntry] = useState(false)
  const [manualYear, setManualYear] = useState('')
  const [manualMake, setManualMake] = useState('')
  const [manualModel, setManualModel] = useState('')
  const [manualBodyType, setManualBodyType] = useState<Vehicle['bodyType']>('Sedan')
  const [drivable, setDrivable] = useState<boolean | null>(null)
  const [tow, setTow] = useState<{ towId?: string; status?: TowStatus } | null>(null)
  const [towDestination, setTowDestination] = useState<'home' | 'shop' | 'custom' | ''>('')
  const [towCustomAddress, setTowCustomAddress] = useState('')
  const [towLoading, setTowLoading] = useState(false)
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
    estimate?: {
      estimatedRepairCost: number
      aboveDeductible: boolean
      customerPays: number
      insurerPays: number
    } | null
    drivable: boolean | null
    tow?: { requested: boolean; status?: TowStatus }
  } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null)
  const [rentalBooking, setRentalBooking] = useState<RentalBooking | null>(null)
  const [rideBooking, setRideBooking] = useState<RideBooking | null>(null)
  const claimId = claimRecord?.claimId ?? null
  const [thinkingStepIndex, setThinkingStepIndex] = useState(0)
  const [emergencyAnswer, setEmergencyAnswer] = useState<'yes' | 'no' | ''>('')
  const [emergencyRequested, setEmergencyRequested] = useState(false)
  const [emergencyLoading, setEmergencyLoading] = useState(false)
  const [emergencyLocation, setEmergencyLocation] = useState<{
    lat: number
    lng: number
    accuracy: number
  } | null>(null)
  const [emergencyNotes, setEmergencyNotes] = useState('')
  const [emergencyLocationConfirmed, setEmergencyLocationConfirmed] = useState(false)
  const [emergencyManualLocation, setEmergencyManualLocation] = useState('')
  const [emergencyTranscript, setEmergencyTranscript] = useState('')
  const [emergencySummary, setEmergencySummary] = useState('')
  const [viewMode, setViewMode] = useState<'app' | 'tow' | 'insurer'>('app')
  const [incidentNarrator, setIncidentNarrator] = useState<{
    narration: string
    accepted: boolean
    edits?: Partial<NarratorFacts>
  } | null>(null)
  const [showVehicleIdentifierEdit, setShowVehicleIdentifierEdit] = useState(false)

  const steps = useMemo(() => {
    const includeOtherParty = hasOtherParty === true
    return {
      total: includeOtherParty ? 12 : 11,
      prelude: 1,
      emergency: 2,
      incident: 3,
      photos: 4,
      identifier: 5,
      vehicleConfirm: 6,
      otherParty: includeOtherParty ? 7 : null,
      summary: includeOtherParty ? 8 : 7,
      thinking: includeOtherParty ? 9 : 8,
      assessment: includeOtherParty ? 10 : 9,
      drivable: includeOtherParty ? 11 : 10,
      submit: includeOtherParty ? 12 : 11,
    }
  }, [hasOtherParty])

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

  useEffect(() => {
    if (!vehicleResult || !assessment || !policyHolder) {
      setEstimatedRepairCost(null)
      return
    }
    const estimate = generateRepairEstimate({
      vehicle: vehicleResult,
      assessment,
      policy: policyHolder.policy,
    })
    setEstimatedRepairCost(estimate.estimatedRepairCost)
  }, [assessment, policyHolder, vehicleResult])

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

  const handlePhotoChange = (key: PhotoKey, file: File | File[] | null) => {
    if (key === 'damagePhoto') {
      setPhotos((prev) => ({
        ...prev,
        damagePhoto: Array.isArray(file) ? file : file ? [file] : [],
      }))
    } else {
      setPhotos((prev) => ({ ...prev, [key]: file as File | null }))
    }

    if (key === 'damagePhoto') {
      setAssessment(null)
    }
  }
  const handleConfirmIdentifier = (payload: {
    mode: 'plate' | 'vin'
    plate?: string
    state?: string
    vin?: string
  }) => {
    setConfirmedIdentifier(payload)
    setShowVehicleIdentifierEdit(false)
    setUseManualVehicleEntry(false)
    setVehicleResult(null)
    setSuggestedVehicle(null)
    setVehicleLookupStatus('idle')
    setVehicleLookupMessage('')
    setManualYear('')
    setManualMake('')
    setManualModel('')
    setLookupKey((prev) => prev + 1)
    setCurrentStep(steps.vehicleConfirm)
  }

  const handleRunAssessment = async () => {
    if (photos.damagePhoto.length === 0) {
      return
    }

    setIsAssessing(true)
    const results = await Promise.all(photos.damagePhoto.map((file) => assessDamage(file)))
    if (results.length === 1) {
      setAssessment(results[0])
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
    const combinedDamageTypes = Array.from(
      new Set(results.flatMap((result) => result.damageTypes)),
    )
    const avgConfidence = Math.round(
      results.reduce((sum, result) => sum + result.confidence, 0) / results.length,
    )
    let recommendedNextStep: AIAssessment['recommendedNextStep'] = 'Approve'
    if (combinedSeverity === 'High' || avgConfidence < 70) {
      recommendedNextStep = 'Escalate'
    } else if (combinedSeverity === 'Medium' || avgConfidence < 85) {
      recommendedNextStep = 'Review'
    }
    setAssessment({
      damageTypes: combinedDamageTypes,
      severity: combinedSeverity,
      confidence: avgConfidence,
      recommendedNextStep,
    })
    setIsAssessing(false)
  }

  const handleTowRequest = async (
    destination?: 'home' | 'shop' | 'custom',
    customAddress?: string,
  ) => {
    if (!vehicleResult && !claimRecord) {
      return
    }
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
        const seed = claimRecord?.claimId ?? `${vehicleResult?.make}-${vehicleResult?.model}`
        const result = await requestTow({ seed })
        setTow({ towId: result.towId, status: result.status })
      }
    } finally {
      setTowLoading(false)
    }
  }

  const handleEmergencyLocation = async () => {
    if (emergencyLoading) {
      return
    }
    setEmergencyLoading(true)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setEmergencyLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
          })
          setEmergencyLocationConfirmed(false)
          setEmergencyLoading(false)
        },
        () => {
          setEmergencyLoading(false)
        },
        { enableHighAccuracy: true, timeout: 8000 },
      )
    } else {
      setEmergencyLoading(false)
    }
  }

  const handleEmergencyDispatch = async () => {
    if (emergencyLoading || emergencyRequested) {
      return
    }
    if (!emergencyLocationConfirmed) {
      return
    }
    setEmergencyLoading(true)
    setEmergencyRequested(true)
    setEmergencyLoading(false)
  }

  const handleEmergencyVoiceInput = () => {
    if (emergencyRequested) {
      return
    }
    const sample =
      emergencyNotes.trim().length > 0
        ? emergencyNotes
        : 'Two cars involved. One person feels dizzy. Airbags deployed.'
    setEmergencyTranscript(sample)
    setEmergencyNotes(sample)
  }

  const emergencyLocationLookup = useMemo(() => {
    if (!emergencyLocation) {
      return null
    }
    return mockLookupLocation({ lat: emergencyLocation.lat, lng: emergencyLocation.lng })
  }, [emergencyLocation])

  useEffect(() => {
    const details = emergencyTranscript || emergencyNotes
    const locationText = emergencyLocationLookup
      ? `Location: ${emergencyLocationLookup.formattedAddress} (nearest cross street: ${emergencyLocationLookup.nearestCrossStreet}).`
      : emergencyManualLocation
        ? `Location details: ${emergencyManualLocation}.`
        : ''
    if (!details && !locationText) {
      setEmergencySummary('')
      return
    }
    const summary = `Summary: ${details || 'Crash reported.'}${locationText ? ` ${locationText}` : ''}`
    setEmergencySummary(summary)
  }, [emergencyLocationLookup, emergencyManualLocation, emergencyNotes, emergencyTranscript])

  const handleSubmitClaim = async () => {
    if (!vehicleResult || isSubmitting || claimRecord) {
      return
    }
    setIsSubmitting(true)
    try {
      const draftIncidentDescriptionText = generateIncidentNarration(narratorFacts).narration
      const incidentDescriptionText = (incidentNarrator?.narration ?? draftIncidentDescriptionText).trim()
      const incidentNarrationText = incidentNarrator?.accepted ? incidentDescriptionText : undefined
      const claimPayload = {
        vehicle: vehicleResult,
        drivable,
        photos: {
          damage: photos.damagePhoto.length > 0,
          vehicle: Boolean(photos.vehiclePhoto),
          otherInsurance: Boolean(photos.otherInsurancePhoto),
        },
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
        incidentDescription: incidentDescriptionText ? incidentDescriptionText : undefined,
        incidentNarrationText: incidentNarrationText ? incidentNarrationText : undefined,
        incidentNarrationAccepted: Boolean(incidentNarrator?.accepted),
        tow: tow ? { requested: Boolean(tow.towId), status: tow.status } : undefined,
      }
      const response = await submitClaim(claimPayload)
      setClaimRecord({ claimId: response.claimId, submittedAt: response.submittedAt, ...claimPayload })
    } finally {
      setIsSubmitting(false)
    }
  }

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

  const hasDamagePhoto = photos.damagePhoto.length > 0
  const hasVehiclePhoto = Boolean(photos.vehiclePhoto)

  const hasRequiredPhotos = hasDamagePhoto && hasVehiclePhoto
  const step1Complete = hasRequiredPhotos

  const readyForAssessment = step1Complete && vehicleResult !== null
  const showEstimate =
    USE_NEW_ESTIMATE &&
    vehicleResult &&
    photos.damagePhoto.length > 0 &&
    assessment !== null &&
    policyHolder

  const copilotCtx: CopilotContext = {
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
  }
  const mode = computeUrgencyMode(copilotCtx)

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
      bits.push(state ? `${otherPartyDetails.otherVehiclePlate.trim()} (${state})` : otherPartyDetails.otherVehiclePlate.trim())
    }
    if (otherPartyDetails.otherVehicleMakeModel.trim()) {
      bits.push(otherPartyDetails.otherVehicleMakeModel.trim())
    }
    return bits.length > 0 ? bits.slice(0, 3).join(' • ') : 'Other party details provided'
  }, [hasOtherParty, otherPartyDetails.otherDriverName, otherPartyDetails.otherVehicleMakeModel, otherPartyDetails.otherVehiclePlate, otherPartyDetails.otherVehicleState])

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

  useEffect(() => {
    if (currentStep !== steps.vehicleConfirm) {
      return
    }
    if (useManualVehicleEntry) {
      return
    }
    if (!confirmedIdentifier) {
      return
    }
    if (vehicleResult) {
      setManualYear(String(vehicleResult.year))
      setManualMake(vehicleResult.make)
      setManualModel(vehicleResult.model)
      setManualBodyType(vehicleResult.bodyType)
      return
    }

    let active = true
    const identifier =
      confirmedIdentifier.mode === 'vin'
        ? confirmedIdentifier.vin ?? ''
        : confirmedIdentifier.plate ?? ''
    const state = confirmedIdentifier.mode === 'plate' ? confirmedIdentifier.state : undefined

    setSuggestedVehicle(null)
    setVehicleLookupStatus('loading')
    setVehicleLookupMessage('')

    lookupVehicleByIdentifier({ state, identifier })
      .then((vehicle) => {
        if (!active) {
          return
        }
        setSuggestedVehicle(vehicle)
        setManualYear(String(vehicle.year))
        setManualMake(vehicle.make)
        setManualModel(vehicle.model)
        setManualBodyType(vehicle.bodyType)
        setVehicleLookupStatus('idle')
      })
      .catch((error) => {
        if (!active) {
          return
        }
        const messageText = error instanceof Error ? error.message : 'Lookup failed. Please retry.'
        setVehicleLookupStatus('error')
        setVehicleLookupMessage(messageText)
      })

    return () => {
      active = false
    }
  }, [confirmedIdentifier, currentStep, lookupKey, useManualVehicleEntry, vehicleResult, steps])

  const canConfirmVehicleDetails = useMemo(() => {
    return Boolean(manualYear && manualMake && manualModel)
  }, [manualMake, manualModel, manualYear])

  const yearOptions = vehicleYears
  const makeOptions = useMemo(() => {
    const options = manualYear ? getMakesForYear(manualYear) : []
    if (manualMake && !options.includes(manualMake)) {
      return [manualMake, ...options]
    }
    return options
  }, [manualMake, manualYear])

  const modelOptions = useMemo(() => {
    const options = manualYear && manualMake ? getModelsForYearMake(manualYear, manualMake) : []
    if (manualModel && !options.includes(manualModel)) {
      return [manualModel, ...options]
    }
    return options
  }, [manualMake, manualModel, manualYear])

  const handleConfirmVehicleDetails = () => {
    if (!canConfirmVehicleDetails) {
      return
    }

    const year = Number(manualYear)
    const matchesSuggestion =
      suggestedVehicle !== null &&
      suggestedVehicle.year === year &&
      suggestedVehicle.make === manualMake &&
      suggestedVehicle.model === manualModel &&
      suggestedVehicle.bodyType === manualBodyType
    const estimatedValue = matchesSuggestion
      ? suggestedVehicle!.estimatedValue
      : estimateValueForManualVehicle(year, manualBodyType)

    setVehicleResult({
      year,
      make: manualMake,
      model: manualModel,
      bodyType: manualBodyType,
      estimatedValue,
    })
  }

  const maxAllowedStep = useMemo(() => {
    if (!selectedScenarioId) {
      return steps.prelude
    }
    if (!emergencyAnswer) {
      return steps.emergency
    }
    if (hasOtherParty === null) {
      return steps.incident
    }
    if (!step1Complete) {
      return steps.photos
    }
    if (!confirmedIdentifier && !useManualVehicleEntry) {
      return steps.identifier
    }
    if (!vehicleResult) {
      return steps.vehicleConfirm
    }
    if (!readyForAssessment) {
      return steps.summary
    }
    if (!assessment) {
      return steps.thinking
    }
    if (drivable === null) {
      return steps.drivable
    }
    return steps.submit
  }, [
    assessment,
    confirmedIdentifier,
    drivable,
    emergencyAnswer,
    hasOtherParty,
    readyForAssessment,
    selectedScenarioId,
    step1Complete,
    useManualVehicleEntry,
    vehicleResult,
    steps,
  ])

  useEffect(() => {
    setCurrentStep((prev) => Math.min(prev, maxAllowedStep))
  }, [maxAllowedStep])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [currentStep])

  const canGoNext = useMemo(() => {
    if (currentStep === steps.prelude) {
      return Boolean(selectedScenarioId)
    }
    if (currentStep === steps.emergency) {
      return emergencyAnswer !== ''
    }
    if (currentStep === steps.incident) {
      return hasOtherParty !== null
    }
    if (currentStep === steps.photos) {
      return step1Complete
    }
    if (currentStep === steps.identifier) {
      return step1Complete && (confirmedIdentifier !== null || useManualVehicleEntry)
    }
    if (currentStep === steps.vehicleConfirm) {
      return (
        step1Complete &&
        (confirmedIdentifier !== null || useManualVehicleEntry) &&
        vehicleResult !== null
      )
    }
    if (steps.otherParty && currentStep === steps.otherParty) {
      return true
    }
    if (currentStep === steps.summary) {
      return readyForAssessment && !isAssessing
    }
    if (currentStep === steps.thinking) {
      return false
    }
    if (currentStep === steps.assessment) {
      return assessment !== null && !isAssessing
    }
    if (currentStep === steps.drivable) {
      return drivable !== null
    }
    return false
  }, [
    confirmedIdentifier,
    currentStep,
    assessment,
    drivable,
    emergencyAnswer,
    hasOtherParty,
    isAssessing,
    readyForAssessment,
    selectedScenarioId,
    step1Complete,
    useManualVehicleEntry,
    vehicleResult,
    steps,
  ])

  const { headerTitle, headerSubtitle } = useMemo(() => {
    if (currentStep === steps.prelude) {
      return {
        headerTitle: 'Start your claim',
        headerSubtitle: 'We will set up your policy details before we begin.',
      }
    }
    if (currentStep === steps.emergency) {
      return {
        headerTitle: 'Emergency check',
        headerSubtitle: 'We can get help to you quickly if needed.',
      }
    }
    if (currentStep === steps.incident) {
      return {
        headerTitle: 'Incident basics',
        headerSubtitle: "Only share what you have. You can add details later.",
      }
    }
    if (currentStep === steps.photos) {
      return {
        headerTitle: 'Upload photos',
        headerSubtitle:
          mode === 'urgent'
            ? `${namePrefix}we'll prioritize safety and logistics. Add photos when you can.`
            : mode === 'minor'
              ? `${namePrefix}let's keep this quick—just a few photos to start.`
              : `${namePrefix}let's grab a few details to get started.`,
      }
    }
    if (currentStep === steps.identifier) {
      return {
        headerTitle: 'Enter plate or VIN',
        headerSubtitle: "If you don't have your plate handy, your VIN works too. Either is fine.",
      }
    }
    if (currentStep === steps.vehicleConfirm) {
      return {
        headerTitle: 'Confirm your vehicle',
        headerSubtitle: 'We will use this to match the right repair guidance.',
      }
    }
    if (steps.otherParty && currentStep === steps.otherParty) {
      return {
        headerTitle: 'Other party details',
        headerSubtitle: "Only share what you have. You can add it later.",
      }
    }
    if (currentStep === steps.summary) {
      return {
        headerTitle: 'Summary',
        headerSubtitle:
          mode === 'urgent'
            ? 'Quick check—then we will focus on safety and logistics.'
            : mode === 'minor'
              ? "Quick check—then we'll generate a preliminary estimate."
              : 'Quick check before we generate a preliminary assessment.',
      }
    }
    if (currentStep === steps.thinking) {
      return {
        headerTitle: 'Generating your assessment',
        headerSubtitle: 'Just a moment - we are pulling everything together.',
      }
    }
    if (currentStep === steps.assessment) {
      return {
        headerTitle: 'Damage assessment',
        headerSubtitle:
          mode === 'urgent'
            ? `${namePrefix}safety first—we can help coordinate tow and a ride if needed. A shop will confirm final cost.`
            : mode === 'minor'
              ? `${namePrefix}quick overview—then we'll wrap up the claim. A shop will confirm final cost.`
              : `${namePrefix}this is a preliminary estimate. A shop will confirm final cost.`,
      }
    }
    if (currentStep === steps.drivable) {
      return {
        headerTitle: 'Is the car drivable?',
        headerSubtitle:
          mode === 'urgent'
            ? 'Your safety comes first. If you are unsure, choose not safe—we can help with towing and a ride.'
            : mode === 'minor'
              ? 'Quick safety check—then you can submit your claim.'
              : 'If you are unsure, choose not safe. We can help.',
      }
    }
    return {
      headerTitle: 'Submit claim',
      headerSubtitle:
        mode === 'urgent'
          ? "We'll help with the logistics and keep you updated once it is submitted."
          : mode === 'minor'
            ? "Just a couple taps—then you're done. We'll keep you updated once it is submitted."
            : 'We will keep you updated once it is submitted.',
    }
  }, [currentStep, mode, namePrefix, steps])

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(1, prev - 1))
  }

  const handleRestart = () => {
    setViewMode('app')
    setCurrentStep(1)
    setPhotos({ damagePhoto: [], vehiclePhoto: null, otherInsurancePhoto: null })
    setHasOtherParty(null)
    setOtherPartyStatus('')
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
    setConfirmedIdentifier(null)
    setLookupKey((prev) => prev + 1)
    setVehicleResult(null)
    setSuggestedVehicle(null)
    setVehicleLookupStatus('idle')
    setVehicleLookupMessage('')
    setAssessment(null)
    setIsAssessing(false)
    setEstimatedRepairCost(null)
    setUseManualVehicleEntry(false)
    setManualYear('')
    setManualMake('')
    setManualModel('')
    setManualBodyType('Sedan')
    setDrivable(null)
    setTow(null)
    setTowLoading(false)
    setTowDestination('')
    setTowCustomAddress('')
    setClaimRecord(null)
    setIsSubmitting(false)
    setSelectedShopId(null)
    setRentalBooking(null)
    setRideBooking(null)
    setThinkingStepIndex(0)
    setEmergencyAnswer('')
    setEmergencyRequested(false)
    setEmergencyLoading(false)
    setEmergencyLocation(null)
    setEmergencyNotes('')
    setEmergencyLocationConfirmed(false)
    setEmergencyManualLocation('')
    setEmergencyTranscript('')
    setEmergencySummary('')
    setIncidentNarrator(null)
    setShowVehicleIdentifierEdit(false)
  }

  const handleNext = async () => {
    if (!canGoNext) {
      return
    }
    if (currentStep === steps.summary) {
      if (!assessment && readyForAssessment && !isAssessing) {
        await handleRunAssessment()
      }
      setCurrentStep(steps.thinking)
      return
    }
    setCurrentStep((prev) => Math.min(steps.total, prev + 1))
  }

  const nextLabel = useMemo(() => {
    if (currentStep === steps.prelude) {
      return 'Start claim'
    }
    if (currentStep === steps.emergency) {
      return 'Next: Incident basics'
    }
    if (currentStep === steps.incident) {
      return 'Next: Upload photos'
    }
    if (currentStep === steps.photos) {
      return 'Next: Enter plate or VIN'
    }
    if (currentStep === steps.identifier) {
      return 'Next: Lookup vehicle'
    }
    if (currentStep === steps.vehicleConfirm) {
      return steps.otherParty ? 'Next: Other party info' : 'Next: Summary'
    }
    if (steps.otherParty && currentStep === steps.otherParty) {
      return 'Next: Summary'
    }
    if (currentStep === steps.summary) {
      return 'Generate assessment ✨'
    }
    if (currentStep === steps.thinking) {
      return 'Working on your assessment...'
    }
    if (currentStep === steps.assessment) {
      return 'Next: Drivable check'
    }
    if (currentStep === steps.drivable) {
      return 'Next: Submit claim'
    }
    return 'Next: Submit claim'
  }, [currentStep, steps])

  useEffect(() => {
    if (currentStep !== steps.thinking) {
      return
    }
    setThinkingStepIndex(0)
    const cycle = window.setInterval(() => {
      setThinkingStepIndex((prev) => (prev + 1) % 3)
    }, 1300)
    const timeout = window.setTimeout(() => {
      setCurrentStep(steps.assessment)
    }, 4200)
    return () => {
      window.clearInterval(cycle)
      window.clearTimeout(timeout)
    }
  }, [currentStep, steps])

  const vehicleLabel = vehicleResult
    ? `${vehicleResult.year} ${vehicleResult.make} ${vehicleResult.model}`
    : 'Not identified yet'
  const policyLabel = policyHolder
    ? `FenderBender Mutual - ${policyHolder.policy.coverage} coverage, deductible $${policyHolder.policy.deductible}`
    : 'FenderBender Mutual - Policy not loaded'
  const policyholderName = policyHolder?.name ?? 'Policyholder'
  const policyholderPhone = policyHolder ? '(555) 018-2471' : 'Not available'
  const claimLabel = claimRecord?.claimId ?? 'Not submitted yet'
  const identifierLabel = confirmedIdentifier
    ? confirmedIdentifier.mode === 'vin'
      ? `VIN ${confirmedIdentifier.vin ?? ''}`
      : `Plate ${confirmedIdentifier.state ?? ''} ${confirmedIdentifier.plate ?? ''}`
    : useManualVehicleEntry
      ? 'Manual entry'
      : 'Not provided'
  const pickupLocationLabel = emergencyLocationLookup
    ? `${emergencyLocationLookup.formattedAddress} (near ${emergencyLocationLookup.nearestCrossStreet})`
    : emergencyManualLocation || 'Not provided'
  const pickupDestination = emergencyLocationLookup
    ? emergencyLocationLookup.mapsQuery
    : emergencyManualLocation.trim()
  const hasPickupDestination = pickupDestination.length > 0
  const googleMapsDirectionsUrl = hasPickupDestination
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(pickupDestination)}`
    : ''
  const appleMapsDirectionsUrl = hasPickupDestination
    ? `https://maps.apple.com/?daddr=${encodeURIComponent(pickupDestination)}`
    : ''
  const emergencyNotesLabel =
    emergencySummary || emergencyTranscript || emergencyNotes || 'No emergency notes provided.'
  const towStatusLabel = tow?.status ?? (drivable === false ? 'Not requested' : 'Not needed')

  if (viewMode !== 'app') {
    return (
      <div className="app">
        <main className="app__shell">
          <div className="app__reset">
            <button type="button" className="link-button" onClick={handleRestart}>
              Start workflow over
            </button>
            <button
              type="button"
              className="link-button"
              onClick={() => setViewMode('tow')}
            >
              Tow driver view
            </button>
            <button
              type="button"
              className="link-button"
              onClick={() => setViewMode('insurer')}
            >
              Insurer view
            </button>
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
                        {drivable === null ? 'Unknown' : drivable ? 'Yes' : 'No'}
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
                  <div className="field-group">
                    <h3>Notes for driver</h3>
                    <p className="muted">{emergencyNotesLabel}</p>
                  </div>
                  <div className="support callout">
                    <p className="support__headline">No further action is required here.</p>
                    <p className="muted">This is a preview of what the tow driver receives.</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="support callout">
                    <p className="support__headline">Insurer summary (AI-generated)</p>
                    <p className="muted">This is a preview of the claim summary sent internally.</p>
                  </div>
                  <div className="summary">
                    <div>
                      <span className="summary__label">Claim</span>
                      <span className="summary__value">{claimLabel}</span>
                    </div>
                    <div>
                      <span className="summary__label">Policy</span>
                      <span className="summary__value">{policyLabel}</span>
                    </div>
                    <div>
                      <span className="summary__label">Policyholder</span>
                      <span className="summary__value">{policyholderName}</span>
                    </div>
                    <div>
                      <span className="summary__label">Contact</span>
                      <span className="summary__value">{policyholderPhone}</span>
                    </div>
                    <div>
                      <span className="summary__label">Vehicle</span>
                      <span className="summary__value">{vehicleLabel}</span>
                    </div>
                    <div>
                      <span className="summary__label">Identifier</span>
                      <span className="summary__value">{identifierLabel}</span>
                    </div>
                    <div>
                      <span className="summary__label">Drivable</span>
                      <span className="summary__value">
                        {drivable === null ? 'Unknown' : drivable ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div>
                      <span className="summary__label">Photos</span>
                      <span className="summary__value">
                        {photos.damagePhoto.length} damage, {photos.vehiclePhoto ? 'vehicle' : 'no vehicle'} photo
                      </span>
                    </div>
                    <div>
                      <span className="summary__label">Other driver insurance</span>
                      <span className="summary__value">
                        {photos.otherInsurancePhoto ? 'Received' : 'Not provided'}
                      </span>
                    </div>
                    <div>
                      <span className="summary__label">Emergency check</span>
                      <span className="summary__value">
                        {emergencyAnswer === 'yes' ? 'Emergency requested' : emergencyAnswer === 'no' ? 'No' : 'Unknown'}
                      </span>
                    </div>
                    <div>
                      <span className="summary__label">Emergency notes</span>
                      <span className="summary__value">{emergencyNotesLabel}</span>
                    </div>
                    <div>
                      <span className="summary__label">Emergency location</span>
                      <span className="summary__value">{pickupLocationLabel}</span>
                    </div>
                    <div>
                      <span className="summary__label">Tow status</span>
                      <span className="summary__value">{towStatusLabel}</span>
                    </div>
                    <div>
                      <span className="summary__label">Tow destination</span>
                      <span className="summary__value">
                        {towDestination === 'home'
                          ? 'Home'
                          : towDestination === 'shop'
                            ? selectedShopId
                              ? 'Selected shop'
                              : 'Shop (pending selection)'
                            : towDestination === 'custom'
                              ? towCustomAddress || 'Custom address'
                              : 'Not set'}
                      </span>
                    </div>
                  </div>
                  <div className="field-group">
                    <h3>AI assessment</h3>
                    <div className="summary summary--compact">
                      <div>
                        <span className="summary__label">Severity</span>
                        <span className="summary__value">
                          {assessment ? assessment.severity : 'Pending'}
                        </span>
                      </div>
                      <div>
                        <span className="summary__label">Confidence</span>
                        <span className="summary__value">
                          {assessment ? `${assessment.confidence}%` : 'Pending'}
                        </span>
                      </div>
                      <div>
                        <span className="summary__label">Recommendation</span>
                        <span className="summary__value">
                          {assessment ? assessment.recommendedNextStep : 'Pending'}
                        </span>
                      </div>
                      <div>
                        <span className="summary__label">Damage types</span>
                        <span className="summary__value">
                          {assessment ? assessment.damageTypes.join(', ') : 'Pending'}
                        </span>
                      </div>
                    </div>
                  </div>
                  {hasOtherParty && otherPartyDetails && (
                    <div className="field-group">
                      <h3>Other party details</h3>
                      {otherPartyDetails.noInfo ? (
                        <p className="muted">Policyholder indicated they do not have this info.</p>
                      ) : (
                        <div className="summary summary--compact">
                          <div>
                            <span className="summary__label">Driver name</span>
                            <span className="summary__value">
                              {otherPartyDetails.otherDriverName || 'Not provided'}
                            </span>
                          </div>
                          <div>
                            <span className="summary__label">Contact</span>
                            <span className="summary__value">
                              {otherPartyDetails.otherContact || 'Not provided'}
                            </span>
                          </div>
                          <div>
                            <span className="summary__label">Plate</span>
                            <span className="summary__value">
                              {otherPartyDetails.otherVehiclePlate || 'Not provided'}
                            </span>
                          </div>
                          <div>
                            <span className="summary__label">State</span>
                            <span className="summary__value">
                              {otherPartyDetails.otherVehicleState || 'Not provided'}
                            </span>
                          </div>
                          <div>
                            <span className="summary__label">Vehicle</span>
                            <span className="summary__value">
                              {otherPartyDetails.otherVehicleMakeModel || 'Not provided'}
                            </span>
                          </div>
                          <div>
                            <span className="summary__label">Carrier</span>
                            <span className="summary__value">
                              {otherPartyDetails.insuranceCarrier || 'Not provided'}
                            </span>
                          </div>
                          <div>
                            <span className="summary__label">Policy #</span>
                            <span className="summary__value">
                              {otherPartyDetails.policyNumber || 'Not provided'}
                            </span>
                          </div>
                        </div>
                      )}
                      {otherPartyDetails.notes && (
                        <p className="muted">Notes: {otherPartyDetails.notes}</p>
                      )}
                    </div>
                  )}
                  <div className="field-group">
                    <h3>Estimate summary</h3>
                    <div className="summary summary--compact">
                      <div>
                        <span className="summary__label">Estimated repair</span>
                        <span className="summary__value">
                          {estimateSummary ? `$${estimateSummary.estimatedRepairCost}` : 'Pending'}
                        </span>
                      </div>
                      <div>
                        <span className="summary__label">Deductible impact</span>
                        <span className="summary__value">
                          {estimateSummary
                            ? estimateSummary.aboveDeductible
                              ? 'Above deductible'
                              : 'Below deductible'
                            : 'Pending'}
                        </span>
                      </div>
                      <div>
                        <span className="summary__label">Customer pays</span>
                        <span className="summary__value">
                          {estimateSummary ? `$${estimateSummary.customerPays}` : 'Pending'}
                        </span>
                      </div>
                      <div>
                        <span className="summary__label">Insurer pays</span>
                        <span className="summary__value">
                          {estimateSummary ? `$${estimateSummary.insurerPays}` : 'Pending'}
                        </span>
                      </div>
                      <div>
                        <span className="summary__label">Potential total loss</span>
                        <span className="summary__value">
                          {estimateSummary
                            ? estimateSummary.isPotentialTotalLoss
                              ? 'Yes'
                              : 'No'
                            : 'Pending'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="support callout">
                    <p className="support__headline">No further action is needed right now.</p>
                    <p className="muted">We'll continue processing the claim automatically.</p>
                  </div>
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

  return (
    <div className="app">
      <main className="app__shell">
        <p className="muted">FenderBender Mutual</p>
        <div className="app__reset">
          <button type="button" className="link-button" onClick={handleRestart}>
            Start workflow over
          </button>
          <button
            type="button"
            className="link-button"
            onClick={() => setViewMode('tow')}
          >
            Tow driver view
          </button>
          <button
            type="button"
            className="link-button"
            onClick={() => setViewMode('insurer')}
          >
            Insurer view
          </button>
        </div>
        <header className="app__brand">
          <img src={fenderbenderLogo} alt="FenderBender Mutual" className="app__brandLogo" />
        </header>
        <ProgressHeader
          currentStep={Math.max(1, currentStep - 1)}
          totalSteps={Math.max(1, steps.total - 1)}
          title={headerTitle}
          subtitle={headerSubtitle}
          showProgress={currentStep !== steps.prelude}
        />

        <section className="panel panel--step">
          <div className="panel__body">
            {currentStep === steps.prelude && (
              <div className="form-grid">
                {USE_NEW_ESTIMATE && scenarioOptions.length > 0 && (
                  <fieldset className="field-group">
                    <legend>Demo setup</legend>
                    <p className="field__hint">
                      Prototype data only. This does not submit a real claim.
                    </p>
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
                  </fieldset>
                )}
                <div className="support callout">
                  <p className="support__headline">
                    {namePrefix}let's get you set up before we begin.
                  </p>
                  <p className="muted">You can move at your own pace. We'll guide you.</p>
                </div>
              </div>
            )}

            {currentStep === steps.emergency && (
              <div className="form-grid">
                <div className="support callout">
                  <p className="support__headline">
                    {namePrefix}does anyone involved require immediate medical attention?
                  </p>
                  <p className="muted">If yes, we can alert emergency services right away.</p>
                </div>
                <div className="form-grid form-grid--three">
                  <button
                    type="button"
                    className={`button ${emergencyAnswer === 'yes' ? 'button--primary' : 'button--ghost'}`}
                    onClick={() => setEmergencyAnswer('yes')}
                    disabled={emergencyRequested}
                  >
                    Yes, need help now
                  </button>
                  <button
                    type="button"
                    className={`button ${emergencyAnswer === 'no' ? 'button--primary' : 'button--ghost'}`}
                    onClick={() => setEmergencyAnswer('no')}
                    disabled={emergencyRequested}
                  >
                    No, everyone is ok
                  </button>
                </div>
                {emergencyAnswer === 'yes' && (
                  <div className="field-group">
                    {emergencyRequested ? (
                      <div className="support callout">
                        <p className="support__headline">
                          Help is on the way. Keep your phone handy in case responders contact you.
                        </p>
                          <p className="muted">
                          {emergencyLocationLookup
                            ? `Location captured (${emergencyLocationLookup.formattedAddress}). Nearest cross street: ${emergencyLocationLookup.nearestCrossStreet}.`
                            : `Location shared: ${emergencyManualLocation || 'Provided by user'}.`}
                        </p>
                      </div>
                    ) : (
                      <>
                        <p className="field__hint">We can contact emergency services after you confirm location.</p>
                        <label className="field">
                          <span className="field__label">Briefly describe what you need (optional)</span>
                          <input
                            className="field__input"
                            type="text"
                            placeholder="Injuries, hazards, or urgent details"
                            value={emergencyNotes}
                            onChange={(event) => setEmergencyNotes(event.target.value)}
                            disabled={emergencyRequested}
                          />
                        </label>
                        <div className="form-grid form-grid--three">
                          <button
                            type="button"
                            className="button button--ghost"
                            onClick={handleEmergencyVoiceInput}
                            disabled={emergencyRequested}
                          >
                            Speak to text ✨
                          </button>
                        </div>
                        <div className="form-grid">
                          <button
                            type="button"
                            className="button button--ghost"
                            onClick={handleEmergencyLocation}
                            disabled={emergencyLoading || emergencyRequested}
                          >
                            {emergencyLoading ? 'Getting location...' : 'Use my location'}
                          </button>
                          {emergencyLocationLookup ? (
                            <div className="callout">
                              <div>
                                <strong>Estimated location:</strong> {emergencyLocationLookup.formattedAddress}
                              </div>
                              <div className="muted">
                                Nearest cross street: {emergencyLocationLookup.nearestCrossStreet}
                              </div>
                            </div>
                          ) : (
                            <label className="field">
                              <span className="field__label">Location details</span>
                              <input
                                className="field__input"
                                type="text"
                                placeholder="Street, nearby landmark, or intersection"
                                value={emergencyManualLocation}
                                onChange={(event) => {
                                  setEmergencyManualLocation(event.target.value)
                                  setEmergencyLocationConfirmed(false)
                                }}
                                disabled={emergencyRequested}
                              />
                            </label>
                          )}
                          <button
                            type="button"
                            className="button button--ghost"
                            onClick={() => {
                              if (emergencyLocation || emergencyManualLocation.trim().length > 0) {
                                setEmergencyLocationConfirmed(true)
                              }
                            }}
                            disabled={
                              emergencyRequested ||
                              !(emergencyLocation || emergencyManualLocation.trim().length > 0)
                            }
                          >
                            {emergencyLocationConfirmed ? 'Location confirmed' : 'Confirm location'}
                          </button>
                        </div>
                        {emergencySummary && (
                          <div className="callout">
                            {emergencySummary} (AI-generated)
                          </div>
                        )}
                        <button
                          type="button"
                          className="button button--primary"
                          onClick={handleEmergencyDispatch}
                          disabled={emergencyLoading || !emergencyLocationConfirmed || emergencyRequested}
                        >
                          {emergencyLoading
                            ? 'Contacting emergency services...'
                            : emergencyRequested
                              ? 'Emergency request sent'
                              : 'Request emergency dispatch'}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {currentStep === steps.incident && (
              <>
                <div className="support callout">
                  <p className="support__headline">
                    {namePrefix}only share what you have. You can add details later.
                  </p>
                  <p className="muted">If another vehicle or person was involved, let us know here.</p>
                </div>
                <fieldset className="field-group">
                  <legend>Other party</legend>
                  <p className="field__hint">
                    Only ask for someone else's information if it is safe and appropriate.
                  </p>
                  <div className="field">
                    <span className="field__label">Was another vehicle or person involved?</span>
                    <div className="form-grid form-grid--three">
                      <button
                        type="button"
                        className={`button ${hasOtherParty === true ? 'button--primary' : 'button--ghost'}`}
                        onClick={() => setHasOtherParty(true)}
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        className={`button ${hasOtherParty === false ? 'button--primary' : 'button--ghost'}`}
                        onClick={() => {
                          setHasOtherParty(false)
                          setOtherPartyStatus('')
                        }}
                      >
                        No
                      </button>
                    </div>
                  </div>
                  {hasOtherParty === true && (
                    <div className="field">
                      <span className="field__label">Are they still there?</span>
                      <div className="form-grid form-grid--three">
                        <button
                          type="button"
                          className={`button ${otherPartyStatus === 'still' ? 'button--primary' : 'button--ghost'}`}
                          onClick={() => setOtherPartyStatus('still')}
                        >
                          Yes, still here
                        </button>
                        <button
                          type="button"
                          className={`button ${otherPartyStatus === 'left' ? 'button--primary' : 'button--ghost'}`}
                          onClick={() => setOtherPartyStatus('left')}
                        >
                          No, they drove off
                        </button>
                      </div>
                    </div>
                  )}
                </fieldset>
              </>
            )}

            {currentStep === steps.photos && (
              <>
                <div className="support callout">
                  <p className="support__headline">
                    {namePrefix}you're safe. Let's take this one step at a time.
                  </p>
                  <p className="muted">No need to be perfect - we'll guide you.</p>
                  <p className="muted">
                    Let's grab some information. If someone else is involved, add their insurance card.
                  </p>
                </div>
                <PhotoChecklistUploader
                  photos={{
                    ...photos,
                    otherInsurancePhoto:
                      hasOtherParty === true && otherPartyStatus === 'still'
                        ? photos.otherInsurancePhoto
                        : null,
                  }}
                  includeOtherInsurance={hasOtherParty === true && otherPartyStatus === 'still'}
                  onPhotoChange={(key, file) => {
                    if (key === 'otherInsurancePhoto') {
                      if (hasOtherParty !== true || otherPartyStatus !== 'still') {
                        return
                      }
                    }
                    handlePhotoChange(key, file)
                  }}
                />
              </>
            )}

            {currentStep === steps.identifier && (
              <>
                <div className="support callout">
                  <p className="support__headline">
                    {namePrefix}if you don't have your plate handy, your VIN works too.
                  </p>
                  <p className="muted">Either is fine. You can edit this later.</p>
                </div>
                <VehicleIdentifierEntry onConfirm={handleConfirmIdentifier} />
                <div className="lookup__actions">
                  <button
                    type="button"
                    className="button button--ghost"
                    onClick={() => {
                      setUseManualVehicleEntry(true)
                      setConfirmedIdentifier(null)
                      setVehicleResult(null)
                      setSuggestedVehicle(null)
                      setVehicleLookupStatus('idle')
                      setVehicleLookupMessage('')
                      setManualYear('')
                      setManualMake('')
                      setManualModel('')
                      setCurrentStep(steps.vehicleConfirm)
                    }}
                  >
                    Enter vehicle details manually
                  </button>
                  <p className="muted">You can always come back and enter a plate or VIN later.</p>
                </div>
              </>
            )}

            {currentStep === steps.vehicleConfirm && (
              <>
                <div className="lookup__actions">
                  <button
                    type="button"
                    className="button button--ghost"
                    onClick={() => {
                      if (useManualVehicleEntry) {
                        setShowVehicleIdentifierEdit(false)
                        setCurrentStep(steps.identifier)
                        return
                      }
                      setShowVehicleIdentifierEdit(false)
                      setUseManualVehicleEntry(true)
                      setConfirmedIdentifier(null)
                      setVehicleResult(null)
                      setSuggestedVehicle(null)
                      setVehicleLookupStatus('idle')
                      setVehicleLookupMessage('')
                      setManualYear('')
                      setManualMake('')
                      setManualModel('')
                    }}
                  >
                    {useManualVehicleEntry ? 'Use plate or VIN instead' : 'Enter vehicle details manually'}
                  </button>
                  <p className="muted">You can edit this later.</p>
                </div>

                <fieldset className="field-group">
                  <legend>
                    {useManualVehicleEntry ? 'Enter vehicle details manually' : 'Vehicle'}
                  </legend>

                  {!useManualVehicleEntry ? (
                    <>
                      {vehicleLookupStatus === 'loading' && (
                        <p className="muted">Looking up your vehicle...</p>
                      )}
                      {vehicleLookupStatus === 'error' && (
                        <p className="field__hint text-error">{vehicleLookupMessage}</p>
                      )}
                      {vehicleLookupStatus === 'error' && (
                        <div className="lookup__actions">
                          <button
                            type="button"
                            className="button button--primary"
                            onClick={() => setLookupKey((prev) => prev + 1)}
                          >
                            Retry lookup
                          </button>
                          <p className="muted">Or enter details manually if you prefer.</p>
                        </div>
                      )}
                      {!confirmedIdentifier && (
                        <p className="muted">
                          Go back to enter a plate or VIN, or switch to manual entry.
                        </p>
                      )}

                      {vehicleResult ? (
                        <div className="summary summary--compact">
                          <div>
                            <span className="summary__label">Vehicle</span>
                            <span className="summary__value">
                              {vehicleResult.year} {vehicleResult.make} {vehicleResult.model}
                            </span>
                          </div>
                          <div>
                            <span className="summary__label">Body type</span>
                            <span className="summary__value">{vehicleResult.bodyType}</span>
                          </div>
                          <div>
                            <span className="summary__label">Identifier</span>
                            <span className="summary__value">{identifierLabel}</span>
                          </div>
                        </div>
                      ) : suggestedVehicle ? (
                        <>
                          <div className="summary summary--compact">
                            <div>
                              <span className="summary__label">Vehicle</span>
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
                              onClick={() => setVehicleResult(suggestedVehicle)}
                            >
                              Confirm this vehicle
                            </button>
                            <p className="muted">If anything looks off, edit the plate or VIN and retry.</p>
                          </div>
                        </>
                      ) : (
                        <p className="muted">
                          Once we have your plate or VIN, we will show your vehicle details here.
                        </p>
                      )}

                      <div className="lookup__actions">
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => setShowVehicleIdentifierEdit((prev) => !prev)}
                          disabled={vehicleLookupStatus === 'loading'}
                        >
                          {showVehicleIdentifierEdit ? 'Hide edit' : 'Edit plate or VIN'}
                        </button>
                      </div>

                      {showVehicleIdentifierEdit && (
                        <div className="field-group">
                          <VehicleIdentifierEntry
                            key={lookupKey}
                            initialStateCode={
                              confirmedIdentifier?.mode === 'plate' ? confirmedIdentifier.state : undefined
                            }
                            onConfirm={handleConfirmIdentifier}
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="muted">Use the dropdowns to select the vehicle.</p>

                      <div className="form-grid form-grid--three">
                        <label className="field">
                          <span className="field__label">Year</span>
                          <select
                            className="field__input"
                            value={manualYear}
                            onChange={(event) => {
                              setManualYear(event.target.value)
                              setManualMake('')
                              setManualModel('')
                              setVehicleResult(null)
                            }}
                          >
                            <option value="">Select year</option>
                            {yearOptions.map((year) => (
                              <option key={year} value={year}>
                                {year}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="field">
                          <span className="field__label">Make</span>
                          <select
                            className="field__input"
                            value={manualMake}
                            onChange={(event) => {
                              setManualMake(event.target.value)
                              setManualModel('')
                              setVehicleResult(null)
                            }}
                            disabled={!manualYear}
                          >
                            <option value="">Select make</option>
                            {makeOptions.map((make) => (
                              <option key={make} value={make}>
                                {make}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="field">
                          <span className="field__label">Model</span>
                          <select
                            className="field__input"
                            value={manualModel}
                            onChange={(event) => {
                              setManualModel(event.target.value)
                              setVehicleResult(null)
                            }}
                            disabled={!manualYear || !manualMake}
                          >
                            <option value="">Select model</option>
                            {modelOptions.map((model) => (
                              <option key={model} value={model}>
                                {model}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <label className="field">
                        <span className="field__label">Body type</span>
                        <select
                          className="field__input"
                          value={manualBodyType}
                          onChange={(event) => {
                            setManualBodyType(event.target.value as Vehicle['bodyType'])
                            setVehicleResult(null)
                          }}
                        >
                          {BODY_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </label>

                      <div className="lookup__actions">
                        <button
                          type="button"
                          className="button button--primary"
                          disabled={!canConfirmVehicleDetails}
                          onClick={handleConfirmVehicleDetails}
                        >
                          Confirm vehicle
                        </button>
                        <p className="muted">
                          We will confirm your vehicle to match the right repair guidance.
                        </p>
                      </div>
                    </>
                  )}
                </fieldset>
              </>
            )}

            {steps.otherParty && currentStep === steps.otherParty && (
              <OtherPartyInfo value={otherPartyDetails} onChange={setOtherPartyDetails} />
            )}

            {currentStep === steps.summary && (
              <div className="form-grid">
                {USE_NEW_ESTIMATE && policyHolder && (
                  <PolicySummary
                    policyId={policyHolder.policy.policyId}
                    deductible={policyHolder.policy.deductible}
                    coverage={policyHolder.policy.coverage}
                    rentalCoverage={policyHolder.policy.rentalCoverage}
                    estimatedRepairCost={estimatedRepairCost ?? undefined}
                  />
                )}

                <div className="summary">
                <div>
                  <span className="summary__label">Vehicle identified</span>
                  <span className={`summary__value ${vehicleResult ? 'text-success' : 'text-error'}`}>
                    {vehicleResult ? 'Yes' : 'Pending lookup'}
                  </span>
                </div>
                {vehicleResult && (
                  <div>
                    <span className="summary__label">Vehicle</span>
                    <span className="summary__value">
                      {vehicleResult.year} {vehicleResult.make} {vehicleResult.model}
                    </span>
                  </div>
                )}
                {vehicleResult && (
                  <div>
                    <span className="summary__label">Body type</span>
                    <span className="summary__value">{vehicleResult.bodyType}</span>
                  </div>
                )}
                <div>
                  <span className="summary__label">Photos received</span>
                  <span className={`summary__value ${hasRequiredPhotos ? 'text-success' : 'text-error'}`}>
                    {hasRequiredPhotos ? 'Yes' : 'Missing required photos'}
                  </span>
                </div>
                <div>
                  <span className="summary__label">Damage photos</span>
                  <span className="summary__value">
                    {photos.damagePhoto.length > 0
                      ? `${photos.damagePhoto.length} photo${photos.damagePhoto.length === 1 ? '' : 's'}`
                      : 'Not added'}
                  </span>
                </div>
                <div>
                  <span className="summary__label">Full vehicle photo</span>
                  <span className="summary__value">
                    {photos.vehiclePhoto ? 'Added' : 'Not added'}
                  </span>
                </div>
                <div>
                  <span className="summary__label">Other driver insurance</span>
                  <span className="summary__value">
                    {photos.otherInsurancePhoto ? 'Added' : 'Not added'}
                  </span>
                </div>
                <div>
                  <span className="summary__label">Identifier</span>
                  <span className="summary__value">
                    {confirmedIdentifier
                      ? confirmedIdentifier.mode === 'vin'
                        ? `VIN ${confirmedIdentifier.vin ?? ''}`
                        : `Plate ${confirmedIdentifier.state ?? ''} ${confirmedIdentifier.plate ?? ''}`
                      : useManualVehicleEntry
                        ? 'Manual entry'
                        : 'Not provided'}
                  </span>
                </div>
                <div>
                  <span className="summary__label">Other party involved</span>
                  <span className="summary__value">
                    {hasOtherParty === null
                      ? 'Not answered'
                      : hasOtherParty
                        ? `Yes${otherPartyStatus ? `, ${otherPartyStatus === 'still' ? 'still there' : 'drove off'}` : ''}`
                        : 'No'}
                  </span>
                </div>
                <div>
                  <span className="summary__label">Ready for AI-assisted damage assessment</span>
                  <span className={`summary__value ${readyForAssessment ? 'text-success' : 'text-error'}`}>
                    {readyForAssessment ? 'Ready' : 'Not ready'}
                  </span>
                </div>
                </div>
              </div>
            )}

            {currentStep === steps.thinking && (
              <div className="form-grid">
                <div className="support callout">
                  <div className="ai-sparkle" />
                  <p className="support__headline">We are analyzing your photos.</p>
                  <p className="muted">A few quick checks in progress...</p>
                </div>
                <div className="field-group">
                  {[
                    'Looking for damage patterns and impact areas.',
                    'Matching your vehicle to repair guidance.',
                    'Estimating parts and labor ranges.',
                  ][thinkingStepIndex]}
                </div>
                <div className="field-group">
                  <h3>Help while you wait</h3>
                  <ul className="muted">
                    <li>Take a slow breath in for 4 seconds, then out for 6.</li>
                    <li>If it is safe, move the car to a calm spot.</li>
                    <li>We will guide you step by step.</li>
                  </ul>
                </div>
              </div>
            )}

            {currentStep === steps.assessment && (
              <>
                <div className="assessment__controls">
                  <p className="muted">
                    {isAssessing
                      ? 'Generating your AI assessment...'
                      : assessment
                        ? 'Assessment ready. Review below.'
                        : 'Assessment will appear below.'}
                  </p>
                  <p className="muted">
                    This is a preliminary estimate. A shop will confirm final cost.
                  </p>
                </div>
                <AIAssessmentPanel assessment={assessment} loading={isAssessing} />
                {showEstimate ? (
                  <EstimateBreakdown
                    vehicle={vehicleResult!}
                    assessment={assessment!}
                    policy={policyHolder!.policy}
                  />
                ) : (
                  <p className="muted">
                    {isAssessing
                      ? 'Preparing estimate...'
                      : 'Once the assessment is ready, you will see a rough estimate and deductible comparison here.'}
                  </p>
                )}
              </>
            )}

            {currentStep === steps.drivable && (
              <>
                <DrivableCheck
                  value={drivable}
                  onChange={setDrivable}
                  onRequestTow={handleTowRequest}
                  towStatus={tow?.status}
                  towLoading={towLoading}
                />
              </>
            )}

            {currentStep === steps.submit && (
              <>
                {!claimRecord ? (
                  <div className="form-grid">
                    {USE_NEW_ESTIMATE && policyHolder && (
                      <PolicySummary
                        policyId={policyHolder.policy.policyId}
                        deductible={policyHolder.policy.deductible}
                        coverage={policyHolder.policy.coverage}
                        rentalCoverage={policyHolder.policy.rentalCoverage}
                        estimatedRepairCost={estimatedRepairCost ?? undefined}
                      />
                    )}
                    {assessment && vehicleResult && (
                      <IncidentNarratorCard
                        facts={narratorFacts}
                        value={incidentNarrator}
                        onChange={setIncidentNarrator}
                      />
                    )}
                    <SubmitClaimCard
                      vehicle={vehicleResult}
                      drivable={drivable}
                      hasOtherParty={hasOtherParty}
                      photosSummary={{
                        damageCount: photos.damagePhoto.length,
                        vehicle: Boolean(photos.vehiclePhoto),
                        otherInsurance: Boolean(photos.otherInsurancePhoto),
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
                      onEditVehicle={() => {
                        setShowVehicleIdentifierEdit(true)
                        setCurrentStep(steps.vehicleConfirm)
                      }}
                      onChangeDrivable={() => setCurrentStep(steps.drivable)}
                      onChangeOtherParty={() => setCurrentStep(steps.incident)}
                      onEditPhotos={() => setCurrentStep(steps.photos)}
                      disabled={!vehicleResult || drivable === null || isSubmitting}
                      submitting={isSubmitting}
                      claimId={claimId}
                      onSubmit={handleSubmitClaim}
                    />
                  </div>
                ) : (
                  <PostSubmissionNextSteps
                    claimId={claimId ?? ''}
                    drivable={Boolean(drivable)}
                    vehicle={vehicleResult!}
                    policy={policyHolder?.policy ?? null}
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
          </div>

          <div className="panel__footer">
            <button type="button" className="link-button" onClick={() => {}}>
              Save &amp; continue later
            </button>
            <div className="stepper-actions">
              <button
                type="button"
                className="button button--ghost"
                onClick={handleBack}
                disabled={currentStep === steps.prelude}
              >
                Back
              </button>
              {currentStep < steps.total && (
                <button
                  type="button"
                  className="button button--primary"
                  onClick={() => void handleNext()}
                  disabled={!canGoNext}
                >
                  {nextLabel}
                </button>
              )}
            </div>
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

export default App
