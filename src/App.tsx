import { useEffect, useMemo, useState } from 'react'
import './App.css'
import PhotoChecklistUploader, {
  type ChecklistPhotos,
  type PhotoKey,
} from './components/PhotoChecklistUploader'
import VehicleIdentifierEntry from './components/VehicleIdentifierEntry'
import AIAssessmentPanel from './components/AIAssessmentPanel'
import EstimateBreakdown from './components/EstimateBreakdown'
import PolicySummary from './components/PolicySummary'
import ProgressHeader from './components/ProgressHeader'
import { getMakesForYear, getModelsForYearMake, vehicleYears } from './data/vehicleData'
import {
  assessDamage,
  type AIAssessment,
} from './lib/mockAI'
import { generateRepairEstimate } from './lib/estimation'
import {
  getPolicyHolderByScenario,
  listDemoScenarios,
  lookupVehicleByIdentifier,
} from './server/fakeApi'
import type { PolicyHolder, Vehicle } from './server/fakeDb'

const USE_NEW_ESTIMATE = true
const TOTAL_STEPS = 5
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
    damagePhoto: null,
    vehiclePhoto: null,
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

  const handlePhotoChange = (key: PhotoKey, file: File | null) => {
    setPhotos((prev) => ({ ...prev, [key]: file }))

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
    setUseManualVehicleEntry(false)
    setVehicleResult(null)
    setSuggestedVehicle(null)
    setVehicleLookupStatus('idle')
    setVehicleLookupMessage('')
    setManualYear('')
    setManualMake('')
    setManualModel('')
    setLookupKey((prev) => prev + 1)
    setCurrentStep(3)
  }

  const handleRunAssessment = async () => {
    if (!photos.damagePhoto) {
      return
    }

    setIsAssessing(true)
    const result = await assessDamage(photos.damagePhoto)
    setAssessment(result)
    setIsAssessing(false)
  }

  const hasDamagePhoto = Boolean(photos.damagePhoto)
  const hasVehiclePhoto = Boolean(photos.vehiclePhoto)

  const hasRequiredPhotos = hasDamagePhoto && hasVehiclePhoto
  const step1Complete = hasRequiredPhotos

  const readyForAssessment = step1Complete && vehicleResult !== null
  const showEstimate =
    USE_NEW_ESTIMATE && vehicleResult && photos.damagePhoto && assessment !== null && policyHolder

  useEffect(() => {
    if (currentStep !== 3) {
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
  }, [confirmedIdentifier, currentStep, lookupKey, useManualVehicleEntry, vehicleResult])

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
    if (!step1Complete) {
      return 1
    }
    if (!confirmedIdentifier && !useManualVehicleEntry) {
      return 2
    }
    if (!vehicleResult) {
      return 3
    }
    if (!readyForAssessment) {
      return 4
    }
    return 5
  }, [confirmedIdentifier, readyForAssessment, step1Complete, useManualVehicleEntry, vehicleResult])

  useEffect(() => {
    setCurrentStep((prev) => Math.min(prev, maxAllowedStep))
  }, [maxAllowedStep])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [currentStep])

  const canGoNext = useMemo(() => {
    if (currentStep === 1) {
      return step1Complete
    }
    if (currentStep === 2) {
      return step1Complete && (confirmedIdentifier !== null || useManualVehicleEntry)
    }
    if (currentStep === 3) {
      return (
        step1Complete &&
        (confirmedIdentifier !== null || useManualVehicleEntry) &&
        vehicleResult !== null
      )
    }
    if (currentStep === 4) {
      return readyForAssessment && !isAssessing
    }
    return false
  }, [
    confirmedIdentifier,
    currentStep,
    isAssessing,
    readyForAssessment,
    step1Complete,
    useManualVehicleEntry,
    vehicleResult,
  ])

  const { headerTitle, headerSubtitle } = useMemo(() => {
    if (currentStep === 1) {
      return {
        headerTitle: 'Upload photos',
        headerSubtitle: `${namePrefix}you're safe. We'll guide you step by step.`,
      }
    }
    if (currentStep === 2) {
      return {
        headerTitle: 'Enter plate or VIN',
        headerSubtitle: "If you don't have your plate handy, your VIN works too. Either is fine.",
      }
    }
    if (currentStep === 3) {
      return {
        headerTitle: 'Confirm your vehicle',
        headerSubtitle: 'We will use this to match the right repair guidance.',
      }
    }
    if (currentStep === 4) {
      return {
        headerTitle: 'Summary',
        headerSubtitle: 'Quick check before we generate a preliminary assessment.',
      }
    }
    return {
      headerTitle: 'Damage assessment',
      headerSubtitle: `${namePrefix}this is a preliminary estimate. A shop will confirm final cost.`,
    }
  }, [currentStep, namePrefix])

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(1, prev - 1))
  }

  const handleNext = async () => {
    if (!canGoNext) {
      return
    }
    if (currentStep === 4) {
      if (!assessment && readyForAssessment && !isAssessing) {
        await handleRunAssessment()
      }
      setCurrentStep(5)
      return
    }
    setCurrentStep((prev) => Math.min(TOTAL_STEPS, prev + 1))
  }

  const nextLabel = useMemo(() => {
    if (currentStep === 1) {
      return 'Next: Enter plate or VIN'
    }
    if (currentStep === 2) {
      return 'Next: Lookup vehicle'
    }
    if (currentStep === 3) {
      return 'Next: Summary'
    }
    if (currentStep === 4) {
      return 'Generate assessment ✨'
    }
    return 'Next: Damage assessment'
  }, [currentStep])

  return (
    <div className="app">
      <main className="app__shell">
        <ProgressHeader
          currentStep={currentStep}
          totalSteps={TOTAL_STEPS}
          title={headerTitle}
          subtitle={headerSubtitle}
        />

        <section className="panel panel--step">
          <div className="panel__body">
            {currentStep === 1 && (
              <>
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

                {USE_NEW_ESTIMATE && policyHolder && (
                  <PolicySummary
                    policyId={policyHolder.policy.policyId}
                    deductible={policyHolder.policy.deductible}
                    coverage={policyHolder.policy.coverage}
                    rentalCoverage={policyHolder.policy.rentalCoverage}
                    estimatedRepairCost={estimatedRepairCost ?? undefined}
                  />
                )}

                <div className="support callout">
                  <p className="support__headline">
                    {namePrefix}you're safe. Let's take this one step at a time.
                  </p>
                  <p className="muted">No need to be perfect - we'll guide you.</p>
                  <p className="muted">
                    Take 2 photos. We'll use them to help speed up your claim.
                  </p>
                </div>

                <PhotoChecklistUploader
                  photos={photos}
                  onPhotoChange={handlePhotoChange}
                />
              </>
            )}

            {currentStep === 2 && (
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
                      setCurrentStep(3)
                    }}
                  >
                    Enter vehicle details manually
                  </button>
                  <p className="muted">You can always come back and enter a plate or VIN later.</p>
                </div>
              </>
            )}

            {currentStep === 3 && (
              <>
                <div className="lookup__actions">
                  <button
                    type="button"
                    className="button button--ghost"
                    onClick={() => {
                      if (useManualVehicleEntry) {
                        setCurrentStep(2)
                        return
                      }
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
                    {useManualVehicleEntry ? 'Enter vehicle details manually' : 'Confirm vehicle details'}
                  </legend>

                  {!useManualVehicleEntry && (
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
                    </>
                  )}

                  <p className="muted">
                    {useManualVehicleEntry
                      ? 'Use the dropdowns to select the vehicle.'
                      : 'We pre-filled these details. Please confirm or edit anything.'}
                  </p>

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
                    <p className="muted">We will confirm your vehicle to match the right repair guidance.</p>
                  </div>

                  {vehicleResult && (
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
                    </div>
                  )}
                </fieldset>
              </>
            )}

            {currentStep === 4 && (
              <div className="summary">
                <div>
                  <span className="summary__label">Vehicle identified</span>
                  <span className={`summary__value ${vehicleResult ? 'text-success' : 'text-error'}`}>
                    {vehicleResult ? 'Yes' : 'Pending lookup'}
                  </span>
                </div>
                <div>
                  <span className="summary__label">Photos received</span>
                  <span className={`summary__value ${hasRequiredPhotos ? 'text-success' : 'text-error'}`}>
                    {hasRequiredPhotos ? 'Yes' : 'Missing required photos'}
                  </span>
                </div>
                <div>
                  <span className="summary__label">Ready for AI-assisted damage assessment</span>
                  <span className={`summary__value ${readyForAssessment ? 'text-success' : 'text-error'}`}>
                    {readyForAssessment ? 'Ready' : 'Not ready'}
                  </span>
                </div>
              </div>
            )}

            {currentStep === 5 && (
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
                disabled={currentStep === 1}
              >
                Back
              </button>
              {currentStep < TOTAL_STEPS && (
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
      </main>
    </div>
  )
}

export default App
