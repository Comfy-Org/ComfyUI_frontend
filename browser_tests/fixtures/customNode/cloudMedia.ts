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
async function uploadOne(page: Page, name: string): Promise<string> {
  const base64 = readFileSync(resolve(assetPath(name))).toString('base64')
  const uploaded = await page.evaluate(
    async ({ name, mimeType, base64 }) => {
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
      const form = new FormData()
      form.append('image', new File([bytes], name, { type: mimeType }))
      form.append('overwrite', 'true')
      const response = await window.app!.api.fetchApi('/upload/image', {
        method: 'POST',
        body: form
      })
      if (response.status !== 200) return { status: response.status }
      const stored = (await response.json()) as {
        name?: string
        subfolder?: string
      }
      return { status: response.status, ...stored }
    },
    { name, mimeType: RUN_TIER_MEDIA[name], base64 }
  )
  if (uploaded.status !== 200)
    throw new Error(
      `run-tier media upload failed: ${name} -> HTTP ${uploaded.status} from /api/upload/image`
    )
  // The backend chooses where the file lands and answers with it; the same
  // `subfolder/name` contract the app's own upload path resolves. Assuming the
  // local basename round-trips leaves the workflow pointing at a path the
  // executor cannot download.
  const storedName = uploaded.name ?? name
  return uploaded.subfolder ? `${uploaded.subfolder}/${storedName}` : storedName
}

export function rebindRunMedia(
  workflow: ComfyWorkflowJSON,
  storedByName: Record<string, string>
): void {
  for (const node of workflow.nodes ?? [])
    if (Array.isArray(node.widgets_values))
      node.widgets_values = node.widgets_values.map((value) =>
        typeof value === 'string' && value in storedByName
          ? storedByName[value]
          : value
      )
}

// Uploads the media the curated workflow names, then points the workflow at
// wherever the backend stored it. In place: the caller loads this same parsed
// workflow immediately afterwards. Returns the name-to-stored-path mapping so
// the caller can record what the backend chose.
export async function uploadRunMedia(
  page: Page,
  workflow: ComfyWorkflowJSON
): Promise<Record<string, string>> {
  const storedByName: Record<string, string> = {}
  for (const name of referencedRunMedia(workflow))
    storedByName[name] = await uploadOne(page, name)
  rebindRunMedia(workflow, storedByName)
  return storedByName
}
