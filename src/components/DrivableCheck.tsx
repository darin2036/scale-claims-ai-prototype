import { useState } from 'react'
import type { TowStatus } from '../server/nextStepsApi'

interface DrivableCheckProps {
  value: boolean | null
  onChange: (val: boolean) => void
  onRequestTow: (destination: 'home' | 'shop' | 'custom', customAddress?: string) => void
  towStatus?: TowStatus
  towLoading?: boolean
}

export default function DrivableCheck({
  value,
  onChange,
  onRequestTow,
  towStatus,
  towLoading = false,
}: DrivableCheckProps) {
  const [towDestination, setTowDestination] = useState<'home' | 'shop' | 'custom' | ''>('')
  const [customAddress, setCustomAddress] = useState('')

  return (
    <div className="form-grid">
      <div className="support callout">
        <p className="support__headline">If you're unsure, choose "Not safe".</p>
        <p className="muted">Safety first - we can arrange help quickly.</p>
      </div>

      <div className="form-grid form-grid--three">
        <button
          type="button"
          className={`button ${value === true ? 'button--primary' : 'button--ghost'}`}
          onClick={() => onChange(true)}
        >
          Yes, it can be driven
        </button>
        <button
          type="button"
          className={`button ${value === false ? 'button--primary' : 'button--ghost'}`}
          onClick={() => onChange(false)}
        >
          No, it's not safe to drive
        </button>
      </div>

      {value === false && (
        <div className="field-group">
          <p className="field__hint">You can request a tow now and keep going.</p>
          <div className="form-grid">
            <div className="field">
              <span className="field__label">Tow destination</span>
              <div className="form-grid form-grid--three">
                <button
                  type="button"
                  className={`button ${towDestination === 'home' ? 'button--primary' : 'button--ghost'}`}
                  onClick={() => setTowDestination('home')}
                >
                  Home
                </button>
                <button
                  type="button"
                  className={`button ${towDestination === 'shop' ? 'button--primary' : 'button--ghost'}`}
                  onClick={() => setTowDestination('shop')}
                >
                  Shop (select later)
                </button>
                <button
                  type="button"
                  className={`button ${towDestination === 'custom' ? 'button--primary' : 'button--ghost'}`}
                  onClick={() => setTowDestination('custom')}
                >
                  Custom
                </button>
              </div>
            </div>
            {towDestination === 'custom' && (
              <label className="field">
                <span className="field__label">Custom address</span>
                <input
                  className="field__input"
                  type="text"
                  placeholder="Enter a safe drop-off address"
                  value={customAddress}
                  onChange={(event) => setCustomAddress(event.target.value)}
                />
              </label>
            )}
          </div>
          <button
            type="button"
            className="button button--primary"
            onClick={() => onRequestTow(towDestination || 'home', customAddress)}
            disabled={towLoading || towDestination === '' || (towDestination === 'custom' && !customAddress.trim())}
          >
            {towLoading ? 'Requesting tow...' : 'Request a tow now'}
          </button>
          {towStatus && <p className="muted">Tow status: {towStatus}</p>}
        </div>
      )}
    </div>
  )
}
