import type { UrgencyMode } from '../lib/aiCopilot'

interface CopilotHeaderStatusProps {
  mode: UrgencyMode
  fallback?: boolean
}

const badgeLabelForMode = (mode: UrgencyMode) => {
  if (mode === 'urgent') {
    return 'Priority'
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

const reassuranceForMode = (mode: UrgencyMode) => {
  if (mode === 'urgent') {
    return 'Your safety comes first. We’ll handle the logistics.'
  }
  if (mode === 'moderate') {
    return 'We’re here to help. Let’s take this step by step.'
  }
  return "This looks manageable. We'll guide you through it."
}

export default function CopilotHeaderStatus({ mode, fallback }: CopilotHeaderStatusProps) {
  const reassurance = fallback ? 'We’ll guide you through each step.' : reassuranceForMode(mode)

  return (
    <div className="copilot-header-status" aria-label="AI Copilot status">
      <span className={badgeClassForMode(mode)}>{badgeLabelForMode(mode)}</span>
      <span className="copilot-header-status__message">{reassurance}</span>
    </div>
  )
}

