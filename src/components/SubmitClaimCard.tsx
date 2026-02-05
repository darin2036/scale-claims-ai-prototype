import type { Vehicle } from '../server/fakeDb'

interface SubmitClaimCardProps {
  vehicle: Vehicle | null
  drivable: boolean | null
  estimateSummary?: {
    estimatedRepairCost: number
    aboveDeductible: boolean
    customerPays: number
    insurerPays: number
  } | null
  disabled: boolean
  submitting: boolean
  claimId?: string | null
  onSubmit: () => Promise<void>
}

export default function SubmitClaimCard({
  vehicle,
  drivable,
  estimateSummary,
  disabled,
  submitting,
  claimId,
  onSubmit,
}: SubmitClaimCardProps) {
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
          <span className="summary__value">
            {vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : 'Pending'}
          </span>
        </div>
        <div>
          <span className="summary__label">Drivable</span>
          <span className="summary__value">
            {drivable === null ? 'Not answered' : drivable ? 'Yes' : 'No'}
          </span>
        </div>
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
