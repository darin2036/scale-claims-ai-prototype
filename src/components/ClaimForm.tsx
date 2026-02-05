import { useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { getMakesForYear, getModelsForYearMake, vehicleYears } from '../data/vehicleData'

export interface ClaimFormData {
  claimId: string
  policyholderName: string
  lossDate: string
  location: string
  vehicleYear: string
  vehicleMake: string
  vehicleModel: string
  vin: string
}

interface ClaimFormProps {
  onSubmit: (data: ClaimFormData) => void
}

const VIN_DECODING_ENABLED = false

const initialState: ClaimFormData = {
  claimId: '',
  policyholderName: '',
  lossDate: '',
  location: '',
  vehicleYear: '',
  vehicleMake: '',
  vehicleModel: '',
  vin: '',
}

export default function ClaimForm({ onSubmit }: ClaimFormProps) {
  const [formData, setFormData] = useState<ClaimFormData>(initialState)
  const [vinStatus, setVinStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [vinMessage, setVinMessage] = useState('')
  const [decodedVehicle, setDecodedVehicle] = useState<{
    year: string
    make: string
    model: string
  } | null>(null)

  const decodedYear = decodedVehicle?.year ?? ''
  const decodedMake = decodedVehicle?.make ?? ''
  const decodedModel = decodedVehicle?.model ?? ''
  const yearOptions = useMemo(() => {
    if (decodedYear && !vehicleYears.includes(decodedYear)) {
      return [decodedYear, ...vehicleYears]
    }
    return vehicleYears
  }, [decodedYear])
  const availableMakes = useMemo(
    () => {
      const makes = getMakesForYear(formData.vehicleYear)
      if (decodedMake && !makes.includes(decodedMake)) {
        return [decodedMake, ...makes]
      }
      return makes
    },
    [formData.vehicleYear, decodedMake],
  )
  const availableModels = useMemo(
    () => {
      const models = getModelsForYearMake(formData.vehicleYear, formData.vehicleMake)
      if (decodedModel && !models.includes(decodedModel)) {
        return [decodedModel, ...models]
      }
      return models
    },
    [formData.vehicleYear, formData.vehicleMake, decodedModel],
  )

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = event.target
    setFormData((prev) => {
      if (name === 'vehicleYear') {
        return {
          ...prev,
          vehicleYear: value,
          vehicleMake: '',
          vehicleModel: '',
        }
      }
      if (name === 'vehicleMake') {
        return {
          ...prev,
          vehicleMake: value,
          vehicleModel: '',
        }
      }
      return { ...prev, [name]: value }
    })
  }

  const handleVinLookup = async () => {
    if (!VIN_DECODING_ENABLED) {
      setVinStatus('error')
      setVinMessage('VIN decoding is disabled in this prototype.')
      return
    }
    const vin = formData.vin.trim().toUpperCase()
    if (vin.length < 11) {
      setVinStatus('error')
      setVinMessage('Enter at least 11 characters to decode a VIN.')
      return
    }

    setVinStatus('loading')
    setVinMessage('')
    setDecodedVehicle(null)

    try {
      const response = await fetch(
        `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${encodeURIComponent(
          vin,
        )}?format=json`,
      )
      const payload = (await response.json()) as {
        Results?: Array<{
          ModelYear?: string
          Make?: string
          Model?: string
          ErrorCode?: string
          ErrorText?: string
        }>
      }

      const result = payload.Results?.[0]
      const year = result?.ModelYear?.trim() ?? ''
      const make = result?.Make?.trim() ?? ''
      const model = result?.Model?.trim() ?? ''
      const errorText = result?.ErrorText?.trim() ?? ''

      if (!year || !make || !model) {
        setVinStatus('error')
        setVinMessage(errorText || 'VIN decode failed. Please verify the VIN.')
        return
      }

      setDecodedVehicle({ year, make, model })
      setFormData((prev) => ({
        ...prev,
        vehicleYear: year,
        vehicleMake: make,
        vehicleModel: model,
      }))
      setVinStatus('success')
      setVinMessage(`Decoded ${year} ${make} ${model}. Review and edit if needed.`)
    } catch {
      setVinStatus('error')
      setVinMessage('VIN lookup failed. Please try again.')
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="form-grid">
      <div className="field">
        <span className="field__label">VIN (optional)</span>
        <div className="field__inline">
          <input
            name="vin"
            value={formData.vin}
            onChange={handleChange}
            placeholder="1HGCM82633A123456"
            className="field__input"
          />
          <button
            type="button"
            className="button button--ghost"
            onClick={handleVinLookup}
            disabled={vinStatus === 'loading' || !VIN_DECODING_ENABLED}
          >
            {vinStatus === 'loading' ? 'Decoding...' : 'Decode VIN'}
          </button>
        </div>
        {vinMessage && (
          <p className={`field__hint ${vinStatus === 'error' ? 'text-error' : 'text-success'}`}>
            {vinMessage}
          </p>
        )}
      </div>

      <label className="field">
        <span className="field__label">Claim ID</span>
        <input
          name="claimId"
          value={formData.claimId}
          onChange={handleChange}
          placeholder="CLM-10427"
          required
          className="field__input"
        />
      </label>

      <label className="field">
        <span className="field__label">Policyholder</span>
        <input
          name="policyholderName"
          value={formData.policyholderName}
          onChange={handleChange}
          placeholder="Jordan Smith"
          required
          className="field__input"
        />
      </label>

      <label className="field">
        <span className="field__label">Date of loss</span>
        <input
          type="date"
          name="lossDate"
          value={formData.lossDate}
          onChange={handleChange}
          required
          className="field__input"
        />
      </label>

      <label className="field">
        <span className="field__label">Loss location</span>
        <input
          name="location"
          value={formData.location}
          onChange={handleChange}
          placeholder="Oakland, CA"
          required
          className="field__input"
        />
      </label>

      <fieldset className="field-group">
        <legend>Vehicle</legend>
        <p className="field__hint">Select year, then make and model. This demo uses a public dataset.</p>
        <div className="form-grid form-grid--three">
          <label className="field">
            <span className="field__label">Year</span>
            <select
              name="vehicleYear"
              value={formData.vehicleYear}
              onChange={handleSelectChange}
              required
              className="field__input"
            >
              <option value="">Select year</option>
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field__label">Make</span>
            <select
              name="vehicleMake"
              value={formData.vehicleMake}
              onChange={handleSelectChange}
              required
              className="field__input"
              disabled={!formData.vehicleYear}
            >
              <option value="">Select make</option>
              {availableMakes.map((make) => (
                <option key={make} value={make}>
                  {make}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field__label">Model</span>
            <select
              name="vehicleModel"
              value={formData.vehicleModel}
              onChange={handleSelectChange}
              required
              className="field__input"
              disabled={!formData.vehicleMake}
            >
              <option value="">Select model</option>
              {availableModels.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </label>
        </div>
      </fieldset>

      <button type="submit" className="button button--primary">
        Save claim details
      </button>
    </form>
  )
}
