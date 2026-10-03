import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { test } from '@e2e/fixtures/agentInputOrderFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import {
  hostPrompt,
  hostVisibleValues,
  messageId,
  staleCanvasPrompt,
  staleVisibleValues,
  threadId
} from '@e2e/fixtures/data/agent/inputOrder'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'

/** Node id → serialized execution inputs, as `/api/prompt` would receive them. */
function serializedInputs(page: Page) {
  return page.evaluate(async () =>
    Object.fromEntries(
      Object.entries((await window.app!.graphToPrompt()).output).map(
        ([id, node]) => [id, node.inputs]
      )
    )
  )
}

/**
 * Node 2's inputs that must change when the host's catch-up lands. The three
 * dimensions are the regression itself; `ref_image_size` is a value no
 * binding feeds, so it separates "the frame arrived" from "the bindings were
 * recomputed".
 */
const DIVERGENT_TARGET_INPUTS = [
  'width',
  'height',
  'length',
  'ref_image_size'
] as const

test.describe(
  'Agent follower input mapping after saved autogrow inputs',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test('applies the host named input bindings over a stale canvas', async ({
      page,
      inputOrderHost
    }) => {
      // The premise every assertion below rests on: the canvas the fixture
      // loaded disagrees with the host document on each value this spec goes
      // on to assert. An edit that collapsed the two would make those
      // assertions true before any frame arrived, so it fails here instead of
      // passing vacuously there.
      expect(staleCanvasPrompt['1']).not.toEqual(hostPrompt['1'])
      for (const input of DIVERGENT_TARGET_INPUTS) {
        expect(staleCanvasPrompt['2'][input]).not.toEqual(
          hostPrompt['2'][input]
        )
      }

      const nodes = new VueNodeHelpers(page)
      const source = nodes.getNodeLocator('1')
      const target = nodes.getNodeLocator('2')

      await test.step('canvas starts on the stale revision', async () => {
        await expect(source).toBeVisible()
        await expect(target).toBeVisible()
        await expect(
          source.getByLabel('width', { exact: true }).getByRole('spinbutton')
        ).toHaveValue(staleVisibleValues.width)
        await expect(
          source.getByLabel('height', { exact: true }).getByRole('spinbutton')
        ).toHaveValue(staleVisibleValues.height)
        await expect(
          source.getByLabel('length', { exact: true }).getByRole('spinbutton')
        ).toHaveValue(staleVisibleValues.length)
        await expect(
          source.getByRole('textbox', { name: 'prompt', exact: true })
        ).toHaveValue(staleVisibleValues.prompt)
        await expect(
          target.getByRole('combobox', { name: 'ref_image_size', exact: true })
        ).toHaveText(staleVisibleValues.refImageSize)
        await expect
          .poll(() => serializedInputs(page))
          .toEqual(staleCanvasPrompt)
      })

      await test.step('host answers the subscribe with its catch-up', async () => {
        const panel = new AgentPanel(page)
        await panel.open()
        await panel.selectWorkflow()
        await panel.sendMessage('Show the saved workflow')
        await expect(
          panel.root.getByText(enMessages.agent.thinking).first()
        ).toBeVisible()
        await inputOrderHost.waitForSubscribe()
        inputOrderHost.send({
          type: 'agent_message_done',
          data: { message_id: messageId, thread_id: threadId }
        })
      })

      await test.step('host values replace the stale ones on the canvas', async () => {
        await expect(
          source.getByLabel('width', { exact: true }).getByRole('spinbutton')
        ).toHaveValue(hostVisibleValues.width)
        await expect(
          source.getByLabel('height', { exact: true }).getByRole('spinbutton')
        ).toHaveValue(hostVisibleValues.height)
        await expect(
          source.getByLabel('length', { exact: true }).getByRole('spinbutton')
        ).toHaveValue(hostVisibleValues.length)
        await expect(
          source.getByRole('textbox', { name: 'prompt', exact: true })
        ).toHaveValue(hostVisibleValues.prompt)
        await expect(
          target.getByRole('combobox', { name: 'ref_image_size', exact: true })
        ).toHaveText(hostVisibleValues.refImageSize)
      })

      await test.step('host bindings reach the execution payload', async () => {
        await expect.poll(() => serializedInputs(page)).toEqual(hostPrompt)

        await expect
          .poll(() =>
            page.evaluate(async () => {
              const output = (await window.app!.graphToPrompt()).output
              return Object.hasOwn(output['2'].inputs, 'ref_images.ref_image_2')
            })
          )
          .toBe(false)
      })
    })
  }
)
