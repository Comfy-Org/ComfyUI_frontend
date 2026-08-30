import { describe, expect, it, vi } from 'vitest'

import {
  editorStatusCommandIds,
  invokeEditorStatusCommand
} from './editorStatusCommands'

describe('editorStatusCommands', () => {
  it('invokes a stable VS Code extension status action', () => {
    const editorDocument = document.implementation.createHTMLDocument()
    const statusItem = editorDocument.createElement('div')
    statusItem.id = `comfy.custom-node-tools.${editorStatusCommandIds.submit}`
    statusItem.className = 'statusbar-item'
    const control = editorDocument.createElement('button')
    const click = vi.spyOn(control, 'click')
    control.role = 'button'
    statusItem.append(control)
    editorDocument.body.append(statusItem)

    const invoked = invokeEditorStatusCommand(
      { contentDocument: editorDocument } as HTMLIFrameElement,
      editorStatusCommandIds.submit
    )

    expect(invoked).toBe(true)
    expect(click).toHaveBeenCalledOnce()
  })

  it('reports when the extension action is not ready', () => {
    const editorDocument = document.implementation.createHTMLDocument()

    expect(
      invokeEditorStatusCommand(
        { contentDocument: editorDocument } as HTMLIFrameElement,
        editorStatusCommandIds.validate
      )
    ).toBe(false)
  })

  it('supports editor sessions created before stable status item IDs', () => {
    const editorDocument = document.implementation.createHTMLDocument()
    const statusItem = editorDocument.createElement('div')
    statusItem.id = 'comfy.custom-node-tools.generated-status-item'
    statusItem.className = 'statusbar-item'
    const control = editorDocument.createElement('button')
    const click = vi.spyOn(control, 'click')
    control.role = 'button'
    control.textContent = 'Submit Node'
    statusItem.append(control)
    editorDocument.body.append(statusItem)

    expect(
      invokeEditorStatusCommand(
        { contentDocument: editorDocument } as HTMLIFrameElement,
        editorStatusCommandIds.submit
      )
    ).toBe(true)
    expect(click).toHaveBeenCalledOnce()
  })
})
