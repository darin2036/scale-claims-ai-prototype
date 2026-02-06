import { useCallback, useEffect, useRef, useState } from 'react'
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
  const onLookupCompleteRef = useRef(onLookupComplete)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<Vehicle | null>(null)

  useEffect(() => {
    onLookupCompleteRef.current = onLookupComplete
  }, [onLookupComplete])

  useEffect(() => {
    setResult(null)
    setStatus('idle')
    setMessage('')
    onLookupCompleteRef.current(null)
  }, [identifier, stateCode])

  const resetResult = () => {
    if (result) {
      setResult(null)
      onLookupCompleteRef.current(null)
    }
    setStatus('idle')
    setMessage('')
  }

  const handleLookup = useCallback(async () => {
    setStatus('loading')
    setMessage('')
    setResult(null)
    onLookupCompleteRef.current(null)

    try {
      const lookupResult = await lookupVehicleByIdentifier({
        state: stateCode,
        identifier,
      })
      setResult(lookupResult)
      onLookupCompleteRef.current(lookupResult)
      setStatus('idle')
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'Lookup failed. Please retry.'
      setStatus('error')
      setMessage(messageText)
    }
  }, [identifier, stateCode])

  useEffect(() => {
    if (!identifier.trim()) {
      return
    }
    void handleLookup()
  }, [handleLookup, identifier, stateCode])

  return (
    <div className="lookup">
      {status === 'loading' && <p className="muted">Looking up the other vehicle…</p>}

      {message && (
        <div className="callout callout--warn">
          <p style={{ margin: 0 }}>
            <strong>Lookup needs a retry.</strong> {message}
          </p>
          <div className="lookup__actions" style={{ marginTop: 10 }}>
            <button
              type="button"
              className="button button--ghost"
              disabled={status === 'loading'}
              onClick={() => {
                resetResult()
                void handleLookup()
              }}
            >
              Try again
            </button>
          </div>
        </div>
      )}

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
