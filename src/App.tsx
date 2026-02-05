import { useState } from 'react'
import './App.css'
import ClaimForm from './components/ClaimForm'
import ImageUploader from './components/ImageUploader'
import AIAssessmentPanel from './components/AIAssessmentPanel'
import { assessDamage } from './lib/mockAI'
import type { ClaimFormData } from './components/ClaimForm'
import type { AIAssessment } from './lib/mockAI'

function App() {
  const [claimData, setClaimData] = useState<ClaimFormData | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [assessment, setAssessment] = useState<AIAssessment | null>(null)
  const [isAssessing, setIsAssessing] = useState(false)

  const handleClaimSubmit = (data: ClaimFormData) => {
    setClaimData(data)
  }

  const handleFileSelected = (file: File | null) => {
    setImageFile(file)
    // Clear stale assessment when a new image is selected.
    setAssessment(null)
  }

  const handleRunAssessment = async () => {
    if (!imageFile) {
      return
    }

    setIsAssessing(true)
    const result = await assessDamage(imageFile)
    setAssessment(result)
    setIsAssessing(false)
  }

  const vehicleSummary = claimData
    ? `${claimData.vehicleYear} ${claimData.vehicleMake} ${claimData.vehicleModel}`
    : ''

  return (
    <div className="app">
      <main className="app__shell">
        <header className="app__header">
          <div>
            <p className="kicker">Claims agent workspace</p>
            <h1>AI-assisted damage assessment</h1>
            <p className="muted">
              The AI drafts a preliminary assessment. Agents review, edit, or escalate
              before repair authorization.
            </p>
          </div>
          <div className="pill-group">
            <span className="pill">Explainable AI</span>
            <span className="pill">Human-in-the-loop</span>
            <span className="pill">No auto-approvals</span>
          </div>
        </header>

        <section className="panel">
          <div className="panel__header">
            <div>
              <p className="step">Step 1</p>
              <h2>Capture claim details</h2>
            </div>
            {claimData && <span className="status status--ready">Saved</span>}
          </div>
          <ClaimForm onSubmit={handleClaimSubmit} />
          {claimData && (
            <div className="summary">
              <div>
                <span className="summary__label">Claim ID</span>
                <span className="summary__value">{claimData.claimId}</span>
              </div>
              <div>
                <span className="summary__label">Policyholder</span>
                <span className="summary__value">{claimData.policyholderName}</span>
              </div>
              <div>
                <span className="summary__label">Vehicle</span>
                <span className="summary__value">{vehicleSummary}</span>
              </div>
              {claimData.vin && (
                <div>
                  <span className="summary__label">VIN</span>
                  <span className="summary__value">{claimData.vin}</span>
                </div>
              )}
              <div>
                <span className="summary__label">Loss date</span>
                <span className="summary__value">{claimData.lossDate}</span>
              </div>
              <div>
                <span className="summary__label">Location</span>
                <span className="summary__value">{claimData.location}</span>
              </div>
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <p className="step">Step 2</p>
              <h2>Upload damage photo</h2>
            </div>
            {imageFile && <span className="status status--ready">Attached</span>}
          </div>
          <ImageUploader disabled={!claimData} onFileSelected={handleFileSelected} />
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <p className="step">Step 3</p>
              <h2>Review AI assessment</h2>
            </div>
            {assessment && <span className="status status--ready">Drafted</span>}
          </div>
          <div className="assessment__controls">
            <button
              type="button"
              onClick={handleRunAssessment}
              disabled={!imageFile || isAssessing}
              className="button button--primary"
            >
              {isAssessing ? 'Assessing image...' : 'Generate assessment'}
            </button>
            <p className="muted">
              Agents can adjust severity, add notes, or escalate before approval.
            </p>
          </div>
          <AIAssessmentPanel assessment={assessment} loading={isAssessing} />
        </section>
      </main>
    </div>
  )
}

export default App
