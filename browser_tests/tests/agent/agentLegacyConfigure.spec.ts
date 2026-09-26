import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

test.describe(
  'Agent legacy node configuration',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.use({ conversationCase: 'agent-rec-two-turn-dependent-edit' })

    test('keeps legacy and named widget values available to onConfigure', async ({
      agentConversation,
      page
    }) => {
      test.setTimeout(90_000)

      await page.evaluate(() => {
        const nodeType = window.LiteGraph!.registered_node_types.CLIPTextEncode
        const originalOnConfigure = nodeType.prototype.onConfigure
        nodeType.prototype.onConfigure = function (info) {
          originalOnConfigure?.call(this, info)
          if (String(this.id) !== '3337990138003756') return

          const legacy: unknown = Reflect.get(info, 'widgets_values')
          const named: unknown = Reflect.get(info, 'widgets_values_named')
          window.widgetValue = {
            legacy:
              Array.isArray(legacy) && legacy.length > 0
                ? legacy[0]
                : typeof legacy === 'object' && legacy !== null
                  ? Reflect.get(legacy, 'text')
                  : undefined,
            named:
              typeof named === 'object' && named !== null
                ? Reflect.get(named, 'text')
                : undefined
          }
        }
      })

      await agentConversation.runTurns()

      await expect
        .poll(() => page.evaluate(() => window.widgetValue))
        .toEqual({
          legacy: 'blurry, low quality',
          named: 'blurry, low quality'
        })
    })
  }
)
