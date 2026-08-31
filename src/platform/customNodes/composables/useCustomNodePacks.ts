import { readonly, ref } from 'vue'

import { api } from '@/scripts/api'
import { app } from '@/scripts/app'

/** A user-uploaded custom node pack, as owned by the current workspace. */
export interface UploadedNodePack {
  revisionId: string
  name: string
  uploadedAt: string
}

export interface CustomNodeUploadRecordDto {
  revision_id: string
  name: string
  owner: string
  snapshot: string
  uploaded_at: string
}

const packs = ref<UploadedNodePack[]>([])
const isLoading = ref(false)
const isUploading = ref(false)
const isDeleting = ref(false)
const downloadingRevisionId = ref<string | null>(null)

const toPack = (dto: CustomNodeUploadRecordDto): UploadedNodePack => ({
  revisionId: dto.revision_id,
  name: dto.name,
  uploadedAt: dto.uploaded_at
})

const packNameFromFile = (filename: string): string =>
  filename.replace(/\.zip$/i, '').trim() || filename

const packDownloadFilename = (name: string): string => {
  const safeName = name
    .replace(/\.zip$/i, '')
    .replace(/[^A-Za-z0-9._ -]+/g, '-')
    .trim()
  return `${safeName || 'custom-node'}.zip`
}

const newIdempotencyKey = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

const readError = async (response: Response): Promise<string> => {
  const data = (await response.json().catch(() => null)) as {
    error?: unknown
  } | null
  return typeof data?.error === 'string'
    ? data.error
    : `Request failed (${response.status})`
}

/**
 * Uploading and listing a workspace's private custom node packs. The owning
 * workspace is derived server-side from the session, so no owner is sent from
 * here. Re-uploading a pack of the same name replaces it (a bug-fix release).
 */
export function useCustomNodePacks() {
  const refresh = async (): Promise<void> => {
    isLoading.value = true
    try {
      const response = await api.fetchApi('/customnodes', { method: 'GET' })
      if (!response.ok) {
        throw new Error(`Failed to list custom node packs (${response.status})`)
      }
      const records = (await response.json()) as CustomNodeUploadRecordDto[]
      packs.value = records.map(toPack)
    } finally {
      isLoading.value = false
    }
  }

  const uploadPack = async (file: File, name?: string): Promise<void> => {
    isUploading.value = true
    try {
      const form = new FormData()
      form.append('name', name?.trim() || packNameFromFile(file.name))
      form.append('idempotency_key', newIdempotencyKey())
      form.append('file', file)

      const response = await api.fetchApi('/customnodes', {
        method: 'POST',
        body: form
      })
      if (!response.ok) {
        throw new Error(await readError(response))
      }
      await refresh()
      await app.reloadNodeDefs()
    } finally {
      isUploading.value = false
    }
  }

  const deletePack = async (name: string): Promise<void> => {
    isDeleting.value = true
    try {
      const response = await api.fetchApi(
        `/customnodes?name=${encodeURIComponent(name)}`,
        { method: 'DELETE' }
      )
      if (!response.ok) {
        throw new Error(await readError(response))
      }
      await refresh()
      await app.reloadNodeDefs()
    } finally {
      isDeleting.value = false
    }
  }

  const downloadPack = async (pack: UploadedNodePack): Promise<void> => {
    downloadingRevisionId.value = pack.revisionId
    let objectUrl: string | undefined
    try {
      const response = await api.fetchApi(
        `/customnodes/${encodeURIComponent(pack.revisionId)}/download`,
        { method: 'GET' }
      )
      if (!response.ok) {
        throw new Error(await readError(response))
      }

      objectUrl = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = packDownloadFilename(pack.name)
      document.body.append(link)
      link.click()
      link.remove()
    } finally {
      const completedObjectUrl = objectUrl
      if (completedObjectUrl) {
        window.setTimeout(() => URL.revokeObjectURL(completedObjectUrl), 0)
      }
      downloadingRevisionId.value = null
    }
  }

  return {
    packs: readonly(packs),
    isLoading: readonly(isLoading),
    isUploading: readonly(isUploading),
    isDeleting: readonly(isDeleting),
    downloadingRevisionId: readonly(downloadingRevisionId),
    refresh,
    uploadPack,
    deletePack,
    downloadPack
  }
}
