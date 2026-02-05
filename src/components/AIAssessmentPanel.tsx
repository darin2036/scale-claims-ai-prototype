import type { AIAssessment } from '../lib/mockAI'

interface AIAssessmentPanelProps {
  assessment: AIAssessment | null
  loading: boolean
}

export default function AIAssessmentPanel({ assessment, loading }: AIAssessmentPanelProps) {
  if (loading) {
    return <p className="muted">Generating AI assessment...</p>
  }

  if (!assessment) {
    return <p className="muted">No assessment yet. Upload a photo and run the analysis.</p>
  }

  const nextStepClass =
    assessment.recommendedNextStep === 'Approve'
      ? 'badge badge--approve'
      : assessment.recommendedNextStep === 'Review'
        ? 'badge badge--review'
        : 'badge badge--escalate'

  return (
    <div className="assessment">
      <div className="assessment__row">
        <span className="assessment__label">Damage types</span>
        <div className="chip-group">
          {assessment.damageTypes.map((type) => (
            <span key={type} className="chip">
              {type}
            </span>
          ))}
        </div>
      </div>

      <div className="assessment__row">
        <span className="assessment__label">Severity</span>
        <span className="chip chip--strong">{assessment.severity}</span>
      </div>

      <div className="assessment__row">
        <span className="assessment__label">Confidence</span>
        <div className="confidence">
          <div className="confidence__bar">
            <span style={{ width: `${assessment.confidence}%` }} />
          </div>
          <span className="confidence__value">{Math.round(assessment.confidence)}%</span>
        </div>
      </div>

      <div className="assessment__row">
        <span className="assessment__label">Recommended next step</span>
        <span className={nextStepClass}>{assessment.recommendedNextStep}</span>
      </div>

      <p className="assessment__disclaimer">
        AI output is advisory and should be reviewed before authorization.
      </p>
    </div>
  )
}
