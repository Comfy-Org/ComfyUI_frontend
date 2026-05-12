import { readFileSync } from 'fs'

import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyExpect, comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { SubgraphHelper } from '@e2e/fixtures/helpers/SubgraphHelper'
import { TestIds } from '@e2e/fixtures/selectors'
import { assetPath } from '@e2e/fixtures/utils/paths'
import type { PromotedWidgetEntry } from '@e2e/fixtures/utils/promotedWidgets'
import {
  getPromotedWidgetCount,
  getPromotedWidgetNames,
  getPromotedWidgets
} from '@e2e/fixtures/utils/promotedWidgets'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

const DUPLICATE_IDS_WORKFLOW = 'subgraphs/subgraph-nested-duplicate-ids'
const LEGACY_PREFIXED_WORKFLOW =
  'subgraphs/nested-subgraph-legacy-prefixed-proxy-widgets'

interface MutableWorkflowNode {
  id: number
  pos?: [number, number]
  widgets_values?: unknown[]
  properties?: Record<string, unknown>
}

type MutableWorkflow = ComfyWorkflowJSON & {
  last_node_id: number
  nodes: MutableWorkflowNode[]
}

interface HostWidgetSnapshot {
  name: string
  sourceNodeId: string | null
  sourceWidgetName: string | null
  value: unknown
}

interface PrimitiveFanoutSnapshot {
  hostWidgetNames: string[]
  hostWidgetValues: HostWidgetSnapshot[]
  interiorWidgetValues: unknown[]
  primitiveOutputLinks: unknown
  primitiveOriginLinkCount: number
  serializedProperties: Record<string, unknown>
}

function loadPrimitiveFanoutWorkflow(): MutableWorkflow {
  return JSON.parse(
    readFileSync(
      assetPath('subgraphs/subgraph-with-link-and-proxied-primitive.json'),
      'utf-8'
    )
  ) as MutableWorkflow
}

function createPrimitiveFanoutMultiHostWorkflow(): ComfyWorkflowJSON {
  const workflow = loadPrimitiveFanoutWorkflow()
  const original = workflow.nodes.find((node) => node.id === 2)
  if (!original) throw new Error('Primitive fanout fixture is missing host 2')

  original.widgets_values = ['first-host', 11]
  const clone = structuredClone(original)
  clone.id = 12
  clone.pos = [900, 409]
  clone.widgets_values = ['second-host', 22]
  workflow.nodes.push(clone)
  workflow.last_node_id = Math.max(workflow.last_node_id, clone.id)

  return workflow
}

function createUnresolvableProxyWorkflow(): ComfyWorkflowJSON {
  const workflow = loadPrimitiveFanoutWorkflow()
  const host = workflow.nodes.find((node) => node.id === 2)
  if (!host) throw new Error('Primitive fanout fixture is missing host 2')

  host.properties = {
    ...host.properties,
    proxyWidgets: [['9999', 'missing_widget']]
  }
  host.widgets_values = ['quarantined-host-value']

  return workflow
}

async function getPrimitiveFanoutSnapshot(
  comfyPage: ComfyPage,
  hostNodeId: string
): Promise<PrimitiveFanoutSnapshot> {
  return comfyPage.page.evaluate((id) => {
    const graph = window.app!.canvas.graph!
    const hostNode = graph.getNodeById(Number(id))
    if (!hostNode?.isSubgraphNode?.()) {
      throw new Error(`Host node ${id} is not a SubgraphNode`)
    }

    const primitiveNode = hostNode.subgraph.getNodeById(4)
    const primitiveOriginLinkCount = [
      ...hostNode.subgraph._links.values()
    ].filter((link) => link.origin_id === 4).length
    const serialized = window.app!.graph!.serialize()
    const serializedNode = serialized.nodes.find(
      (candidate) => String(candidate.id) === String(id)
    )

    return {
      hostWidgetNames: (hostNode.widgets ?? []).map((widget) => widget.name),
      hostWidgetValues: (hostNode.widgets ?? []).map((widget) => ({
        name: widget.name,
        sourceNodeId:
          'sourceNodeId' in widget && typeof widget.sourceNodeId === 'string'
            ? widget.sourceNodeId
            : null,
        sourceWidgetName:
          'sourceWidgetName' in widget &&
          typeof widget.sourceWidgetName === 'string'
            ? widget.sourceWidgetName
            : null,
        value: widget.value
      })),
      interiorWidgetValues: hostNode.subgraph._nodes.flatMap((node) =>
        (node.widgets ?? []).map((widget) => widget.value)
      ),
      primitiveOutputLinks: primitiveNode?.outputs?.[0]?.links ?? null,
      primitiveOriginLinkCount,
      serializedProperties: serializedNode?.properties ?? {}
    }
  }, hostNodeId)
}

async function getSerializedSubgraphNodeProperties(
  comfyPage: ComfyPage,
  hostNodeId: string
): Promise<Record<string, unknown>> {
  return comfyPage.page.evaluate((id) => {
    const serialized = window.app!.graph!.serialize()
    const node = serialized.nodes.find(
      (candidate) => String(candidate.id) === String(id)
    )
    return node?.properties ?? {}
  }, hostNodeId)
}

async function expectPromotedWidgetsToResolveToInteriorNodes(
  comfyPage: ComfyPage,
  hostSubgraphNodeId: string,
  widgets: PromotedWidgetEntry[]
) {
  expect(widgets.length).toBeGreaterThan(0)

  const interiorNodeIds = widgets.map(([id]) => id)
  const results = await comfyPage.page.evaluate(
    ([hostId, ids]) => {
      const graph = window.app!.graph!
      const hostNode = graph.getNodeById(Number(hostId))
      if (!hostNode?.isSubgraphNode()) return ids.map(() => false)

      return ids.map((id) => {
        const interiorNode = hostNode.subgraph.getNodeById(Number(id))
        return interiorNode !== null && interiorNode !== undefined
      })
    },
    [hostSubgraphNodeId, interiorNodeIds] as const
  )

  expect(results).toEqual(widgets.map(() => true))
}

test.describe('Subgraph Serialization', { tag: ['@subgraph'] }, () => {
  test('Legacy primitive proxy widgets migrate to host inputs without proxyWidgets round-trip', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow(
      'subgraphs/subgraph-with-link-and-proxied-primitive'
    )

    await expect
      .poll(() => getPromotedWidgetCount(comfyPage, '2'))
      .toBeGreaterThan(1)

    const beforeReload = await getPrimitiveFanoutSnapshot(comfyPage, '2')
    expect(beforeReload.hostWidgetNames).toContain('value')
    expect(beforeReload.primitiveOriginLinkCount).toBe(0)
    expect(beforeReload.primitiveOutputLinks ?? []).toEqual([])
    expect(beforeReload.serializedProperties).not.toHaveProperty('proxyWidgets')
    expect(beforeReload.serializedProperties).not.toHaveProperty(
      'proxyWidgetErrorQuarantine'
    )

    await comfyPage.subgraph.serializeAndReload()

    const afterReload = await getPrimitiveFanoutSnapshot(comfyPage, '2')
    expect(afterReload.interiorWidgetValues).toEqual(
      beforeReload.interiorWidgetValues
    )
    expect(
      afterReload.hostWidgetValues.find((widget) => widget.sourceNodeId === '1')
        ?.value
    ).toBe(
      beforeReload.hostWidgetValues.find(
        (widget) => widget.sourceNodeId === '1'
      )?.value
    )
    expect(afterReload.primitiveOriginLinkCount).toBe(0)
    expect(afterReload.serializedProperties).not.toHaveProperty('proxyWidgets')
  })

  test(
    'Multiple SubgraphNode hosts keep independent migrated widget values',
    { tag: ['@vue-nodes'] },
    async ({ comfyPage }) => {
      await comfyPage.workflow.loadGraphData(
        createPrimitiveFanoutMultiHostWorkflow()
      )

      // The fixture's proxyWidgets [["1","value"], ["4","value"]] migrates to
      // two host widgets sharing the source widget name "value":
      //   index 0 → PrimitiveString.value (string textbox)
      //   index 1 → PrimitiveNode.value   (number input)
      // Disambiguate by row order, matching widgets_values order.
      const expectHostHasIndependentValues = async (
        hostId: string,
        stringValue: string,
        intValue: string
      ) => {
        const host = comfyPage.vueNodes.getNodeLocator(hostId)
        const widgets = host.getByTestId(TestIds.widgets.widget)
        await expect(widgets).toHaveCount(2)
        await expect(widgets.nth(0).locator('input').first()).toHaveValue(
          stringValue
        )
        await expect(widgets.nth(1).locator('input').first()).toHaveValue(
          intValue
        )
      }

      await expectHostHasIndependentValues('2', 'first-host', '11')
      await expectHostHasIndependentValues('12', 'second-host', '22')

      await comfyPage.subgraph.serializeAndReload()

      await expectHostHasIndependentValues('2', 'first-host', '11')
      await expectHostHasIndependentValues('12', 'second-host', '22')
    }
  )

  test('Nested preview exposures render through serialized chain resolution', async ({
    comfyPage
  }) => {
    test.setTimeout(45_000)
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.workflow.loadWorkflow(
      'subgraphs/subgraph-with-multiple-promoted-previews'
    )
    await comfyPage.vueNodes.waitForNodes()

    const nestedHostProperties = await getSerializedSubgraphNodeProperties(
      comfyPage,
      '8'
    )
    expect(nestedHostProperties).not.toHaveProperty('proxyWidgets')
    expect(nestedHostProperties.previewExposures).toEqual([
      expect.objectContaining({
        sourceNodeId: '6',
        sourcePreviewName: '$$canvas-image-preview'
      })
    ])

    const nestedSubgraphNode = comfyPage.vueNodes.getNodeLocator('8')
    await expect(nestedSubgraphNode).toBeVisible()

    await expect
      .poll(() => getPromotedWidgetNames(comfyPage, '8'))
      .toContain('$$canvas-image-preview')
    // A host whose only promoted content is a preview exposure has no
    // node.widgets entries and renders no `.lg-node-widgets` container; the
    // pseudo-widget surfaces via usePromotedPreviews instead.
  })

  test('Legacy unresolvable proxy entry is omitted and quarantined on save', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadGraphData(createUnresolvableProxyWorkflow())

    await expect
      .poll(() => getPromotedWidgetNames(comfyPage, '2'))
      .not.toContain('missing_widget')

    const serializedProperties = await getSerializedSubgraphNodeProperties(
      comfyPage,
      '2'
    )
    expect(serializedProperties).not.toHaveProperty('proxyWidgets')
    expect(serializedProperties.proxyWidgetErrorQuarantine).toEqual([
      expect.objectContaining({
        originalEntry: ['9999', 'missing_widget'],
        reason: 'missingSourceNode',
        hostValue: 'quarantined-host-value'
      })
    ])
  })

  test('Promoted widget remains usable after serialize and reload', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow(
      'subgraphs/subgraph-with-promoted-text-widget'
    )

    const beforeReload = comfyPage.page.locator('.comfy-multiline-input')
    await expect(beforeReload).toHaveCount(1)
    await expect(beforeReload).toBeVisible()

    await comfyPage.subgraph.serializeAndReload()

    const afterReload = comfyPage.page.locator('.comfy-multiline-input')
    await expect(afterReload).toHaveCount(1)
    await expect(afterReload).toBeVisible()
  })

  test('Compressed target_slot workflow boots into a usable promoted widget state', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow(
      'subgraphs/subgraph-compressed-target-slot'
    )

    await expect
      .poll(async () => {
        const widgets = await getPromotedWidgets(comfyPage, '2')
        return widgets.some(([, widgetName]) => widgetName === 'batch_size')
      })
      .toBe(true)
  })

  test('Duplicate ID remap workflow remains navigable after a full reload boot path', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow(DUPLICATE_IDS_WORKFLOW)

    await comfyPage.page.reload()
    await comfyPage.page.waitForFunction(() => !!window.app)
    await comfyPage.workflow.loadWorkflow(DUPLICATE_IDS_WORKFLOW)

    const subgraphNode = await comfyPage.nodeOps.getNodeRefById('5')
    await subgraphNode.navigateIntoSubgraph()

    await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(true)

    await comfyPage.keyboard.press('Escape')

    await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(false)
  })

  test.describe('Deterministic proxyWidgets Hydrate', () => {
    test('proxyWidgets entries map to real interior node IDs after load', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-promoted-text-widget'
      )

      const widgets = await getPromotedWidgets(comfyPage, '11')
      expect(widgets.length).toBeGreaterThan(0)

      for (const [interiorNodeId] of widgets) {
        expect(Number(interiorNodeId)).toBeGreaterThan(0)
      }

      await expectPromotedWidgetsToResolveToInteriorNodes(
        comfyPage,
        '11',
        widgets
      )
    })

    test('proxyWidgets entries survive double round-trip without drift', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-multiple-promoted-widgets'
      )

      const initialWidgets = await getPromotedWidgets(comfyPage, '11')
      expect(initialWidgets.length).toBeGreaterThan(0)
      await expectPromotedWidgetsToResolveToInteriorNodes(
        comfyPage,
        '11',
        initialWidgets
      )

      await comfyPage.subgraph.serializeAndReload()

      const afterFirst = await getPromotedWidgets(comfyPage, '11')
      await expectPromotedWidgetsToResolveToInteriorNodes(
        comfyPage,
        '11',
        afterFirst
      )

      await comfyPage.subgraph.serializeAndReload()

      const afterSecond = await getPromotedWidgets(comfyPage, '11')
      await expectPromotedWidgetsToResolveToInteriorNodes(
        comfyPage,
        '11',
        afterSecond
      )

      expect(afterFirst).toEqual(initialWidgets)
      expect(afterSecond).toEqual(initialWidgets)
    })

    test('Compressed target_slot (-1) entries are hydrated to real IDs', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-compressed-target-slot'
      )

      const widgets = await getPromotedWidgets(comfyPage, '2')
      expect(widgets.length).toBeGreaterThan(0)

      for (const [interiorNodeId] of widgets) {
        expect(interiorNodeId).not.toBe('-1')
        expect(Number(interiorNodeId)).toBeGreaterThan(0)
      }

      await expectPromotedWidgetsToResolveToInteriorNodes(
        comfyPage,
        '2',
        widgets
      )
    })
  })

  test.describe('Legacy And Round-Trip Coverage', () => {
    let previousUseNewMenu: unknown

    test.beforeEach(async ({ comfyPage }) => {
      previousUseNewMenu =
        await comfyPage.settings.getSetting('Comfy.UseNewMenu')
      await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting(
        'Comfy.UseNewMenu',
        previousUseNewMenu
      )
    })

    test('Legacy -1 proxyWidgets entries are hydrated to concrete interior node IDs', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-compressed-target-slot'
      )

      const promotedWidgets = await getPromotedWidgets(comfyPage, '2')
      expect(promotedWidgets.length).toBeGreaterThan(0)
      expect(
        promotedWidgets.some(([interiorNodeId]) => interiorNodeId === '-1')
      ).toBe(false)
      expect(
        promotedWidgets.some(
          ([interiorNodeId, widgetName]) =>
            interiorNodeId !== '-1' && widgetName === 'batch_size'
        )
      ).toBe(true)
    })

    test('Promoted widgets survive serialize -> loadGraphData round-trip', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-promoted-text-widget'
      )

      const beforePromoted = await getPromotedWidgetNames(comfyPage, '11')
      expect(beforePromoted).toContain('text')

      await comfyPage.subgraph.serializeAndReload()

      const afterPromoted = await getPromotedWidgetNames(comfyPage, '11')
      expect(afterPromoted).toContain('text')

      const widgetCount = await getPromotedWidgetCount(comfyPage, '11')
      expect(widgetCount).toBeGreaterThan(0)
    })

    test('Multi-link input representative stays stable through save/reload', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-multiple-promoted-widgets'
      )

      const beforeSnapshot = await getPromotedWidgets(comfyPage, '11')
      expect(beforeSnapshot.length).toBeGreaterThan(0)

      await comfyPage.subgraph.serializeAndReload()

      const afterSnapshot = await getPromotedWidgets(comfyPage, '11')
      expect(afterSnapshot).toEqual(beforeSnapshot)
    })

    test('Cloning a subgraph node keeps promoted widget entries on original and clone', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-promoted-text-widget'
      )

      const originalNode = await comfyPage.nodeOps.getNodeRefById('11')
      const originalPos = await originalNode.getPosition()

      await comfyPage.page.mouse.move(originalPos.x + 16, originalPos.y + 16)
      await comfyPage.page.keyboard.down('Alt')
      try {
        await comfyPage.page.mouse.down()
        await comfyPage.page.mouse.move(originalPos.x + 72, originalPos.y + 72)
        await comfyPage.page.mouse.up()
      } finally {
        await comfyPage.page.keyboard.up('Alt')
      }

      async function collectSubgraphNodeIds() {
        return comfyPage.page.evaluate(() => {
          const graph = window.app!.canvas.graph!
          return graph.nodes
            .filter(
              (n) =>
                typeof n.isSubgraphNode === 'function' && n.isSubgraphNode()
            )
            .map((n) => String(n.id))
        })
      }

      await expect
        .poll(async () => (await collectSubgraphNodeIds()).length)
        .toBeGreaterThan(1)

      const subgraphNodeIds = await collectSubgraphNodeIds()
      for (const nodeId of subgraphNodeIds) {
        const promotedWidgets = await getPromotedWidgets(comfyPage, nodeId)
        expect(promotedWidgets.length).toBeGreaterThan(0)
        expect(
          promotedWidgets.some(([, widgetName]) => widgetName === 'text')
        ).toBe(true)
      }
    })
  })

  test.describe('Duplicate ID Remapping', () => {
    test('All node IDs are globally unique after loading', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(DUPLICATE_IDS_WORKFLOW)

      const result = await comfyPage.page.evaluate(() => {
        const graph = window.app!.canvas.graph!
        const allGraphs = [graph, ...graph.subgraphs.values()]
        const allIds = allGraphs
          .flatMap((g) => g._nodes)
          .map((n) => n.id)
          .filter((id): id is number => typeof id === 'number')

        return { allIds, uniqueCount: new Set(allIds).size }
      })

      expect(result.uniqueCount).toBe(result.allIds.length)
      expect(result.allIds.length).toBeGreaterThanOrEqual(10)
    })

    test('Root graph node IDs are preserved as canonical', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(DUPLICATE_IDS_WORKFLOW)

      const rootIds = await comfyPage.page.evaluate(() => {
        const graph = window.app!.canvas.graph!
        return graph._nodes
          .map((n) => n.id)
          .filter((id): id is number => typeof id === 'number')
          .sort((a, b) => a - b)
      })

      expect(rootIds).toEqual([1, 2, 5])
    })

    test('Promoted widget tuples are stable after full page reload boot path', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(DUPLICATE_IDS_WORKFLOW)

      const beforeSnapshot =
        await comfyPage.subgraph.getHostPromotedTupleSnapshot()
      expect(beforeSnapshot.length).toBeGreaterThan(0)
      expect(
        beforeSnapshot.some(({ promotedWidgets }) => promotedWidgets.length > 0)
      ).toBe(true)

      await comfyPage.page.reload()
      await comfyPage.page.waitForFunction(() => !!window.app)
      await comfyPage.workflow.loadWorkflow(DUPLICATE_IDS_WORKFLOW)

      await expect
        .poll(() => comfyPage.subgraph.getHostPromotedTupleSnapshot(), {
          timeout: 5_000
        })
        .toEqual(beforeSnapshot)
    })

    test('All links reference valid nodes in their graph', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(DUPLICATE_IDS_WORKFLOW)

      const invalidLinks = await comfyPage.page.evaluate(() => {
        const graph = window.app!.canvas.graph!
        const labeledGraphs: [string, typeof graph][] = [
          ['root', graph],
          ...[...graph.subgraphs.entries()].map(
            ([id, sg]) => [`subgraph:${id}`, sg] as [string, typeof graph]
          )
        ]

        const SENTINEL_IDS = new Set([-1, -10, -20])
        const isSentinelNodeId = (id: number | string): id is number =>
          typeof id === 'number' && SENTINEL_IDS.has(id)

        const checkEndpoint = (
          label: string,
          kind: 'origin_id' | 'target_id',
          id: number | string,
          g: typeof graph
        ): string | null => {
          if (isSentinelNodeId(id)) return null
          if (typeof id !== 'number' || !g._nodes_by_id[id]) {
            return `${label}: ${kind} ${id} invalid or not found`
          }
          return null
        }

        return labeledGraphs.flatMap(([label, g]) =>
          [...g._links.values()].flatMap((link) =>
            [
              checkEndpoint(label, 'origin_id', link.origin_id, g),
              checkEndpoint(label, 'target_id', link.target_id, g)
            ].filter((e): e is string => e !== null)
          )
        )
      })

      expect(invalidLinks).toEqual([])
    })

    test('Subgraph navigation works after ID remapping', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(DUPLICATE_IDS_WORKFLOW)

      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('5')
      await subgraphNode.navigateIntoSubgraph()

      await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(true)

      await comfyPage.keyboard.press('Escape')

      await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(false)
    })
  })

  /**
   * Regression test for legacy-prefixed proxyWidget normalization.
   *
   * Older serialized workflows stored proxyWidget entries with prefixed widget
   * names like "6: 3: string_a" instead of plain "string_a". This caused
   * resolution failures during configure, resulting in missing promoted widgets.
   *
   * The fixture contains an outer SubgraphNode (id 5) whose proxyWidgets array
   * has a legacy-prefixed entry: ["6", "6: 3: string_a"]. After normalization
   * the promoted widget should render with the clean name "string_a".
   *
   * See: https://github.com/Comfy-Org/ComfyUI_frontend/pull/10573
   */
  test.describe(
    'Legacy Prefixed proxyWidget Normalization',
    { tag: ['@subgraph', '@widget'] },
    () => {
      let previousVueNodesEnabled: unknown

      test.beforeEach(async ({ comfyPage }) => {
        previousVueNodesEnabled = await comfyPage.settings.getSetting(
          'Comfy.VueNodes.Enabled'
        )
        await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
      })

      test.afterEach(async ({ comfyPage }) => {
        await comfyPage.settings.setSetting(
          'Comfy.VueNodes.Enabled',
          previousVueNodesEnabled
        )
      })

      test('Loads without console warnings about failed widget resolution', async ({
        comfyPage
      }) => {
        const { warnings, dispose } = SubgraphHelper.collectConsoleWarnings(
          comfyPage.page
        )

        try {
          await comfyPage.workflow.loadWorkflow(LEGACY_PREFIXED_WORKFLOW)

          comfyExpect(warnings).toEqual([])
        } finally {
          dispose()
        }
      })

      test('Legacy-prefixed promoted widget renders with the normalized label after load', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(LEGACY_PREFIXED_WORKFLOW)
        await comfyPage.vueNodes.waitForNodes()

        const outerNode = comfyPage.vueNodes.getNodeLocator('5')
        await expect(outerNode).toBeVisible()

        const textarea = outerNode
          .getByRole('textbox', { name: 'string_a' })
          .first()
        await expect(textarea).toBeVisible()
        await expect(textarea).toBeDisabled()
      })

      test('No legacy-prefixed or disconnected widgets remain on the node', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(LEGACY_PREFIXED_WORKFLOW)
        await comfyPage.vueNodes.waitForNodes()

        const outerNode = comfyPage.vueNodes.getNodeLocator('5')
        await expect(outerNode).toBeVisible()

        // The legacy `proxyWidgets` entry references an interior nodeId that
        // doesn't match the existing linked input's PromotedWidgetView source,
        // so migration creates a second SubgraphInput rather than deduping.
        // The intent of this test is that no legacy "<id>: <id>:" prefix
        // leaks into the rendered widget rows.
        const widgetRows = outerNode.getByTestId(TestIds.widgets.widget)
        await expect(widgetRows).toHaveCount(2)
        await expect(widgetRows.first()).not.toContainText('6: 3:')
        await expect(widgetRows.nth(1)).not.toContainText('6: 3:')
      })
    }
  )
})
