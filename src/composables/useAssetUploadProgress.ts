/**
 * Uploads files to the upload progress server and exposes reactive progress
 * state keyed by a caller-provided asset identifier.
 *
 * Uses XMLHttpRequest for client-side `upload.onprogress` tracking, which
 * gives incremental byte-level feedback without polling.
 */
import { computed, reactive } from 'vue'

/** Progress state for a single in-flight upload. */
export interface UploadProgress {
  /** Bytes sent so far. */
  loaded: number
  /** Total file size in bytes. */
  total: number
  /** Integer percentage 0–100. */
  percent: number
  /** Whether the upload has completed (successfully or not). */
  complete: boolean
  /** Error message if the upload failed. */
  error?: string
}

/** Default base URL of the upload progress server. */
const DEFAULT_UPLOAD_URL = 'http://localhost:3001/upload'

/**
 * Provides methods to upload files with progress tracking, keyed by a
 * caller-chosen string identifier (e.g. `'thumbnail'`, `'gallery-2'`).
 *
 * @param uploadUrl - Base URL of the upload endpoint.
 */
export function useAssetUploadProgress(uploadUrl: string = DEFAULT_UPLOAD_URL) {
  const uploads = reactive<Record<string, UploadProgress>>({})

  /** Reactive map of all in-flight or recently completed uploads. */
  const progressMap = computed(() => uploads)

  /**
   * Uploads a file and tracks progress under the given key.
   * Any existing entry for the key is replaced.
   *
   * @param key - Identifier for this upload slot (e.g. `'thumbnail'`).
   * @param file - The File to upload.
   * @returns A promise that resolves with the server response JSON, or
   *          rejects on network/server error.
   */
  function upload(key: string, file: File): Promise<Record<string, unknown>> {
    uploads[key] = {
      loaded: 0,
      total: file.size,
      percent: 0,
      complete: false
    }

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      const formData = new FormData()
      formData.append('file', file)

      xhr.upload.addEventListener('progress', (e) => {
        if (!e.lengthComputable) return
        const entry = uploads[key]
        if (!entry) return
        entry.loaded = e.loaded
        entry.total = e.total
        entry.percent = Math.round((e.loaded / e.total) * 100)
      })

      xhr.addEventListener('load', () => {
        const entry = uploads[key]
        if (!entry) return
        entry.percent = 100
        entry.complete = true

        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText))
        } else {
          entry.error = `Server responded with ${xhr.status}`
          reject(new Error(entry.error))
        }
      })

      xhr.addEventListener('error', () => {
        const entry = uploads[key]
        if (!entry) return
        entry.error = 'Network error'
        entry.complete = true
        reject(new Error(entry.error))
      })

      xhr.addEventListener('abort', () => {
        const entry = uploads[key]
        if (!entry) return
        entry.error = 'Upload aborted'
        entry.complete = true
        reject(new Error(entry.error))
      })

      xhr.open('POST', uploadUrl)
      xhr.send(formData)
    })
  }

  /**
   * Returns the reactive progress entry for the given key, or `undefined`
   * if no upload is in progress for that key.
   */
  function getProgress(key: string): UploadProgress | undefined {
    return uploads[key]
  }

  /**
   * Removes the progress entry for the given key. Call this after the
   * upload completes and the progress bar has been dismissed.
   */
  function clearProgress(key: string): void {
    delete uploads[key]
  }

  return {
    progressMap,
    upload,
    getProgress,
    clearProgress
  }
}
