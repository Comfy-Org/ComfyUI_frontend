import type {
  ComfyTemplateInputDownloadProgress,
  ComfyTemplateInputReference
} from '@comfyorg/comfyui-desktop-bridge-types'
import { defineStore } from 'pinia'
import { computed, shallowReactive } from 'vue'

export interface TrackedTemplateInputDownload {
  downloadId: string
  filename: string
  progress: number | null
  status: 'pending' | 'downloading' | 'paused' | 'completed'
  templateInputs: readonly ComfyTemplateInputReference[]
}

function normalizeProgress(progress: number): number | null {
  return Number.isFinite(progress) && progress >= 0 && progress <= 1
    ? progress
    : null
}

export const useTemplateInputDownloadStore = defineStore(
  'templateInputDownload',
  () => {
    const downloadsById = shallowReactive(
      new Map<string, TrackedTemplateInputDownload>()
    )
    const previewRevisions = shallowReactive(new Map<string, number>())
    const completedIds = new Set<string>()

    const downloads = computed(() => [...downloadsById.values()])
    const blockingFilenames = computed(
      () => new Set(downloads.value.map(({ filename }) => filename))
    )

    function updateProgress(progress: ComfyTemplateInputDownloadProgress) {
      const { downloadId, filename, status, templateInputs } = progress
      if (status === 'error' || status === 'cancelled') {
        downloadsById.delete(downloadId)
        return
      }

      if (status === 'completed' && !completedIds.has(downloadId)) {
        completedIds.add(downloadId)
        previewRevisions.set(
          filename,
          (previewRevisions.get(filename) ?? 0) + 1
        )
      }

      downloadsById.set(downloadId, {
        downloadId,
        filename,
        progress: normalizeProgress(progress.progress),
        status,
        templateInputs
      })
    }

    function completeGraphSync(filenames: readonly string[]) {
      const completed = new Set(filenames)
      for (const [downloadId, download] of downloadsById) {
        if (
          download.status === 'completed' &&
          completed.has(download.filename)
        ) {
          downloadsById.delete(downloadId)
        }
      }
    }

    function previewRevision(filename: string): number {
      return previewRevisions.get(filename) ?? 0
    }

    function clear() {
      downloadsById.clear()
      previewRevisions.clear()
      completedIds.clear()
    }

    return {
      downloads,
      blockingFilenames,
      updateProgress,
      completeGraphSync,
      previewRevision,
      clear
    }
  }
)
