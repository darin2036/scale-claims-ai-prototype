import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { OtherPartyDetails } from '../types/claim'
import { US_STATES } from '../data/usStates'
import PhotoSlotUploader from './PhotoSlotUploader'
import ExtractionReview from './ExtractionReview'
import VehicleIdentifierEntry from './VehicleIdentifierEntry'
import VehicleLookup from './VehicleLookup'
import { mockExtractPlateAndStateFromImage, mockExtractVinFromImage, type PlateExtraction, type VinExtraction } from '../lib/mockAI'

interface OtherPartyInfoProps {
  value: OtherPartyDetails
  onChange: (next: OtherPartyDetails) => void
}

const updateField = (
  value: OtherPartyDetails,
  onChange: (next: OtherPartyDetails) => void,
  field: keyof OtherPartyDetails,
  nextValue: string | boolean,
) => {
  onChange({
    ...value,
    [field]: nextValue,
  })
}

export default function OtherPartyInfo({ value, onChange }: OtherPartyInfoProps) {
  const [notice, setNotice] = useState<string>('')
  const noticeTimerRef = useRef<number | null>(null)
  const [insuranceCardPhoto, setInsuranceCardPhoto] = useState<File | null>(null)
  const [licensePhoto, setLicensePhoto] = useState<File | null>(null)
  const [plateVinPhoto, setPlateVinPhoto] = useState<File | null>(null)
  const [plateExtraction, setPlateExtraction] = useState<PlateExtraction | null>(null)
  const [vinExtraction, setVinExtraction] = useState<VinExtraction | null>(null)
  const [extractionMode, setExtractionMode] = useState<'plate' | 'vin'>('plate')
  const [confirmedIdentifier, setConfirmedIdentifier] = useState<{
    mode: 'plate' | 'vin'
    plate?: string
    state?: string
    vin?: string
  } | null>(null)

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current !== null) {
        window.clearTimeout(noticeTimerRef.current)
      }
    }
  }, [])

  const showNotice = useCallback((text: string) => {
    setNotice(text)
    if (noticeTimerRef.current !== null) {
      window.clearTimeout(noticeTimerRef.current)
    }
    noticeTimerRef.current = window.setTimeout(() => {
      setNotice('')
      noticeTimerRef.current = null
    }, 4000)
  }, [])

  useEffect(() => {
    if (!plateVinPhoto) {
      setPlateExtraction(null)
      setVinExtraction(null)
      return
    }
    let active = true
    Promise.all([
      mockExtractPlateAndStateFromImage(plateVinPhoto),
      mockExtractVinFromImage(plateVinPhoto),
    ]).then(([plateResult, vinResult]) => {
      if (!active) {
        return
      }
      setPlateExtraction(plateResult)
      setVinExtraction(vinResult)
      setExtractionMode('plate')
      showNotice('Captured. Review extracted plate/VIN below.')
    })
    return () => {
      active = false
    }
  }, [plateVinPhoto, showNotice])

  const identifierForLookup = useMemo(() => {
    if (!confirmedIdentifier) {
      return null
    }
    if (confirmedIdentifier.mode === 'vin') {
      const vin = confirmedIdentifier.vin?.trim()
      return vin ? { identifier: vin, state: undefined } : null
    }
    const plate = confirmedIdentifier.plate?.trim()
    const state = confirmedIdentifier.state?.trim()
    if (!plate || !state) {
      return null
    }
    return { identifier: plate, state }
  }, [confirmedIdentifier])

  const handleConfirmIdentifier = (payload: { mode: 'plate' | 'vin'; plate?: string; state?: string; vin?: string }) => {
    setConfirmedIdentifier(payload)
    if (payload.mode === 'plate') {
      updateField(value, onChange, 'otherVehiclePlate', payload.plate ?? '')
      updateField(value, onChange, 'otherVehicleState', payload.state ?? '')
      showNotice('Plate captured. Looking up vehicle details...')
      return
    }

    const vin = payload.vin?.trim()
    if (!vin) {
      return
    }
    const existingNotes = value.notes.trim()
    const vinLine = `Other vehicle VIN: ${vin}`
    const nextNotes = existingNotes.includes(vinLine)
      ? existingNotes
      : existingNotes
        ? `${existingNotes}\n${vinLine}`
        : vinLine
    onChange({ ...value, notes: nextNotes })
    showNotice('VIN captured. Looking up vehicle details...')
  }

  return (
    <div className="form-grid">
      <div className="support callout">
        <p className="support__headline">Only share what you have.</p>
        <p className="muted">
          If you're unsure or don't have it right now, that's okay - you can add it later.
        </p>
      </div>

      <div className="field-group">
        {notice && (
          <div className="callout" role="status" aria-live="polite">
            {notice}
          </div>
        )}

        <label className="field">
          <span className="field__label">I don't have this info</span>
          <input
            className="field__input"
            type="checkbox"
            checked={value.noInfo}
            onChange={(event) => updateField(value, onChange, 'noInfo', event.target.checked)}
          />
        </label>

        {!value.noInfo && (
          <>
            <div className="field">
              <div className="field__label">Quick capture (optional)</div>
              <p className="field__hint">Use the same capture flow as the main claim intake.</p>
            </div>

            <div className="checklist">
              <div className="checklist__grid">
                <PhotoSlotUploader
                  title="Other driver's insurance card"
                  hint="Optional. Capture if available."
                  helper="Only take this if it is safe and appropriate."
                  value={insuranceCardPhoto}
                  onChange={(nextValue) => setInsuranceCardPhoto((nextValue as File | null) ?? null)}
                />
                <PhotoSlotUploader
                  title="Other driver's license"
                  hint="Optional. Helps confirm contact details."
                  value={licensePhoto}
                  onChange={(nextValue) => setLicensePhoto((nextValue as File | null) ?? null)}
                />
                <PhotoSlotUploader
                  title="Other vehicle plate/VIN photo"
                  hint="Optional. We can try to extract identifiers to speed up lookup."
                  value={plateVinPhoto}
                  onChange={(nextValue) => setPlateVinPhoto((nextValue as File | null) ?? null)}
                />
              </div>
            </div>

            {plateVinPhoto && (plateExtraction || vinExtraction) && (
              <div className="field">
                <div className="chip-group">
                  <span className="chip">Extract</span>
                  <button
                    type="button"
                    className={`chip ${extractionMode === 'plate' ? 'chip--strong' : ''}`}
                    onClick={() => setExtractionMode('plate')}
                  >
                    Plate
                  </button>
                  <button
                    type="button"
                    className={`chip ${extractionMode === 'vin' ? 'chip--strong' : ''}`}
                    onClick={() => setExtractionMode('vin')}
                  >
                    VIN
                  </button>
                </div>
                <ExtractionReview
                  mode={extractionMode}
                  plateExtraction={plateExtraction}
                  vinExtraction={vinExtraction}
                  contextNote="Review the extracted identifier, then confirm to run vehicle lookup."
                  onConfirm={handleConfirmIdentifier}
                />
              </div>
            )}

            <div className="field">
              <div className="field__label">Other vehicle lookup (optional)</div>
              <p className="field__hint">Enter a plate/VIN to look up vehicle details (deterministic mock data).</p>
            </div>
            <VehicleIdentifierEntry onConfirm={handleConfirmIdentifier} />

            {identifierForLookup && (
              <VehicleLookup
                stateCode={identifierForLookup.state}
                identifier={identifierForLookup.identifier}
                onLookupComplete={(result) => {
                  if (result) {
                    updateField(value, onChange, 'otherVehicleMakeModel', `${result.year} ${result.make} ${result.model}`)
                  }
                }}
              />
            )}

            <div className="form-grid">
            <label className="field">
              <span className="field__label">Other driver name</span>
              <input
                className="field__input"
                type="text"
                value={value.otherDriverName}
                onChange={(event) =>
                  updateField(value, onChange, 'otherDriverName', event.target.value)
                }
              />
            </label>

            <label className="field">
              <span className="field__label">Phone or email</span>
              <input
                className="field__input"
                type="text"
                value={value.otherContact}
                onChange={(event) => updateField(value, onChange, 'otherContact', event.target.value)}
              />
            </label>

            <div className="form-grid form-grid--three">
              <label className="field">
                <span className="field__label">License plate</span>
                <input
                  className="field__input"
                  type="text"
                  value={value.otherVehiclePlate}
                  onChange={(event) =>
                    updateField(value, onChange, 'otherVehiclePlate', event.target.value)
                  }
                />
              </label>
              <label className="field">
                <span className="field__label">State</span>
                <select
                  className="field__input"
                  value={value.otherVehicleState}
                  onChange={(event) =>
                    updateField(value, onChange, 'otherVehicleState', event.target.value)
                  }
                >
                  <option value="">Select</option>
                  {US_STATES.map((state) => (
                    <option key={state.code} value={state.code}>
                      {state.code}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="field">
              <span className="field__label">Vehicle make/model</span>
              <input
                className="field__input"
                type="text"
                value={value.otherVehicleMakeModel}
                onChange={(event) =>
                  updateField(value, onChange, 'otherVehicleMakeModel', event.target.value)
                }
              />
            </label>

            <label className="field">
              <span className="field__label">Insurance carrier</span>
              <input
                className="field__input"
                type="text"
                value={value.insuranceCarrier}
                onChange={(event) =>
                  updateField(value, onChange, 'insuranceCarrier', event.target.value)
                }
              />
            </label>

            <label className="field">
              <span className="field__label">Policy number</span>
              <input
                className="field__input"
                type="text"
                value={value.policyNumber}
                onChange={(event) => updateField(value, onChange, 'policyNumber', event.target.value)}
              />
            </label>
            </div>
          </>
        )}

        <label className="field">
          <span className="field__label">Notes</span>
          <textarea
            className="field__input"
            rows={3}
            value={value.notes}
            onChange={(event) => updateField(value, onChange, 'notes', event.target.value)}
          />
        </label>
      </div>
    </div>
  )
}
