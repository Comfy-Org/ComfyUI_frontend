import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import { Topbar } from '@e2e/fixtures/components/Topbar'
import { ComboWidgetHelper } from '@e2e/fixtures/helpers/ComboWidgetHelper'

// Combo widgets in an agent workflow tab paint the red "invalid value" ring
// although every value the agent wrote is a legal option.
// Both repros drive the same agent-CRDT write path (set_widget on a live node,
// then add_node with combo values, then a tab round trip that re-syncs the
// whole document) on two node families, to tell one root cause from two:
// a plain enum combo (KSampler) and the COMFY_DYNAMICCOMBO_V3 model selector
// (Flux2ImageNode), whose widget has its own value setter in dynamicWidgets.ts.
const GENERIC_CASE = 'agent-repro-combo-write-ksampler'
const FLUX2_CASE = 'agent-repro-combo-write-flux2'

test.describe(
  'Agent combo widgets keep no false red ring',
  { tag: ['@cloud', '@agent', '@widget'] },
  () => {
    test.describe('Hypothesis A: plain combo on a core node', () => {
      test.use({ conversationCase: GENERIC_CASE })

      test('agent set_widget, add_node and a tab round trip leave every KSampler combo without an invalid ring', async ({
        agentConversation,
        page
      }, testInfo) => {
        test.fail(
          true,
          'WidgetSelectDefault paints ring-destructive on combos the agent wrote through widgetValueStore.setValue, bypassing the widget callback'
        )
        test.setTimeout(120_000)
        const combos = new ComboWidgetHelper(page)
        const topbar = new Topbar(page)
        const tabs = topbar.workflowTabs.locator('.p-togglebutton')
        const lastTurn = agentConversation.conversation.turns.length - 1

        await test.step('agent writes two combos and adds a node', async () => {
          await agentConversation.runTurns()
          await combos.expectNoFalseRing(testInfo, 'ksampler-after-turns')
        })

        await test.step('user leaves and returns to the tab', async () => {
          const before = agentConversation.subscribeCount()
          await topbar.newWorkflowButton.click()
          await expect(tabs).toHaveCount(2)
          await topbar.getTab(0).click()
          await expect(topbar.getTab(0)).toHaveClass(/p-togglebutton-checked/)
          await expect
            .poll(() => agentConversation.subscribeCount())
            .toBe(before + 1)
          await agentConversation.expectCanvasReplayed(lastTurn)
          await combos.expectNoFalseRing(testInfo, 'ksampler-after-tab-return')
        })
      })
    })

    test.describe('Hypothesis B: dynamic combo on Flux2ImageNode', () => {
      test.use({ conversationCase: FLUX2_CASE })

      test('agent set_widget, add_node and a tab round trip leave every Flux2ImageNode combo without an invalid ring', async ({
        agentConversation,
        page
      }, testInfo) => {
        test.fail(
          true,
          'The Flux2ImageNode model selector shows a red ring after an agent write; same root cause as the KSampler repro only if this fails the same way'
        )
        test.setTimeout(120_000)
        const combos = new ComboWidgetHelper(page)
        const topbar = new Topbar(page)
        const tabs = topbar.workflowTabs.locator('.p-togglebutton')
        const lastTurn = agentConversation.conversation.turns.length - 1

        await test.step('agent switches the model selector and adds a node', async () => {
          await agentConversation.runTurns()
          await combos.expectNoFalseRing(testInfo, 'flux2-after-turns')
        })

        await test.step('user leaves and returns to the tab', async () => {
          const before = agentConversation.subscribeCount()
          await topbar.newWorkflowButton.click()
          await expect(tabs).toHaveCount(2)
          await topbar.getTab(0).click()
          await expect(topbar.getTab(0)).toHaveClass(/p-togglebutton-checked/)
          await expect
            .poll(() => agentConversation.subscribeCount())
            .toBe(before + 1)
          await agentConversation.expectCanvasReplayed(lastTurn)
          await combos.expectNoFalseRing(testInfo, 'flux2-after-tab-return')
        })
      })
    })
  }
)
