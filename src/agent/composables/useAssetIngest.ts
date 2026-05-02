import { api } from '@/scripts/api'

import type { IngestedAsset } from '../stores/agentStore'

interface IngestResult {
  asset: IngestedAsset
  remote: boolean
}

function safeName(raw: string): string {
  return raw.replace(/[^\w.-]+/g, '_').slice(0, 120) || `pasted_${Date.now()}`
}

function detectExt(mime: string): string {
  if (mime === 'image/png') return '.png'
  if (mime === 'image/jpeg') return '.jpg'
  if (mime === 'image/webp') return '.webp'
  if (mime === 'image/gif') return '.gif'
  if (mime === 'text/plain') return '.txt'
  return ''
}

async function uploadToInput(file: File): Promise<string | null> {
  const body = new FormData()
  body.append('image', file, file.name)
  body.append('type', 'input')
  body.append('overwrite', 'false')
  try {
    const resp = await api.fetchApi('/upload/image', { method: 'POST', body })
    if (!resp.ok) return null
    const json = (await resp.json()) as { name?: string; subfolder?: string }
    if (!json.name) return null
    const prefix = json.subfolder ? `${json.subfolder}/` : ''
    return `/input/${prefix}${json.name}`
  } catch {
    return null
  }
}

interface AssetIngestOptions {
  uploader?: (file: File) => Promise<string | null>
}

export function useAssetIngest(options: AssetIngestOptions = {}) {
  const uploader = options.uploader ?? uploadToInput

  async function ingestFile(file: File): Promise<IngestResult> {
    const remotePath = await uploader(file)
    const fallbackName =
      file.name && file.name.length > 0
        ? safeName(file.name)
        : safeName('pasted') + detectExt(file.type)
    const path = remotePath ?? `/tmp/pasted/${fallbackName}`
    const previewUrl = file.type.startsWith('image/')
      ? URL.createObjectURL(file)
      : undefined
    return {
      asset: {
        id: crypto.randomUUID(),
        name: fallbackName,
        path,
        mime: file.type || 'application/octet-stream',
        size: file.size,
        previewUrl
      },
      remote: remotePath !== null
    }
  }

  async function ingestFromClipboard(
    data: DataTransfer | null
  ): Promise<IngestResult[]> {
    if (!data) return []
    const results: IngestResult[] = []
    for (const item of Array.from(data.items)) {
      if (item.kind !== 'file') continue
      const file = item.getAsFile()
      if (file) results.push(await ingestFile(file))
    }
    if (results.length === 0 && data.files && data.files.length > 0) {
      for (const file of Array.from(data.files)) {
        results.push(await ingestFile(file))
      }
    }
    return results
  }

  return {
    ingestFile,
    ingestFromClipboard
  }
}
