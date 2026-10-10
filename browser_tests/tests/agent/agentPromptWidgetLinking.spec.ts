import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import type { RecordedGraphOperation } from '@e2e/fixtures/data/agent/agentConversation'

// Three stories of qa/user-story-test-matrix.md (in-app-agent-program), all
// about the same slot -- a prompt widget that also accepts a wire:
//
//   50 "Agent says it cannot wire a text output into a prompt widget"
//      -- regr-34 (PM-313, PM-949, PRs 16922 ...), slack-26. Pin: 18105,
//      a draft WIP harness. Frozen area, so black-box only.
//   51 "A text widget disappears when I connect an input to it"
//      -- slack-27, linear-6. Expected: grey out. Actual: gone. Pin 18110.
//      On a plain node the canvas replaces the control with the input slot
//      row when a person wires it (subgraphPromotedWidgetExternalLink.spec),
//      so an agent wire must land on that same row, not remove it.
//   52 "Agent creates an incompatible connection, or refuses a compatible one"
//      -- linear-15 (PM-1027). IMAGE-to-STRING accepted or wrongly denied.
//      No pin. Frozen area.
//
// The seed's CLIPTextEncode (node 6) has exactly the input these are about:
// `text`, typed STRING, backed by a widget. Every assertion below is on what
// the canvas draws -- the wire, the widget row, the slot -- never on the
// projection, the stores or a frame, so all three survive FE #18700.
//
// ecsWidgets.spec.ts covers connect/disconnect on the legacy canvas by
// reading `connectionSuppressed` and `computedDisabled` off the widget.
// Story 51's symptom is that the row is not drawn at all, on Vue nodes, which
// those internals cannot distinguish from a correctly greyed one.

const CASE = 'agent-rec-text-only-answer'

// The seed's "Positive prompt" CLIPTextEncode and its widget-backed input.
const PROMPT_NODE_ID = '6'
const PROMPT_TEXT_SLOT = 1
const PROMPT_WIDGET = 'text'
// The seed's VAEDecode: an IMAGE output, for the type-mismatch case.
const IMAGE_SOURCE_ID = 8

const STRING_SOURCE_ID = 777001
const STRING_SOURCE_TEXT = 'a red fox in the snow'
const COMPATIBLE_LINK_ID = 777101
const INCOMPATIBLE_LINK_ID = 777102

const ADD_STRING_SOURCE: RecordedGraphOperation = {
  op: 'add_node',
  node_id: STRING_SOURCE_ID,
  class_type: 'PrimitiveStringMultiline',
  pos: [1400, 200],
  node: {
    id: STRING_SOURCE_ID,
    type: 'PrimitiveStringMultiline',
    pos: [1400, 200],
    size: [240, 120],
    mode: 0,
    flags: {},
    order: 0,
    inputs: [],
    outputs: [{ name: 'STRING', type: 'STRING', links: [] }],
    properties: {},
    widgets_values: [STRING_SOURCE_TEXT]
  }
}

interface RenderedLink {
  fromNode: string
  fromSlot: number
  toNode: string
  toSlot: number
}

function renderedLinks(page: {
  evaluate: <T>(fn: () => T) => Promise<T>
}): Promise<RenderedLink[]> {
  return page.evaluate(() =>
    [...window.app!.graph.links.values()].map((link) => ({
      fromNode: String(link.origin_id),
      fromSlot: link.origin_slot,
      toNode: String(link.target_id),
      toSlot: link.target_slot
    }))
  )
}

test.describe(
  'Wiring a text output into a prompt widget',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.use({ conversationCase: CASE })

    test('stories 50 and 51: the wire lands and the prompt widget stays on the node, greyed', async ({
      agentConversation,
      page
    }) => {
      test.setTimeout(90_000)

      await test.step('replay the recorded turn so the follower is bound', () =>
        agentConversation.runTurns())

      const promptNode =
        agentConversation.vueNodes.getNodeLocator(PROMPT_NODE_ID)
      const promptTextbox = promptNode.getByRole('textbox', {
        name: PROMPT_WIDGET,
        exact: true
      })

      await test.step('before the wire, the prompt widget is on the node and editable', async () => {
        await expect(promptTextbox).toBeVisible()
        await expect(promptTextbox).toBeEditable()
      })

      await test.step('agent adds a string node and wires it into the prompt', () => {
        agentConversation.pushHostOps([
          ADD_STRING_SOURCE,
          {
            op: 'connect',
            link_id: COMPATIBLE_LINK_ID,
            from_node: STRING_SOURCE_ID,
            from_slot: 0,
            to_node: Number(PROMPT_NODE_ID),
            to_slot: PROMPT_TEXT_SLOT,
            link_type: 'STRING'
          }
        ])
      })

      await test.step('story 50: the wire is drawn', async () => {
        await expect(
          agentConversation.vueNodes.getNodeLocator(String(STRING_SOURCE_ID))
        ).toBeVisible()
        await expect
          .poll(() => renderedLinks(page))
          .toContainEqual({
            fromNode: String(STRING_SOURCE_ID),
            fromSlot: 0,
            toNode: PROMPT_NODE_ID,
            toSlot: PROMPT_TEXT_SLOT
          })
      })

      await test.step('story 51: the prompt row stays as its input slot, as when a person wires it', async () => {
        await expect(promptTextbox).toHaveCount(0)
        await expect(
          agentConversation.vueNodes.getInputSlotConnectionDot(
            PROMPT_NODE_ID,
            PROMPT_TEXT_SLOT
          )
        ).toBeVisible()
        await expect(
          promptNode.getByText(PROMPT_WIDGET, { exact: true })
        ).toBeVisible()
      })
    })

    test('story 52: an IMAGE output does not wire into the STRING prompt input', async ({
      agentConversation,
      page
    }) => {
      test.setTimeout(90_000)

      await test.step('replay the recorded turn so the follower is bound', () =>
        agentConversation.runTurns())

      const before = await renderedLinks(page)

      await test.step('agent tries to connect IMAGE into the prompt', () => {
        agentConversation.pushHostOps([
          {
            op: 'connect',
            link_id: INCOMPATIBLE_LINK_ID,
            from_node: IMAGE_SOURCE_ID,
            from_slot: 0,
            to_node: Number(PROMPT_NODE_ID),
            to_slot: PROMPT_TEXT_SLOT,
            link_type: 'IMAGE'
          }
        ])
      })

      // A marker edit behind the connect: once it renders, the connect ahead
      // of it on the same channel has been applied (or refused) too, so this
      // is not a race against a frame that had not arrived yet.
      await test.step('let the frame land', () =>
        agentConversation.waitForPendingFrames(
          PROMPT_NODE_ID,
          PROMPT_WIDGET,
          'incompatible connect frame landed'
        ))

      await test.step('no IMAGE wire reaches the prompt input', async () => {
        const after = await renderedLinks(page)
        expect(
          after.filter(
            (link) =>
              link.toNode === PROMPT_NODE_ID && link.toSlot === PROMPT_TEXT_SLOT
          ),
          'an IMAGE output must not land on a STRING prompt input'
        ).toEqual([])
        expect(after).toEqual(before)
      })

      await test.step('and the prompt widget is still usable', async () => {
        const promptWidget = agentConversation.vueNodes
          .getNodeLocator(PROMPT_NODE_ID)
          .getByLabel(PROMPT_WIDGET, { exact: true })
        await expect(promptWidget).toBeVisible()
        await expect(promptWidget).toBeEditable()
      })
    })
  }
)
