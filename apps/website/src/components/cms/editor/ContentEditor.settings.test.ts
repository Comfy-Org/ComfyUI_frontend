import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import ContentEditor from './ContentEditor.vue'
import { editorRequest } from '@/lib/cms/editor-client'
import { blankDocument, editorSnapshot } from '@/lib/cms/editor-document'

vi.mock(import('@/lib/cms/editor-client'))
const uid = '00000000-0000-4000-8000-000000000001'
const version = '00000000-0000-4000-8000-000000000002'
const definition = { help: '', hidden: false, advanced: false }
const authored = {
  ...blankDocument(),
  title: 'Settings fixture',
  slug: 'settings-fixture',
  inputs: {
    width: {
      ...definition,
      label: 'Width',
      control: 'number',
      unit: 'pixels',
      'x-retain': { nested: true }
    },
    quality: {
      ...definition,
      label: 'Quality',
      control: 'dropdown',
      optionLabels: {
        '0': 'Zero',
        false: 'Off',
        high: 'High',
        unrelated: 'Keep'
      }
    }
  },
  inputSchema: {
    type: 'object',
    required: ['width'],
    properties: {
      width: {
        type: 'number',
        minimum: 0,
        maximum: 10,
        default: 0,
        multipleOf: 0.5,
        'x-retain': ['keep', false, 7]
      },
      quality: { enum: [false, 0, 'high'], default: false }
    }
  },
  inputBindings: { width: { node: '7', input: 'width' } },
  examples: [{ title: 'Keep example', values: { width: 0, quality: false } }],
  hero: { src: 'r2', id: uid, file_version_uid: version }
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
async function savedBody() {
  await fireEvent.click(
    screen.getAllByRole('button', { name: 'Save changes' })[0]
  )
  await waitFor(() => expect(editorRequest).toHaveBeenCalledOnce())
  return JSON.parse(String(vi.mocked(editorRequest).mock.calls[0][1]?.body))
}
describe('input settings in the complete content form', () => {
  it('keeps incomplete settings repairable while blocking Save and alternate replacement', async () => {
    setup()
    await fireEvent.click(screen.getByText('Advanced: complete authored JSON'))
    await fireEvent.update(
      screen.getByRole('textbox', { name: 'Maximum' }),
      '1e'
    )
    expect(screen.getByRole('textbox', { name: 'Maximum' })).toHaveValue('1e')
    expect(screen.getByRole('textbox', { name: 'Maximum' })).toBeEnabled()
    expect(screen.getAllByRole('button', { name: 'Save changes' })).toEqual(
      screen
        .getAllByRole('button', { name: 'Save changes' })
        .map(() => expect.toBeDisabled())
    )
    expect(
      screen.getByRole('textbox', { name: 'Complete content document' })
    ).toBeDisabled()
    expect(screen.getAllByRole('textbox', { name: 'Label' })[0]).toBeDisabled()
    expect(
      screen.getAllByRole('textbox', { name: 'Parameter JSON schema' })[0]
    ).toBeDisabled()
    expect(editorRequest).not.toHaveBeenCalled()
    await fireEvent.update(
      screen.getByRole('textbox', { name: 'Maximum' }),
      '20'
    )
    expect(
      screen.getByRole('textbox', { name: 'Complete content document' })
    ).toBeEnabled()
    const payload = await savedBody()
    expect(payload).toMatchObject({
      ...authored,
      inputSchema: {
        properties: {
          ...authored.inputSchema.properties,
          width: { ...authored.inputSchema.properties.width, maximum: 20 }
        }
      },
      expected_draft_rev: 7,
      expected_revision_uid: version
    })
  })
  it('preserves exact typed dropdown values/defaults and unrelated metadata through reorder and label changes', async () => {
    setup()
    await fireEvent.click(
      screen.getAllByRole('button', { name: 'Move option down' })[0]
    )
    await fireEvent.update(
      screen.getAllByRole('textbox', { name: 'Display label (optional)' })[0],
      'Exactly zero'
    )
    expect(await savedBody()).toMatchObject({
      ...authored,
      inputs: {
        ...authored.inputs,
        quality: {
          ...authored.inputs.quality,
          optionLabels: {
            ...authored.inputs.quality.optionLabels,
            '0': 'Exactly zero'
          }
        }
      },
      inputSchema: {
        ...authored.inputSchema,
        properties: {
          ...authored.inputSchema.properties,
          quality: { enum: [0, false, 'high'], default: false }
        }
      }
    })
  })
  it('clears only the deliberately removed row validity while retaining bindings and example intent', async () => {
    setup()
    await fireEvent.update(
      screen.getByRole('textbox', { name: 'Maximum' }),
      '-'
    )
    await fireEvent.click(
      screen.getByRole('button', { name: 'Remove input width' })
    )
    expect(
      screen.queryByRole('textbox', { name: 'Maximum' })
    ).not.toBeInTheDocument()
    expect(await savedBody()).toMatchObject({
      inputs: { quality: authored.inputs.quality },
      inputSchema: {
        required: [],
        properties: { quality: authored.inputSchema.properties.quality }
      },
      inputBindings: authored.inputBindings,
      examples: authored.examples,
      hero: authored.hero
    })
  })
  it('freezes numeric/settings mutation during invalid complete JSON and restores controls on repair', async () => {
    setup()
    await fireEvent.click(screen.getByText('Advanced: complete authored JSON'))
    const complete = screen.getByRole('textbox', {
      name: 'Complete content document'
    })
    await fireEvent.update(complete, '{invalid')
    expect(screen.getByRole('textbox', { name: 'Maximum' })).toBeDisabled()
    await fireEvent.update(
      screen.getByRole('textbox', { name: 'Maximum' }),
      '50'
    )
    await fireEvent.update(complete, JSON.stringify(authored))
    expect(screen.getByRole('textbox', { name: 'Maximum' })).toBeEnabled()
    expect(screen.getByRole('textbox', { name: 'Maximum' })).toHaveValue('10')
    expect(await savedBody()).toMatchObject(authored)
  })
  it('retains invalid schema JSON while structured settings stay frozen until repair', async () => {
    setup()
    const widthSchema = screen.getAllByRole('textbox', {
      name: 'Parameter JSON schema'
    })[0]
    await fireEvent.update(widthSchema, '{bad')
    expect(screen.getByRole('textbox', { name: 'Maximum' })).toBeDisabled()
    expect(
      screen.getAllByRole('textbox', { name: 'Presentation settings' })[0]
    ).toBeDisabled()
    const repaired = { ...authored.inputSchema.properties.width, maximum: 30 }
    await fireEvent.update(widthSchema, JSON.stringify(repaired))
    expect(screen.getByRole('textbox', { name: 'Maximum' })).toBeEnabled()
    expect(screen.getByRole('textbox', { name: 'Maximum' })).toHaveValue('30')
    expect(await savedBody()).toMatchObject({
      inputSchema: { properties: { width: repaired } }
    })
  })
})
