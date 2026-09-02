import { mergeTests } from '@playwright/test'

import {
  comfyPageFixture,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { webSocketFixture } from '@e2e/fixtures/ws'

const test = mergeTests(comfyPageFixture, webSocketFixture)

// Every fixture below declares an explicit `previewExposures` on its hosts.
// That trips the `properties.previewExposures !== undefined` gate in
// `autoExposeKnownPreviewNodes`, so load-time auto-promotion cannot run and
// each test exercises the path it names instead of falling back to the
// exposure-driven one.
test.describe(
  'Subgraph preview identity',
  { tag: ['@vue-nodes', '@subgraph'] },
  () => {
    test('a root-level host surfaces every unexposed interior node that is live', async ({
      comfyPage,
      getWebSocket
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/ambient-root-two-unexposed-samplers'
      )
      await comfyPage.vueNodes.waitForNodes(1)

      const ws = await getWebSocket()
      const exec = new ExecutionHelper(comfyPage, ws)
      const rootHost = comfyPage.vueNodes.getNodeByTitle('Root Host')
      const previews = rootHost.locator('img[src^="blob:"]')

      const jobId = await exec.run()
      await comfyPage.nextFrame()
      exec.executionStart(jobId)

      exec.latentPreview(jobId, '1:2')
      await expect(previews).toHaveCount(1)
      exec.latentPreview(jobId, '1:3')
      await expect(previews).toHaveCount(2)
    })

    test('a host nested inside another subgraph surfaces its own interior live preview', async ({
      comfyPage,
      getWebSocket
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-nested-host-execution-path'
      )
      await comfyPage.vueNodes.waitForNodes(2)

      const ws = await getWebSocket()
      const exec = new ExecutionHelper(comfyPage, ws)

      const jobId = await exec.run()
      await comfyPage.nextFrame()
      exec.executionStart(jobId)
      // `Inner Host` is node 10 inside `Outer Host` (node 9), so its interior
      // sampler executes at the root-relative path 9:10:11.
      exec.latentPreview(jobId, '9:10:11')

      await comfyPage.vueNodes.enterSubgraph('9')
      const innerHost = comfyPage.vueNodes.getNodeByTitle('Inner Host')
      await expect(innerHost.locator('img[src^="blob:"]')).toHaveCount(1)
    })

    test('a nested host ignores an unrelated node whose root-relative path equals its truncated key', async ({
      comfyPage,
      getWebSocket
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-nested-host-execution-path'
      )
      await comfyPage.vueNodes.waitForNodes(2)

      const ws = await getWebSocket()
      const exec = new ExecutionHelper(comfyPage, ws)
      const decoyHost = comfyPage.vueNodes.getNodeByTitle('Decoy Host')

      const jobId = await exec.run()
      await comfyPage.nextFrame()
      exec.executionStart(jobId)
      exec.latentPreview(jobId, '1:3')

      // Anchor: proves the frame really landed, so the count below is not
      // merely passing before the store was written.
      await expect(decoyHost.locator('img[src^="blob:"]')).toHaveCount(1)

      await comfyPage.vueNodes.enterSubgraph('9')
      const innerHost = comfyPage.vueNodes.getNodeByTitle('Inner Host')
      await comfyPage.nextFrame()
      await expect(innerHost.locator('img[src^="blob:"]')).toHaveCount(0)
    })

    test('load-time subgraph id deduplication keeps previewExposures pointing at a node that exists', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-dup-ids-with-exposure'
      )
      await comfyPage.vueNodes.waitForNodes(2)

      const state = await comfyPage.page.evaluate(() => {
        interface ProbeNode {
          title?: string
          properties?: { previewExposures?: { sourceNodeId: string }[] }
          subgraph?: { nodes: { id: string | number }[] }
        }
        const graph = (
          window as unknown as { app: { graph?: { nodes: ProbeNode[] } } }
        ).app.graph
        const host = graph?.nodes.find((node) => node.title === 'Host A')
        return {
          exposed: (host?.properties?.previewExposures ?? []).map((entry) =>
            String(entry.sourceNodeId)
          ),
          interior: (host?.subgraph?.nodes ?? []).map((node) => String(node.id))
        }
      })

      expect(state.exposed.length).toBeGreaterThan(0)
      for (const sourceNodeId of state.exposed) {
        expect(state.interior).toContain(sourceNodeId)
      }
    })

    test('a chained exposure still renders when its leaf shares a local id with a sibling interior node', async ({
      comfyPage,
      getWebSocket
    }) => {
      // `Host A` exposes its own sampler (node 3) and, through `Nested B`
      // (node 5), that subgraph's sampler — which is also numbered 3. Colliding
      // interior ids only survive a load with dedup switched off.
      await comfyPage.settings.setSetting(
        'Comfy.Graph.DeduplicateSubgraphNodeIds',
        false
      )
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/promoted-leaf-id-collision'
      )
      await comfyPage.vueNodes.waitForNodes(1)

      const ws = await getWebSocket()
      const exec = new ExecutionHelper(comfyPage, ws)
      const hostA = comfyPage.vueNodes.getNodeByTitle('Host A')

      const jobId = await exec.run()
      await comfyPage.nextFrame()
      exec.executionStart(jobId)
      exec.latentPreview(jobId, '1:3')
      exec.latentPreview(jobId, '1:5:3')

      await expect(hostA.locator('img[src^="blob:"]')).toHaveCount(2)
    })

    test('control: the same chain renders both previews once the leaf id is unique', async ({
      comfyPage,
      getWebSocket
    }) => {
      // Identical to the previous fixture except `Nested B`'s sampler is node
      // 7, so nothing collides. If this renders 2 where the previous test
      // renders fewer, the shared local id is the cause.
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/promoted-chain-unique-ids'
      )
      await comfyPage.vueNodes.waitForNodes(1)

      const ws = await getWebSocket()
      const exec = new ExecutionHelper(comfyPage, ws)
      const hostA = comfyPage.vueNodes.getNodeByTitle('Host A')

      const jobId = await exec.run()
      await comfyPage.nextFrame()
      exec.executionStart(jobId)
      exec.latentPreview(jobId, '1:3')
      exec.latentPreview(jobId, '1:5:7')

      await expect(hostA.locator('img[src^="blob:"]')).toHaveCount(2)
    })
  }
)
