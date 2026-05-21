/**
 * PreviewAny — rewritten with the v2 extension API.
 *
 * Compare with previewAny.ts (v1) which uses beforeRegisterNodeDef +
 * prototype patching + manual callback chaining.
 *
 * v1: 90 lines, prototype.onNodeCreated override, prototype.onExecuted override
 * v2: 35 lines, no prototype access, no manual chaining
 */

import {
  defineNode,
  type NodeHandle,
  type NodeExecutedEvent,
  type WidgetValueChangeEvent
} from '@/extension-api'
import { useExtensionStore } from '@/stores/extensionStore'

defineNode({
  name: 'Comfy.PreviewAny.V2',
  nodeTypes: ['PreviewAny'],

  nodeCreated(node: NodeHandle) {
    // RFR-12144-1 strangler-fig guard (D6): v1 + v2 coexist as Phase A demos,
    // but only one path runs per node. v1 adds the same three widgets via
    // beforeRegisterNodeDef + onNodeCreated patching, so if v1 is registered
    // we no-op to avoid duplicate widgets on the node.
    if (useExtensionStore().isExtensionInstalled('Comfy.PreviewAny')) return

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

    toggle.on('valueChange', (e: WidgetValueChangeEvent) => {
      markdown.setHidden(!e.newValue)
      plaintext.setHidden(e.newValue as boolean)
    })

    node.on('executed', (e: NodeExecutedEvent) => {
      const text = (e.output['text'] as string | string[]) ?? ''
      const content = Array.isArray(text) ? text.join('\n\n') : text
      markdown.setValue(content)
      plaintext.setValue(content)
    })
  }
})
