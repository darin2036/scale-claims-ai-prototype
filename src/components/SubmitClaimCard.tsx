import type { Vehicle } from '../server/fakeDb'

interface SubmitClaimCardProps {
  vehicle: Vehicle | null
  drivable: boolean | null
  hasOtherParty?: boolean | null
  photosSummary?: { damageCount: number; vehicle: boolean; otherInsurance: boolean }
  estimateSummary?: {
    estimatedRepairCost: number
    aboveDeductible: boolean
    customerPays: number
    insurerPays: number
  } | null
  disabled: boolean
  submitting: boolean
  claimId?: string | null
  onEditVehicle?: () => void
  onChangeDrivable?: () => void
  onChangeOtherParty?: () => void
  onEditPhotos?: () => void
  onSubmit: () => Promise<void>
}

export default function SubmitClaimCard({
  vehicle,
  drivable,
  hasOtherParty,
  photosSummary,
  estimateSummary,
  disabled,
  submitting,
  claimId,
  onEditVehicle,
  onChangeDrivable,
  onChangeOtherParty,
  onEditPhotos,
  onSubmit,
}: SubmitClaimCardProps) {
  const otherPartyLabel =
    hasOtherParty === undefined ? null : hasOtherParty === null ? 'Not answered' : hasOtherParty ? 'Yes' : 'No'
  const photosLabel = photosSummary
    ? `${photosSummary.damageCount} damage, ${photosSummary.vehicle ? 'vehicle' : 'no vehicle'}, ${
        photosSummary.otherInsurance ? 'other insurance' : 'no other insurance'
      }`
    : null

  return (
    <div className="field-group">
      <div>
        <p className="step">Review</p>
        <h2>Submit your claim</h2>
        <p className="muted">You're almost done. We'll take it from here.</p>
      </div>

      <div className="summary summary--compact">
        <div>
          <span className="summary__label">Vehicle</span>
          <div className="summary__split">
            <span className="summary__value">
              {vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : 'Pending'}
            </span>
            {onEditVehicle && (
              <button
                type="button"
                className="link-button"
                onClick={onEditVehicle}
                disabled={submitting || Boolean(claimId)}
              >
                Edit
              </button>
            )}
          </div>
        </div>
        <div>
          <span className="summary__label">Drivable</span>
          <div className="summary__split">
            <span className="summary__value">
              {drivable === null ? 'Not answered' : drivable ? 'Yes' : 'No'}
            </span>
            {onChangeDrivable && (
              <button
                type="button"
                className="link-button"
                onClick={onChangeDrivable}
                disabled={submitting || Boolean(claimId)}
              >
                Change
              </button>
            )}
          </div>
        </div>
        {otherPartyLabel !== null && (
          <div>
            <span className="summary__label">Other party</span>
            <div className="summary__split">
              <span className="summary__value">{otherPartyLabel}</span>
              {onChangeOtherParty && (
                <button
                  type="button"
                  className="link-button"
                  onClick={onChangeOtherParty}
                  disabled={submitting || Boolean(claimId)}
                >
                  Change
                </button>
              )}
            </div>
          </div>
        )}
        {photosLabel !== null && (
          <div>
            <span className="summary__label">Photos</span>
            <div className="summary__split">
              <span className="summary__value">{photosLabel}</span>
              {onEditPhotos && (
                <button
                  type="button"
                  className="link-button"
                  onClick={onEditPhotos}
                  disabled={submitting || Boolean(claimId)}
                >
                  Edit
                </button>
              )}
            </div>
          </div>
        )}
        {estimateSummary && (
          <div>
            <span className="summary__label">Deductible</span>
            <span className="summary__value">
              {estimateSummary.aboveDeductible ? 'Likely above' : 'Likely below'}
            </span>
          </div>
        )}
      </div>

      {estimateSummary && (
        <div className="summary summary--compact">
          <div>
            <span className="summary__label">Estimated repair cost</span>
            <span className="summary__value">${estimateSummary.estimatedRepairCost}</span>
          </div>
          <div>
            <span className="summary__label">Customer pays</span>
            <span className="summary__value">${estimateSummary.customerPays}</span>
          </div>
          <div>
            <span className="summary__label">Insurer pays</span>
            <span className="summary__value">${estimateSummary.insurerPays}</span>
          </div>
        </div>
      )}

      <button
        type="button"
        className="button button--primary"
        disabled={disabled || submitting || Boolean(claimId)}
        onClick={() => void onSubmit()}
      >
        {submitting ? 'Submitting...' : claimId ? 'Claim submitted' : 'Submit claim'}
      </button>

      {claimId && (
        <div className="callout callout--success">
          Claim submitted: <strong>{claimId}</strong>
        </div>
      )}
    </div>
  )
}
