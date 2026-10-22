import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { editorRequest } from '@/lib/cms/editor-client'
import { blankDocument, editorSnapshot } from '@/lib/cms/editor-document'
import type { ContentType } from '@/lib/cms/editor-document'
import ContentEditor from './ContentEditor.vue'

vi.mock(import('@/lib/cms/editor-client'))

const uid = '00000000-0000-4000-8000-000000000001'
const revision = '00000000-0000-4000-8000-000000000002'
function setup(type: ContentType = 'workflow', changeID?: string) {
  const snapshot = editorSnapshot({
    ...blankDocument(),
    title: 'Existing content',
    slug: 'existing-content',
    uid,
    revision_uid: revision,
    expected_draft_rev: 7,
    expected_revision_uid: revision,
    schema_version: 2,
    is_deleted: false,
    type,
    ...(changeID === undefined ? {} : { change_id: changeID }),
    custom: { nested: ['preserve'] }
  })
  if (!snapshot) throw new Error('Invalid editor fixture')
  render(ContentEditor, {
    props: {
      initial: snapshot.document,
      snapshot,
      type,
      draft: 7,
      csrf: 'a'.repeat(64)
    }
  })
  vi.mocked(editorRequest).mockResolvedValue({
    ok: false,
    status: 409,
    data: undefined
  })
  return snapshot
}

describe('editable change batch', () => {
  it.for<ContentType>(['model', 'workflow', 'app'])(
    'shows the saved Change ID on %s content',
    (type) => {
      setup(type, 'workflows_1016')
      expect(screen.getByRole('textbox', { name: 'Change ID' })).toHaveValue(
        'workflows_1016'
      )
      expect(editorRequest).not.toHaveBeenCalled()
    }
  )

  it('submits a typed batch with unchanged JSON and CAS, retaining it after conflict', async () => {
    setup()
    const input = screen.getByRole('textbox', { name: 'Change ID' })
    await fireEvent.update(input, 'workflows_1016')
    await userEvent.click(
      screen.getAllByRole('button', { name: 'Save changes' })[0]
    )
    await waitFor(() => expect(editorRequest).toHaveBeenCalledOnce())
    expect(
      JSON.parse(String(vi.mocked(editorRequest).mock.calls[0][1]?.body))
    ).toMatchObject({
      uid,
      change_id: 'workflows_1016',
      title: 'Existing content',
      custom: { nested: ['preserve'] },
      expected_draft_rev: 7,
      expected_revision_uid: revision
    })
    expect(input).toHaveValue('workflows_1016')
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your unsaved edits are retained'
    )
  })

  it('keeps the server-confirmed batch after a successful save', async () => {
    const snapshot = setup()
    vi.mocked(editorRequest).mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        ...snapshot.document,
        change_id: 'workflows_1016',
        uid,
        revision_uid: '00000000-0000-4000-8000-000000000003',
        type: 'workflow',
        schema_version: 2,
        is_deleted: false
      }
    })
    await fireEvent.update(
      screen.getByRole('textbox', { name: 'Change ID' }),
      'workflows_1016'
    )
    await userEvent.click(
      screen.getAllByRole('button', { name: 'Save changes' })[0]
    )
    expect(
      await screen.findByText('Saved in Draft. LIVE is unchanged.')
    ).toBeVisible()
    expect(screen.getByRole('textbox', { name: 'Change ID' })).toHaveValue(
      'workflows_1016'
    )
    expect(
      screen.queryByRole('region', { name: 'Unsaved changes' })
    ).not.toBeInTheDocument()
  })

  it('removes an optional batch when the field is cleared', async () => {
    setup('workflow', 'previous_batch')
    await fireEvent.update(
      screen.getByRole('textbox', { name: 'Change ID' }),
      ''
    )
    await userEvent.click(
      screen.getAllByRole('button', { name: 'Save changes' })[0]
    )
    await waitFor(() => expect(editorRequest).toHaveBeenCalledOnce())
    expect(
      JSON.parse(String(vi.mocked(editorRequest).mock.calls[0][1]?.body))
    ).not.toHaveProperty('change_id')
  })

  it.for(['bad batch', '_batch', 'batch/one', 'a'.repeat(129)])(
    'keeps invalid batch %j visible and blocks saving until repaired',
    async (value) => {
      setup()
      const input = screen.getByRole('textbox', { name: 'Change ID' })
      await fireEvent.update(input, value)
      expect(input).toHaveValue(value)
      expect(input).toHaveAttribute('aria-invalid', 'true')
      expect(
        screen.getAllByRole('button', { name: 'Save changes' })[0]
      ).toBeDisabled()
      expect(editorRequest).not.toHaveBeenCalled()
      await fireEvent.update(input, 'workflows_1016')
      expect(input).toHaveAttribute('aria-invalid', 'false')
      expect(
        screen.getAllByRole('button', { name: 'Save changes' })[0]
      ).toBeEnabled()
    }
  )
})
