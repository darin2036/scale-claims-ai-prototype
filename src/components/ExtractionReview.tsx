import { useEffect, useMemo, useState } from 'react'
import type { PlateExtraction, VinExtraction } from '../lib/mockAI'
import { US_STATES } from '../data/usStates'

type ReviewMode = 'plate' | 'vin'

interface ExtractionReviewProps {
  mode: ReviewMode
  plateExtraction: PlateExtraction | null
  vinExtraction: VinExtraction | null
  contextNote?: string
  disabled?: boolean
  onConfirm: (payload: { mode: ReviewMode; plate?: string; state?: string; vin?: string }) => void
}

export default function ExtractionReview({
  mode,
  plateExtraction,
  vinExtraction,
  contextNote,
  disabled,
  onConfirm,
}: ExtractionReviewProps) {
  const [plate, setPlate] = useState(plateExtraction?.plate ?? '')
  const [state, setState] = useState(plateExtraction?.state ?? '')
  const [vin, setVin] = useState(vinExtraction?.vin ?? '')

  useEffect(() => {
    if (mode === 'plate') {
      setPlate(plateExtraction?.plate ?? '')
      setState(plateExtraction?.state ?? '')
      return
    }
    setVin(vinExtraction?.vin ?? '')
  }, [mode, plateExtraction?.plate, plateExtraction?.state, vinExtraction?.vin])

  const rawConfidence = mode === 'plate' ? plateExtraction?.confidence : vinExtraction?.confidence
  const confidence =
    rawConfidence !== undefined && rawConfidence <= 1 ? rawConfidence * 100 : rawConfidence
  const notes = mode === 'plate' ? plateExtraction?.notes : vinExtraction?.notes

  const isConfirmDisabled = useMemo(() => {
    if (disabled) {
      return true
    }
    if (mode === 'plate') {
      return plate.trim().length === 0 || state.trim().length === 0
    }
    return vin.trim().length < 11
  }, [disabled, mode, plate, state, vin])

  const handleConfirm = () => {
    if (isConfirmDisabled) {
      return
    }
    if (mode === 'plate') {
      onConfirm({
        mode,
        plate: plate.trim().toUpperCase(),
        state: state.trim().toUpperCase(),
      })
      return
    }
    onConfirm({
      mode,
      vin: vin.trim().toUpperCase(),
    })
  }

  return (
    <div className="review">
      {contextNote && <p className="field__hint">{contextNote}</p>}

      <div className="summary summary--compact">
        <div>
          <span className="summary__label">Confidence</span>
          <span className="summary__value">
            {confidence ? `${Math.round(confidence)}%` : 'Manual entry'}
          </span>
        </div>
        <div>
          <span className="summary__label">Notes</span>
          <span className="summary__value">{notes ?? 'No extraction notes yet.'}</span>
        </div>
      </div>

      {mode === 'plate' ? (
        <div className="form-grid form-grid--three">
          <label className="field">
            <span className="field__label">Plate</span>
            <input
              className="field__input"
              value={plate}
              onChange={(event) => setPlate(event.target.value)}
              placeholder="7ABC123"
            />
          </label>

          <label className="field">
            <span className="field__label">State</span>
            <select
              className="field__input"
              value={state}
              onChange={(event) => setState(event.target.value)}
            >
              <option value="">Select state</option>
              {US_STATES.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.code} - {item.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : (
        <label className="field">
          <span className="field__label">VIN</span>
          <input
            className="field__input"
            value={vin}
            onChange={(event) => setVin(event.target.value)}
            placeholder="1HGCM82633A123456"
          />
          <span className="field__hint">Enter at least 11 characters to continue.</span>
        </label>
      )}

      <button
        type="button"
        className="button button--primary"
        onClick={handleConfirm}
        disabled={isConfirmDisabled}
      >
        Confirm identifiers
      </button>
    </div>
  )
}
