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

/**
 * The resolver's curated overrides were once guarded by committed copies of the
 * upstream template JSONs, which drifted silently from what the backend serves.
 * Instead we fetch each real template the backend serves and verify the resolver
 * against it: the overrides must point at nodes that exist on the live graph, and
 * the pure heuristics must still agree with the overrides. A divergence means an
 * upstream restructure or a stale override — fix `templateOverrides`.
 *
 * This only fetches JSON and runs the pure resolver, so it uses the base request
 * fixture rather than booting the app.
 */
test.describe(
  'first-run tour resolver — live curated templates',
  { tag: ['@slow', '@workflow'] },
  () => {
    for (const id of curatedIds) {
      test(`resolves ${id} against the served template`, async ({
        request
      }) => {
        const templateUrl = new URL(`/templates/${id}.json`, baseUrl).toString()

        // A curated template the tour depends on must be served; a 404 is a real
        // failure (a stale curated id or a backend that dropped it), not a skip.
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
        // The prompt spotlights a root-graph host (the widget lives in a subgraph),
        // so the target must be a real top-level node, not the pinned inner id.
        if (overridden.prompt) {
          expect(nodeIds.has(String(overridden.prompt.subgraphNodeId))).toBe(
            true
          )
        }

        // Drift guard: the pure heuristics must independently agree with the
        // pinned override on the live template.
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
