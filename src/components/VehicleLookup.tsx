import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import { lookupVehicleByPlateState, lookupVehicleByVin } from '../server/fakeApi'
import type { Vehicle } from '../server/fakeDb'
import { US_STATES } from '../data/usStates'

type LookupMode = 'plate' | 'vin'

interface VehicleLookupProps {
  mode: LookupMode
  prefill: {
    plate?: string
    state?: string
    vin?: string
  }
  autoLookupKey: number
  onLookupComplete: (result: Vehicle | null) => void
}

export default function VehicleLookup({
  mode,
  prefill,
  autoLookupKey,
  onLookupComplete,
}: VehicleLookupProps) {
  const [plate, setPlate] = useState(prefill.plate ?? '')
  const [state, setState] = useState(prefill.state ?? '')
  const [vin, setVin] = useState(prefill.vin ?? '')
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<Vehicle | null>(null)

  useEffect(() => {
    setPlate(prefill.plate ?? '')
    setState(prefill.state ?? '')
    setVin(prefill.vin ?? '')
    setResult(null)
    setStatus('idle')
    setMessage('')
    onLookupComplete(null)
  }, [prefill.plate, prefill.state, prefill.vin, mode, onLookupComplete])

  const isLookupDisabled = useMemo(() => {
    if (status === 'loading') {
      return true
    }
    if (mode === 'plate') {
      return plate.trim().length === 0 || state.trim().length === 0
    }
    return vin.trim().length < 11
  }, [mode, plate, state, vin, status])

  const resetResult = () => {
    if (result) {
      setResult(null)
      onLookupComplete(null)
    }
    setStatus('idle')
    setMessage('')
  }

  const handleLookup = useCallback(
    async (plateValue: string, stateValue: string, vinValue: string) => {
      setStatus('loading')
      setMessage('')
      setResult(null)
      onLookupComplete(null)

      try {
        if (mode === 'plate') {
          const normalizedPlate = plateValue.trim().toUpperCase()
          const normalizedState = stateValue.trim().toUpperCase()
          if (!normalizedPlate || !normalizedState) {
            setStatus('error')
            setMessage('Enter a plate and state to run the lookup.')
            return
          }
          const lookupResult = await lookupVehicleByPlateState(normalizedState, normalizedPlate)
          setResult(lookupResult)
          onLookupComplete(lookupResult)
          setStatus('idle')
          return
        }

        const normalizedVin = vinValue.trim().toUpperCase()
        if (normalizedVin.length < 11) {
          setStatus('error')
          setMessage('Enter at least 11 VIN characters to run the lookup.')
          return
        }
        const lookupResult = await lookupVehicleByVin(normalizedVin)
        setResult(lookupResult)
        onLookupComplete(lookupResult)
        setStatus('idle')
      } catch {
        setStatus('error')
        setMessage('Lookup failed. Please retry.')
      }
    },
    [mode, onLookupComplete],
  )

  useEffect(() => {
    if (autoLookupKey === 0) {
      return
    }
    if (mode === 'plate') {
      const nextPlate = (prefill.plate ?? '').trim()
      const nextState = (prefill.state ?? '').trim()
      if (nextPlate && nextState) {
        void handleLookup(nextPlate, nextState, '')
      }
      return
    }
    const nextVin = (prefill.vin ?? '').trim()
    if (nextVin.length >= 11) {
      void handleLookup('', '', nextVin)
    }
  }, [autoLookupKey, mode, prefill.plate, prefill.state, prefill.vin, handleLookup])

  const handlePlateChange = (event: ChangeEvent<HTMLInputElement>) => {
    setPlate(event.target.value)
    resetResult()
  }

  const handleStateChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setState(event.target.value)
    resetResult()
  }

  const handleVinChange = (event: ChangeEvent<HTMLInputElement>) => {
    setVin(event.target.value)
    resetResult()
  }

  const handleSubmit = () => {
    if (mode === 'plate') {
      void handleLookup(plate, state, '')
      return
    }
    void handleLookup('', '', vin)
  }

  return (
    <div className="lookup">
      {mode === 'plate' ? (
        <div className="form-grid form-grid--three">
          <label className="field">
            <span className="field__label">State</span>
            <select className="field__input" value={state} onChange={handleStateChange}>
              <option value="">Select state</option>
              {US_STATES.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.code} - {item.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field__label">Plate</span>
            <input
              className="field__input"
              value={plate}
              onChange={handlePlateChange}
              placeholder="7ABC123"
            />
          </label>
        </div>
      ) : (
        <label className="field">
          <span className="field__label">VIN</span>
          <input
            className="field__input"
            value={vin}
            onChange={handleVinChange}
            placeholder="1HGCM82633A123456"
          />
        </label>
      )}

      <div className="lookup__actions">
        <button
          type="button"
          className="button button--primary"
          disabled={isLookupDisabled}
          onClick={handleSubmit}
        >
          {status === 'loading' ? 'Looking up...' : 'Lookup vehicle'}
        </button>
        <p className="muted">Uses deterministic mock lookup data.</p>
      </div>

      {message && <p className="field__hint text-error">{message}</p>}

      {result && (
        <div className="summary summary--compact">
          <div>
            <span className="summary__label">Vehicle</span>
            <span className="summary__value">
              {result.year} {result.make} {result.model}
            </span>
          </div>
          <div>
            <span className="summary__label">Body type</span>
            <span className="summary__value">{result.bodyType ?? 'Not specified'}</span>
          </div>
        </div>
      )}
    </div>
  )
}
