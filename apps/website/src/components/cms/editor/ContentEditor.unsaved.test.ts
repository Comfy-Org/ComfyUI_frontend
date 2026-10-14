import { render, screen, waitFor, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { editorSnapshot } from '@/lib/cms/editor-document'
import { editorRequest } from '@/lib/cms/editor-client'
import ContentEditor from './ContentEditor.vue'

vi.mock(import('@/lib/cms/editor-client'))
const uid = '00000000-0000-4000-8000-000000000001'
const revision = '00000000-0000-4000-8000-000000000002'
const next = '00000000-0000-4000-8000-000000000003'
const flat = {
  uid,
  revision_uid: revision,
  expected_draft_rev: 7,
  expected_revision_uid: revision,
  is_deleted: false,
  type: 'workflow',
  schema_version: 2,
  title: 'Original',
  slug: 'original',
  long_description: 'Keep this paragraph.',
  author_uid: 'fixture-original-author',
  faq: [{ question: 'Keep?', answer: 'Yes.' }],
  custom: { nested: ['keep'] }
}
function setup(locale: 'en' | 'zh-CN' = 'en') {
  const snapshot = editorSnapshot(flat)
  if (!snapshot) throw new Error('Invalid editor test fixture')
  render(ContentEditor, {
    props: {
      initial: snapshot.document,
      snapshot,
      type: 'workflow',
      draft: 7,
      csrf: 'a'.repeat(64),
      locale
    }
  })
  return userEvent.setup()
}
const bar = () => screen.getByRole('region', { name: 'Unsaved changes' })

describe('editor unsaved changes bar', () => {
  it('shows only for pending edits and discards local buffers without a server request', async () => {
    const user = setup()
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
    const title = screen.getByRole('textbox', { name: 'Title' })
    await user.clear(title)
    await user.type(title, 'Changed title')
    expect(bar()).toBeVisible()
    await user.click(
      within(bar()).getByRole('button', { name: 'Discard unsaved edits' })
    )
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue(
      'Original'
    )
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
    expect(editorRequest).not.toHaveBeenCalled()
  })

  it('allows explicit discard of invalid complete JSON and remounts repaired controls', async () => {
    const user = setup()
    await user.click(screen.getByText('Advanced: complete authored JSON'))
    await user.clear(
      screen.getByRole('textbox', { name: 'Complete content document' })
    )
    await user.paste('{bad')
    expect(screen.getByRole('textbox', { name: 'Title' })).toBeDisabled()
    expect(
      within(bar()).getByRole('button', { name: 'Save changes' })
    ).toBeDisabled()
    await user.click(
      within(bar()).getByRole('button', { name: 'Discard unsaved edits' })
    )
    expect(screen.getByRole('textbox', { name: 'Title' })).toBeEnabled()
    expect(
      screen.getByRole('textbox', { name: 'Complete content document' })
    ).toHaveValue(JSON.stringify(editorSnapshot(flat)?.document, null, 2))
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
    expect(editorRequest).not.toHaveBeenCalled()
  })

  it('disables discard during a save and restores the latest confirmed snapshot afterward', async () => {
    let complete:
      | ((value: Awaited<ReturnType<typeof editorRequest>>) => void)
      | undefined
    vi.mocked(editorRequest).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve
        })
    )
    const user = setup()
    await user.clear(screen.getByRole('textbox', { name: 'Title' }))
    await user.type(
      screen.getByRole('textbox', { name: 'Title' }),
      'Saved title'
    )
    await user.click(
      within(bar()).getByRole('button', { name: 'Save changes' })
    )
    expect(
      within(bar()).getByRole('button', { name: 'Discard unsaved edits' })
    ).toBeDisabled()
    complete?.({
      ok: true,
      status: 200,
      data: { ...flat, title: 'Saved title', revision_uid: next }
    })
    await waitFor(() =>
      expect(screen.queryByRole('region')).not.toBeInTheDocument()
    )
    await user.clear(screen.getByRole('textbox', { name: 'Title' }))
    await user.type(
      screen.getByRole('textbox', { name: 'Title' }),
      'Unwanted edit'
    )
    await user.click(
      within(bar()).getByRole('button', { name: 'Discard unsaved edits' })
    )
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue(
      'Saved title'
    )
    expect(editorRequest).toHaveBeenCalledOnce()
  })

  it('retains unsaved work after a conflict and warns before leaving', async () => {
    vi.mocked(editorRequest).mockResolvedValue({
      ok: false,
      status: 409,
      data: undefined
    })
    const user = setup()
    await user.clear(screen.getByRole('textbox', { name: 'Title' }))
    await user.type(
      screen.getByRole('textbox', { name: 'Title' }),
      'Pending title'
    )
    await user.click(
      within(bar()).getByRole('button', { name: 'Save changes' })
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your unsaved edits are retained'
    )
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue(
      'Pending title'
    )
    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    await user.click(
      within(bar()).getByRole('button', { name: 'Discard unsaved edits' })
    )
    const cleanEvent = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(cleanEvent)
    expect(cleanEvent.defaultPrevented).toBe(false)
  })

  it('localizes the bar and discard command', async () => {
    const user = setup('zh-CN')
    await user.type(screen.getByRole('textbox', { name: '标题' }), '新')
    const region = screen.getByRole('region', { name: '有未保存的更改' })
    expect(
      within(region).getByRole('button', { name: '放弃未保存的编辑' })
    ).toBeEnabled()
  })
})
