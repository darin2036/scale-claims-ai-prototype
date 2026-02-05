interface PolicySummaryProps {
  policyId: string
  deductible: number
  coverage: 'collision' | 'comprehensive'
  rentalCoverage: boolean
  estimatedRepairCost?: number | null
}

export default function PolicySummary({
  policyId,
  deductible,
  coverage,
  rentalCoverage,
  estimatedRepairCost,
}: PolicySummaryProps) {
  const hasEstimate = typeof estimatedRepairCost === 'number'
  const customerPays = hasEstimate ? Math.min(deductible, estimatedRepairCost) : null
  const insurerPays = hasEstimate ? Math.max(0, estimatedRepairCost - deductible) : null
  const aboveDeductible = hasEstimate ? estimatedRepairCost >= deductible : null

  return (
    <div className="summary summary--compact">
      <div>
        <span className="summary__label">Policy ID</span>
        <span className="summary__value">{policyId}</span>
      </div>
      <div>
        <span className="summary__label">Coverage</span>
        <span className="summary__value">{coverage}</span>
      </div>
      <div>
        <span className="summary__label">Deductible</span>
        <span className="summary__value">${deductible}</span>
      </div>
      <div>
        <span className="summary__label">Rental coverage</span>
        <span className="summary__value">{rentalCoverage ? 'Yes' : 'No'}</span>
      </div>
      <div className="summary__full">
        <span className="summary__label">Plain English</span>
        <ul className="summary__list">
          <li>You pay the first ${deductible} (deductible) before insurance contributes.</li>
          <li>
            {coverage === 'collision'
              ? 'Collision coverage typically applies to accident damage.'
              : 'Comprehensive coverage typically applies to non-collision losses.'}
          </li>
          <li>Rental coverage: {rentalCoverage ? 'Yes' : 'No'}.</li>
        </ul>
      </div>
      {hasEstimate && (
        <div className="summary__full">
          <span className="summary__label">
            Likely {aboveDeductible ? 'above' : 'below'} deductible
          </span>
          <div className="summary__split">
            <span>Customer pays: ${customerPays}</span>
            <span>Insurer pays: ${insurerPays}</span>
          </div>
          <p className="muted">Preliminary estimate — final cost depends on shop inspection.</p>
        </div>
      )}
    </div>
  )
}
