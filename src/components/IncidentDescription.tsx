import { useMemo, useState } from 'react'
import { draftIncidentDescription, type CopilotContext } from '../lib/aiCopilot'
import type { OtherPartyDetails } from '../types/claim'

interface IncidentDescriptionProps {
  ctx: CopilotContext
  value: string
  onChange: (text: string) => void
  hasOtherParty?: boolean
  otherParty?: OtherPartyDetails
}

const shouldTreatAsFreeText = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) {
    return false
  }
  if (trimmed.length > 160) {
    return false
  }
  const sentenceMarkers = (trimmed.match(/[.!?]/g) ?? []).length
  return sentenceMarkers <= 1
}

export default function IncidentDescription({
  ctx,
  value,
  onChange,
  hasOtherParty,
  otherParty,
}: IncidentDescriptionProps) {
  const [hasDraft, setHasDraft] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [showWhy, setShowWhy] = useState(false)

  const draft = useMemo(() => {
    const freeText = shouldTreatAsFreeText(value) ? value.trim() : undefined
    return draftIncidentDescription({
      freeText,
      ctx,
      hasOtherParty,
      otherParty: otherParty
        ? {
            name: otherParty.otherDriverName || undefined,
            plate: otherParty.otherVehiclePlate || undefined,
            state: otherParty.otherVehicleState || undefined,
            makeModel: otherParty.otherVehicleMakeModel || undefined,
          }
        : undefined,
    })
  }, [ctx, hasOtherParty, otherParty, value])

  const confidencePercent = Math.round(draft.confidence * 100)

  const applyDraft = (confirmReplace: boolean) => {
    const trimmed = value.trim()
    if (confirmReplace && trimmed.length > 0) {
      const ok = window.confirm('Replace the current text with a drafted description?')
      if (!ok) {
        return
      }
    }
    onChange(draft.text)
    setHasDraft(true)
    setAccepted(false)
    setShowWhy(false)
  }

  return (
    <div className="field-group">
      <div>
        <p className="step">Optional</p>
        <h2>Incident description (optional)</h2>
        <p className="muted">We can draft this for you — you can edit it anytime.</p>
      </div>

      {hasDraft && !accepted && (
        <div className="callout" role="status" aria-live="polite">
          Draft inserted. Review and edit as needed, then tap Accept when it looks right.
        </div>
      )}

      <label className="field">
        <span className="field__label">Description</span>
        <textarea
          className="field__input"
          rows={6}
          value={value}
          placeholder="Optional: Add a couple details, or leave blank and we’ll draft it for you."
          onChange={(event) => onChange(event.target.value)}
        />
      </label>

      <div className="lookup__actions">
        <button type="button" className="button button--primary" onClick={() => applyDraft(true)}>
          Draft for me
        </button>
        <button type="button" className="button button--ghost" onClick={() => applyDraft(false)}>
          Regenerate
        </button>
        <button
          type="button"
          className="button button--ghost"
          onClick={() => {
            setAccepted(true)
            setHasDraft(false)
          }}
          disabled={!value.trim()}
        >
          Accept
        </button>
      </div>

      <p className="muted">Draft confidence: {confidencePercent}%</p>

      <button
        type="button"
        className="link-button"
        onClick={() => setShowWhy((prev) => !prev)}
      >
        Why this draft?
      </button>

      {showWhy && (
        <ul className="summary__list">
          {draft.rationale.slice(0, 3).map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

