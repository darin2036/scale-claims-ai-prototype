import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'

type PhotoValue = File | File[] | null

interface PhotoSlotUploaderProps {
  title: string
  hint: string
  helper?: string
  required?: boolean
  value: PhotoValue
  onChange: (value: PhotoValue) => void
  multiple?: boolean
  maxFiles?: number
  accept?: string
  mobileTakeLabel?: string
  mobileChooseLabel?: string
}

const DEFAULT_ACCEPT = 'image/*,.heic,.heif'

const toPreviewUrls = (value: PhotoValue) => {
  if (!value) {
    return [] as string[]
  }
  const files = Array.isArray(value) ? value : [value]
  return files.map((file) => URL.createObjectURL(file))
}

export default function PhotoSlotUploader({
  title,
  hint,
  helper,
  required = false,
  value,
  onChange,
  multiple = false,
  maxFiles,
  accept = DEFAULT_ACCEPT,
  mobileTakeLabel = 'Take photo',
  mobileChooseLabel = 'Choose from photos',
}: PhotoSlotUploaderProps) {
  const [isMobile, setIsMobile] = useState(false)
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const previewRef = useRef<string[]>([])

  useEffect(() => {
    previewRef.current = previewUrls
  }, [previewUrls])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    const isMobileDevice = Boolean(
      navigator?.userAgent && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent),
    )
    setIsMobile(isMobileDevice)
  }, [])

  useEffect(() => {
    previewRef.current.forEach((url) => {
      if (url) {
        URL.revokeObjectURL(url)
      }
    })
    setPreviewUrls(toPreviewUrls(value))
  }, [value])

  useEffect(() => {
    return () => {
      previewRef.current.forEach((url) => {
        if (url) {
          URL.revokeObjectURL(url)
        }
      })
    }
  }, [])

  const valueFiles = useMemo(() => {
    if (!value) {
      return [] as File[]
    }
    return Array.isArray(value) ? value : [value]
  }, [value])

  const handleFileChange = (capture?: boolean) => (event: ChangeEvent<HTMLInputElement>) => {
    if (multiple) {
      const raw = Array.from(event.target.files ?? [])
      const files = typeof maxFiles === 'number' ? raw.slice(0, maxFiles) : raw
      onChange(files)
      return
    }
    const file = event.target.files?.[0] ?? null
    onChange(file)
    if (capture && file === null) {
      onChange(null)
    }
  }

  const hasFiles = valueFiles.length > 0
  const fileSummary = multiple
    ? hasFiles
      ? `${valueFiles.length} photo${valueFiles.length === 1 ? '' : 's'}`
      : ''
    : valueFiles[0]?.name ?? ''

  return (
    <div className="checklist__item">
      <div className="checklist__header">
        <div>
          <div className="checklist__title">{title}</div>
          <div className="checklist__hint">{hint}</div>
        </div>
        <span
          className={`checklist__flag ${required ? 'checklist__flag--required' : 'checklist__flag--optional'}`}
        >
          {required ? 'Required' : 'Optional'}
        </span>
      </div>

      {helper && <p className="muted">{helper}</p>}

      {isMobile ? (
        <div className="form-grid form-grid--three">
          <label className="button button--primary">
            <input
              className="upload__input"
              type="file"
              accept={accept}
              multiple={multiple}
              capture="environment"
              onChange={handleFileChange(true)}
            />
            {mobileTakeLabel}
          </label>
          <label className="button button--ghost">
            <input
              className="upload__input"
              type="file"
              accept={accept}
              multiple={multiple}
              onChange={handleFileChange(false)}
            />
            {mobileChooseLabel}
          </label>
        </div>
      ) : (
        <label className="upload__dropzone">
          <input
            className="upload__input"
            type="file"
            accept={accept}
            multiple={multiple}
            onChange={handleFileChange(false)}
          />
          <div className="upload__content">
            <span className="upload__title">
              {hasFiles ? (multiple ? 'Replace photos' : 'Replace photo') : multiple ? 'Upload photos' : 'Upload photo'}
            </span>
            <span className="upload__hint">
              {multiple ? 'JPG or PNG' : 'JPG or PNG'}
              {fileSummary ? ` • ${fileSummary}` : ''}
            </span>
          </div>
          <span className="upload__cta">Choose file</span>
        </label>
      )}

      {previewUrls.length > 0 &&
        valueFiles.map((file, index) => {
          const url = previewUrls[index]
          if (!url) {
            return null
          }
          return (
            <div key={`${file.name}-${index}`} className="preview-card">
              <img className="preview-card__image" src={url} alt={`${title} preview`} />
              <div className="preview-card__meta">
                <span className="preview-card__title">{file.name || 'Uploaded photo'}</span>
                <span className="preview-card__details">
                  {(file.size / 1024).toFixed(0)} KB - {file.type || 'image'}
                </span>
              </div>
            </div>
          )
        })}
    </div>
  )
}

