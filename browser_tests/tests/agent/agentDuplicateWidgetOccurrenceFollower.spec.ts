import { expect } from '@playwright/test'

import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import type {
  AgentThreadListResponse,
  WorkflowListResponse
} from '@comfyorg/ingest-types'
import type { UserDataFullInfo } from '@/platform/remote/comfyui/types'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import type {
  AgentRunModePreference,
  AgentTurnAccepted
} from '@/workbench/extensions/agent/schemas/agentApiSchema'

import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'
import type { RecordedGraphOperation } from '@e2e/fixtures/data/agent/agentConversation'
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import { AgentFollowerHostSocket } from '@e2e/fixtures/agentFollowerHostSocket'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import enMessages from '@/locales/en/main.json' with { type: 'json' }

/**
 * The frontend half of the FE-3036 cross-repo seam: what a node whose class
 * carries a REPEATED widget name does across the shared document.
 *
 * Two facts make that state reachable from both ends at once, and they point
 * opposite ways:
 *
 * - The frontend's accepted invariant is that two widgets on one node cannot
 *   share a name (ADR-ECS-0008, "Widget identity keys on `name`"), and
 *   #20087 now enforces it where widgets are registered — a repeat that
 *   cannot be renamed is REFUSED rather than kept under a name another widget
 *   already holds.
 * - The pinned widget catalog is per-CLASS and is derived from `object_info`,
 *   so its `widget_order` can name the same widget twice regardless of what
 *   any client does with its own widgets array. The document the doc host
 *   mints from that order therefore carries two registers for one name, and
 *   the frontend never gets a vote.
 *
 * So the question this case answers is not "can the frontend create the
 * state" — it refuses to — but "what does the follower do when the DOCUMENT
 * carries it anyway". The answer must be: address the register that belongs
 * to the widget it kept, and refuse the other rather than misaddress it onto
 * the widget it has.
 *
 * Schema v5 is what makes that answerable. It arrived in
 * `@comfyorg/comfy-multi-player` 0.3.8 and this diff pins **0.3.10**, which is
 * the version every assertion below actually runs against. Under the previous
 * pin (0.3.6, schema v4) a repeated name has ONE register: the second
 * position's value overwrites the first at mint, and `widget_occurrence` on an
 * op is accepted and silently ignored. Both halves of this case therefore fail
 * on the parent pin — the kept widget shows the OTHER occurrence's value, and
 * a write aimed at occurrence 1 lands on it — and neither failure is reported
 * anywhere. That is why this file is the proof obligation of the pin bump
 * rather than of a source change: nothing in `src/` moves.
 *
 * Black-box throughout. Canvas outcomes are read from the rendered node;
 * document outcomes are read from the host's own projection — the workflow
 * the shared document would hand back — never from frontend internals.
 *
 * Every step that asserts a canvas field DID NOT change rides a marker node
 * added in the SAME host batch and waits for it to render first. `host.apply()`
 * mutates the in-process document synchronously, before the frame is sent, so
 * polling the host's own projection proves nothing about the frame reaching the
 * follower: a bare "still the old value" assertion would pass on the first tick
 * and a misaddressed write landing afterwards would go unnoticed. Frames arrive
 * in order on one channel, so the marker rendering is the client-visible proof
 * that the write ahead of it was processed — the same device
 * `agentClearedWorkflowStaysCleared.spec.ts` uses on its catch-up.
 *
 * NOT covered here, deliberately: what the frontend's own `serialize()` writes
 * for this node. `node.serialize()` emits one value per serializable widget, so
 * a user SAVE of a node whose class has two catalog slots writes a one-entry
 * `widgets_values` and the unaddressable register is dropped on the save leg.
 * That is a consequence of the refusal plus per-widget serialization, identical
 * at both pins, and it is FE-3036's to resolve — not this pin's. Asserting it
 * here would pin current lossy behaviour as if it were the contract.
 */

const NODE_TYPE = 'TestRepeatedWidgetNameNode'
const NODE_ID = 701
const WIDGET_NAME = 'dup'

/**
 * A widgetless class used only as a delivery marker. It carries no widget of
 * its own, so its arrival cannot disturb anything this case asserts about the
 * node under test.
 */
const MARKER_TYPE = 'TestDeliveryMarkerNode'
/** Rides the occurrence-1 write in step 3. */
const MARKER_WRITE_NODE_ID = 702
/** Rides the deliberately-unbroadcast write in the final step. */
const MARKER_MISSED_NODE_ID = 703

/** The value the document holds for the widget the frontend keeps. */
const FIRST_OCCURRENCE_VALUE = 'first occurrence'
/** The value the document holds for the occurrence the frontend refused. */
const SECOND_OCCURRENCE_VALUE = 'second occurrence'
/** What a later agent write puts on the register the frontend cannot address. */
const SECOND_OCCURRENCE_REWRITE = 'rewritten second occurrence'
/** What the host writes to that same register while the follower is away. */
const SECOND_OCCURRENCE_MISSED = 'missed second occurrence'
const TYPED_VALUE = 'typed by the user'

const WORKFLOW_ID = '2d9f5a71-4c3b-4e8d-9a06-7b1c2d3e4f50'
const THREAD_ID = '3e0a6b82-5d4c-4f9e-8b17-8c2d3e4f5a61'
const MESSAGE_ID = '4f1b7c93-6e5d-4a0f-9c28-9d3e4f5a6b72'
const SOCKET_SID = '5a2c8d04-7f6e-4b10-8d39-0e4f5a6b7c83'

/**
 * One serializable string widget. The repeat is NOT in the node definition —
 * `input.required` is a map, so a definition cannot name one key twice. The
 * duplicate arrives the way it really does: something adds a second widget
 * under a name the node already holds.
 */
const nodeDef: ComfyNodeDef = {
  name: NODE_TYPE,
  display_name: 'Test Repeated Widget Name Node',
  description: '',
  category: 'test',
  python_module: 'test',
  output_node: false,
  output: ['STRING'],
  output_is_list: [false],
  output_name: ['STRING'],
  input: {
    required: {
      [WIDGET_NAME]: ['STRING', { default: 'definition default' }]
    }
  },
  input_order: { required: [WIDGET_NAME] }
}

/** No widgets, so a marker can never be mistaken for the node under test. */
const markerDef: ComfyNodeDef = {
  name: MARKER_TYPE,
  display_name: 'Test Delivery Marker Node',
  description: '',
  category: 'test',
  python_module: 'test',
  output_node: false,
  output: ['STRING'],
  output_is_list: [false],
  output_name: ['STRING'],
  input: {},
  input_order: {}
}

/**
 * The catalog names the widget TWICE, which is the whole premise: the doc
 * host decomposes `widgets_values` against this order, so the document holds
 * one register per position. comfy-cli's catalog builder appends a slot per
 * qualifying input without checking whether the name is already taken, so a
 * repeated name here is a property of the class, not of this fixture.
 */
const catalog: WidgetCatalog = {
  types: {
    [NODE_TYPE]: { widget_order: [WIDGET_NAME, WIDGET_NAME] },
    [MARKER_TYPE]: { widget_order: [] }
  }
}

/**
 * A host add that rides a batch whose real payload is a write the canvas must
 * NOT show. Frames reach the follower in order on one channel, so once this
 * renders, the write ahead of it in the same batch has been processed — which
 * is what turns "the field still holds the old value" from a statement about an
 * unprocessed frame into a statement about the applier's addressing.
 */
function markerAdd(nodeId: number): RecordedGraphOperation {
  return {
    op: 'add_node',
    node_id: nodeId,
    class_type: MARKER_TYPE,
    pos: [400, 0],
    node: {
      id: nodeId,
      type: MARKER_TYPE,
      pos: [400, 0],
      size: [200, 60],
      mode: 0,
      flags: {},
      order: 1,
      inputs: [],
      outputs: [{ name: 'STRING', type: 'STRING', links: [] }],
      properties: {},
      widgets_values: []
    }
  }
}

/** The node under test, found by id rather than by projection position. */
function widgetsUnderTest(host: HostDoc): unknown[] | undefined {
  return host.projection().nodes.find((node) => node.id === NODE_ID)
    ?.widgets_values as unknown[] | undefined
}

const seed: WorkflowJSON = {
  nodes: [
    {
      id: NODE_ID,
      type: NODE_TYPE,
      pos: [0, 0],
      size: [270, 120],
      flags: {},
      order: 0,
      mode: 0,
      inputs: [],
      outputs: [{ name: 'STRING', type: 'STRING', links: [] }],
      properties: {},
      widgets_values: [FIRST_OCCURRENCE_VALUE, SECOND_OCCURRENCE_VALUE]
    }
  ],
  links: [],
  groups: [],
  config: {},
  extra: {},
  version: 0.4
}

/**
 * Gives every instance of the class a second widget under the name the first
 * already holds, pinned so it cannot be renamed — the one state in which a
 * node really carries two serializable widgets under one name, and the state
 * #20087 refuses. Patched on the TYPE rather than an instance, because the
 * node under test is built by the follower from the document, not by the test.
 *
 * A plain frozen object handed to `addWidget` does not reproduce it: the
 * concrete widget class's own writable accessor wins. Redefining `name` on
 * the already-concrete widget is what makes the rename impossible.
 */
async function pinASecondWidgetUnderTheSameName(
  page: Parameters<typeof bootAgentApp>[0]
): Promise<void> {
  // `bootAgentApp` resolves on `window.app?.extensionManager`, which App.vue
  // sets during setup — well before `app.setup()` has fetched `/api/object_info`
  // and registered any type. Patching through the race throws an opaque
  // "Cannot read properties of undefined" on `.prototype` from inside the page
  // instead of failing where the cause is readable, so wait for the class to
  // exist first. (The identical patch in `unrenamableDuplicateWidgetRefused`
  // needs no wait only because `comfyPage` hands it a fully set-up app.)
  await page.waitForFunction(
    (nodeTypeName) =>
      window.LiteGraph?.registered_node_types[nodeTypeName]?.prototype !==
      undefined,
    NODE_TYPE,
    { timeout: 15_000 }
  )
  await page.evaluate(
    ({ nodeTypeName, widgetName }) => {
      const nodeType = window.LiteGraph!.registered_node_types[nodeTypeName]
      const onNodeCreated = nodeType.prototype.onNodeCreated
      nodeType.prototype.onNodeCreated = function (...args) {
        onNodeCreated?.apply(this, args)
        this.serialize_widgets = true
        const second = this.addWidget(
          'string',
          'second',
          'second default',
          () => {}
        )
        Object.defineProperty(second, 'name', {
          value: widgetName,
          writable: false,
          configurable: false
        })
      }
    },
    { nodeTypeName: NODE_TYPE, widgetName: WIDGET_NAME }
  )
}

test.describe(
  'Agent follower on a class whose catalog repeats a widget name',
  { tag: ['@cloud', '@agent', '@vue-nodes', '@widget'] },
  () => {
    test('addresses the occurrence it kept and refuses the one it cannot', async ({
      page
    }) => {
      test.setTimeout(90_000)

      await page.route('**/api/object_info', (route) =>
        route.fulfill(
          jsonRoute({ [NODE_TYPE]: nodeDef, [MARKER_TYPE]: markerDef })
        )
      )

      const host = new HostDoc(WORKFLOW_ID, seed, catalog)
      const hostSocket = new AgentFollowerHostSocket(
        page,
        WORKFLOW_ID,
        host,
        SOCKET_SID,
        // The human's own edit must reach the document through the real
        // applier, not be held: the last step asserts what the document kept.
        'apply'
      )
      await hostSocket.install()

      const threadList: AgentThreadListResponse = {
        pagination: { has_more: false, limit: 100, offset: 0, total: 0 },
        threads: []
      }
      await page.route('**/api/agent/threads', (route) =>
        route.fulfill(jsonRoute(threadList))
      )
      const runModePreference: AgentRunModePreference = {
        mode: 'ask_approval',
        credit_limit: null
      }
      await page.route('**/api/agent/run-mode', (route) =>
        route.fulfill(jsonRoute(runModePreference))
      )
      const turnAccepted: AgentTurnAccepted = {
        thread_id: THREAD_ID,
        message_id: MESSAGE_ID,
        workflow_id: WORKFLOW_ID
      }
      await page.route('**/api/agent/threads/*/messages', (route) => {
        if (route.request().method() !== 'POST')
          return route.fulfill(jsonRoute([]))
        return route.fulfill({
          status: 202,
          contentType: 'application/json',
          body: JSON.stringify(turnAccepted)
        })
      })

      await bootAgentApp(page, true, {
        objectInfo: 'server',
        settings: {
          'Comfy.VueNodes.Enabled': true,
          'Comfy.Graph.CanvasInfo': false
        }
      })

      let savedName: string | undefined
      await page.route('**/api/userdata/*', (route) => {
        const request = route.request()
        const path = decodeURIComponent(
          new URL(request.url()).pathname.split('/userdata/')[1]
        )
        if (request.method() !== 'POST' || !path.startsWith('workflows/'))
          return route.fallback()
        savedName = path.slice('workflows/'.length, -'.json'.length)
        const saved: UserDataFullInfo = {
          path,
          modified: Date.now(),
          size: request.postDataBuffer()?.length ?? 0
        }
        return route.fulfill(jsonRoute(saved))
      })
      await page.route('**/api/workflows?*', (route) => {
        const workflows: WorkflowListResponse = {
          data:
            savedName === undefined
              ? []
              : [
                  {
                    id: WORKFLOW_ID,
                    name: savedName,
                    created_at: '2026-09-01T00:00:00Z',
                    updated_at: '2026-09-01T00:00:00Z',
                    created_by: 'test-user-e2e',
                    latest_version: 1
                  }
                ],
          pagination: {
            has_more: false,
            limit: 100,
            offset: 0,
            total: savedName === undefined ? 0 : 1
          }
        }
        return route.fulfill(jsonRoute(workflows))
      })

      // Before the follower builds the node, so the node it builds from the
      // document carries the ambiguous pair the invariant has to resolve.
      await pinASecondWidgetUnderTheSameName(page)

      // The refusal's own diagnostic. `reportError` writes the `errorType` to
      // the console in every environment (Sentry is off in DEV), so this is
      // the stable, product-owned signal that the node really did arrive
      // ambiguous — without it, every assertion below would also hold on a
      // node that simply has one widget, and the fixture's precondition would
      // be unasserted.
      // Matched at a word boundary, and as a LITERAL rather than through the
      // source's own constant: a dashboard query is written against the
      // string, so a rename has to be visible here. A bare `includes` is not
      // enough — it keeps matching when a suffix is appended to the type.
      const refusalReports: string[] = []
      page.on('console', (message) => {
        if (/\bwidget_duplicate_name_refused(?![\w-])/.test(message.text()))
          refusalReports.push(message.text())
      })

      const vueNodes = new VueNodeHelpers(page)
      const agentPanel = new AgentPanel(page)
      const panel = agentPanel.root

      await test.step('bind the workflow so the follower subscribes', async () => {
        await agentPanel.open()
        await agentPanel.selectWorkflow()
        const composer = panel.getByRole('textbox', {
          name: /^Describe ideas/
        })
        await composer.fill('hello')
        await panel.getByRole('button', { name: enMessages.agent.send }).click()
        await expect(panel.getByText('hello').first()).toBeVisible()
        hostSocket.send({
          type: 'agent_message_done',
          data: { message_id: MESSAGE_ID, thread_id: THREAD_ID }
        })
        await hostSocket.waitForSubscribe()
      })

      const node = vueNodes.getNodeLocator(String(NODE_ID))
      await expect(node).toBeVisible()
      const duplicateInputs = node.getByRole('textbox', { name: WIDGET_NAME })

      await test.step('the node is usable: one widget under the name, not none and not two', async () => {
        // The pair itself is the regression #20087 fixed: before it,
        // `BaseWidget.setNodeId` bailed for EVERY widget on such a node, so
        // the canvas rendered no widget rows at all.
        await expect(duplicateInputs).toHaveCount(1)

        // And it is one because the other was REFUSED, not because the node
        // only ever had one.
        await expect.poll(() => refusalReports).not.toHaveLength(0)
      })

      await test.step('the kept widget shows ITS OWN occurrence, not the other one', async () => {
        // The discriminator against the parent pin. At schema v4 the
        // document holds a single register for this name, carrying the
        // SECOND position's value, and the follower applies it here.
        await expect(duplicateInputs).toHaveValue(FIRST_OCCURRENCE_VALUE)
      })

      await test.step('a write aimed at the occurrence the frontend refused is not misaddressed onto the one it kept', async () => {
        hostSocket.send(
          host.apply([
            {
              op: 'set_widget',
              node_id: NODE_ID,
              widget: WIDGET_NAME,
              widget_occurrence: 1,
              value: SECOND_OCCURRENCE_REWRITE
            },
            markerAdd(MARKER_WRITE_NODE_ID)
          ])
        )

        // The register moved in the document...
        await expect
          .poll(() => widgetsUnderTest(host))
          .toEqual([FIRST_OCCURRENCE_VALUE, SECOND_OCCURRENCE_REWRITE])

        // ...the follower has PROCESSED the batch that moved it — the marker
        // behind the write in the same batch is on the canvas, so the
        // assertion below is about where the write landed rather than about a
        // frame still in flight...
        await expect(
          vueNodes.getNodeLocator(String(MARKER_WRITE_NODE_ID))
        ).toBeVisible()

        // ...and the widget the frontend kept did not change. At schema v4
        // `widget_occurrence` is accepted and ignored, so the same op writes
        // the one register this widget reads and the field changes.
        await expect(duplicateInputs).toHaveValue(FIRST_OCCURRENCE_VALUE)
      })

      await test.step("the user's own edit reaches the document on the register that belongs to it", async () => {
        const input = duplicateInputs.first()
        await input.fill(TYPED_VALUE)
        await input.blur()

        await expect
          .poll(() => hostSocket.humanOpOutcomes(), { timeout: 15_000 })
          .toEqual([expect.objectContaining({ outcome: 'applied' })])

        // Lossless on both of the DOCUMENT's registers: the typed value claims
        // occurrence 0 and the occurrence the frontend cannot address is left
        // intact rather than clobbered. At schema v4 this projection is a
        // ONE-element array — the other value does not exist to be preserved.
        // (The frontend's own save leg is lossy here at both pins; see the
        // header. That is FE-3036's, not this pin's.)
        await expect
          .poll(() => widgetsUnderTest(host))
          .toEqual([TYPED_VALUE, SECOND_OCCURRENCE_REWRITE])
      })

      await test.step('and a missed delta carrying the unaddressable occurrence does not clobber it on resubscribe', async () => {
        // Applied on the host and deliberately NOT broadcast, so the
        // follower is genuinely behind and its resubscribe has a real delta
        // to replay rather than nothing to do. A full in-session reload is
        // avoided on purpose: `loadGraphData()` while the follower is
        // subscribed has a separate, documented, pre-existing gap
        // (`agentAutogrowHandWiredLinkSurvivesSend.spec.ts`), so a red there
        // would not be this pin's.
        host.apply([
          {
            op: 'set_widget',
            node_id: NODE_ID,
            widget: WIDGET_NAME,
            widget_occurrence: 1,
            value: SECOND_OCCURRENCE_MISSED
          },
          markerAdd(MARKER_MISSED_NODE_ID)
        ])

        // Counted before the disconnect rather than against a literal:
        // `answerSubscribe` raises this counter in the same synchronous block
        // that sends `doc_subscribed` and the catch-up, so the count alone
        // says the host ANSWERED, never that the page applied the delta. It is
        // the cheap precondition; the marker below is the real gate.
        const subscribesBefore = hostSocket.subscribeCount()
        await hostSocket.disconnect()
        await expect
          .poll(() => hostSocket.subscribeCount(), { timeout: 30_000 })
          .toBeGreaterThan(subscribesBefore)

        // The document the follower caught up to carries the new value on the
        // occurrence it cannot address...
        await expect
          .poll(() => widgetsUnderTest(host))
          .toEqual([TYPED_VALUE, SECOND_OCCURRENCE_MISSED])

        // ...the catch-up really landed in the page — the marker added behind
        // that write in the same unbroadcast batch is now on the canvas, and
        // it can only have arrived through the resubscribe delta, since it was
        // never broadcast. Without this, "still what the user typed" would
        // hold just as well on a follower that received nothing at all...
        await expect(
          vueNodes.getNodeLocator(String(MARKER_MISSED_NODE_ID))
        ).toBeVisible()

        // ...and what the user typed is still on the widget they typed into.
        await expect(duplicateInputs).toHaveCount(1)
        await expect(duplicateInputs).toHaveValue(TYPED_VALUE)
      })
    })
  }
)
