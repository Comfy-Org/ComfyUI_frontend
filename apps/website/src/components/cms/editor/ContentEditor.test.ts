import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { blankDocument, editorSnapshot } from '@/lib/cms/editor-document'
import { editorRequest } from '@/lib/cms/editor-client'
import ContentEditor from './ContentEditor.vue'

vi.mock(import('@/lib/cms/editor-client'))
const uid = '00000000-0000-4000-8000-000000000001'
const revision = '00000000-0000-4000-8000-000000000002'
const next = '00000000-0000-4000-8000-000000000003'
const flat = {
  ...blankDocument(),
  title: 'Original',
  slug: 'original',
  translations: { 'zh-CN': { title: '原始' } },
  workflow_files: [
    {
      name: 'Original file',
      file: { src: 'r2', id: uid, file_version_uid: revision }
    }
  ],
  uid,
  revision_uid: revision,
  type: 'workflow',
  schema_version: 1,
  is_deleted: false,
  expected_draft_rev: 7,
  expected_revision_uid: revision
}
function setup(existing = true) {
  const snapshot = existing ? editorSnapshot(flat) : undefined
  render(ContentEditor, {
    props: {
      initial: snapshot?.document ?? blankDocument(),
      snapshot,
      type: 'workflow',
      draft: 7,
      csrf: 'a'.repeat(64)
    }
  })
}

describe('staff page editor', () => {
  it('uses single-line Description and a large multi-paragraph Long description', () => {
    setup()
    expect(screen.getByRole('textbox', { name: /^Description$/ }).tagName).toBe(
      'INPUT'
    )
    expect(
      screen.getByRole('textbox', { name: /^Long description$/ })
    ).toHaveAttribute('rows', '12')
    expect(
      screen.getByRole('textbox', { name: /^Long description$/ }).tagName
    ).toBe('TEXTAREA')
  })

  it('saves new structured fields and editable credited author without an owner override', async () => {
    setup()
    vi.mocked(editorRequest).mockResolvedValue({
      ok: false,
      status: 409,
      data: undefined
    })
    for (const [name, value] of [
      ['Long description', 'First paragraph.\n\nSecond paragraph.'],
      ['Credited author account UID', next],
      ['Documentation URL', 'https://docs.comfy.org/api-reference/'],
      ['Runs', '0'],
      ['Downloads', '9'],
      ['Model UIDs (comma-separated)', next],
      ['Comfy Cloud share URL', 'https://cloud.comfy.org/?share=abcdef123456']
    ])
      await fireEvent.update(
        screen.getByRole('textbox', { name: (label) => label === name }),
        value
      )
    await fireEvent.update(
      screen.getByRole('combobox', { name: 'Works on Comfy Cloud' }),
      'false'
    )
    await fireEvent.update(
      screen.getByRole('combobox', { name: 'Output type' }),
      'video'
    )
    await fireEvent.click(screen.getByRole('button', { name: 'Add output' }))
    await fireEvent.update(
      screen.getByRole('textbox', { name: 'Output 1 ID' }),
      'result'
    )
    await fireEvent.update(
      screen.getByRole('textbox', { name: 'Output 1 node ID' }),
      '9'
    )
    await fireEvent.update(
      screen.getByRole('textbox', { name: 'Output 1 key' }),
      'videos'
    )
    await fireEvent.update(
      screen.getByRole('combobox', { name: 'Output 1 type' }),
      'video'
    )
    await fireEvent.click(screen.getByRole('button', { name: 'Add question' }))
    expect(
      screen.getAllByRole('button', { name: 'Save changes' })[0]
    ).toBeDisabled()
    await fireEvent.update(
      screen.getByRole('textbox', { name: 'Question 1' }),
      'Can I edit this?'
    )
    await fireEvent.update(
      screen.getByRole('textbox', { name: 'Answer 1' }),
      'Yes, download it.'
    )
    await fireEvent.click(
      screen.getAllByRole('button', { name: 'Save changes' })[0]
    )
    await waitFor(() => expect(editorRequest).toHaveBeenCalledOnce())
    const payload = JSON.parse(
      String(vi.mocked(editorRequest).mock.calls[0][1]?.body)
    )
    expect(payload).toMatchObject({
      long_description: 'First paragraph.\n\nSecond paragraph.',
      author_uid: next,
      documentation_url: 'https://docs.comfy.org/api-reference/',
      runs: 0,
      downloads: 9,
      works_on_cloud: false,
      output_type: 'video',
      outputs: [{ id: 'result', nodeId: '9', key: 'videos', kind: 'video' }],
      model_uids: [next],
      cloud_share_url: 'https://cloud.comfy.org/?share=abcdef123456',
      faq: [{ question: 'Can I edit this?', answer: 'Yes, download it.' }],
      expected_revision_uid: revision,
      workflow_files: flat.workflow_files
    })
    expect(payload.owner_uid).toBeUndefined()
    expect(
      screen.getByRole('textbox', { name: 'Long description' })
    ).toHaveValue('First paragraph.\n\nSecond paragraph.')
  })

  it('retains invalid count text and blocks saving until repaired or cleared', async () => {
    setup()
    const count = screen.getByRole('textbox', { name: /^Runs$/ })
    await fireEvent.update(count, '-5')
    expect(count).toHaveValue('-5')
    expect(
      screen.getAllByRole('button', { name: 'Save changes' })[0]
    ).toBeDisabled()
    await fireEvent.update(count, '0')
    expect(
      screen.getAllByRole('button', { name: 'Save changes' })[0]
    ).toBeEnabled()
    await fireEvent.update(count, '')
    expect(count).toHaveValue('')
    expect(editorRequest).not.toHaveBeenCalled()
  })
  it('uses matching large Cancel/Save controls and Comfy yellow on both Save buttons', () => {
    setup()
    for (const cancel of screen.getAllByRole('link', { name: /^Cancel$/ }))
      expect(cancel).toHaveClass('h-10', 'w-40')
    for (const save of screen.getAllByRole('button', {
      name: /^Save changes$/
    })) {
      expect(save).toHaveClass(
        'h-10',
        'w-40',
        'bg-primary-comfy-yellow',
        'text-primary-comfy-ink'
      )
      expect(save).not.toHaveClass('bg-admin-fg')
    }
  })
  it('opening EDIT reads the supplied snapshot without saving or uploading', () => {
    setup()
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue(
      'Original'
    )
    expect(editorRequest).not.toHaveBeenCalled()
    expect(
      screen.getByText('Editing DRAFT 7. Publish separately after review.')
    ).toBeVisible()
  })
  it('saves complete authored JSON with exact CAS without publishing', async () => {
    setup()
    vi.mocked(editorRequest).mockResolvedValue({
      ok: true,
      status: 200,
      data: { ...flat, title: 'Changed', revision_uid: next }
    })
    await fireEvent.update(
      screen.getByRole('textbox', { name: 'Title' }),
      'Changed'
    )
    await fireEvent.click(
      screen.getAllByRole('button', { name: 'Save changes' })[0]
    )
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Saved in Draft. LIVE is unchanged.'
      )
    )
    const [operation, options] = vi.mocked(editorRequest).mock.calls[0]
    expect(operation).toBe('save')
    const body = JSON.parse(String(options?.body))
    expect(body).toMatchObject({
      title: 'Changed',
      expected_draft_rev: 7,
      expected_revision_uid: revision,
      uid,
      translations: flat.translations,
      workflow_files: flat.workflow_files
    })
    expect(body.owner_uid).toBeUndefined()
    expect(options?.key).toBeTruthy()
    expect(editorRequest).toHaveBeenCalledOnce()
  })
  it('retains local edits and same retry key after a stale rejection', async () => {
    setup()
    vi.mocked(editorRequest).mockResolvedValue({
      ok: false,
      status: 409,
      data: undefined
    })
    await fireEvent.update(
      screen.getByRole('textbox', { name: 'Title' }),
      'Do not lose this'
    )
    await fireEvent.click(
      screen.getAllByRole('button', { name: 'Save changes' })[0]
    )
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/changed|stale/i)
    )
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue(
      'Do not lose this'
    )
    await fireEvent.click(
      screen.getAllByRole('button', { name: 'Save changes' })[0]
    )
    await waitFor(() => expect(editorRequest).toHaveBeenCalledTimes(2))
    expect(vi.mocked(editorRequest).mock.calls[1][1]).toEqual(
      vi.mocked(editorRequest).mock.calls[0][1]
    )
  })
  it('NEW does not upload before the server has assigned an entity UID', () => {
    setup(false)
    for (const button of screen.getAllByRole('button', {
      name: 'Upload as new media'
    }))
      expect(button).toBeDisabled()
    expect(editorRequest).not.toHaveBeenCalled()
  })
  it('adds editable input and example fields without network or paid generation', async () => {
    setup()
    await fireEvent.update(
      screen.getByRole('textbox', { name: 'Parameter name' }),
      'prompt'
    )
    await fireEvent.click(screen.getByRole('button', { name: 'Add input' }))
    expect(screen.getByRole('textbox', { name: 'Label' })).toHaveValue('prompt')
    await fireEvent.click(screen.getByRole('button', { name: 'Add example' }))
    await fireEvent.update(
      screen.getByRole('textbox', { name: 'Example title' }),
      'Poster example'
    )
    expect(screen.getByRole('textbox', { name: 'Example title' })).toHaveValue(
      'Poster example'
    )
    expect(editorRequest).not.toHaveBeenCalled()
  })
  it('blocks saving invalid JSON rather than dropping a complex field', async () => {
    setup()
    await fireEvent.click(screen.getByText('Advanced: complete authored JSON'))
    await fireEvent.update(
      screen.getByRole('textbox', { name: 'Complete content document' }),
      '{bad'
    )
    for (const button of screen.getAllByRole('button', {
      name: 'Save changes'
    }))
      expect(button).toBeDisabled()
    expect(editorRequest).not.toHaveBeenCalled()
  })
})
