import { render, screen, waitFor, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ContentEditor from './ContentEditor.vue'
import { editorSnapshot } from '@/lib/cms/editor-document'
import { editorRequest } from '@/lib/cms/editor-client'

vi.mock(import('@/lib/cms/editor-client'))

describe('Mar editor controls on the real authoring form', () => {
  it('saves editorial choices and publishing fields through the normal CAS request without losing pins or existing text', async () => {
    const flat = {
      uid: '00000000-0000-4000-8000-000000000001',
      revision_uid: '00000000-0000-4000-8000-000000000002',
      expected_revision_uid: '00000000-0000-4000-8000-000000000002',
      expected_draft_rev: 7,
      schema_version: 2,
      type: 'workflow',
      is_deleted: false,
      title: 'Example',
      slug: 'example',
      enabled: false,
      visibility: 'staff',
      visible_from: '2026-10-15T09:30:45.123-07:00',
      generation_type: 'text-to-image',
      use_cases: ['Portraits, editorial'],
      long_description: 'First paragraph.\n\nSecond paragraph.',
      hero: {
        src: 'r2',
        id: '00000000-0000-4000-8000-000000000003',
        file_version_uid: '00000000-0000-4000-8000-000000000004'
      },
      custom: { nested: ['preserve'] }
    }
    const snapshot = editorSnapshot(flat)
    expect(snapshot).toBeDefined()
    if (!snapshot) throw new Error('Invalid editor fixture')
    render(ContentEditor, {
      props: {
        initial: snapshot.document,
        snapshot,
        type: 'workflow',
        draft: 7,
        csrf: 'a'.repeat(64)
      }
    })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Use cases' }))
    await user.type(screen.getByRole('searchbox'), 'Animate characters{Enter}')
    expect(editorRequest).not.toHaveBeenCalled()
    await user.keyboard('{Escape}')
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Audience' }),
      'public'
    )
    await user.click(screen.getByRole('checkbox', { name: 'Enabled' }))
    vi.mocked(editorRequest).mockResolvedValue({
      ok: false,
      status: 409,
      data: undefined
    })
    await user.click(
      within(screen.getByRole('region', { name: 'Unsaved changes' })).getByRole(
        'button',
        { name: 'Save changes' }
      )
    )
    await waitFor(() => expect(editorRequest).toHaveBeenCalledOnce())
    expect(editorRequest).toHaveBeenCalledWith(
      'save',
      expect.objectContaining({
        csrf: 'a'.repeat(64),
        body: expect.any(String)
      })
    )
    const body = vi.mocked(editorRequest).mock.calls[0]?.[1]?.body
    expect(typeof body).toBe('string')
    if (typeof body !== 'string') throw new Error('Expected JSON save')
    expect(JSON.parse(body)).toMatchObject({
      ...snapshot.document,
      expected_draft_rev: 7,
      expected_revision_uid: flat.revision_uid,
      enabled: true,
      visibility: 'public',
      use_cases: ['Portraits, editorial', 'Animate characters']
    })
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your unsaved edits are retained'
    )
    expect(screen.getByRole('checkbox', { name: 'Enabled' })).toBeChecked()
  })
})
