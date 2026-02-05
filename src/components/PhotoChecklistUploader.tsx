import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'

export type PhotoKey = 'damagePhoto' | 'vehiclePhoto'

export interface ChecklistPhotos {
  damagePhoto: File | null
  vehiclePhoto: File | null
}

interface PhotoChecklistUploaderProps {
  photos: ChecklistPhotos
  onPhotoChange: (key: PhotoKey, file: File | null) => void
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
]

const initialPreviews: Record<PhotoKey, string | null> = {
  damagePhoto: null,
  vehiclePhoto: null,
}

export default function PhotoChecklistUploader({
  photos,
  onPhotoChange,
}: PhotoChecklistUploaderProps) {
  const [previewUrls, setPreviewUrls] = useState(initialPreviews)
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
  }

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
                    slot.required
                      ? 'checklist__flag--required'
                      : 'checklist__flag--optional'
                  }`}
                >
                  {slot.required ? 'Required' : 'Optional'}
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
            </div>
          )
        })}
      </div>
    </div>
  )
}
