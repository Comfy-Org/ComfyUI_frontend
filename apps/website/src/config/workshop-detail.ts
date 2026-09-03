import snapshot from './workshop-catalog.generated.json'

type FieldOption = string | number

export type WorkshopField =
  | {
      readonly kind: 'text'
      readonly name: string
      readonly label: string
      readonly hint?: string
      readonly required: boolean
      readonly multiline: boolean
      readonly valueType: 'string' | 'json'
      readonly defaultValue?: string
    }
  | {
      readonly kind: 'select'
      readonly name: string
      readonly label: string
      readonly hint?: string
      readonly required: boolean
      readonly options: readonly FieldOption[]
      readonly defaultValue?: FieldOption
    }
  | {
      readonly kind: 'number'
      readonly name: string
      readonly label: string
      readonly hint?: string
      readonly required: boolean
      readonly integer: boolean
      readonly min?: number
      readonly max?: number
      readonly step: number
      readonly defaultValue?: number
    }
  | {
      readonly kind: 'toggle'
      readonly name: string
      readonly label: string
      readonly hint?: string
      readonly required: boolean
      readonly defaultValue: boolean
    }
  | {
      readonly kind: 'media'
      readonly name: string
      readonly role: string
      readonly label: string
      readonly required: boolean
      readonly multiple: boolean
      readonly accept: 'image' | 'video' | 'audio' | 'file'
    }

export interface WorkshopDetailModel {
  readonly id: string
  readonly slug: string
  readonly displayName: string
  readonly provider: string
  readonly modality: string
  readonly description: string
  readonly tags: readonly string[]
  readonly fields: readonly WorkshopField[]
}

export type WorkshopFormValue =
  | string
  | number
  | boolean
  | readonly string[]
  | undefined
export type WorkshopFormValues = Readonly<Record<string, WorkshopFormValue>>

interface CatalogSnapshot {
  readonly models: readonly WorkshopDetailModel[]
}

const models = (snapshot as CatalogSnapshot).models

export const workshopDetailModels: readonly WorkshopDetailModel[] = models

export function defaultWorkshopValues(
  fields: readonly WorkshopField[]
): WorkshopFormValues {
  return Object.fromEntries(
    fields.map((field) => [
      field.name,
      'defaultValue' in field ? field.defaultValue : undefined
    ])
  )
}

export function relatedWorkshopModels(
  model: WorkshopDetailModel,
  limit = 4
): WorkshopDetailModel[] {
  return models
    .filter((candidate) => candidate.slug !== model.slug)
    .sort((left, right) => {
      const leftScore =
        Number(left.provider === model.provider) * 2 +
        Number(left.modality === model.modality)
      const rightScore =
        Number(right.provider === model.provider) * 2 +
        Number(right.modality === model.modality)
      return (
        rightScore - leftScore ||
        left.displayName.localeCompare(right.displayName)
      )
    })
    .slice(0, limit)
}
