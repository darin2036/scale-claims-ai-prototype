import PhotoSlotUploader from './PhotoSlotUploader'

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
  visibleKeys?: PhotoKey[]
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

export default function PhotoChecklistUploader({
  photos,
  onPhotoChange,
  includeOtherInsurance = true,
  visibleKeys,
}: PhotoChecklistUploaderProps) {
  return (
    <div className="checklist">
      <div className="checklist__grid">
        {SLOT_CONFIG.filter((slot) => {
          if (slot.key === 'otherInsurancePhoto' && !includeOtherInsurance) {
            return false
          }
          if (visibleKeys && !visibleKeys.includes(slot.key)) {
            return false
          }
          return true
        }).map((slot) => {
          const isDamageSlot = slot.key === 'damagePhoto'
          const value = isDamageSlot ? photos.damagePhoto : (photos[slot.key] as File | null)

          return (
            <PhotoSlotUploader
              key={slot.key}
              title={slot.title}
              hint={slot.hint}
              helper={slot.helper}
              required={slot.required}
              value={value}
              multiple={isDamageSlot}
              maxFiles={isDamageSlot ? 6 : undefined}
              onChange={(nextValue) => onPhotoChange(slot.key, nextValue)}
            />
          )
        })}
      </div>
    </div>
  )
}
