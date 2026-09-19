import { describe, expect, it } from 'vitest'

import { shouldIgnoreCopyPaste } from '@/workbench/eventHelpers'

describe('shouldIgnoreCopyPaste', () => {
  it('returns true for a textarea target', () => {
    const textarea = document.createElement('textarea')

    expect(shouldIgnoreCopyPaste(textarea)).toBe(true)
  })

  it('returns true for a text input target', () => {
    const input = document.createElement('input')
    input.type = 'text'

    expect(shouldIgnoreCopyPaste(input)).toBe(true)
  })

  it.fails('KNOWN BUG: returns true for a focused contenteditable target', () => {
    // The agent composer (InlinePromptEditor.vue) mounts a ProseMirror
    // EditorView on a contenteditable div, not a textarea/input. Paste
    // events targeting it should be left to native/ProseMirror handling,
    // the same as a textarea or text input, instead of falling through to
    // the canvas's node-clipboard paste.
    const composer = document.createElement('div')
    composer.contentEditable = 'true'

    expect(shouldIgnoreCopyPaste(composer)).toBe(true)
  })
})
