import { z } from 'zod'

import { zResultItem } from '@/platform/remote/comfyui/execution/types'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'

const NO_IMAGES: readonly string[] = []

const zSavedImages = z.array(zResultItem)

export function savedImageUrls(saved: unknown): readonly string[] {
  const parsed = zSavedImages.safeParse(saved)
  if (!parsed.success) return NO_IMAGES

  const rand = app.getRandParam()
  const previewParam = app.getPreviewFormatParam()

  return parsed.data.map((item) => {
    const params = new URLSearchParams(item)
    return api.apiURL(`/view?${params}${previewParam}${rand}`)
  })
}
