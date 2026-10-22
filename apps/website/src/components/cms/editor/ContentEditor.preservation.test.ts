import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ContentEditor from './ContentEditor.vue'
import { editorRequest } from '@/lib/cms/editor-client'
import { blankDocument, editorSnapshot } from '@/lib/cms/editor-document'

vi.mock(import('@/lib/cms/editor-client'))
const uid = '00000000-0000-4000-8000-000000000001'
const version = '00000000-0000-4000-8000-000000000002'
const pin = {
  src: 'r2',
  id: uid,
  file_version_uid: version,
  name: 'exact.json'
}
const authored = {
  ...blankDocument(),
  title: 'Keep everything',
  slug: 'keep-everything',
  hero: pin,
  thumbnail: pin,
  translations: { 'zh-CN': { title: '保留内容', description: '说明' } },
  availability: { desktop: { minimum_version: '1.0' } },
  workflow_files: [
    { name: 'v1', file: pin },
    { name: 'v2', file: { ...pin, name: 'v2.json' } }
  ],
  inputs: { prompt: { label: 'Prompt', type: 'string', widget: 'textarea' } },
  inputSchema: {
    type: 'object',
    properties: { prompt: { type: 'string', default: 'keep default' } },
    required: ['prompt']
  },
  inputBindings: { prompt: { node: '7', input: 'text' } },
  examples: [
    {
      name: 'a',
      title: 'Example A',
      values: { prompt: 'a' },
      media: pin,
      reference_media: [pin],
      tags: ['first']
    },
    {
      name: 'b',
      title: 'Example B',
      values: { prompt: 'b' },
      media: pin,
      reference_media: [pin],
      tags: ['second']
    }
  ]
}
function setup() {
  const snapshot = editorSnapshot({
    ...authored,
    uid,
    revision_uid: version,
    type: 'workflow',
    schema_version: 1,
    is_deleted: false,
    expected_draft_rev: 7,
    expected_revision_uid: version
  })
  render(ContentEditor, {
    props: {
      initial: authored,
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
}
async function saveBody() {
  await userEvent.click(
    screen.getAllByRole('button', { name: 'Save changes' })[0]
  )
  await waitFor(() => expect(editorRequest).toHaveBeenCalledOnce())
  return JSON.parse(String(vi.mocked(editorRequest).mock.calls[0][1]?.body))
}
describe('complete authored document preservation', () => {
  it('saves chip tags without changing nested content or exact media pins', async () => {
    setup()
    const input = screen.getByRole('textbox', { name: 'Tags' })
    await userEvent.type(input, 'product-video{Enter}')
    expect(editorRequest).not.toHaveBeenCalled()
    const payload = await saveBody()
    expect(payload).toMatchObject({
      ...authored,
      tags: ['product-video']
    })
  })
  it('keeps literal keys in a successful save response for the next save', async () => {
    setup()
    const literal = JSON.parse('{"__proto__":{"literal":true}}')
    vi.mocked(editorRequest).mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: {
        ...authored,
        ...literal,
        uid,
        revision_uid: version,
        type: 'workflow',
        schema_version: 1,
        is_deleted: false
      }
    })
    await saveBody()
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Saved in Draft. LIVE is unchanged.'
      )
    )
    vi.mocked(editorRequest).mockClear()
    await fireEvent.update(
      screen.getByRole('textbox', { name: 'Title' }),
      'Next save'
    )
    const payload = await saveBody()
    expect(JSON.stringify(payload)).toContain('"__proto__":{"literal":true}')
  })
  it('preserves literal keys from advanced JSON through a later structured edit and save', async () => {
    setup()
    await userEvent.click(screen.getByText('Advanced: complete authored JSON'))
    const literal = JSON.parse(
      '{"__proto__":{"literal":true},"nested":{"__proto__":"Keep label","constructor":"Keep too"}}'
    )
    await fireEvent.update(
      screen.getByRole('textbox', { name: 'Complete content document' }),
      JSON.stringify({ ...authored, ...literal })
    )
    await fireEvent.update(
      screen.getByRole('textbox', { name: 'Title' }),
      'Changed after JSON'
    )
    const payload = await saveBody()
    expect(payload).toMatchObject({
      ...literal,
      title: 'Changed after JSON',
      hero: pin
    })
    expect(JSON.stringify(payload)).toContain('"__proto__":{"literal":true}')
    expect(JSON.stringify(payload)).toContain('"__proto__":"Keep label"')
    expect(Object.hasOwn(Object.prototype, 'literal')).toBe(false)
  })
  it('freezes both editing representations during upload and retains the completed exact pin', async () => {
    setup()
    let finish:
      | ((result: Awaited<ReturnType<typeof editorRequest>>) => void)
      | undefined
    vi.mocked(editorRequest).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    await userEvent.click(screen.getByText('Advanced: complete authored JSON'))
    await userEvent.upload(
      screen.getAllByLabelText('Choose image, video or workflow JSON')[0],
      new File(['png'], 'new.png', { type: 'image/png' })
    )
    await userEvent.click(
      screen.getAllByRole('button', { name: 'Upload as new media' })[0]
    )
    expect(
      screen.getByRole('textbox', { name: 'Complete content document' })
    ).toBeDisabled()
    expect(screen.getByRole('textbox', { name: 'Title' })).toBeDisabled()
    const uploadedVersion = '00000000-0000-4000-8000-000000000003'
    if (!finish) throw new Error('Upload did not start')
    finish({
      ok: true,
      status: 201,
      data: { uid, revision_uid: uploadedVersion }
    })
    await waitFor(() =>
      expect(
        screen.getByRole('textbox', { name: 'Complete content document' })
      ).toBeEnabled()
    )
    const complete = screen.getByRole('textbox', {
      name: 'Complete content document'
    })
    if (!(complete instanceof HTMLTextAreaElement))
      throw new Error('Missing complete-document textarea')
    expect(JSON.parse(complete.value)).toMatchObject({
      ...authored,
      hero: { ...pin, name: 'new.png', file_version_uid: uploadedVersion }
    })
    expect(screen.getByRole('textbox', { name: 'Title' })).toBeEnabled()
  })
  it('retains nested fields and all exact file pins through a title edit and stale response', async () => {
    setup()
    await fireEvent.update(
      screen.getByRole('textbox', { name: 'Title' }),
      'Changed'
    )
    expect(await saveBody()).toMatchObject({ ...authored, title: 'Changed' })
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue(
      'Changed'
    )
    expect(editorRequest).toHaveBeenCalledOnce()
  })
  it('removes one example without modifying the surviving example or its references', async () => {
    setup()
    await userEvent.click(
      screen.getAllByRole('button', { name: 'Remove example' })[0]
    )
    expect(await saveBody()).toMatchObject({
      ...authored,
      examples: [authored.examples[1]]
    })
  })
  it('freezes complete JSON until the invalid child buffer has been repaired on its original row', async () => {
    setup()
    await fireEvent.update(
      screen.getAllByRole('textbox', { name: /Input values \(JSON\)/ })[0],
      '{invalid-a'
    )
    await userEvent.click(screen.getByText('Advanced: complete authored JSON'))
    const complete = screen.getByRole('textbox', {
      name: 'Complete content document'
    })
    expect(complete).toBeDisabled()
    expect(
      screen.getAllByRole('textbox', { name: 'Example title' })[0]
    ).toHaveValue('Example A')
    expect(
      screen.getAllByRole('textbox', { name: /Input values \(JSON\)/ })[0]
    ).toHaveValue('{invalid-a')
    await fireEvent.update(
      screen.getAllByRole('textbox', { name: /Input values \(JSON\)/ })[0],
      JSON.stringify({ prompt: 'repaired a' })
    )
    expect(complete).toBeEnabled()
    const repaired = {
      ...authored,
      examples: [
        { ...authored.examples[0], values: { prompt: 'repaired a' } },
        authored.examples[1]
      ]
    }
    await fireEvent.update(
      complete,
      JSON.stringify({
        ...repaired,
        examples: [...repaired.examples].reverse()
      })
    )
    expect(await saveBody()).toMatchObject({
      ...repaired,
      examples: [...repaired.examples].reverse()
    })
  })
  it('freezes all structured mutations while complete JSON is invalid and keeps repair enabled', async () => {
    setup()
    await userEvent.click(screen.getByText('Advanced: complete authored JSON'))
    await fireEvent.update(
      screen.getByRole('textbox', { name: 'Complete content document' }),
      '{invalid'
    )
    expect(screen.getByRole('textbox', { name: 'Title' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Add example' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Add input' })).toBeDisabled()
    const mutationControls = [
      ...screen.getAllByRole('button', { name: 'Remove example' }),
      ...screen.getAllByRole('button', { name: 'Upload as new media' }),
      ...screen.getAllByRole('button', { name: 'Replace this media UID' })
    ]
    expect(mutationControls).toEqual(
      mutationControls.map(() => expect.toBeDisabled())
    )
    expect(
      screen.getByRole('textbox', { name: /Complete content document/ })
    ).toBeEnabled()
    await fireEvent.update(
      screen.getByRole('textbox', { name: /Complete content document/ }),
      JSON.stringify(authored)
    )
    expect(screen.getByRole('textbox', { name: 'Title' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Add example' })).toBeEnabled()
    expect(await saveBody()).toMatchObject(authored)
  })
})
