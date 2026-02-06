import { generateIncidentSummary, type CopilotContext, type UrgencyMode } from '../lib/aiCopilot'

interface AICopilotPanelProps {
  ctx: CopilotContext
  onEdit?: () => void
}

const labelForMode = (mode: UrgencyMode) => {
  if (mode === 'urgent') {
    return 'Urgent'
  }
  if (mode === 'moderate') {
    return 'Moderate'
  }
  return 'Minor'
}

const badgeClassForMode = (mode: UrgencyMode) => {
  if (mode === 'urgent') {
    return 'badge badge--escalate'
  }
  if (mode === 'moderate') {
    return 'badge badge--review'
  }
  return 'badge badge--approve'
}

export default function AICopilotPanel({ ctx, onEdit }: AICopilotPanelProps) {
  const summary = generateIncidentSummary(ctx)
  const bullets = summary.bullets.slice(0, 5)
  const confidencePercent = Math.round(summary.confidence * 100)

  return (
    <div className="field-group" aria-label="AI incident summary">
      <div className="panel__header">
        <div>
          <p className="step">AI Copilot</p>
          <h2>{summary.title}</h2>
        </div>
        <div className="pill-group">
          <span className={badgeClassForMode(summary.mode)}>{labelForMode(summary.mode)}</span>
          {onEdit && (
            <button type="button" className="link-button" onClick={onEdit}>
              Edit / correct
            </button>
          )}
        </div>
      </div>

      <p className="muted">{summary.reassurance}</p>

      <ul className="summary__list">
        {bullets.map((bullet) => (
          <li key={bullet}>{bullet}</li>
        ))}
      </ul>

      <div>
        <p className="step">Recommended next steps</p>
        <div className="chip-group">
          {summary.recommendedNextSteps.map((step) => (
            <span key={step} className="chip">
              {step}
            </span>
          ))}
        </div>
      </div>

      <p className="muted">Confidence: {confidencePercent}%</p>
      <p className="muted">You can edit any detail later.</p>
    </div>
  )
}

