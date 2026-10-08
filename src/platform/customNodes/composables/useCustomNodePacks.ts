import type { ListWorkspaceCustomNodesResponses } from '@comfyorg/ingest-types'
import { zListWorkspaceCustomNodesResponse } from '@comfyorg/ingest-types/zod'
import { computed, readonly, ref } from 'vue'

import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useNodeAccountScope } from './useNodeAccountScope'

/** A user-uploaded custom node pack, as owned by the current workspace. */
export interface UploadedNodePack {
  revisionId: string
  name: string
  uploadedAt: string
  runtimeRevisionId?: string
  nodeTypes?: Record<string, string>
}

export type CustomNodeUploadRecordDto =
  ListWorkspaceCustomNodesResponses[200][number]

export class CustomNodePackRequestError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = 'CustomNodePackRequestError'
  }
}

const packs = ref<UploadedNodePack[]>([])
const loadedScope = ref<string | null>(null)
let refreshGeneration = 0
const isLoading = ref(false)
const isUploading = ref(false)
const isDeleting = ref(false)
const downloadingRevisionId = ref<string | null>(null)

const toPack = (dto: CustomNodeUploadRecordDto): UploadedNodePack => ({
  revisionId: dto.revision_id,
  name: dto.name,
  uploadedAt: dto.uploaded_at,
  ...(dto.runtime_revision_id
    ? { runtimeRevisionId: dto.runtime_revision_id }
    : {}),
  ...(dto.node_types ? { nodeTypes: dto.node_types } : {})
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

const readError = async (
  response: Response
): Promise<CustomNodePackRequestError> => {
  const data = (await response.json().catch(() => null)) as {
    error?: unknown
  } | null
  const message =
    typeof data?.error === 'string'
      ? data.error
      : `Request failed (${response.status})`
  return new CustomNodePackRequestError(message, response.status)
}

/**
 * Uploading and listing a workspace's private custom node packs. The owning
 * workspace is derived server-side from the session, so no owner is sent from
 * here. Re-uploading a pack of the same name replaces it (a bug-fix release).
 */
export function useCustomNodePacks() {
  const { scope, capture, current } = useNodeAccountScope()

  const refresh = async (): Promise<void> => {
    const request = capture()
    if (request.scope === null) return
    const generation = ++refreshGeneration
    isLoading.value = true
    try {
      const response = await api.fetchApi('/customnodes', { method: 'GET' })
      if (!current(request) || generation !== refreshGeneration) return
      if (!response.ok) {
        throw await readError(response)
      }
      const records = zListWorkspaceCustomNodesResponse.parse(
        await response.json()
      )
      if (!current(request) || generation !== refreshGeneration) return
      packs.value = records.map(toPack)
      loadedScope.value = request.scope
    } finally {
      if (generation === refreshGeneration) isLoading.value = false
    }
  }

  const uploadPack = async (file: File, name?: string): Promise<void> => {
    const request = capture()
    if (request.scope === null)
      throw new CustomNodePackRequestError(
        'Authenticated account required',
        401
      )
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
      if (!current(request)) return
      if (!response.ok) {
        throw await readError(response)
      }
      await refresh()
      if (current(request)) await app.reloadNodeDefs()
    } finally {
      isUploading.value = false
    }
  }

  const deletePack = async (name: string): Promise<void> => {
    const request = capture()
    if (request.scope === null)
      throw new CustomNodePackRequestError(
        'Authenticated account required',
        401
      )
    isDeleting.value = true
    try {
      const response = await api.fetchApi(
        `/customnodes?name=${encodeURIComponent(name)}`,
        { method: 'DELETE' }
      )
      if (!current(request)) return
      if (!response.ok) {
        throw await readError(response)
      }
      await refresh()
      if (current(request)) await app.reloadNodeDefs()
    } finally {
      isDeleting.value = false
    }
  }

  const downloadPack = async (pack: UploadedNodePack): Promise<void> => {
    const request = capture()
    if (request.scope === null)
      throw new CustomNodePackRequestError(
        'Authenticated account required',
        401
      )
    downloadingRevisionId.value = pack.revisionId
    let objectUrl: string | undefined
    try {
      const response = await api.fetchApi(
        `/customnodes/${encodeURIComponent(pack.revisionId)}/download`,
        { method: 'GET' }
      )
      if (!current(request)) return
      if (!response.ok) {
        throw await readError(response)
      }

      const archive = await response.blob()
      if (!current(request)) return
      objectUrl = URL.createObjectURL(archive)
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
    packs: computed(() =>
      loadedScope.value === scope.value ? readonly(packs).value : []
    ),
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
