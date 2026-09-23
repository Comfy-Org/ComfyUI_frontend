import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import { Topbar } from '@e2e/fixtures/components/Topbar'
import { CanvasHelper } from '@e2e/fixtures/helpers/CanvasHelper'
import { TestIds } from '@e2e/fixtures/selectors'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

// Five wired nodes, one renamed, whose recorded turn sets widget values on
// existing nodes. Returning to the tab re-subscribes the follower, which
// replays the whole saved document over those live nodes.
const EDITED_CASE = 'agent-rec-set-widget-existing'
const PAN = { x: 137, y: -61 }
const EMPTY_CANVAS_SPOT = { x: 1050, y: 1075 }

test.describe(
  'Agent workflow tab switch',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.use({ conversationCase: EDITED_CASE })

    test('shows the edited workflow unchanged after switching away and back with Agent open', async ({
      agentConversation,
      page
    }) => {
      test.setTimeout(90_000)
      const panel = page.getByTestId('docked-agent-panel')
      const topbar = new Topbar(page)
      const canvas = new CanvasHelper(
        page,
        page.locator('#graph-canvas'),
        page.getByRole('button', { name: 'Reset View' })
      )
      const tabs = topbar.workflowTabs.locator('.p-togglebutton')
      const lastTurn = agentConversation.conversation.turns.length - 1

      const widgetRows =
        await test.step('agent edits the workflow', async () => {
          await agentConversation.runTurns()
          const rows = await agentConversation.renderedWidgetRows()
          expect(rows.length).toBeGreaterThan(0)
          return rows
        })

      const viewport = await test.step('user zooms and pans', async () => {
        const restingOffset = await canvas.getOffset()
        await canvas.setScale(0.8)
        await canvas.pan(PAN, EMPTY_CANVAS_SPOT)
        const offset = await canvas.getOffset()
        expect(offset).not.toEqual(restingOffset)
        return { scale: await canvas.getScale(), offset }
      })

      await test.step('user opens a new blank workflow', async () => {
        await expect(tabs).toHaveCount(1)
        await topbar.newWorkflowButton.click()
        await expect(tabs).toHaveCount(2)
        await expect(agentConversation.vueNodes.nodes).toHaveCount(0)
        await expect(topbar.getTab(1)).toHaveClass(/p-togglebutton-checked/)
        await expect(panel).toBeVisible()
      })

      await test.step('user returns to the edited workflow', async () => {
        await topbar.getTab(0).click()
        await expect(topbar.getTab(0)).toHaveClass(/p-togglebutton-checked/)
        await agentConversation.expectCanvasReplayed(lastTurn)
        await expect
          .poll(() => agentConversation.renderedWidgetRows())
          .toEqual(widgetRows)
        expect({
          scale: await canvas.getScale(),
          offset: await canvas.getOffset()
        }).toEqual(viewport)
        await expect(panel).toBeVisible()
      })
    })
  }
)

// Two turns, the second wiring nodes the first added. A second, unrelated
// workflow with its own widget text, Markdown body, and saved viewport opens
// beside it; none of that is in the CRDT host, so a follower that rebuilt the
// canvas from its document would lose it.
const WIRING_CASE = 'agent-rec-two-turn-dependent-edit'
const TAB_B_NAME = 'Tab B'
const TAB_B_PROMPT_ID = 1
const TAB_B_NOTE_ID = 2
const TAB_B_PROMPT = 'tab b prompt'
const TAB_B_VIEWPORT = { scale: 0.8, offset: [-100, -40] as [number, number] }
const TAB_B = {
  last_node_id: 2,
  last_link_id: 0,
  nodes: [
    {
      id: TAB_B_PROMPT_ID,
      type: 'CLIPTextEncode',
      pos: [120, 80],
      size: [400, 200],
      flags: {},
      order: 0,
      mode: 0,
      inputs: [
        { name: 'clip', type: 'CLIP', link: null },
        { name: 'text', type: 'STRING', widget: { name: 'text' }, link: null }
      ],
      outputs: [{ name: 'CONDITIONING', type: 'CONDITIONING', links: [] }],
      properties: {},
      widgets_values: [TAB_B_PROMPT]
    },
    {
      id: TAB_B_NOTE_ID,
      type: 'MarkdownNote',
      pos: [600, 300],
      size: [320, 180],
      flags: {},
      order: 1,
      mode: 0,
      inputs: [],
      outputs: [],
      properties: {},
      widgets_values: ['## Tab B note\n\nkeep me']
    }
  ],
  links: [],
  groups: [],
  config: {},
  extra: { ds: TAB_B_VIEWPORT },
  version: 0.4
} satisfies ComfyWorkflowJSON

test.describe(
  'Agent workflow tab switch between two workflows',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.use({ conversationCase: WIRING_CASE })

    test('preserves each workflow as last shown across two round trips with Agent open', async ({
      agentConversation,
      page
    }) => {
      test.setTimeout(120_000)
      const panel = agentConversation.panel
      const nodes = agentConversation.vueNodes
      const topbar = new Topbar(page)
      const canvas = new CanvasHelper(
        page,
        page.locator('#graph-canvas'),
        page.getByRole('button', { name: 'Reset View' })
      )
      const tabs = topbar.workflowTabs.locator('.p-togglebutton')
      const lastTurn = agentConversation.conversation.turns.length - 1

      const expectViewport = async (viewport: {
        scale: number
        offset: [number, number]
      }) => {
        await expect.poll(() => canvas.getScale()).toBe(viewport.scale)
        await expect.poll(() => canvas.getOffset()).toEqual(viewport.offset)
      }
      const expectTabA = async (viewport: {
        scale: number
        offset: [number, number]
      }) => {
        await agentConversation.expectCanvasReplayed(lastTurn)
        await expectViewport(viewport)
        await expect(panel).toBeVisible()
      }
      const expectTabB = async () => {
        await expect(page.getByTestId('node-title')).toHaveCount(
          TAB_B.nodes.length
        )
        const prompt = nodes.getNodeLocator(String(TAB_B_PROMPT_ID))
        await expect(prompt.getByLabel('text', { exact: true })).toHaveValue(
          TAB_B_PROMPT
        )
        const note = nodes.getNodeLocator(String(TAB_B_NOTE_ID))
        await expect(note.getByLabel('text', { exact: true })).toContainText(
          'Tab B note'
        )
        await expect(note.getByLabel('text', { exact: true })).toContainText(
          'keep me'
        )
        await expectViewport(TAB_B_VIEWPORT)
        await expect(panel).toBeVisible()
      }
      const returnToTabA = async () => {
        const before = agentConversation.subscribeCount()
        await topbar.getTab(0).click()
        await expect(topbar.getTab(0)).toHaveClass(/p-togglebutton-checked/)
        await expect
          .poll(() => agentConversation.subscribeCount())
          .toBe(before + 1)
      }

      const tabAViewport =
        await test.step('agent edits, user zooms and pans', async () => {
          await agentConversation.runTurns()
          await canvas.setScale(1.25)
          await canvas.pan(PAN, EMPTY_CANVAS_SPOT)
          const viewport = {
            scale: await canvas.getScale(),
            offset: await canvas.getOffset()
          }
          await expect(tabs).toHaveCount(1)
          await expectTabA(viewport)
          return viewport
        })

      await test.step('second workflow opens in its own tab', async () => {
        await page.evaluate(
          ({ json, name }) => window.app!.loadGraphData(json, true, true, name),
          { json: TAB_B, name: TAB_B_NAME }
        )
        await expect(tabs).toHaveCount(2)
        await expect(topbar.getActiveTab()).toContainText(TAB_B_NAME)
        await expectTabB()
      })

      await test.step('back to the agent tab', async () => {
        await returnToTabA()
        await expectTabA(tabAViewport)
      })

      await test.step('second round trip', async () => {
        await topbar.getTab(1).click()
        await expectTabB()
        await returnToTabA()
        await expectTabA(tabAViewport)
      })
    })
  }
)

test.describe(
  'Agent tab-return remote apply acceptance',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.use({ conversationCase: EDITED_CASE })

    test('keeps a canvas rename after switching away and back', async ({
      agentConversation,
      page
    }) => {
      test.setTimeout(90_000)
      const customTitle = 'My Custom Sampler'
      const topbar = new Topbar(page)
      await agentConversation.runTurns()
      const sampler =
        await agentConversation.vueNodes.getFixtureByTitle('KSampler')
      await sampler.setTitle(customTitle)
      await expect(sampler.title).toHaveText(customTitle)

      const subscribeCount = agentConversation.subscribeCount()
      await expect(topbar.getTab(1)).toHaveCount(0)
      await topbar.newWorkflowButton.click()
      await expect(topbar.getTab(1)).toHaveCount(1)
      await expect(topbar.getTab(1)).toHaveClass(/p-togglebutton-checked/)
      await topbar.getTab(0).click()
      await expect(topbar.getTab(0)).toHaveClass(/p-togglebutton-checked/)
      await expect
        .poll(() => agentConversation.subscribeCount())
        .toBe(subscribeCount + 1)

      test.fail()
      await expect(sampler.title).toHaveText(customTitle)
    })

    test('keeps a node color after switching away and back', async ({
      agentConversation,
      page
    }) => {
      test.setTimeout(90_000)
      const nodeId = '3'
      const nodes = agentConversation.vueNodes
      const wrapper = nodes.getNodeInnerWrapper(nodeId)
      const topbar = new Topbar(page)
      await agentConversation.runTurns()
      await nodes.selectNode(nodeId)
      const originalBackground = await wrapper.evaluate(
        (element) => getComputedStyle(element).backgroundColor
      )
      await page
        .getByTestId(TestIds.selectionToolbox.colorPickerButton)
        .dispatchEvent('click')
      await page
        .getByTestId(TestIds.selectionToolbox.colorRed)
        .dispatchEvent('click')
      await expect
        .poll(() =>
          wrapper.evaluate(
            (element) => getComputedStyle(element).backgroundColor
          )
        )
        .not.toBe(originalBackground)
      const background = await wrapper.evaluate(
        (element) => getComputedStyle(element).backgroundColor
      )

      const subscribeCount = agentConversation.subscribeCount()
      await expect(topbar.getTab(1)).toHaveCount(0)
      await topbar.newWorkflowButton.click()
      await expect(topbar.getTab(1)).toHaveCount(1)
      await expect(topbar.getTab(1)).toHaveClass(/p-togglebutton-checked/)
      await topbar.getTab(0).click()
      await expect(topbar.getTab(0)).toHaveClass(/p-togglebutton-checked/)
      await expect
        .poll(() => agentConversation.subscribeCount())
        .toBe(subscribeCount + 1)

      await expect(wrapper).toHaveCSS('background-color', background)
    })
  }
)
