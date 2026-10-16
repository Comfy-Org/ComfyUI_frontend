import { render, screen, waitFor, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ContentEditor from './ContentEditor.vue'
import { editorSnapshot } from '@/lib/cms/editor-document'
import { editorRequest } from '@/lib/cms/editor-client'

vi.mock(import('@/lib/cms/editor-client'))
const uid = '00000000-0000-4000-8000-000000000001'
const revision = '00000000-0000-4000-8000-000000000002'
const next = '00000000-0000-4000-8000-000000000003'
const flat = {
  uid,
  revision_uid: revision,
  expected_revision_uid: revision,
  expected_draft_rev: 7,
  schema_version: 2,
  type: 'workflow',
  is_deleted: false,
  title: 'Delete fixture',
  slug: 'delete-fixture',
  enabled: true,
  visibility: 'public',
  author_uid: 'original-comfy-account',
  long_description: 'Keep all paragraphs.',
  hero: { src: 'r2', id: uid, file_version_uid: revision },
  workflow_versions: [
    {
      name: 'V1',
      download: { src: 'r2', id: uid, file_version_uid: revision },
      api: null
    }
  ],
  custom: { nested: ['retain'] }
}
function setup(deleted = false) {
  const snapshot = editorSnapshot({ ...flat, is_deleted: deleted })
  if (!snapshot) throw new Error('Invalid tombstone fixture')
  render(ContentEditor, {
    props: {
      initial: snapshot.document,
      snapshot,
      type: 'workflow',
      draft: 7,
      csrf: 'a'.repeat(64)
    }
  })
  return userEvent.setup()
}

describe('content tombstone authoring', () => {
  it('asks before deleting and Cancel makes no request', async () => {
    const user = setup()
    await user.click(screen.getByRole('button', { name: 'Delete content' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent(
      'LIVE only when that deletion is checked and published'
    )
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(editorRequest).not.toHaveBeenCalled()
  })

  it('sends only exact delete tokens, then shows retained content read-only with Undelete', async () => {
    vi.mocked(editorRequest).mockResolvedValue({
      ok: true,
      status: 200,
      data: { ...flat, revision_uid: next, is_deleted: true }
    })
    const user = setup()
    await user.click(screen.getByRole('button', { name: 'Delete content' }))
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Delete in Draft'
      })
    )
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Undelete content' })
      ).toBeVisible()
    )
    const options = vi.mocked(editorRequest).mock.calls[0]?.[1]
    expect(editorRequest).toHaveBeenCalledWith(
      'delete',
      expect.objectContaining({ csrf: 'a'.repeat(64), key: expect.any(String) })
    )
    expect(JSON.parse(String(options?.body))).toEqual({
      uid,
      expected_draft_rev: 7,
      expected_revision_uid: revision
    })
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue(
      'Delete fixture'
    )
    expect(screen.getByRole('textbox', { name: 'Title' })).toBeDisabled()
    expect(
      screen.getAllByRole('button', { name: 'Save changes' })[0]
    ).toBeDisabled()
    expect(editorRequest).toHaveBeenCalledOnce()
  })

  it('undeletes through complete JSON replacement, preserving exact pins and never sending server is_deleted metadata', async () => {
    vi.mocked(editorRequest).mockResolvedValue({
      ok: true,
      status: 200,
      data: { ...flat, revision_uid: next }
    })
    const user = setup(true)
    await user.click(screen.getByRole('button', { name: 'Undelete content' }))
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Title' })).toBeEnabled()
    )
    expect(editorRequest).toHaveBeenCalledWith(
      'save',
      expect.objectContaining({ csrf: 'a'.repeat(64) })
    )
    const body = vi.mocked(editorRequest).mock.calls[0]?.[1]?.body
    if (typeof body !== 'string')
      throw new Error('Missing complete undelete JSON')
    const saved = JSON.parse(body)
    expect(saved).toMatchObject({
      uid,
      expected_draft_rev: 7,
      expected_revision_uid: revision,
      author_uid: flat.author_uid,
      workflow_versions: flat.workflow_versions,
      hero: flat.hero,
      custom: flat.custom
    })
    expect(saved).not.toHaveProperty('is_deleted')
    expect(saved).not.toHaveProperty('owner_uid')
    expect(screen.getByRole('button', { name: 'Delete content' })).toBeVisible()
    expect(editorRequest).toHaveBeenCalledOnce()
  })

  it('retains the tombstone on a stale undelete and does not silently overwrite a competing edit', async () => {
    vi.mocked(editorRequest).mockResolvedValue({
      ok: false,
      status: 409,
      data: undefined
    })
    const user = setup(true)
    await user.click(screen.getByRole('button', { name: 'Undelete content' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your unsaved edits are retained'
    )
    expect(
      screen.getByRole('button', { name: 'Undelete content' })
    ).toBeVisible()
    expect(screen.getByRole('textbox', { name: 'Title' })).toBeDisabled()
  })

  it('requires saving or explicitly discarding unsaved local edits before deletion', async () => {
    const user = setup()
    await user.clear(screen.getByRole('textbox', { name: 'Title' }))
    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'Unsaved')
    expect(
      screen.getByRole('button', { name: 'Delete content' })
    ).toBeDisabled()
    expect(
      screen.getByText(/Save or discard your unsaved form edits/)
    ).toBeVisible()
    expect(editorRequest).not.toHaveBeenCalled()
  })

  it('keeps a pending delete confirmation locked and does not send a second request', async () => {
    let finish:
      | ((result: Awaited<ReturnType<typeof editorRequest>>) => void)
      | undefined
    vi.mocked(editorRequest).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    const user = setup()
    await user.click(screen.getByRole('button', { name: 'Delete content' }))
    const dialog = screen.getByRole('dialog')
    await user.click(
      within(dialog).getByRole('button', { name: 'Delete in Draft' })
    )
    expect(
      within(dialog).getByRole('button', { name: 'Cancel' })
    ).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeDisabled()
    expect(
      within(dialog).getByRole('button', { name: 'Delete in Draft' })
    ).toBeDisabled()
    await user.keyboard('{Escape}')
    expect(screen.getByRole('dialog')).toBeVisible()
    expect(editorRequest).toHaveBeenCalledOnce()
    finish?.({ ok: false, status: 409, data: undefined })
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your unsaved edits are retained'
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Title' })).toBeEnabled()
  })
})
