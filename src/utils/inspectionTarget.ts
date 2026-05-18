import { isThreeDLoadableExtension } from '@comfyorg/shared-frontend-utils/mediaExtensions'

import type { ResultItemImpl, TaskItemImpl } from '@/stores/queueStore'
import { getMediaTypeFromFilename } from '@/utils/formatUtil'

type InspectionKind = 'lightbox' | 'load3d'

export type InspectionTarget =
  | { kind: 'lightbox'; output: ResultItemImpl }
  | { kind: 'load3d'; output: ResultItemImpl }

export function getInspectionTarget(
  output: ResultItemImpl
): InspectionTarget | null {
  if (output.is3D) {
    return getInspectionKindForFilename(output.filename) === 'load3d'
      ? { kind: 'load3d', output }
      : null
  }

  if (output.isImage || output.isVideo || output.isAudio) {
    return { kind: 'lightbox', output }
  }

  return null
}

export function getInspectionTargets(
  outputs: readonly ResultItemImpl[]
): InspectionTarget[] {
  return outputs.flatMap((output) => {
    const target = getInspectionTarget(output)
    return target ? [target] : []
  })
}

export function getPreferredInspectionTarget(
  targets: readonly InspectionTarget[]
): InspectionTarget | undefined {
  return (
    targets.findLast((target) => target.output.type === 'output') ??
    targets.at(-1)
  )
}

export function getLightboxOutputs(
  targets: readonly InspectionTarget[]
): ResultItemImpl[] {
  return targets.flatMap((target) =>
    target.kind === 'lightbox' ? [target.output] : []
  )
}

export function canAttemptTaskInspection(task: TaskItemImpl): boolean {
  return (
    getInspectionTargets(task.flatOutputs).length > 0 ||
    (task.outputsCount ?? 0) > 1
  )
}

export function getInspectionKindForFilename(
  filename: string | null | undefined
): InspectionKind | null {
  const mediaType = getMediaTypeFromFilename(filename)
  switch (mediaType) {
    case 'image':
    case 'video':
    case 'audio':
      return 'lightbox'
    case '3D':
      return isThreeDLoadableExtension(getFileExtension(filename))
        ? 'load3d'
        : null
    default:
      return null
  }
}

function getFileExtension(filename: string | null | undefined): string | null {
  if (!filename) return null
  return filename.split('.').pop()?.toLowerCase() ?? null
}
