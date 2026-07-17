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
test.describe(
  'first-run tour resolver — live curated templates',
  { tag: ['@slow', '@workflow'] },
  () => {
    for (const id of curatedIds) {
      test(`resolves ${id} against the served template`, async ({
        request
      }) => {
        const templateUrl = new URL(`/templates/${id}.json`, baseUrl).toString()

        const response = await request.get(templateUrl)
        expect(
          response.ok(),
          `Backend does not serve /templates/${id}.json`
        ).toBe(true)
        const workflow = (await response.json()) as ComfyWorkflowJSON

        const nodeIds = new Set(workflow.nodes.map((node) => String(node.id)))
        const overridden = resolveRoles(workflow, id)
        const pin = templateOverrides[id]

        expect(nodeIds.has(String(pin.sinkNodeId)), 'sink node exists').toBe(
          true
        )
        expect(overridden.sink?.nodeId).toBe(pin.sinkNodeId)
        expect(overridden.engine?.nodeId).toBe(pin.engineNodeId)
        expect(overridden.mediaKind).toBe(pin.mediaKind)
        if (pin.sourceNodeId) {
          expect(overridden.source?.nodeId).toBe(pin.sourceNodeId)
        }
        // The prompt spotlight targets the root-graph host, not the inner node.
        if (overridden.prompt) {
          expect(nodeIds.has(String(overridden.prompt.subgraphNodeId))).toBe(
            true
          )
        }

        // Drift guard: heuristics must independently agree with the override.
        const heuristic = resolveRoles(workflow)
        expect(heuristic.prompt?.innerNodeId).toBe(pin.promptNodeId)
        expect(heuristic.engine?.nodeId).toBe(pin.engineNodeId)
        expect(heuristic.sink?.nodeId).toBe(pin.sinkNodeId)
        expect(heuristic.mediaKind).toBe(pin.mediaKind)
        if (pin.sourceNodeId) {
          expect(heuristic.source?.nodeId).toBe(pin.sourceNodeId)
        }
      })
    }
  }
)
