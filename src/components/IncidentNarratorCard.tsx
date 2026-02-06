import { useMemo, useState } from 'react'
import { generateIncidentNarration, type NarratorFacts } from '../lib/incidentNarrator'

type NarratorValue = { narration: string; accepted: boolean; edits?: Partial<NarratorFacts> } | null

interface IncidentNarratorCardProps {
  facts: NarratorFacts
  value: NarratorValue
  onChange: (next: NarratorValue) => void
}

const drivableToSelectValue = (drivable?: boolean | null) => {
  if (drivable === true) {
    return 'yes'
  }
  if (drivable === false) {
    return 'no'
  }
  return 'unknown'
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

  const selectedDrivable = useMemo(() => {
    if (Object.prototype.hasOwnProperty.call(edits, 'drivable')) {
      return edits.drivable
    }
    return facts.drivable
  }, [edits, facts.drivable])

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
        <p className="step">AI Draft</p>
        <h2>Incident summary (AI drafted)</h2>
        <p className="muted">Review and edit a couple key details if needed.</p>
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

      <p className="muted" style={{ lineHeight: 1.45 }}>
        {narrationText}
      </p>

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
          {expanded ? 'Hide edits' : 'Edit details'}
        </button>
        <button
          type="button"
          className="button button--ghost"
          onClick={() => update(edits)}
          disabled={accepted}
        >
          Regenerate summary
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
          Use this summary
        </button>
      </div>

      {expanded && (
        <div className="form-grid">
          <label className="field">
            <span className="field__label">Drivable</span>
            <select
              className="field__input"
              value={drivableToSelectValue(selectedDrivable)}
              onChange={(event) => {
                const next =
                  event.target.value === 'yes'
                    ? true
                    : event.target.value === 'no'
                      ? false
                      : null
                update({ ...edits, drivable: next })
              }}
              disabled={accepted}
            >
              <option value="unknown">Unknown</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>

          {typeof facts.hasOtherParty === 'boolean' && (
            <label className="field">
              <span className="field__label">Other party involved</span>
              <select
                className="field__input"
                value={(edits.hasOtherParty ?? facts.hasOtherParty) ? 'yes' : 'no'}
                onChange={(event) => update({ ...edits, hasOtherParty: event.target.value === 'yes' })}
                disabled={accepted}
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>
          )}

          <label className="field">
            <span className="field__label">Notes</span>
            <textarea
              className="field__input"
              rows={3}
              value={edits.userNotes ?? facts.userNotes ?? ''}
              placeholder="Optional: Add a short note to refine the summary."
              onChange={(event) => update({ ...edits, userNotes: event.target.value.slice(0, 220) })}
              disabled={accepted}
            />
          </label>
        </div>
      )}

      <button type="button" className="link-button" onClick={() => setShowWhy((prev) => !prev)}>
        Why this summary?
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
