import { useCallback, useEffect, useState } from 'react'
import { lookupVehicleByIdentifier } from '../server/fakeApi'
import type { Vehicle } from '../server/fakeDb'

interface VehicleLookupProps {
  stateCode?: string
  identifier: string
  onLookupComplete: (result: Vehicle | null) => void
}

export default function VehicleLookup({
  stateCode,
  identifier,
  onLookupComplete,
}: VehicleLookupProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<Vehicle | null>(null)

  useEffect(() => {
    setResult(null)
    setStatus('idle')
    setMessage('')
    onLookupComplete(null)
  }, [identifier, stateCode, onLookupComplete])

  const resetResult = () => {
    if (result) {
      setResult(null)
      onLookupComplete(null)
    }
    setStatus('idle')
    setMessage('')
  }

  const handleLookup = useCallback(async () => {
    setStatus('loading')
    setMessage('')
    setResult(null)
    onLookupComplete(null)

    try {
      const lookupResult = await lookupVehicleByIdentifier({
        state: stateCode,
        identifier,
      })
      setResult(lookupResult)
      onLookupComplete(lookupResult)
      setStatus('idle')
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'Lookup failed. Please retry.'
      setStatus('error')
      setMessage(messageText)
    }
  }, [identifier, onLookupComplete, stateCode])

  useEffect(() => {
    if (!identifier.trim()) {
      return
    }
    void handleLookup()
  }, [handleLookup, identifier, stateCode])

  return (
    <div className="lookup">
      <div className="lookup__actions">
        <button
          type="button"
          className="button button--primary"
          disabled={status === 'loading'}
          onClick={() => {
            resetResult()
            void handleLookup()
          }}
        >
          {status === 'loading' ? 'Looking up...' : 'Retry lookup'}
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
