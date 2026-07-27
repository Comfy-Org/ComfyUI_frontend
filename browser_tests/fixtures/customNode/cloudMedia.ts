import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import type { Page } from '@playwright/test'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

import { assetPath } from '@e2e/fixtures/utils/paths'

const RUN_TIER_MEDIA: Record<string, string> = {
  'plain_video.mp4': 'video/mp4'
}

export function referencedRunMedia(workflow: ComfyWorkflowJSON): string[] {
  const widgetValues = (workflow.nodes ?? []).flatMap((node) =>
    Array.isArray(node.widgets_values) ? node.widgets_values : []
  )
  return Object.keys(RUN_TIER_MEDIA).filter((name) =>
    widgetValues.includes(name)
  )
}

// window.app.api.fetchApi carries the signed-in session's auth header; a node-side POST would not.
export async function uploadRunMedia(
  page: Page,
  names: string[]
): Promise<void> {
  for (const name of names) {
    const base64 = readFileSync(resolve(assetPath(name))).toString('base64')
    const status = await page.evaluate(
      async ({ name, mimeType, base64 }) => {
        const bytes = Uint8Array.from(atob(base64), (char) =>
          char.charCodeAt(0)
        )
        const form = new FormData()
        form.append('image', new File([bytes], name, { type: mimeType }))
        form.append('overwrite', 'true')
        const response = await window.app!.api.fetchApi('/upload/image', {
          method: 'POST',
          body: form
        })
        return response.status
      },
      { name, mimeType: RUN_TIER_MEDIA[name], base64 }
    )
    if (status !== 200)
      throw new Error(
        `run-tier media upload failed: ${name} -> HTTP ${status} from /api/upload/image`
      )
  }
}
