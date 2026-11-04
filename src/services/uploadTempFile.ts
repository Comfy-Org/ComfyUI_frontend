import type { UploadImageResponse } from '@comfyorg/ingest-types'

import { useToast } from '@/components/ui/toast/toastStore'
import { t } from '@/i18n'
import { api } from '@/scripts/api'

export type ComfyFileUpload =
  | { ok: true; file: UploadImageResponse }
  | { ok: false; reason: string }

async function postUpload(
  file: File,
  subfolder: string,
  type: 'input' | 'temp',
  signal?: AbortSignal
): Promise<ComfyFileUpload> {
  const body = new FormData()
  body.append('image', file)
  body.append('subfolder', subfolder)
  body.append('type', type)

  const resp = await api.fetchApi('/upload/image', {
    method: 'POST',
    body,
    signal
  })
  if (resp.status !== 200) {
    return { ok: false, reason: `${resp.status} - ${resp.statusText}` }
  }
  return { file: await resp.json(), ok: true }
}

export async function uploadTempFile(
  file: File,
  subfolder: string
): Promise<ComfyFileUpload> {
  const upload = await postUpload(file, subfolder, 'temp')
  if (!upload.ok) {
    useToast().warning(t('g.uploadFailed', { reason: upload.reason }))
  }
  return upload
}

/** Uploads a file to the user's input storage without a toast. */
export async function uploadInputFile(
  file: File,
  subfolder: string,
  signal?: AbortSignal
): Promise<ComfyFileUpload> {
  try {
    return await postUpload(file, subfolder, 'input', signal)
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : String(error)
    }
  }
}
