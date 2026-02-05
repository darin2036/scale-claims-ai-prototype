import type { AIAssessment as DamageAssessment } from '../lib/mockAI'
import { generateRepairEstimate } from '../lib/estimation'
import type { Policy, Vehicle } from '../server/fakeDb'

interface EstimateBreakdownProps {
  vehicle: Vehicle
  assessment: DamageAssessment
  policy: Policy
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)

export default function EstimateBreakdown({ vehicle, assessment, policy }: EstimateBreakdownProps) {
  const estimate = generateRepairEstimate({ vehicle, assessment, policy })
  const confidenceLabel = `${Math.round(estimate.estimateConfidence * 100)}%`
  const lowConfidence = estimate.estimateConfidence < 0.6

  return (
    <div className="estimate">
      <div className="estimate__header">
        <div>
          <p className="kicker">Repair estimate</p>
          <h3 className="estimate__cost">{formatCurrency(estimate.estimatedRepairCost)}</h3>
          <p className="muted">
            {vehicle.year} {vehicle.make} {vehicle.model} {vehicle.bodyType ?? ''}
          </p>
        </div>
        <div className={`callout ${estimate.aboveDeductible ? 'callout--success' : 'callout--warn'}`}>
          {estimate.aboveDeductible ? 'Likely above deductible' : 'Likely below deductible'}
        </div>
      </div>

      <div className="summary summary--compact">
        <div>
          <span className="summary__label">Customer pays</span>
          <span className="summary__value">{formatCurrency(estimate.customerPays)}</span>
        </div>
        <div>
          <span className="summary__label">Insurer pays</span>
          <span className="summary__value">{formatCurrency(estimate.insurerPays)}</span>
        </div>
        <div>
          <span className="summary__label">Deductible</span>
          <span className="summary__value">{formatCurrency(policy.deductible)}</span>
        </div>
        <div>
          <span className="summary__label">Estimate confidence</span>
          <span className="summary__value">{confidenceLabel}</span>
        </div>
      </div>

      {lowConfidence && (
        <div className="callout callout--warn">
          Low confidence — recommend manual review or request more photos.
        </div>
      )}

      {estimate.isPotentialTotalLoss && (
        <div className="callout callout--alert">
          <strong>Potential total loss.</strong> {estimate.totalLossReason} Next step: escalate to a
          senior adjuster.
        </div>
      )}

      <div className="summary summary--compact">
        <div>
          <span className="summary__label">Estimated vehicle value</span>
          <span className="summary__value">{formatCurrency(estimate.estimatedVehicleValue)}</span>
        </div>
        <div>
          <span className="summary__label">Coverage</span>
          <span className="summary__value">{policy.coverage}</span>
        </div>
        <div>
          <span className="summary__label">Rental coverage</span>
          <span className="summary__value">{policy.rentalCoverage ? 'Included' : 'Not included'}</span>
        </div>
      </div>

      <div className="line-items">
        {estimate.lineItems.map((item) => (
          <div key={item.label} className="line-items__row">
            <span>{item.label}</span>
            <span>{formatCurrency(item.amount)}</span>
          </div>
        ))}
      </div>

      <p className="muted estimate__disclaimer">
        Preliminary estimate only. Final costs subject to shop inspection and teardown.
      </p>
    </div>
  )
}
