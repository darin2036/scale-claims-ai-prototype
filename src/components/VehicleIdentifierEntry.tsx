import { useMemo, useState } from 'react'
import { US_STATES } from '../data/usStates'

type Mode = 'plate' | 'vin'

interface VehicleIdentifierEntryProps {
  initialStateCode?: string
  onConfirm: (payload: { mode: Mode; state?: string; plate?: string; vin?: string }) => void
}

const normalize = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '')

const isValidVin = (value: string) => /^[A-HJ-NPR-Z0-9]{17}$/.test(value)

export default function VehicleIdentifierEntry({
  initialStateCode,
  onConfirm,
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

  const handleConfirm = () => {
    if (!canConfirm) {
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
        <button type="button" className="button button--primary" onClick={handleConfirm} disabled={!canConfirm}>
          Confirm
        </button>
        <p className="muted">You can edit this later.</p>
      </div>
    </div>
  )
}

