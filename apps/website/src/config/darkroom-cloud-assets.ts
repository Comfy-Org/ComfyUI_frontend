/**
 * Saves a Darkroom image into the signed-in account's Comfy Cloud library, so
 * it shows up in Cloud's Assets panel beside everything else the account has
 * made. Router does not keep the Nano Banana models' output itself, so the
 * page uploads the image it was handed.
 *
 * The asset is tagged `output` and `darkroom`, and carries the prompt and
 * settings as metadata. Darkroom's own feed stays in the browser; this is a
 * copy, and a failed upload never fails the image.
 */
import { downloadName } from '@/lib/darkroom/feed'
import type { DarkroomItem } from '@/lib/darkroom/store'
import { combineAbortSignals, createTimeoutSignal } from '@/utils/abortSignal'

import { WORKSHOP_CLOUD_BASE_URL } from './workshop-env'

const UPLOAD_TIMEOUT_MS = 120_000
export const DARKROOM_ASSET_TAGS = ['output', 'darkroom'] as const

/** Off unless the build opts in, like the Workshop's own asset saving. */
export function darkroomSavesToCloud(): boolean {
  return import.meta.env.PUBLIC_WORKSHOP_SAVE_ASSETS === '1'
}

export function darkroomAssetMetadata(
  item: DarkroomItem
): Record<string, unknown> {
  const { settings } = item
  return {
    source: 'comfy-darkroom',
    prompt: settings.prompt,
    model: settings.model,
    seed: settings.seed,
    aspect_ratio: settings.aspectRatio,
    image_size: settings.imageSize,
    temperature: settings.temperature,
    ...(settings.thinkingLevel
      ? { thinking_level: settings.thinkingLevel }
      : {}),
    ...(settings.system ? { style_notes: settings.system } : {}),
    darkroom_job_id: settings.jobId,
    darkroom_run: settings.run
  }
}

export function darkroomAssetForm(item: DarkroomItem, blob: Blob): FormData {
  const form = new FormData()
  const name = downloadName(item)
  form.set('file', blob, name)
  form.set('name', name)
  form.set('mime_type', item.mime)
  form.set('tags', JSON.stringify(DARKROOM_ASSET_TAGS))
  form.set('user_metadata', JSON.stringify(darkroomAssetMetadata(item)))
  return form
}

/** Uploads one image and returns the id Cloud stored it under. */
export async function saveDarkroomAsset(
  item: DarkroomItem,
  blob: Blob,
  token: string,
  signal: AbortSignal
): Promise<string> {
  const response = await fetch(`${WORKSHOP_CLOUD_BASE_URL}/api/assets`, {
    method: 'POST',
    credentials: 'omit',
    redirect: 'error',
    headers: { Authorization: `Bearer ${token}` },
    body: darkroomAssetForm(item, blob),
    signal: combineAbortSignals([
      signal,
      createTimeoutSignal(UPLOAD_TIMEOUT_MS)
    ])
  })
  if (!response.ok) {
    await response.body?.cancel().catch(() => {})
    throw new Error(`Cloud asset upload failed: HTTP ${response.status}`)
  }
  const id: unknown = Reflect.get(Object(await response.json()), 'id')
  if (typeof id !== 'string' || !id)
    throw new Error('Cloud asset upload returned no id')
  return id
}
