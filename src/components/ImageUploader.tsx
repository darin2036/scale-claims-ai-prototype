import { useEffect, useState } from 'react'
import type { ChangeEvent } from 'react'

interface ImageUploaderProps {
  disabled?: boolean
  onFileSelected: (file: File | null) => void
}

export default function ImageUploader({ disabled, onFileSelected }: ImageUploaderProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [fileMeta, setFileMeta] = useState<{ name: string; size: number } | null>(null)

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    onFileSelected(file)

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }

    setPreviewUrl(file ? URL.createObjectURL(file) : null)
    setFileMeta(file ? { name: file.name, size: file.size } : null)
  }

  return (
    <div className="upload">
      <label className={`upload__dropzone ${disabled ? 'upload__dropzone--disabled' : ''}`}>
        <input
          className="upload__input"
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={disabled}
        />
        <div className="upload__content">
          <span className="upload__title">Upload a damage photo</span>
          <span className="upload__hint">JPG or PNG, single image</span>
        </div>
        <span className="upload__cta">Choose file</span>
      </label>

      {disabled && <p className="muted">Complete claim details to enable image upload.</p>}

      {previewUrl && (
        <div className="preview-card">
          <img className="preview-card__image" src={previewUrl} alt="Uploaded damage" />
          <div className="preview-card__meta">
            <span className="preview-card__title">Uploaded damage photo</span>
            {fileMeta && (
              <span className="preview-card__details">
                {fileMeta.name} · {(fileMeta.size / 1024).toFixed(0)} KB
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
