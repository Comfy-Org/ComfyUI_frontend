import { sumBy } from 'es-toolkit'

import type { CloudMissingModel } from '@/platform/openOnCloud/cloudWorkflowCheck'

/** Models going up to Comfy Cloud, one after another. */
export type ModelUploadState =
  | { phase: 'idle' }
  | { phase: 'uploading'; models: CloudMissingModel[]; uploadedBytes: number }

/** How far one model of an upload has got. */
export interface ModelUploadFile {
  model: CloudMissingModel
  uploadedBytes: number
}

export function totalBytes(models: readonly CloudMissingModel[]): number {
  return sumBy(models, (model) => model.bytes)
}

/** Splits the bytes sent so far across the models, in upload order. */
export function uploadFiles(
  models: readonly CloudMissingModel[],
  uploadedBytes: number
): ModelUploadFile[] {
  return models.map((model, index) => {
    const before = totalBytes(models.slice(0, index))
    return {
      model,
      uploadedBytes: Math.min(model.bytes, Math.max(0, uploadedBytes - before))
    }
  })
}

export function uploadPercent(
  models: readonly CloudMissingModel[],
  uploadedBytes: number
): number {
  const total = totalBytes(models)
  return total === 0 ? 100 : Math.floor((uploadedBytes / total) * 100)
}

const BYTE_UNITS = [
  { unit: 'gigabyte', bytes: 1e9 },
  { unit: 'megabyte', bytes: 1e6 },
  { unit: 'kilobyte', bytes: 1e3 }
] as const

function unitFor(bytes: number) {
  return BYTE_UNITS.find((unit) => bytes >= unit.bytes) ?? BYTE_UNITS[2]
}

/** Formats bytes in the unit that suits `scaleBytes`, with or without it. */
export function formatBytes(
  locale: string,
  bytes: number,
  { scaleBytes = bytes, withUnit = true } = {}
): string {
  const { unit, bytes: unitBytes } = unitFor(scaleBytes)
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    ...(withUnit && { style: 'unit', unit })
  }).format(bytes / unitBytes)
}
