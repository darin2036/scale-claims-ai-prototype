import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { PlateExtraction, VinExtraction } from '../lib/mockAI'
import { extractPlateStateFromImage, extractVinFromImage } from '../server/fakeApi'

export type PhotoKey = 'damagePhoto' | 'vehiclePhoto' | 'platePhoto' | 'vinPhoto'

export interface ChecklistPhotos {
  damagePhoto: File | null
  vehiclePhoto: File | null
  platePhoto: File | null
  vinPhoto: File | null
}

interface PhotoChecklistUploaderProps {
  photos: ChecklistPhotos
  plateExtraction: PlateExtraction | null
  vinExtraction: VinExtraction | null
  onPhotoChange: (key: PhotoKey, file: File | null) => void
  onPlateExtraction: (result: PlateExtraction | null) => void
  onVinExtraction: (result: VinExtraction | null) => void
}

const SLOT_CONFIG: Array<{
  key: PhotoKey
  title: string
  hint: string
  required: boolean
  helper?: string
}> = [
  {
    key: 'damagePhoto',
    title: 'Damage photo',
    hint: 'Close-up of the primary damage area.',
    required: true,
  },
  {
    key: 'vehiclePhoto',
    title: 'Full vehicle photo',
    hint: 'Wide shot showing the entire vehicle.',
    required: true,
  },
  {
    key: 'platePhoto',
    title: 'License plate photo',
    hint: 'Optional. Used for plate + state lookup.',
    required: false,
  },
  {
    key: 'vinPhoto',
    title: 'VIN photo',
    hint: 'Required if no plate photo is provided.',
    required: false,
    helper: 'Use the VIN label on the driver-side door or dashboard.',
  },
]

const initialPreviews: Record<PhotoKey, string | null> = {
  damagePhoto: null,
  vehiclePhoto: null,
  platePhoto: null,
  vinPhoto: null,
}

export default function PhotoChecklistUploader({
  photos,
  plateExtraction,
  vinExtraction,
  onPhotoChange,
  onPlateExtraction,
  onVinExtraction,
}: PhotoChecklistUploaderProps) {
  const [previewUrls, setPreviewUrls] = useState(initialPreviews)
  const [plateStatus, setPlateStatus] = useState<'idle' | 'loading'>('idle')
  const [vinStatus, setVinStatus] = useState<'idle' | 'loading'>('idle')
  const plateRequestId = useRef(0)
  const vinRequestId = useRef(0)
  const previewRef = useRef(previewUrls)

  useEffect(() => {
    previewRef.current = previewUrls
  }, [previewUrls])

  useEffect(() => {
    return () => {
      Object.values(previewRef.current).forEach((url) => {
        if (url) {
          URL.revokeObjectURL(url)
        }
      })
    }
  }, [])

  const handleFileChange = (key: PhotoKey) => async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    onPhotoChange(key, file)

    if (previewUrls[key]) {
      URL.revokeObjectURL(previewUrls[key])
    }

    setPreviewUrls((prev) => ({
      ...prev,
      [key]: file ? URL.createObjectURL(file) : null,
    }))

    if (key === 'platePhoto') {
      if (!file) {
        plateRequestId.current += 1
        setPlateStatus('idle')
        onPlateExtraction(null)
        return
      }
      plateRequestId.current += 1
      const requestId = plateRequestId.current
      setPlateStatus('loading')
      const result = await extractPlateStateFromImage(file)
      if (requestId !== plateRequestId.current) {
        return
      }
      setPlateStatus('idle')
      onPlateExtraction(result)
    }

    if (key === 'vinPhoto') {
      if (!file) {
        vinRequestId.current += 1
        setVinStatus('idle')
        onVinExtraction(null)
        return
      }
      vinRequestId.current += 1
      const requestId = vinRequestId.current
      setVinStatus('loading')
      const result = await extractVinFromImage(file)
      if (requestId !== vinRequestId.current) {
        return
      }
      setVinStatus('idle')
      onVinExtraction(result)
    }
  }

  const requiresVin = !photos.platePhoto
  const missingVin = requiresVin && !photos.vinPhoto

  return (
    <div className="checklist">
      <div className="checklist__grid">
        {SLOT_CONFIG.map((slot) => {
          const file = photos[slot.key]
          const previewUrl = previewUrls[slot.key]

          return (
            <div key={slot.key} className="checklist__item">
              <div className="checklist__header">
                <div>
                  <div className="checklist__title">{slot.title}</div>
                  <div className="checklist__hint">{slot.hint}</div>
                </div>
                <span
                  className={`checklist__flag ${
                    slot.required || (slot.key === 'vinPhoto' && requiresVin)
                      ? 'checklist__flag--required'
                      : 'checklist__flag--optional'
                  }`}
                >
                  {slot.required || (slot.key === 'vinPhoto' && requiresVin) ? 'Required' : 'Optional'}
                </span>
              </div>

              {slot.helper && <p className="muted">{slot.helper}</p>}

              <label className="upload__dropzone">
                <input
                  className="upload__input"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange(slot.key)}
                />
                <div className="upload__content">
                  <span className="upload__title">{file ? 'Replace photo' : 'Upload photo'}</span>
                  <span className="upload__hint">JPG or PNG</span>
                </div>
                <span className="upload__cta">Choose file</span>
              </label>

              {previewUrl && (
                <div className="preview-card">
                  <img className="preview-card__image" src={previewUrl} alt={`${slot.title} preview`} />
                  <div className="preview-card__meta">
                    <span className="preview-card__title">{file?.name ?? 'Uploaded photo'}</span>
                    {file && (
                      <span className="preview-card__details">
                        {(file.size / 1024).toFixed(0)} KB - {file.type || 'image'}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {slot.key === 'platePhoto' && file && (
                <div className="extraction-card">
                  <span className="extraction-card__title">Plate extraction</span>
                  {plateStatus === 'loading' && <p className="muted">Extracting plate + state...</p>}
                  {plateStatus === 'idle' && plateExtraction && (
                    <>
                      {(() => {
                        const normalized =
                          plateExtraction.confidence <= 1
                            ? plateExtraction.confidence * 100
                            : plateExtraction.confidence
                        return (
                          <>
                            <div className="summary summary--compact">
                              <div>
                                <span className="summary__label">Plate</span>
                                <span className="summary__value">{plateExtraction.plate}</span>
                              </div>
                              <div>
                                <span className="summary__label">State</span>
                                <span className="summary__value">
                                  {plateExtraction.state ?? 'Not detected'}
                                </span>
                              </div>
                            </div>
                            <div className="confidence">
                              <div className="confidence__bar">
                                <span style={{ width: `${normalized}%` }} />
                              </div>
                              <span className="confidence__value">{Math.round(normalized)}%</span>
                            </div>
                            <p className="extraction-card__notes">{plateExtraction.notes}</p>
                          </>
                        )
                      })()}
                    </>
                  )}
                </div>
              )}

              {slot.key === 'vinPhoto' && file && (
                <div className="extraction-card">
                  <span className="extraction-card__title">VIN extraction</span>
                  {vinStatus === 'loading' && <p className="muted">Extracting VIN...</p>}
                  {vinStatus === 'idle' && vinExtraction && (
                    <>
                      {(() => {
                        const normalized =
                          vinExtraction.confidence <= 1
                            ? vinExtraction.confidence * 100
                            : vinExtraction.confidence
                        return (
                          <>
                            <div className="summary summary--compact">
                              <div>
                                <span className="summary__label">VIN</span>
                                <span className="summary__value">{vinExtraction.vin}</span>
                              </div>
                            </div>
                            <div className="confidence">
                              <div className="confidence__bar">
                                <span style={{ width: `${normalized}%` }} />
                              </div>
                              <span className="confidence__value">{Math.round(normalized)}%</span>
                            </div>
                            <p className="extraction-card__notes">{vinExtraction.notes}</p>
                          </>
                        )
                      })()}
                    </>
                  )}
                </div>
              )}

              {slot.key === 'vinPhoto' && missingVin && (
                <p className="text-error">VIN photo required when no plate photo is provided.</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
