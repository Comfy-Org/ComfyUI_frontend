import { expect } from '@playwright/test'

import type { ComfyPage } from '../fixtures/ComfyPage'
import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe('Dynamic Combo Widgets in Subgraphs', () => {
  const TEST_NODE_TYPE = 'DevToolsDynamicComboNode'

  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.setSetting('Comfy.Workflow.WorkflowTabsPosition', 'Topbar')
    await comfyPage.setSetting('Comfy.ConfirmClear', false)
  })

  function subgraphWidgetName(widgetName: string): string {
    return `1: ${widgetName}`
  }

  function widget(name: string, visible: boolean, value: unknown) {
    return {
      name: subgraphWidgetName(name),
      visible,
      value
    }
  }

  async function clearGraph(comfyPage: ComfyPage) {
    await comfyPage.executeCommand('Comfy.ClearWorkflow')
    await comfyPage.nextFrame()
  }

  async function getSubgraphNode(comfyPage: ComfyPage) {
    const nodes = await comfyPage.getNodeRefsByTitle('New Subgraph')
    return nodes[0]
  }

  async function createTestNodeAsSubgraph(
    comfyPage: ComfyPage,
    mode: 'none' | 'one' | 'two' | 'three' = 'none'
  ) {
    const testNode = await comfyPage.createNode(TEST_NODE_TYPE)

    if (mode !== 'none') {
      const widget = await testNode.getWidgetByName('dynamic_combo')
      if (widget) await widget.setValue(mode)
    }

    await testNode.click('title')
    await comfyPage.nextFrame()

    return await testNode.convertToSubgraph()
  }

  test('Promoted dynamic combo promotes all children with it', async ({
    comfyPage
  }) => {
    await clearGraph(comfyPage)

    const subgraphNode = await createTestNodeAsSubgraph(comfyPage, 'two')

    await subgraphNode.click('title')
    await comfyPage.nextFrame()
    await comfyPage.menu.propertiesPanel.promoteWidget('dynamic_combo')

    expect(await subgraphNode.getWidgets()).toEqual([
      widget('dynamic_combo', true, 'two'),
      widget('dynamic_combo.w1', true, 0),
      widget('dynamic_combo.w2', true, 0)
    ])
  })

  test('Demoted dynamic combo unpromotes all children with it', async ({
    comfyPage
  }) => {
    await clearGraph(comfyPage)

    const subgraphNode = await createTestNodeAsSubgraph(comfyPage, 'two')

    await subgraphNode.click('title')
    await comfyPage.nextFrame()
    await comfyPage.menu.propertiesPanel.promoteWidget('dynamic_combo')

    expect(await subgraphNode.getWidgets()).toEqual([
      widget('dynamic_combo', true, 'two'),
      widget('dynamic_combo.w1', true, 0),
      widget('dynamic_combo.w2', true, 0)
    ])

    await comfyPage.menu.propertiesPanel.demoteWidget('dynamic_combo')

    const widgets = await subgraphNode.getWidgets()
    const visibleWidgets = widgets.filter((w) => w.visible)
    expect(visibleWidgets).toEqual([])
  })

  test('Promoted combo widgets hide and show based on combo value', async ({
    comfyPage
  }) => {
    await clearGraph(comfyPage)

    const subgraphNode = await createTestNodeAsSubgraph(comfyPage, 'none')

    await subgraphNode.click('title')
    await comfyPage.nextFrame()
    await comfyPage.menu.propertiesPanel.promoteWidget('dynamic_combo')

    expect(await subgraphNode.getWidgets()).toEqual([
      widget('dynamic_combo', true, 'none')
    ])

    const comboWidget = await subgraphNode.getWidgetByName(
      subgraphWidgetName('dynamic_combo')
    )

    await comboWidget!.setValue('one')
    expect(await subgraphNode.getWidgets()).toEqual([
      widget('dynamic_combo', true, 'one'),
      widget('dynamic_combo.w1', true, 0)
    ])

    await comboWidget!.setValue('two')
    expect(await subgraphNode.getWidgets()).toEqual([
      widget('dynamic_combo', true, 'two'),
      widget('dynamic_combo.w1', true, 0),
      widget('dynamic_combo.w2', true, 0)
    ])

    await comboWidget!.setValue('three')
    expect(await subgraphNode.getWidgets()).toEqual([
      widget('dynamic_combo', true, 'three'),
      widget('dynamic_combo.w1', true, 0),
      widget('dynamic_combo.w2', true, 0),
      widget('dynamic_combo.w3', true, 0)
    ])

    await comboWidget!.setValue('two')
    expect(await subgraphNode.getWidgets()).toEqual([
      widget('dynamic_combo', true, 'two'),
      widget('dynamic_combo.w1', true, 0),
      widget('dynamic_combo.w2', true, 0),
      widget('dynamic_combo.w3', false, undefined)
    ])

    await comboWidget!.setValue('one')
    expect(await subgraphNode.getWidgets()).toEqual([
      widget('dynamic_combo', true, 'one'),
      widget('dynamic_combo.w1', true, 0),
      widget('dynamic_combo.w2', false, undefined),
      widget('dynamic_combo.w3', false, undefined)
    ])

    await comboWidget!.setValue('none')
    expect(await subgraphNode.getWidgets()).toEqual([
      widget('dynamic_combo', true, 'none'),
      widget('dynamic_combo.w1', false, undefined),
      widget('dynamic_combo.w2', false, undefined),
      widget('dynamic_combo.w3', false, undefined)
    ])
  })

  test('Promoted combo maintains state after workflow reload', async ({
    comfyPage
  }) => {
    await clearGraph(comfyPage)

    const subgraphNode = await createTestNodeAsSubgraph(comfyPage, 'two')

    await subgraphNode.click('title')
    await comfyPage.nextFrame()

    await comfyPage.menu.propertiesPanel.promoteWidget('dynamic_combo')

    const w1 = await subgraphNode.getWidgetByName(
      subgraphWidgetName('dynamic_combo.w1')
    )
    const w2 = await subgraphNode.getWidgetByName(
      subgraphWidgetName('dynamic_combo.w2')
    )
    await w1!.setValue(123)
    await w2!.setValue(456)

    expect(await subgraphNode.getWidgets()).toEqual([
      widget('dynamic_combo', true, 'two'),
      widget('dynamic_combo.w1', true, 123),
      widget('dynamic_combo.w2', true, 456)
    ])

    // Click on node to ensure changes are committed before switching
    await subgraphNode.click('title')
    await comfyPage.nextFrame()

    await comfyPage.executeCommand('Comfy.NewBlankWorkflow')
    await comfyPage.nextFrame()
    await comfyPage.menu.topbar.switchToTab(0)
    await comfyPage.nextFrame()

    const reloadedSubgraph = await getSubgraphNode(comfyPage)
    expect(await reloadedSubgraph.getWidgets()).toEqual([
      widget('dynamic_combo', true, 'two'),
      widget('dynamic_combo.w1', true, 123),
      widget('dynamic_combo.w2', true, 456)
    ])
  })

  test('Hidden children remain hidden after workflow reload when combo is none', async ({
    comfyPage
  }) => {
    await clearGraph(comfyPage)

    const subgraphNode = await createTestNodeAsSubgraph(comfyPage, 'two')

    await subgraphNode.click('title')
    await comfyPage.nextFrame()
    await comfyPage.menu.propertiesPanel.promoteWidget('dynamic_combo')

    const comboWidget = await subgraphNode.getWidgetByName(
      subgraphWidgetName('dynamic_combo')
    )
    await comboWidget!.setValue('none')

    expect(await subgraphNode.getWidgets()).toEqual([
      widget('dynamic_combo', true, 'none'),
      widget('dynamic_combo.w1', false, undefined),
      widget('dynamic_combo.w2', false, undefined)
    ])

    // Click on node to ensure changes are committed before switching
    await subgraphNode.click('title')
    await comfyPage.nextFrame()

    await comfyPage.executeCommand('Comfy.NewBlankWorkflow')
    await comfyPage.nextFrame()
    await comfyPage.menu.topbar.switchToTab(0)
    await comfyPage.nextFrame()

    const reloadedSubgraph = await getSubgraphNode(comfyPage)
    expect(await reloadedSubgraph.getWidgets()).toEqual([
      widget('dynamic_combo', true, 'none'),
      widget('dynamic_combo.w1', false, undefined),
      widget('dynamic_combo.w2', false, undefined)
    ])
  })

  test('Children appear when combo changes after workflow reload', async ({
    comfyPage
  }) => {
    await clearGraph(comfyPage)

    const subgraphNode = await createTestNodeAsSubgraph(comfyPage, 'none')

    await subgraphNode.click('title')
    await comfyPage.nextFrame()
    await comfyPage.menu.propertiesPanel.promoteWidget('dynamic_combo')

    expect(await subgraphNode.getWidgets()).toEqual([
      widget('dynamic_combo', true, 'none')
    ])

    await comfyPage.executeCommand('Comfy.NewBlankWorkflow')
    await comfyPage.nextFrame()
    await comfyPage.menu.topbar.switchToTab(0)
    await comfyPage.nextFrame()

    const reloadedSubgraph = await getSubgraphNode(comfyPage)
    const comboWidget = await reloadedSubgraph.getWidgetByName(
      subgraphWidgetName('dynamic_combo')
    )
    await comboWidget!.setValue('two')
    await comfyPage.page.waitForTimeout(500)

    expect(await reloadedSubgraph.getWidgets()).toEqual([
      widget('dynamic_combo', true, 'two'),
      widget('dynamic_combo.w1', true, 0),
      widget('dynamic_combo.w2', true, 0)
    ])
  })

  test('Dynamic combo children created inside subgraph are auto-promoted', async ({
    comfyPage
  }) => {
    await clearGraph(comfyPage)

    const testNode = await comfyPage.createNode(TEST_NODE_TYPE)
    await testNode.click('title')
    await comfyPage.nextFrame()

    const subgraphNode = await testNode.convertToSubgraph()
    await comfyPage.page.waitForTimeout(500)

    await subgraphNode.click('title')
    await comfyPage.nextFrame()
    await comfyPage.menu.propertiesPanel.promoteWidget('dynamic_combo')

    expect(await subgraphNode.getWidgets()).toEqual([
      widget('dynamic_combo', true, 'none')
    ])

    await subgraphNode.click('subgraph')
    await expect
      .poll(() => comfyPage.isInSubgraph(), { timeout: 5000 })
      .toBe(true)

    const innerNodes = await comfyPage.getNodeRefsByType(TEST_NODE_TYPE, true)
    const innerNode = innerNodes[0]
    const innerComboWidget = await innerNode.getWidgetByName(
      'dynamic_combo',
      true
    )
    await innerComboWidget!.setValue('two', true)

    await comfyPage.page.keyboard.press('Escape')
    await comfyPage.nextFrame()
    expect(await comfyPage.isInSubgraph()).toBe(false)

    const outerSubgraph = await getSubgraphNode(comfyPage)
    expect(await outerSubgraph.getWidgets()).toEqual([
      widget('dynamic_combo', true, 'two'),
      widget('dynamic_combo.w1', true, 0),
      widget('dynamic_combo.w2', true, 0)
    ])
  })
})
