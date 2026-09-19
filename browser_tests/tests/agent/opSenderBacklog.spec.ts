import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import type { createOpSender as createOpSenderType } from '@/workbench/extensions/agent/crdt/opSender'

type CreateOpSender = typeof createOpSenderType

// Regression source: https://comfy-org.sentry.io/issues/7727037598/
test.describe(
  'Agent document-operation sender backlog',
  { tag: ['@agent', '@canvas'] },
  () => {
    test('retargets after a large refused backlog without changing the canvas', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('default')
      const before = await comfyPage.nodeOps.getSerializedGraph()
      const pageErrors: string[] = []
      comfyPage.page.on('pageerror', (error) => pageErrors.push(error.message))

      const result = await comfyPage.page.evaluate(async () => {
        const senderModulePath =
          '/src/workbench/extensions/agent/crdt/opSender.ts'
        const { createOpSender } = (await import(
          /* @vite-ignore */ senderModulePath
        )) as { createOpSender: CreateOpSender }
        let workflowId: string | null = 'old-workflow'
        let listener:
          | ((result: {
              ok: boolean
              applied: string[]
              skipped: string[]
            }) => void)
          | undefined
        const sent: Array<{ workflowId: string; opId: string }> = []
        const settled: string[] = []
        const sender = createOpSender({
          sendOps: (target, _tab, ops) => {
            sent.push({ workflowId: target, opId: ops[0].op_id })
            return true
          },
          onOpsResult: (callback) => {
            listener = callback
            return () => {
              listener = undefined
            }
          },
          workflowId: () => workflowId,
          tab: 'browser-regression',
          actor: () => 'human:browser-regression',
          baseVersion: () => 1,
          onBatchSettled: ({ state }) => settled.push(state)
        })
        const addNode = (nodeId: number) => ({
          op: 'add_node' as const,
          node_id: nodeId,
          class_type: 'TestNode',
          pos: [0, 0] as [number, number],
          node: { id: nodeId, type: 'TestNode' }
        })

        sender.enqueue([addNode(0)])
        for (let index = 1; index < 20_000; index++) {
          sender.enqueue([addNode(index)])
        }
        workflowId = 'next-workflow'
        sender.enqueue([addNode(20_000)])
        sender.abortIfUnbound()
        const next = sent.at(-1)
        listener?.({ ok: true, applied: [next!.opId], skipped: [] })

        return {
          oldSettled: settled.filter((state) => state === 'undeliverable')
            .length,
          finalState: settled.at(-1),
          pending: sender.pending(),
          nextWorkflow: next?.workflowId
        }
      })

      expect(result).toEqual({
        oldSettled: 20_000,
        finalState: 'acknowledged',
        pending: 0,
        nextWorkflow: 'next-workflow'
      })
      expect(pageErrors).toEqual([])
      await expect(comfyPage.page.locator('#graph-canvas')).toBeVisible()
      await expect
        .poll(() => comfyPage.nodeOps.getSerializedGraph())
        .toEqual(before)
    })
  }
)
