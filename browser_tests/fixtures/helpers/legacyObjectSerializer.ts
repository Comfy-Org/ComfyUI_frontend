import type { Page } from '@playwright/test'

export async function installLegacyObjectSerializer(
  page: Page,
  nodeType: string
): Promise<void> {
  await page.evaluate((nodeType) => {
    window.app!.registerExtension({
      name: 'AgentRejectedNodeLegacyObjectSerializer',
      nodeCreated(node) {
        if (node.constructor.comfyClass !== nodeType) return
        node.onSerialize = (data) => {
          const values = data.widgets_values
          Reflect.set(data, 'widgets_values', {
            text: Array.isArray(values) ? values[0] : ''
          })
          delete data.widgets_values_form
        }
      }
    })
  }, nodeType)
}
