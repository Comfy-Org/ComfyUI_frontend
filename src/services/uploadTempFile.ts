import { useToast } from '@/components/ui/toast/toastStore'
import { t } from '@/i18n'
import { api } from '@/scripts/api'

interface UploadedTempFile {
  name: string
  subfolder?: string
  type?: string
}

type TempFileUpload =
  | { ok: true; file: UploadedTempFile }
  | { ok: false; reason: string }

export async function uploadTempFile(
  file: File,
  subfolder: string
): Promise<TempFileUpload> {
  const body = new FormData()
  body.append('image', file)
  body.append('subfolder', subfolder)
  body.append('type', 'temp')

  const resp = await api.fetchApi('/upload/image', { method: 'POST', body })
  if (resp.status !== 200) {
    const reason = `${resp.status} - ${resp.statusText}`
    useToast().warning(t('g.uploadFailed', { reason }))
    return { ok: false, reason }
  }
  return { file: await resp.json(), ok: true }
}
