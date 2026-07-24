import { expect } from '@playwright/test'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import {
  resolveRoles,
  templateOverrides
} from '@/renderer/extensions/firstRunTour/roleResolver'
import type { CuratedTemplateId } from '@/renderer/extensions/firstRunTour/roleResolver'
import { templateApiFixture as test } from '@e2e/fixtures/templateApiFixture'

const curatedIds = Object.keys(templateOverrides) as CuratedTemplateId[]

const baseUrl = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

// Verifies the resolver against the real templates the backend serves, so a
// stale override or an upstream restructure fails loudly instead of drifting.
// A curated template the backend build does not ship is skipped, not failed, so
// the guard tracks the serving backend rather than the (newer) upstream set.
test.describe(
  'first-run tour resolver — live curated templates',
  { tag: ['@slow', '@workflow'] },
  () => {
    test('override roles land on real nodes and match the heuristics', async ({
      request
    }) => {
      const skipped: string[] = []

      for (const id of curatedIds) {
        const url = new URL(`/templates/${id}.json`, baseUrl).toString()
        const response = await request.get(url)
        if (!response.ok()) {
          skipped.push(id)
          continue
        }
        const workflow = (await response.json()) as ComfyWorkflowJSON

        const nodeIds = new Set(workflow.nodes.map((node) => String(node.id)))
        const overridden = resolveRoles(workflow, id)
        const pin = templateOverrides[id]

        expect(nodeIds.has(String(pin.sinkNodeId)), `${id} sink node`).toBe(
          true
        )
        expect(overridden.sink?.nodeId, id).toBe(pin.sinkNodeId)
        expect(overridden.engine?.nodeId, id).toBe(pin.engineNodeId)
        expect(overridden.mediaKind, id).toBe(pin.mediaKind)
        if (pin.sourceNodeId) {
          expect(overridden.source?.nodeId, id).toBe(pin.sourceNodeId)
        }
        // The prompt spotlight targets the root-graph host, not the inner node.
        if (overridden.prompt) {
          expect(
            nodeIds.has(String(overridden.prompt.subgraphNodeId)),
            `${id} prompt host`
          ).toBe(true)
        }

        // Drift guard: heuristics must independently agree with the override.
        const heuristic = resolveRoles(workflow)
        expect(heuristic.prompt?.innerNodeId, id).toBe(pin.promptNodeId)
        expect(heuristic.engine?.nodeId, id).toBe(pin.engineNodeId)
        expect(heuristic.sink?.nodeId, id).toBe(pin.sinkNodeId)
        expect(heuristic.mediaKind, id).toBe(pin.mediaKind)
        if (pin.sourceNodeId) {
          expect(heuristic.source?.nodeId, id).toBe(pin.sourceNodeId)
        }
      }

      if (skipped.length) {
        console.warn(`Backend does not serve curated templates: ${skipped}`)
      }
      expect(
        skipped.length,
        'backend served no curated templates'
      ).toBeLessThan(curatedIds.length)
    })
  }
)
