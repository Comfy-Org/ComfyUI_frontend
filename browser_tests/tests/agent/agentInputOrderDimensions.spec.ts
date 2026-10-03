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

test.describe(
  'Agent follower input mapping after saved autogrow inputs',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test('applies the host named input bindings over a stale canvas', async ({
      page,
      inputOrderHost
    }) => {
      // The premise every assertion below rests on: the canvas the fixture
      // loaded disagrees with the host document on node 1's widget values,
      // on each of node 2's three dimension bindings, and on its
      // `ref_image_size`. An edit that collapsed any one of those would make
      // the matching assertion true before a frame arrived, so it fails here
      // instead of passing vacuously there.
      // Destructured because `length` here is one of node 2's input names,
      // and `expect(x.length)` reads to the Playwright lint rule as an
      // array-length assertion.
      const {
        width: staleWidth,
        height: staleHeight,
        length: staleLength,
        ref_image_size: staleRefImageSize
      } = staleCanvasPrompt['2']
      const {
        width: hostWidth,
        height: hostHeight,
        length: hostLength,
        ref_image_size: hostRefImageSize
      } = hostPrompt['2']
      expect(staleCanvasPrompt['1']).not.toEqual(hostPrompt['1'])
      expect(staleWidth).not.toEqual(hostWidth)
      expect(staleHeight).not.toEqual(hostHeight)
      expect(staleLength).not.toEqual(hostLength)
      expect(staleRefImageSize).not.toEqual(hostRefImageSize)

      // The host's three named bindings, pinned as literals rather than read
      // off the fixture: `seed` and `hostPrompt` are both generated from one
      // origin map, so a wrong permutation in it would move the fixture and
      // the expectation together and the comparison below would still pass.
      // Node 1 names output slots 0/1/2 `width`/`height`/`length`.
      expect(hostWidth).toEqual(['1', 0])
      expect(hostHeight).toEqual(['1', 1])
      expect(hostLength).toEqual(['1', 2])

      const executionInputs = () =>
        page.evaluate(async () =>
          Object.fromEntries(
            Object.entries((await window.app!.graphToPrompt()).output).map(
              ([id, node]) => [id, node.inputs]
            )
          )
        )

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
        await expect.poll(executionInputs).toEqual(staleCanvasPrompt)
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
        await expect.poll(executionInputs).toEqual(hostPrompt)

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
