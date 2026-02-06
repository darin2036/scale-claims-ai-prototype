import { useMemo, useState } from 'react'
import { generateIncidentNarration, type NarratorFacts } from '../lib/incidentNarrator'

type NarratorValue = { narration: string; accepted: boolean; edits?: Partial<NarratorFacts> } | null

interface IncidentNarratorCardProps {
  facts: NarratorFacts
  value: NarratorValue
  onChange: (next: NarratorValue) => void
}

export default function IncidentNarratorCard({ facts, value, onChange }: IncidentNarratorCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [showWhy, setShowWhy] = useState(false)

  const edits = value?.edits ?? {}
  const mergedFacts: NarratorFacts = useMemo(() => ({ ...facts, ...edits }), [edits, facts])

  const draft = useMemo(() => generateIncidentNarration(mergedFacts), [mergedFacts])

  const accepted = value?.accepted ?? false
  const narrationText = value?.narration ?? draft.narration
  const confidencePercent = Math.round(draft.confidence * 100)

  const update = (nextEdits: Partial<NarratorFacts>) => {
    const nextFacts: NarratorFacts = { ...facts, ...nextEdits }
    const nextDraft = generateIncidentNarration(nextFacts)
    onChange({
      narration: nextDraft.narration,
      accepted: false,
      edits: nextEdits,
    })
  }

  return (
    <div className="field-group">
      <div>
        <p className="step">Optional</p>
        <h2>Incident description</h2>
        <p className="muted">We drafted this based on your photos and answers. You can edit it anytime.</p>
      </div>

      {accepted && <div className="callout callout--success">Added to your claim</div>}

      <div className="summary summary--compact">
        <div>
          <span className="summary__label">{draft.headline}</span>
          <span className="summary__value" style={{ fontWeight: 600 }}>
            Confidence: {confidencePercent}%
          </span>
        </div>
      </div>

      <label className="field">
        <span className="field__label">Description</span>
        <textarea
          className="field__input"
          rows={6}
          value={narrationText}
          placeholder="Optional: Edit this description, or regenerate a draft."
          onChange={(event) =>
            onChange({
              narration: event.target.value,
              accepted: false,
              edits,
            })
          }
          disabled={accepted}
        />
      </label>

      <div className="field-group">
        <h3>Key facts</h3>
        <ul className="summary__list">
          {draft.keyFacts.slice(0, 6).map((fact) => (
            <li key={fact.label}>
              <span className="summary__label">{fact.label}</span> {fact.value}
            </li>
          ))}
        </ul>
      </div>

      <div className="lookup__actions">
        <button type="button" className="button button--ghost" onClick={() => setExpanded((prev) => !prev)}>
          {expanded ? 'Hide notes' : 'Add notes'}
        </button>
        <button
          type="button"
          className="button button--ghost"
          onClick={() => update(edits)}
          disabled={accepted}
        >
          Regenerate draft
        </button>
        <button
          type="button"
          className="button button--primary"
          onClick={() =>
            onChange({
              narration: narrationText,
              accepted: true,
              edits,
            })
          }
          disabled={accepted}
        >
          Use this description
        </button>
      </div>

      {expanded && (
        <div className="form-grid">
          <label className="field">
            <span className="field__label">Notes</span>
            <textarea
              className="field__input"
              rows={3}
              value={edits.userNotes ?? facts.userNotes ?? ''}
              placeholder="Optional: Add a short note to refine the draft."
              onChange={(event) => update({ ...edits, userNotes: event.target.value.slice(0, 220) })}
              disabled={accepted}
            />
          </label>
        </div>
      )}

      <button type="button" className="link-button" onClick={() => setShowWhy((prev) => !prev)}>
        Why this draft?
      </button>

      {showWhy && (
        <ul className="summary__list">
          {draft.disclaimers.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
