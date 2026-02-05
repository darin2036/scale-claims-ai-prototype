import { useEffect, useMemo, useState } from 'react'
import './App.css'
import PhotoChecklistUploader, {
  type ChecklistPhotos,
  type PhotoKey,
} from './components/PhotoChecklistUploader'
import ExtractionReview from './components/ExtractionReview'
import VehicleLookup from './components/VehicleLookup'
import AIAssessmentPanel from './components/AIAssessmentPanel'
import EstimateBreakdown from './components/EstimateBreakdown'
import DemoScenarioSelector from './components/DemoScenarioSelector'
import PolicySummary from './components/PolicySummary'
import {
  assessDamage,
  type AIAssessment,
  type PlateExtraction,
  type VinExtraction,
} from './lib/mockAI'
import { generateRepairEstimate } from './lib/estimation'
import { getPolicyHolderByScenario, listDemoScenarios } from './server/fakeApi'
import type { PolicyHolder, Vehicle } from './server/fakeDb'

const USE_NEW_ESTIMATE = true

function App() {
  const [scenarioOptions, setScenarioOptions] = useState<Array<{ id: string; label: string }>>(
    [],
  )
  const [selectedScenarioId, setSelectedScenarioId] = useState('')
  const [policyHolder, setPolicyHolder] = useState<PolicyHolder | null>(null)
  const [photos, setPhotos] = useState<ChecklistPhotos>({
    damagePhoto: null,
    vehiclePhoto: null,
    platePhoto: null,
    vinPhoto: null,
  })
  const [plateExtraction, setPlateExtraction] = useState<PlateExtraction | null>(null)
  const [vinExtraction, setVinExtraction] = useState<VinExtraction | null>(null)
  const [confirmedIdentifiers, setConfirmedIdentifiers] = useState<{
    mode: 'plate' | 'vin'
    plate?: string
    state?: string
    vin?: string
  } | null>(null)
  const [lookupKey, setLookupKey] = useState(0)
  const [vehicleResult, setVehicleResult] = useState<Vehicle | null>(null)
  const [assessment, setAssessment] = useState<AIAssessment | null>(null)
  const [isAssessing, setIsAssessing] = useState(false)
  const [estimatedRepairCost, setEstimatedRepairCost] = useState<number | null>(null)

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

    if (key === 'platePhoto') {
      setPlateExtraction(null)
      setConfirmedIdentifiers(null)
      setVehicleResult(null)
    }

    if (key === 'vinPhoto') {
      setVinExtraction(null)
      setConfirmedIdentifiers(null)
      setVehicleResult(null)
    }
  }

  const handlePlateExtraction = (result: PlateExtraction | null) => {
    setPlateExtraction(result)
    setConfirmedIdentifiers(null)
    setVehicleResult(null)
  }

  const handleVinExtraction = (result: VinExtraction | null) => {
    setVinExtraction(result)
    setConfirmedIdentifiers(null)
    setVehicleResult(null)
  }

  const handleConfirmIdentifiers = (payload: {
    mode: 'plate' | 'vin'
    plate?: string
    state?: string
    vin?: string
  }) => {
    setConfirmedIdentifiers(payload)
    setVehicleResult(null)
    setLookupKey((prev) => prev + 1)
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
  const hasPlatePhoto = Boolean(photos.platePhoto)
  const hasVinPhoto = Boolean(photos.vinPhoto)

  const plateConfidence =
    plateExtraction?.confidence !== undefined
      ? plateExtraction.confidence <= 1
        ? plateExtraction.confidence * 100
        : plateExtraction.confidence
      : 0
  const shouldUseVin = !hasPlatePhoto || plateConfidence < 70
  const reviewMode: 'plate' | 'vin' = shouldUseVin ? 'vin' : 'plate'

  const hasRequiredPhotos = hasDamagePhoto && hasVehiclePhoto && (hasPlatePhoto || hasVinPhoto)
  const plateReady = !hasPlatePhoto || plateExtraction !== null
  const vinReady = !hasVinPhoto || vinExtraction !== null
  const step1Complete = hasRequiredPhotos && plateReady && vinReady

  const reviewNote = useMemo(() => {
    if (!hasPlatePhoto) {
      return 'No plate photo provided. Enter the VIN to continue.'
    }
    if (hasPlatePhoto && plateExtraction && plateConfidence < 70) {
      return `Plate confidence ${Math.round(plateConfidence)}%. Enter the VIN to continue.`
    }
    return undefined
  }, [hasPlatePhoto, plateConfidence, plateExtraction])

  const readyForAssessment = step1Complete && vehicleResult !== null
  const showEstimate =
    USE_NEW_ESTIMATE && vehicleResult && photos.damagePhoto && assessment !== null && policyHolder

  return (
    <div className="app">
      <main className="app__shell">
        <header className="app__header">
          <div>
            <p className="kicker">Claims intake flow</p>
            <h1>Vehicle lookup + photo intake</h1>
            <p className="muted">
              Plate-first vehicle identification with VIN fallback. Confirm extractions before lookup.
            </p>
          </div>
          <div className="pill-group">
            <span className="pill">Plate-first</span>
            <span className="pill">VIN fallback</span>
            <span className="pill">Human confirmation</span>
          </div>
        </header>

        {USE_NEW_ESTIMATE && scenarioOptions.length > 0 && (
          <DemoScenarioSelector value={selectedScenarioId} onChange={setSelectedScenarioId} />
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

        <section className="panel">
          <div className="panel__header">
            <div>
              <p className="step">Step 1</p>
              <h2>Upload required photos</h2>
            </div>
            {step1Complete && <span className="status status--ready">Complete</span>}
          </div>
          <PhotoChecklistUploader
            photos={photos}
            plateExtraction={plateExtraction}
            vinExtraction={vinExtraction}
            onPhotoChange={handlePhotoChange}
            onPlateExtraction={handlePlateExtraction}
            onVinExtraction={handleVinExtraction}
          />
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <p className="step">Step 2</p>
              <h2>Review extracted identifiers</h2>
            </div>
            {confirmedIdentifiers && <span className="status status--ready">Confirmed</span>}
          </div>
          {step1Complete ? (
            <ExtractionReview
              mode={reviewMode}
              plateExtraction={plateExtraction}
              vinExtraction={vinExtraction}
              contextNote={reviewNote}
              onConfirm={handleConfirmIdentifiers}
            />
          ) : (
            <p className="muted">
              Upload the required photos to run extraction before confirming identifiers.
            </p>
          )}
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <p className="step">Step 3</p>
              <h2>Lookup vehicle</h2>
            </div>
            {vehicleResult && <span className="status status--ready">Identified</span>}
          </div>
          {confirmedIdentifiers ? (
            <VehicleLookup
              mode={confirmedIdentifiers.mode}
              prefill={{
                plate: confirmedIdentifiers.plate,
                state: confirmedIdentifiers.state,
                vin: confirmedIdentifiers.vin,
              }}
              autoLookupKey={lookupKey}
              onLookupComplete={setVehicleResult}
            />
          ) : (
            <p className="muted">Confirm identifiers to enable vehicle lookup.</p>
          )}
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <p className="step">Step 4</p>
              <h2>Summary</h2>
            </div>
            {readyForAssessment && <span className="status status--ready">Ready</span>}
          </div>
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
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <p className="step">Step 5</p>
              <h2>AI damage assessment (next step)</h2>
            </div>
            {assessment && <span className="status status--ready">Drafted</span>}
          </div>
          <div className="assessment__controls">
            <button
              type="button"
              onClick={handleRunAssessment}
              disabled={!readyForAssessment || isAssessing}
              className="button button--primary"
            >
              {isAssessing ? 'Assessing image...' : 'Generate assessment'}
            </button>
            <p className="muted">
              Stubbed next step. Agents can review or adjust before authorization.
            </p>
          </div>
          <AIAssessmentPanel assessment={assessment} loading={isAssessing} />
          {showEstimate && (
            <EstimateBreakdown
              vehicle={vehicleResult!}
              assessment={assessment!}
              policy={policyHolder!.policy}
            />
          )}
        </section>
      </main>
    </div>
  )
}

export default App
