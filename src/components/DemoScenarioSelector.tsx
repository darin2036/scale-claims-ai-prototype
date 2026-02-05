import { useEffect, useState } from 'react'
import { getPolicyHolderByScenario, listDemoScenarios } from '../server/fakeApi'
import type { PolicyHolder } from '../server/fakeDb'

interface DemoScenarioSelectorProps {
  value: string
  onChange: (id: string) => void
}

export default function DemoScenarioSelector({ value, onChange }: DemoScenarioSelectorProps) {
  const [options, setOptions] = useState<Array<{ id: string; label: string }>>([])
  const [policyHolder, setPolicyHolder] = useState<PolicyHolder | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    listDemoScenarios()
      .then((items) => {
        if (!active) {
          return
        }
        setOptions(items)
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!value) {
      return
    }
    let active = true
    getPolicyHolderByScenario(value).then((holder) => {
      if (active) {
        setPolicyHolder(holder)
      }
    })
    return () => {
      active = false
    }
  }, [value])

  return (
    <div className="panel">
      <div className="panel__header">
        <div>
          <p className="step">Demo setup</p>
          <h2>Scenario selector</h2>
        </div>
        {loading && <span className="status">Loading</span>}
      </div>
      <label className="field">
        <span className="field__label">Scenario</span>
        <select
          className="field__input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {policyHolder && (
        <div className="summary summary--compact">
          <div>
            <span className="summary__label">Policyholder</span>
            <span className="summary__value">{policyHolder.name}</span>
          </div>
          <div>
            <span className="summary__label">Deductible</span>
            <span className="summary__value">${policyHolder.policy.deductible}</span>
          </div>
          <div>
            <span className="summary__label">Coverage</span>
            <span className="summary__value">{policyHolder.policy.coverage}</span>
          </div>
          <div>
            <span className="summary__label">Rental coverage</span>
            <span className="summary__value">
              {policyHolder.policy.rentalCoverage ? 'Included' : 'Not included'}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
