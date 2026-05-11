/**
 * PreviewAny — rewritten with the v2 extension API.
 *
 * Compare with previewAny.ts (v1) which uses beforeRegisterNodeDef +
 * prototype patching + manual callback chaining.
 *
 * v1: 90 lines, prototype.onNodeCreated override, prototype.onExecuted override
 * v2: 35 lines, no prototype access, no manual chaining
 */

import { defineNodeExtension } from '@/extension-api'

defineNodeExtension({
  name: 'Comfy.PreviewAny.V2',
  nodeTypes: ['PreviewAny'],

  nodeCreated(node) {
    const markdown = node.addWidget('MARKDOWN', 'preview_markdown', '', {
      hidden: true,
      readonly: true,
      serialize: false,
      label: 'Preview'
    })

    const plaintext = node.addWidget('STRING', 'preview_text', '', {
      multiline: true,
      readonly: true,
      serialize: false,
      label: 'Preview'
    })

    const toggle = node.addWidget('BOOLEAN', 'previewMode', false, {
      labelOn: 'Markdown',
      labelOff: 'Plaintext'
    })

    toggle.on('valueChange', (e) => {
      markdown.setHidden(!e.newValue)
      plaintext.setHidden(e.newValue as boolean)
    })

    node.on('executed', (e) => {
      const text = (e.output['text'] as string | string[]) ?? ''
      const content = Array.isArray(text) ? text.join('\n\n') : text
      markdown.setValue(content)
      plaintext.setValue(content)
    })
  }
})
