interface ProgressHeaderProps {
  currentStep: number
  totalSteps: number
  title: string
  subtitle?: string
  showProgress?: boolean
}

export default function ProgressHeader({
  currentStep,
  totalSteps,
  title,
  subtitle,
  showProgress = true,
}: ProgressHeaderProps) {
  const safeTotal = Math.max(1, totalSteps)
  const safeStep = Math.min(Math.max(1, currentStep), safeTotal)
  const percent = Math.round((safeStep / safeTotal) * 100)

  return (
    <header className="progress-header" role="banner">
      {showProgress && (
        <>
          <div className="progress-header__top">
            <span className="progress-header__step">
              Step {safeStep} of {safeTotal}
            </span>
          </div>
          <div className="progress-header__bar" aria-hidden="true">
            <span className="progress-header__barFill" style={{ width: `${percent}%` }} />
          </div>
        </>
      )}
      <div className="progress-header__titles">
        <h1 className="progress-header__title">{title}</h1>
        {subtitle && <p className="progress-header__subtitle">{subtitle}</p>}
      </div>
    </header>
  )
}
