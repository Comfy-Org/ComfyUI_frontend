import {
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { blankDocument, editorSnapshot } from '@/lib/cms/editor-document'
import { editorRequest } from '@/lib/cms/editor-client'
import ContentEditor from './ContentEditor.vue'
import userEvent from '@testing-library/user-event'

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
  it('uploads the API file separately while preserving the downloadable graph pin', async () => {
    setup()
    const input = screen.getByLabelText('API JSON (Cloud Run workflow)')
    const uploadPanel = screen.getByRole('group', {
      name: 'API JSON (Cloud Run workflow) · Upload as new media'
    })
    expect(uploadPanel).toContainElement(input)
    vi.mocked(editorRequest)
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        data: { uid: next, revision_uid: revision }
      })
      .mockResolvedValueOnce({ ok: false, status: 409, data: undefined })
    await userEvent
      .setup({ applyAccept: false })
      .upload(
        input,
        new File(
          ['{"7":{"class_type":"Example","inputs":{}}}'],
          'workflow.json',
          { type: 'application/json' }
        )
      )
    await userEvent.click(
      within(uploadPanel).getByRole('button', { name: 'Upload as new media' })
    )
    await waitFor(() => expect(editorRequest).toHaveBeenCalledOnce())
    await waitFor(() =>
      expect(
        screen.getAllByRole('button', { name: 'Save changes' })[0]
      ).toBeEnabled()
    )
    await userEvent.click(
      screen.getAllByRole('button', { name: 'Save changes' })[0]
    )
    await waitFor(() => expect(editorRequest).toHaveBeenCalledTimes(2))
    const upload = vi.mocked(editorRequest).mock.calls[0][1]?.body
    if (!(upload instanceof FormData))
      throw new Error('Missing API upload form')
    expect(upload.get('role')).toBe('workflow-api-0')
    const save = JSON.parse(
      String(vi.mocked(editorRequest).mock.calls[1][1]?.body)
    )
    expect(save.workflow_versions).toEqual([
      {
        name: 'Original file',
        download: flat.workflow_files[0].file,
        api: {
          src: 'r2',
          id: next,
          file_version_uid: revision,
          name: 'workflow-api-0.json'
        }
      }
    ])
    expect(save).not.toHaveProperty('workflow_files')
  })
  it('defaults a new pair name to V1 and exposes two JSON-only selectors', () => {
    setup(false)
    expect(
      screen.getByRole('textbox', { name: 'Workflow version name' })
    ).toHaveValue('V1')
    expect(
      screen.getByLabelText('Download JSON (graph workflow)')
    ).toHaveAttribute('accept', 'application/json,.json')
    expect(
      screen.getByLabelText('API JSON (Cloud Run workflow)')
    ).toHaveAttribute('accept', 'application/json,.json')
  })
  it('requires opting into input editing but not script examples', async () => {
    setup(false)
    const runnable = screen.getByRole('checkbox', { name: 'Runnable' })
    const addInput = screen.getByRole('button', { name: 'Add input' })
    expect(runnable).not.toBeChecked()
    expect(addInput).toBeDisabled()
    expect(
      screen.getByRole('textbox', { name: 'Python fallback code' })
    ).toBeEnabled()
    await userEvent.click(runnable)
    expect(addInput).toBeEnabled()
    await userEvent.click(runnable)
    expect(addInput).toBeDisabled()
  })
  it('disabling Runnable preserves inputs, bindings and authored fallback code on save', async () => {
    const fields = {
      inputs: {
        prompt: {
          label: 'Prompt',
          help: '',
          hidden: false,
          advanced: false,
          control: 'text-area'
        }
      },
      inputSchema: {
        type: 'object',
        properties: { prompt: { type: 'string', default: 'Default' } },
        required: [],
        additionalProperties: false
      },
      inputBindings: {
        prompt: {
          encoding: 'scalar',
          targets: [{ nodeId: '6', inputName: 'text' }]
        }
      }
    }
    const snapshot = editorSnapshot({ ...flat, ...fields })
    if (!snapshot) throw new Error('Fixture invalid')
    render(ContentEditor, {
      props: {
        initial: snapshot.document,
        snapshot,
        type: 'workflow',
        draft: 7,
        csrf: 'a'.repeat(64)
      }
    })
    vi.mocked(editorRequest).mockResolvedValue({
      ok: false,
      status: 409,
      data: undefined
    })
    expect(screen.getByRole('checkbox', { name: 'Runnable' })).toBeChecked()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Runnable' }))
    await fireEvent.update(
      screen.getByRole('textbox', { name: 'Python fallback code' }),
      'print("Fallback")\n'
    )
    await userEvent.click(
      screen.getAllByRole('button', { name: 'Save changes' })[0]
    )
    await waitFor(() => expect(editorRequest).toHaveBeenCalledOnce())
    expect(
      JSON.parse(String(vi.mocked(editorRequest).mock.calls[0][1]?.body))
    ).toMatchObject({
      ...fields,
      runnable: false,
      script_code: { python: 'print("Fallback")\n' }
    })
  })
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
    await userEvent
      .setup()
      .click(screen.getByText('Enter an account ID directly'))
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
    await userEvent.click(screen.getByRole('button', { name: 'Add output' }))
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
    await userEvent.click(screen.getByRole('button', { name: 'Add question' }))
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
    await userEvent.click(
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
    await userEvent.click(
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
    await userEvent.click(
      screen.getAllByRole('button', { name: 'Save changes' })[0]
    )
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/changed|stale/i)
    )
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue(
      'Do not lose this'
    )
    await userEvent.click(
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
    await userEvent.click(screen.getByRole('checkbox', { name: 'Runnable' }))
    await fireEvent.update(
      screen.getByRole('textbox', { name: 'Parameter name' }),
      'prompt'
    )
    await userEvent.click(screen.getByRole('button', { name: 'Add input' }))
    expect(screen.getByRole('textbox', { name: 'Label' })).toHaveValue('prompt')
    await userEvent.click(screen.getByRole('button', { name: 'Add example' }))
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
    await userEvent.click(screen.getByText('Advanced: complete authored JSON'))
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
