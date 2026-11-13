import { reportError } from '@comfyorg/telemetry/reportError'
import { render } from '@testing-library/vue'
import { assert, describe, expect, it, vi } from 'vitest'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import type { DialogDef } from '@/platform/nodeApi/v4/types'
import { useDialogStore } from '@/stores/dialogStore'

function uiApi() {
  return createComfyApi({ getGraph: () => null }).comfy.ui
}

function dialog(overrides: Partial<DialogDef> = {}): DialogDef {
  return {
    key: 'MyPack.settings',
    title: 'My settings',
    render: vi.fn((container: HTMLElement) => {
      container.textContent = 'pack form'
    }),
    destroy: vi.fn(),
    ...overrides
  }
}

function openDialog(key: string) {
  const found = useDialogStore().dialogStack.find((entry) => entry.key === key)
  assert(found, `no dialog ${key}`)
  return found
}

function showContent(key: string) {
  const { component, contentProps } = openDialog(key)
  return render(component, { props: contentProps })
}

async function openPrompt() {
  return vi.waitFor(() => openDialog('global-prompt'))
}

describe('dialogs', () => {
  it('opens a dialog under the extension key and renders the pack content', () => {
    const definition = dialog()
    uiApi().showDialog(definition)

    const shown = showContent('extension-MyPack.settings')

    expect(openDialog('extension-MyPack.settings').title).toBe('My settings')
    expect(shown.container.textContent).toBe('pack form')
    expect(definition.render).toHaveBeenCalledOnce()
  })

  it('closes the dialog, calling destroy once when its content goes', () => {
    const definition = dialog()
    const handle = uiApi().showDialog(definition)
    const shown = showContent('extension-MyPack.settings')

    handle.close()
    shown.unmount()
    handle.close()

    expect(useDialogStore().dialogStack).toEqual([])
    expect(definition.destroy).toHaveBeenCalledOnce()
  })

  it('raises the dialog already open under the key instead of opening another', () => {
    const ui = uiApi()
    const first = dialog()
    const second = dialog({ title: 'Second' })
    ui.showDialog(first)

    const handle = ui.showDialog(second)
    showContent('extension-MyPack.settings')
    handle.close()

    expect(first.render).toHaveBeenCalledOnce()
    expect(second.render).not.toHaveBeenCalled()
    expect(useDialogStore().dialogStack).toEqual([])
  })

  it('leaves a later dialog under the same key open when an old handle closes', () => {
    const ui = uiApi()
    const old = ui.showDialog(dialog())
    old.close()
    ui.showDialog(dialog({ title: 'Later' }))

    old.close()

    expect(openDialog('extension-MyPack.settings').title).toBe('Later')
  })

  it('reports a render that throws, and keeps the dialog open', () => {
    const broken = new Error('pack render failed')
    uiApi().showDialog(
      dialog({
        render: () => {
          throw broken
        }
      })
    )

    showContent('extension-MyPack.settings')

    expect(reportError).toHaveBeenCalledExactlyOnceWith(
      broken,
      expect.objectContaining({ tags: { event: 'ui.showDialog' } })
    )
    expect(useDialogStore().dialogStack).toHaveLength(1)
  })

  it.for([
    { name: 'no dialog', value: 'MyPack.settings', needs: 'a dialog' },
    {
      name: 'an empty key',
      value: dialog({ key: '' }),
      needs: 'key as a non-empty string'
    },
    {
      name: 'a title that is not text',
      value: { ...dialog(), title: 3 },
      needs: 'title as a string'
    },
    {
      name: 'no render function',
      value: { ...dialog(), render: undefined },
      needs: 'render as a function'
    }
  ])('refuses $name, and opens nothing', ({ value, needs }) => {
    const ui = uiApi()

    expect(() => Reflect.apply(ui.showDialog, ui, [value])).toThrow(
      expect.objectContaining({
        message: expect.stringContaining(`ui.showDialog needs ${needs}, not `)
      })
    )
    expect(useDialogStore().dialogStack).toEqual([])
  })
})

describe('prompts', () => {
  it('asks the user with the host prompt and resolves what they enter', async () => {
    const answer = uiApi().prompt({
      label: 'Strength',
      value: '0.5',
      placeholder: 'A number'
    })

    const shown = await openPrompt()
    expect(shown.title).toBe('Strength')
    expect(shown.contentProps).toMatchObject({
      message: 'Strength',
      defaultValue: '0.5',
      placeholder: 'A number'
    })
    const { onConfirm } = shown.contentProps
    assert(typeof onConfirm === 'function')
    onConfirm('0.8')
    useDialogStore().closeDialog({ key: 'global-prompt' })

    expect(await answer).toBe('0.8')
  })

  it('resolves undefined when the user cancels', async () => {
    const answer = uiApi().prompt({ label: 'Strength' })

    await openPrompt()
    useDialogStore().closeDialog({ key: 'global-prompt' })

    expect(await answer).toBeUndefined()
  })

  it.for([
    { name: 'no prompt', value: 'Strength', needs: 'a prompt' },
    {
      name: 'an empty label',
      value: { label: '' },
      needs: 'label as a non-empty string'
    },
    {
      name: 'a starting value that is not text',
      value: { label: 'x', value: 1 },
      needs: 'value as a string'
    },
    {
      name: 'a placeholder that is not text',
      value: { label: 'x', placeholder: [] },
      needs: 'placeholder as a string'
    }
  ])('refuses $name, and asks nothing', async ({ value, needs }) => {
    const ui = uiApi()

    expect(() => Reflect.apply(ui.prompt, ui, [value])).toThrow(
      expect.objectContaining({
        message: expect.stringContaining(`ui.prompt needs ${needs}, not `)
      })
    )
    const next = ui.prompt({ label: 'Asked next' })
    expect((await openPrompt()).title).toBe('Asked next')
    useDialogStore().closeDialog({ key: 'global-prompt' })
    await next
  })
})
