import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'

export type PhotoKey = 'damagePhoto' | 'vehiclePhoto' | 'otherInsurancePhoto'

export interface ChecklistPhotos {
  damagePhoto: File[]
  vehiclePhoto: File | null
  otherInsurancePhoto: File | null
}

type PhotoValue = File | File[] | null

interface PhotoChecklistUploaderProps {
  photos: ChecklistPhotos
  onPhotoChange: (key: PhotoKey, file: PhotoValue) => void
  includeOtherInsurance?: boolean
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
    hint: 'Add up to 6 photos. The more you share, the better the estimate.',
    required: true,
    helper: 'Try a few angles and distances to capture the full damage.',
  },
  {
    key: 'vehiclePhoto',
    title: 'Full vehicle photo',
    hint: 'Wide shot showing the entire vehicle.',
    required: true,
  },
  {
    key: 'otherInsurancePhoto',
    title: "Other driver's insurance card",
    hint: 'Optional. Capture if another person is involved.',
    required: false,
    helper: 'Only take this if it is safe and appropriate.',
  },
]

const initialPreviews = {
  damagePhoto: [] as string[],
  vehiclePhoto: null as string | null,
  otherInsurancePhoto: null as string | null,
}

type PreviewUrls = typeof initialPreviews

export default function PhotoChecklistUploader({
  photos,
  onPhotoChange,
  includeOtherInsurance = true,
}: PhotoChecklistUploaderProps) {
  const [previewUrls, setPreviewUrls] = useState<PreviewUrls>(initialPreviews)
  const previewRef = useRef(previewUrls)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    previewRef.current = previewUrls
  }, [previewUrls])

  useEffect(() => {
    return () => {
      Object.values(previewRef.current).forEach((urlOrUrls) => {
        if (Array.isArray(urlOrUrls)) {
          urlOrUrls.forEach((url) => {
            if (url) {
              URL.revokeObjectURL(url)
            }
          })
        } else if (urlOrUrls) {
          URL.revokeObjectURL(urlOrUrls)
        }
      })
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    const isMobileDevice = Boolean(
      navigator?.userAgent && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent),
    )
    setIsMobile(isMobileDevice)
  }, [])

  const handleFileChange = (key: PhotoKey) => async (event: ChangeEvent<HTMLInputElement>) => {
    if (key === 'damagePhoto') {
      const files = Array.from(event.target.files ?? []).slice(0, 6)
      onPhotoChange(key, files)

      previewUrls.damagePhoto.forEach((url) => {
        if (url) {
          URL.revokeObjectURL(url)
        }
      })

      setPreviewUrls((prev) => ({
        ...prev,
        damagePhoto: files.map((file) => URL.createObjectURL(file)),
      }))
      return
    }

    const file = event.target.files?.[0] ?? null
    onPhotoChange(key, file)

    if (previewUrls[key]) {
      URL.revokeObjectURL(previewUrls[key] as string)
    }

    setPreviewUrls((prev) => ({
      ...prev,
      [key]: file ? URL.createObjectURL(file) : null,
    }))
  }

  return (
    <div className="checklist">
      <div className="checklist__grid">
        {SLOT_CONFIG.filter((slot) =>
          slot.key === 'otherInsurancePhoto' ? includeOtherInsurance : true,
        ).map((slot) => {
          const isDamageSlot = slot.key === 'damagePhoto'
          const files = isDamageSlot ? photos.damagePhoto : null
          const singleFile = !isDamageSlot ? (photos[slot.key] as File | null) : null
          const previewUrl = isDamageSlot ? null : (previewUrls[slot.key] as string | null)
          const hasDamageFiles = files ? files.length > 0 : false

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

              {isMobile ? (
                <div className="form-grid form-grid--three">
                  <label className="button button--primary">
                    <input
                      className="upload__input"
                      type="file"
                      accept="image/*,.heic,.heif"
                      capture="environment"
                      onChange={handleFileChange(slot.key)}
                    />
                    Take photo
                  </label>
                  <label className="button button--ghost">
                    <input
                      className="upload__input"
                      type="file"
                      accept="image/*,.heic,.heif"
                      multiple={isDamageSlot}
                      onChange={handleFileChange(slot.key)}
                    />
                    Choose from photos
                  </label>
                </div>
              ) : (
                <label className="upload__dropzone">
                  <input
                    className="upload__input"
                    type="file"
                    accept="image/*,.heic,.heif"
                    multiple={isDamageSlot}
                    onChange={handleFileChange(slot.key)}
                  />
                  <div className="upload__content">
                    <span className="upload__title">
                      {isDamageSlot
                        ? hasDamageFiles
                          ? 'Replace photos'
                          : 'Upload photos'
                        : singleFile
                          ? 'Replace photo'
                          : 'Upload photo'}
                    </span>
                    <span className="upload__hint">JPG or PNG</span>
                  </div>
                  <span className="upload__cta">Choose file</span>
                </label>
              )}

              {isDamageSlot &&
                previewUrls.damagePhoto.length > 0 &&
                files?.map((damageFile, index) => {
                  const url = previewUrls.damagePhoto[index]
                  if (!url) {
                    return null
                  }
                  return (
                    <div key={`${damageFile.name}-${index}`} className="preview-card">
                      <img
                        className="preview-card__image"
                        src={url}
                        alt={`${slot.title} ${index + 1} preview`}
                      />
                      <div className="preview-card__meta">
                        <span className="preview-card__title">{damageFile.name}</span>
                        <span className="preview-card__details">
                          {(damageFile.size / 1024).toFixed(0)} KB - {damageFile.type || 'image'}
                        </span>
                      </div>
                    </div>
                  )
                })}

              {!isDamageSlot && previewUrl && (
                <div className="preview-card">
                  <img className="preview-card__image" src={previewUrl} alt={`${slot.title} preview`} />
                  <div className="preview-card__meta">
                    <span className="preview-card__title">{singleFile?.name ?? 'Uploaded photo'}</span>
                    {singleFile && (
                      <span className="preview-card__details">
                        {(singleFile.size / 1024).toFixed(0)} KB - {singleFile.type || 'image'}
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
