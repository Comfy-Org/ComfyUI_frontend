import type { EditorState } from './editor'
import { savedRecord } from './editor'
import type { SaveResult } from './save-item'

export type SaveNotice = 'saved' | 'archived' | 'restored' | 'undone'

export function noticeFor(deleted: boolean | undefined): SaveNotice {
  if (deleted === undefined) return 'saved'
  return deleted ? 'archived' : 'restored'
}

/** Posts one editor state to the admin actions endpoint as a draft save. */
export async function saveToDraft(
  csrf: string,
  state: EditorState,
  base: Record<string, unknown>
): Promise<SaveResult> {
  const form = new FormData()
  form.set('csrf', csrf)
  form.set('action', 'save')
  form.set('uid', state.uid)
  form.set('record', JSON.stringify(savedRecord(state, base)))
  try {
    const response = await fetch('/admin/actions', {
      method: 'POST',
      body: form
    })
    return (await response.json()) as SaveResult
  } catch {
    return { ok: false, error: 'failed' }
  }
}
