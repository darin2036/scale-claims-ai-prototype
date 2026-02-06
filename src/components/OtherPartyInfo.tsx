import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { OtherPartyDetails } from '../types/claim'
import PhotoSlotUploader from './PhotoSlotUploader'
import VehicleIdentifierEntry from './VehicleIdentifierEntry'
import VehicleLookup from './VehicleLookup'
import { hashString } from '../server/hash'

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

  const updateFromAutoFill = useCallback(
    (next: Partial<OtherPartyDetails>, message?: string) => {
      const merged: OtherPartyDetails = { ...value, ...next }
      const changed = (Object.keys(next) as Array<keyof OtherPartyDetails>).some(
        (key) => merged[key] !== value[key],
      )
      if (!changed) {
        return
      }
      onChange(merged)
      if (message) {
        showNotice(message)
      }
    },
    [onChange, showNotice, value],
  )

  const mockExtractNameAndContact = useCallback((file: File) => {
    const seed = `${file.name}:${file.size}`
    const hash = hashString(seed)
    const firstNames = [
      'Alex',
      'Taylor',
      'Jordan',
      'Casey',
      'Morgan',
      'Riley',
      'Avery',
      'Sam',
      'Jamie',
      'Cameron',
    ]
    const lastNames = [
      'Nguyen',
      'Patel',
      'Johnson',
      'Garcia',
      'Lee',
      'Martinez',
      'Brown',
      'Davis',
      'Wilson',
      'Anderson',
    ]
    const first = firstNames[hash % firstNames.length]
    const last = lastNames[(hashString(`${seed}:last`) + 3) % lastNames.length]
    const name = `${first} ${last}`
    const phone = `(555) ${String(100 + (hash % 800)).padStart(3, '0')}-${String(1000 + (hash % 9000)).padStart(4, '0')}`
    const email = `${first.toLowerCase()}.${last.toLowerCase()}@example.com`
    const contact = hash % 2 === 0 ? phone : email
    return { name, contact }
  }, [])

  const mockExtractInsurance = useCallback((file: File) => {
    const seed = `${file.name}:${file.size}`
    const hash = hashString(seed)
    const carriers = [
      'State Farm',
      'GEICO',
      'Progressive',
      'Allstate',
      'USAA',
      'Liberty Mutual',
      'Farmers',
      'Nationwide',
    ]
    const carrier = carriers[hash % carriers.length]
    const policyNumber = `POL-${String(100000 + (hash % 900000)).padStart(6, '0')}-${String(hashString(`${seed}:p`) % 1000).padStart(3, '0')}`
    return { carrier, policyNumber }
  }, [])

  useEffect(() => {
    if (value.noInfo) {
      return
    }
    if (!licensePhoto) {
      return
    }
    const extracted = mockExtractNameAndContact(licensePhoto)
    updateFromAutoFill(
      {
        otherDriverName: value.otherDriverName.trim() ? value.otherDriverName : extracted.name,
        otherContact: value.otherContact.trim() ? value.otherContact : extracted.contact,
      },
      'Driver license scanned (mock). We filled what we could.',
    )
  }, [licensePhoto, mockExtractNameAndContact, updateFromAutoFill, value.noInfo, value.otherContact, value.otherDriverName])

  useEffect(() => {
    if (value.noInfo) {
      return
    }
    if (!insuranceCardPhoto) {
      return
    }
    const extractedName = mockExtractNameAndContact(insuranceCardPhoto)
    const extractedInsurance = mockExtractInsurance(insuranceCardPhoto)
    updateFromAutoFill(
      {
        otherDriverName: value.otherDriverName.trim() ? value.otherDriverName : extractedName.name,
        insuranceCarrier: value.insuranceCarrier.trim()
          ? value.insuranceCarrier
          : extractedInsurance.carrier,
        policyNumber: value.policyNumber.trim() ? value.policyNumber : extractedInsurance.policyNumber,
      },
      'Insurance card scanned (mock). We filled carrier and policy info.',
    )
  }, [
    insuranceCardPhoto,
    mockExtractInsurance,
    mockExtractNameAndContact,
    updateFromAutoFill,
    value.insuranceCarrier,
    value.noInfo,
    value.otherDriverName,
    value.policyNumber,
  ])

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
              </div>
            </div>

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

            <div className="summary summary--compact">
              <div>
                <span className="summary__label">Other vehicle plate</span>
                <span className="summary__value">{value.otherVehiclePlate || 'Not provided'}</span>
              </div>
              <div>
                <span className="summary__label">State</span>
                <span className="summary__value">{value.otherVehicleState || 'Not provided'}</span>
              </div>
              <div className="summary__full">
                <p className="muted" style={{ margin: 0 }}>
                  Use “Other vehicle lookup” above to capture plate/state (no need to enter it twice).
                </p>
              </div>
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
