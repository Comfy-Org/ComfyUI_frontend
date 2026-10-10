import type { StageStatus } from './stage-status'

/** Asks the admin to record one review decision; true once it's saved. */
export async function postDecision(
  csrf: string,
  ids: string[],
  status: StageStatus
): Promise<boolean> {
  const form = new FormData()
  form.set('csrf', csrf)
  form.set('action', 'stage')
  form.set('decision', JSON.stringify({ ids, status }))
  try {
    const response = await fetch('/admin/actions', {
      method: 'POST',
      body: form
    })
    return ((await response.json()) as { ok?: boolean }).ok === true
  } catch {
    return false
  }
}
