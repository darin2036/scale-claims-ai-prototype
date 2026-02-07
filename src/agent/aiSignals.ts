import type { AgentClaim, AgentSignal } from './store'

const MIN_PHOTO_COUNT_FOR_WIDE_SHOT = 2
const LOW_CONFIDENCE_THRESHOLD = 0.6
const MINOR_LANGUAGE_PATTERNS = [
  'minor',
  'small',
  'light',
  'cosmetic',
  'just a scratch',
  'only a scratch',
]

const toNormalizedConfidence = (confidence: number) => (confidence <= 1 ? confidence : confidence / 100)

const hashString = (value: string) => {
  let hash = 0
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  }
  return hash.toString(16)
}

const hasDuplicatePhotos = (claim: AgentClaim) => {
  const seenNames = new Set<string>()
  const seenUrlHashes = new Set<string>()

  for (const photo of claim.photos) {
    const normalizedName = photo.name.trim().toLowerCase()
    if (normalizedName) {
      if (seenNames.has(normalizedName)) {
        return true
      }
      seenNames.add(normalizedName)
    }

    const urlHash = hashString(photo.url)
    if (seenUrlHashes.has(urlHash)) {
      return true
    }
    seenUrlHashes.add(urlHash)
  }

  return false
}

export const evaluateAISignals = (claim: AgentClaim): AgentSignal[] => {
  const signals: AgentSignal[] = []
  const confidence = claim.aiAssessment?.confidence
  const normalizedConfidence = typeof confidence === 'number' ? toNormalizedConfidence(confidence) : null

  if (claim.photos.length < MIN_PHOTO_COUNT_FOR_WIDE_SHOT) {
    signals.push({
      id: 'missing_wide_shot',
      severity: 'Info',
      title: 'Needs review: Limited photo coverage',
      recommendedAction: 'Request more photos to include a wide vehicle view.',
    })
  }

  if (normalizedConfidence !== null && normalizedConfidence < LOW_CONFIDENCE_THRESHOLD) {
    signals.push({
      id: 'very_low_confidence',
      severity: 'Warning',
      title: 'Needs review: Very low AI confidence',
      recommendedAction: 'Request more photos or escalate for manual review.',
    })
  }

  const noteText = `${claim.agentNotes ?? ''} ${claim.incident?.incidentDescription ?? ''}`.toLowerCase()
  const hasMinorLanguage = MINOR_LANGUAGE_PATTERNS.some((term) => noteText.includes(term))
  if (claim.aiAssessment?.severity === 'High' && hasMinorLanguage) {
    signals.push({
      id: 'severity_notes_mismatch',
      severity: 'Warning',
      title: 'Needs review: Severity and note language mismatch',
      recommendedAction: 'Escalate to senior adjuster to confirm final severity.',
    })
  }

  if (claim.photos.length > 1 && hasDuplicatePhotos(claim)) {
    signals.push({
      id: 'duplicate_photos',
      severity: 'Info',
      title: 'Needs review: Potential duplicate photos detected',
      recommendedAction: 'Request additional distinct angles for validation.',
    })
  }

  return signals
}
