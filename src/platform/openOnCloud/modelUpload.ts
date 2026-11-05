import { sumBy } from 'es-toolkit'

import type { CloudMissingModel } from '@/platform/openOnCloud/cloudWorkflowCheck'

export type ModelUploadState =
  | { phase: 'idle' }
  | { phase: 'uploading'; models: CloudMissingModel[]; uploadedBytes: number }

export interface ModelUploadFile {
  model: CloudMissingModel
  uploadedBytes: number
}

export function totalBytes(models: readonly CloudMissingModel[]): number {
  return sumBy(models, (model) => model.bytes ?? 0)
}

export function uploadFiles(
  models: readonly CloudMissingModel[],
  uploadedBytes: number
): ModelUploadFile[] {
  return models.map((model, index) => {
    const before = totalBytes(models.slice(0, index))
    return {
      model,
      uploadedBytes: Math.min(
        model.bytes ?? 0,
        Math.max(0, uploadedBytes - before)
      )
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
