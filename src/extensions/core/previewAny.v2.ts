/**
 * PreviewAny — rewritten with the v2 extension API.
 *
 * Compare with previewAny.ts (v1) which uses beforeRegisterNodeDef +
 * prototype patching + manual callback chaining.
 *
 * v1: 90 lines, prototype.onNodeCreated override, prototype.onExecuted override
 * v2: 35 lines, no prototype access, no manual chaining
 */

import { defineNodeExtension } from '@/services/extensionV2Service'

defineNodeExtension({
  name: 'Comfy.PreviewAny.V2',
  nodeTypes: ['PreviewAny'],

  nodeCreated(node) {
    const markdown = node.addWidget('MARKDOWN', 'preview_markdown', '', {
      hidden: true,
      readonly: true,
      serialize: false
    })
    markdown.setLabel('Preview')

    const plaintext = node.addWidget('STRING', 'preview_text', '', {
      multiline: true,
      readonly: true,
      serialize: false
    })
    plaintext.setLabel('Preview')

    const toggle = node.addWidget('BOOLEAN', 'previewMode', false, {
      labelOn: 'Markdown',
      labelOff: 'Plaintext'
    })

    toggle.on('change', (value) => {
      markdown.setHidden(!value)
      plaintext.setHidden(value as boolean)
    })

    node.on('executed', (output) => {
      const text = (output.text as string | string[]) ?? ''
      const content = Array.isArray(text) ? text.join('\n\n') : text
      markdown.setValue(content)
      plaintext.setValue(content)
    })
  }
})
