import { useEffect, useMemo, useState } from 'react'
import { US_STATES } from '../data/usStates'

type Mode = 'plate' | 'vin'

interface VehicleIdentifierEntryProps {
  initialStateCode?: string
  onConfirm?: (payload: { mode: Mode; state?: string; plate?: string; vin?: string }) => void
  onDraft?: (draft: {
    canConfirm: boolean
    payload: { mode: Mode; state?: string; plate?: string; vin?: string } | null
  }) => void
  confirmLabel?: string
  hideConfirm?: boolean
}

const normalize = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '')

const isValidVin = (value: string) => /^[A-HJ-NPR-Z0-9]{17}$/.test(value)

export default function VehicleIdentifierEntry({
  initialStateCode,
  onConfirm,
  onDraft,
  confirmLabel = 'Confirm',
  hideConfirm = false,
}: VehicleIdentifierEntryProps) {
  const [stateCode, setStateCode] = useState(initialStateCode ?? '')
  const [rawIdentifier, setRawIdentifier] = useState('')

  const normalizedIdentifier = useMemo(() => normalize(rawIdentifier), [rawIdentifier])
  const inferredMode: Mode = useMemo(
    () => (isValidVin(normalizedIdentifier) ? 'vin' : 'plate'),
    [normalizedIdentifier],
  )

  const plateLengthOk = normalizedIdentifier.length >= 2 && normalizedIdentifier.length <= 8
  const canConfirm = useMemo(() => {
    if (inferredMode === 'vin') {
      return isValidVin(normalizedIdentifier)
    }
    if (!plateLengthOk) {
      return false
    }
    return stateCode.trim().length > 0
  }, [inferredMode, normalizedIdentifier, plateLengthOk, stateCode])

  const draftPayload = useMemo(() => {
    if (!canConfirm) {
      return null
    }
    if (inferredMode === 'vin') {
      return { mode: 'vin' as const, vin: normalizedIdentifier }
    }
    return { mode: 'plate' as const, state: stateCode.toUpperCase(), plate: normalizedIdentifier }
  }, [canConfirm, inferredMode, normalizedIdentifier, stateCode])

  useEffect(() => {
    onDraft?.({ canConfirm, payload: draftPayload })
  }, [canConfirm, draftPayload, onDraft])

  const handleConfirm = () => {
    if (!canConfirm) {
      return
    }
    if (!onConfirm) {
      return
    }
    if (inferredMode === 'vin') {
      onConfirm({ mode: 'vin', vin: normalizedIdentifier })
      return
    }
    onConfirm({ mode: 'plate', state: stateCode.toUpperCase(), plate: normalizedIdentifier })
  }

  return (
    <div className="form-grid">
      <label className="field">
        <span className="field__label">State</span>
        <select
          className="field__input"
          value={stateCode}
          onChange={(event) => setStateCode(event.target.value)}
          disabled={inferredMode === 'vin'}
        >
          <option value="">Select state</option>
          {US_STATES.map((item) => (
            <option key={item.code} value={item.code}>
              {item.code} - {item.name}
            </option>
          ))}
        </select>
        <p className="field__hint">
          {inferredMode === 'vin'
            ? 'VIN detected. State is not needed.'
            : 'State is required for plate lookup.'}
        </p>
      </label>

      <label className="field">
        <div className="field__inline">
          <span className="field__label">License plate or VIN</span>
          <span className={`chip ${inferredMode === 'vin' ? 'chip--strong' : ''}`}>
            Detected: {inferredMode === 'vin' ? 'VIN' : 'Plate'}
          </span>
        </div>
        <input
          className="field__input"
          value={rawIdentifier}
          onChange={(event) => setRawIdentifier(event.target.value)}
          placeholder="7ABC123 or 1HGCM82633A123456"
          inputMode="text"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
        />
        <p className="field__hint">
          Enter your license plate (e.g., 7ABC123) or your VIN (17 characters).
        </p>
      </label>

      <div className="lookup__actions">
        {!hideConfirm && onConfirm && (
          <>
            <button
              type="button"
              className="button button--primary"
              onClick={handleConfirm}
              disabled={!canConfirm}
            >
              {confirmLabel}
            </button>
            <p className="muted">You can edit this later.</p>
          </>
        )}
      </div>
    </div>
  )
}
