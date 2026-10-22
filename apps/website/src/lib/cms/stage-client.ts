import type { StageStatus } from './stage-status'

async function send(
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

let queue: Promise<unknown> = Promise.resolve()

/**
 * Asks the admin to record one review decision; true once it's saved.
 * Decisions go out one at a time, in the order they were made, so quick
 * clicks never race each other to the API.
 */
export function postDecision(
  csrf: string,
  ids: string[],
  status: StageStatus
): Promise<boolean> {
  const result = queue.then(() => send(csrf, ids, status))
  queue = result
  return result
}
