import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { VueNodeFixture } from '@e2e/fixtures/utils/vueNodeFixtures'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

for (const renderer of [
  {
    name: 'classic',
    tags: ['@subgraph', '@widget'],
    enter: (comfyPage: ComfyPage, id: string) =>
      comfyPage.nodeOps
        .getNodeRefById(id)
        .then((host) => host.navigateIntoSubgraph())
  },
  {
    name: 'Vue',
    tags: ['@subgraph', '@widget', '@vue-nodes'],
    enter: (comfyPage: ComfyPage, id: string) =>
      comfyPage.vueNodes.enterSubgraph(id)
  }
]) {
  test.describe(
    `Subgraph input values in ${renderer.name}`,
    { tag: renderer.tags },
    () => {
      test('edits the identified host without changing its sibling or interior defaults', async ({
        comfyPage
      }) => {
        const savedValues = () =>
          comfyPage.page.evaluate(() => {
            const root = window.app?.rootGraph
            if (!root) throw new Error('Expected an active workflow')
            const workflow = root.asSerialisable()
            return {
              hosts: workflow.nodes.map((node) => ({
                id: String(node.id),
                values: node.widgets_values
              })),
              defaults: workflow.definitions?.subgraphs?.flatMap(
                (definition) =>
                  definition.nodes?.map((node) => ({
                    id: String(node.id),
                    values: node.widgets_values
                  })) ?? []
              )
            }
          })
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/shared-definition-two-hosts-promoted-text'
        )
        const initial = await savedValues()
        const { inputPanel: panel } = comfyPage.subgraph
        const input = panel.getByRole('textbox', { name: 'text', exact: true })

        await test.step('Entering Host A identifies the instance and preserves saved values', async () => {
          await renderer.enter(comfyPage, '11')
          await expect(panel).toHaveAccessibleName('Host A · #11')
          await expect(input).toHaveValue('')
          expect(await savedValues()).toEqual(initial)
        })

        await test.step('Editing inside Host A changes only its promoted value', async () => {
          await comfyPage.subgraph.fillInput('text', 'boundary-host-a')
          await expect.poll(savedValues).toEqual({
            ...initial,
            hosts: [
              { id: '11', values: ['boundary-host-a'] },
              { id: '12', values: [''] }
            ]
          })
        })

        await test.step('Leaving the subgraph and entering Host B changes the editing target', async () => {
          await comfyPage.subgraph.exitViaBreadcrumb()
          await expect(panel).toBeHidden()
          await renderer.enter(comfyPage, '12')
          await expect(panel).toHaveAccessibleName('Host B · #12')
          await expect(input).toHaveValue('')
          await comfyPage.subgraph.fillInput('text', 'boundary-host-b')
          await expect
            .poll(async () => (await savedValues()).hosts)
            .toEqual([
              { id: '11', values: ['boundary-host-a'] },
              { id: '12', values: ['boundary-host-b'] }
            ])
        })

        await test.step('Workflow undo and redo restore the host values', async () => {
          await comfyPage.keyboard.undo()
          await expect
            .poll(async () => (await savedValues()).hosts)
            .toEqual([
              { id: '11', values: ['boundary-host-a'] },
              { id: '12', values: [''] }
            ])
          await expect(panel).toHaveAccessibleName('Host B · #12')
          await comfyPage.keyboard.redo()
          await expect
            .poll(async () => (await savedValues()).hosts)
            .toEqual([
              { id: '11', values: ['boundary-host-a'] },
              { id: '12', values: ['boundary-host-b'] }
            ])
        })

        await test.step('Saving and reloading preserves both host values and interior defaults', async () => {
          await comfyPage.subgraph.exitViaBreadcrumb()
          await comfyPage.subgraph.serializeAndReload()
          await renderer.enter(comfyPage, '12')
          await expect(panel).toHaveAccessibleName('Host B · #12')
          await expect(input).toHaveValue('boundary-host-b')
          expect((await savedValues()).defaults).toEqual(initial.defaults)
        })

        await test.step('Panning and zooming move the input node with the canvas beyond the viewport', async () => {
          {
            await using _pan = await comfyPage.keyboard.hold('Space')
            await comfyPage.canvasOps.pan(
              { x: 2100, y: 1500 },
              { x: 1100, y: 350 }
            )
          }
          await expect(panel).not.toBeInViewport()
          const scale = await comfyPage.canvasOps.getScale()
          {
            await using _zoom = await comfyPage.keyboard.hold('Control')
            await comfyPage.page.mouse.move(1100, 350)
            await comfyPage.page.mouse.wheel(0, -120)
          }
          await expect
            .poll(() => comfyPage.canvasOps.getScale())
            .not.toBe(scale)
          await expect(panel).not.toBeInViewport()
          await expect
            .poll(async () => {
              const bounds = await comfyPage.subgraph.getInputBounds()
              const expected = await comfyPage.canvasOps.toAbsolute(bounds)
              const actual = await panel.boundingBox()
              if (!actual) return Number.POSITIVE_INFINITY
              return Math.max(
                Math.abs(actual.x - expected.x),
                Math.abs(actual.y - expected.y)
              )
            })
            .toBeLessThan(1)
        })
      })
    }
  )
}

test.describe(
  'Subgraph IO panel in Vue',
  { tag: ['@subgraph', '@vue-nodes'] },
  () => {
    test('moves the input node with its linked port when dragged by a label row', async ({
      comfyPage,
      comfyMouse
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/shared-definition-two-hosts-promoted-text'
      )
      await comfyPage.vueNodes.enterSubgraph('11')
      const target = await comfyPage.nodeOps.getNodeRefById('10')
      const input = await target.getInputByName('clip')
      const { inputPanel } = comfyPage.subgraph

      await test.step('Dragging the clip label row moves the node, its port and its link together', async () => {
        const before = await inputPanel.boundingBox()
        if (!before) throw new Error('Expected the input node')
        const slot = await comfyPage.subgraph.getInputSlot('clip').getPosition()
        await comfyMouse.dragElementBy(
          inputPanel.getByText('clip', { exact: true }),
          { x: 20, y: 30 }
        )
        await expect
          .poll(async () => (await inputPanel.boundingBox())?.x)
          .toBeCloseTo(before.x + 20, 0)
        await expect
          .poll(async () => (await inputPanel.boundingBox())?.y)
          .toBeCloseTo(before.y + 30, 0)
        const moved = await comfyPage.subgraph
          .getInputSlot('clip')
          .getPosition()
        expect(moved.x).toBeCloseTo(slot.x + 20, 0)
        expect(moved.y).toBeCloseTo(slot.y + 30, 0)
        await expect
          .poll(() => input.getLink())
          .toMatchObject({
            origin_id: '-10',
            origin_slot: 1,
            target_id: target.id,
            target_slot: 1
          })
      })
    })

    test(
      'creates a widget input from the empty socket and disconnects it with Ctrl+Alt click',
      { tag: '@widget' },
      async ({ comfyPage }) => {
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/shared-definition-two-hosts-promoted-text'
        )
        await comfyPage.vueNodes.enterSubgraph('11')
        const sampler = await comfyPage.nodeOps.getNodeRefByType(
          'KSampler',
          true
        )
        const samplerSteps = new VueNodeFixture(
          comfyPage.vueNodes.getNodeLocator(String(sampler.id))
        ).getSlot('steps')
        const { inputPanel, inputPorts, addInputSocket } = comfyPage.subgraph
        const steps = comfyPage.subgraph.inputSocket('steps')
        const stepsWidget = inputPanel.getByRole('spinbutton', {
          name: 'steps',
          exact: true
        })

        await test.step('Dragging the empty socket to a widget input creates its native promoted control', async () => {
          await addInputSocket.dragTo(samplerSteps)
          await expect(inputPorts).toHaveCount(7)
          await expect(stepsWidget).toHaveValue('20')
          await expect(addInputSocket).toHaveCount(1)
        })

        await test.step('Ctrl+Alt clicking the port disconnects its link', async () => {
          await expect
            .poll(() => comfyPage.vueNodes.isSlotConnected(samplerSteps))
            .toBe(true)
          await steps.click({ modifiers: ['Control', 'Alt'] })
          await expect
            .poll(() => comfyPage.vueNodes.isSlotConnected(samplerSteps))
            .toBe(false)
          await expect(steps).toHaveCount(1)
          await expect(stepsWidget).toHaveCount(0)
        })
      }
    )

    test(
      'edits a shared Primitive source without replacing either connection',
      { tag: '@widget' },
      async ({ comfyMouse, comfyPage }) => {
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/subgraph-promoted-int-text-with-primitives'
        )
        const source = await comfyPage.nodeOps.getNodeRefById('3')
        const host = await comfyPage.nodeOps.getNodeRefById('1')
        const otherConsumer = await comfyPage.nodeOps.getNodeRefById('5')
        const reroute = await comfyPage.nodeOps.addNode('Reroute', undefined, {
          x: 360,
          y: 600
        })
        const panel = comfyPage.subgraph.inputPanel

        await test.step('Connect the String source through a reroute with two consumers', async () => {
          await comfyPage.vueNodes
            .getOutputSlotConnectionDot(String(source.id), 0)
            .dragTo(
              comfyPage.vueNodes.getInputSlotConnectionDot(
                String(reroute.id),
                0
              )
            )
          await comfyPage.vueNodes
            .getOutputSlotConnectionDot(String(reroute.id), 0)
            .dragTo(
              comfyPage.vueNodes.getInputSlotConnectionDot(String(host.id), 0)
            )
          await comfyPage.vueNodes
            .getOutputSlotConnectionDot(String(reroute.id), 0)
            .dragTo(
              comfyPage.vueNodes.getInputSlotConnectionDot(
                String(otherConsumer.id),
                0
              )
            )
        })

        await test.step('Edit the owning Primitive from inside the subgraph', async () => {
          await comfyPage.vueNodes.enterSubgraph('1')
          await expect(panel.getByText(/← .* #3$/)).toBeVisible()
          await expect(
            panel.getByRole('img', { name: 'Shared source', exact: true })
          ).toBeVisible()
          await expect(
            panel.getByRole('textbox', { name: 'value', exact: true })
          ).toHaveValue('external prompt')
          await comfyPage.subgraph.fillInput('value', 'edited upstream source')
        })

        await test.step('Right-clicking a boundary widget does not open the selected interior node menu', async () => {
          const interior = await comfyPage.nodeOps.getNodeRefByType(
            'CLIPTextEncode',
            true
          )
          await comfyPage.vueNodes
            .getNodeLocator(String(interior.id))
            .getByTestId('node-title')
            .click()
          await expect
            .poll(() => comfyPage.nodeOps.getSelectedNodeIds())
            .toEqual([interior.id])
          const before =
            await comfyPage.nodeOps.getSerializedGraphWithoutViewport()
          await comfyMouse.clickCenter(
            panel.getByRole('spinbutton', { name: 'width', exact: true }),
            { button: 'right' }
          )
          await comfyPage.nextFrame()
          const { ariaMenu, litegraphMenu, litegraphContextMenu } =
            comfyPage.contextMenu
          await expect(
            ariaMenu.or(litegraphMenu).or(litegraphContextMenu)
          ).toBeHidden()
          expect(
            await comfyPage.nodeOps.getSerializedGraphWithoutViewport()
          ).toEqual(before)
        })

        await test.step('Locating the source shows the same value and both links outside', async () => {
          await comfyPage.canvasOps.pan({ x: 300, y: 0 }, { x: 950, y: 420 })
          await panel
            .getByRole('button', { name: 'Locate source node', exact: true })
            .click()
          await expect(panel).toBeHidden()
          await expect(
            comfyPage.vueNodes
              .getNodeLocator('3')
              .getByRole('textbox', { name: 'value', exact: true })
          ).toHaveValue('edited upstream source')
          await (await source.getOutput(0)).expectLinkCount(1)
          await (await reroute.getOutput(0)).expectLinkCount(2)
          await (await host.getInput(0)).expectLinkCount(1)
          await (await otherConsumer.getInput(0)).expectLinkCount(1)
        })
      }
    )

    test(
      'grows the native textarea with the input node while preserving its value',
      { tag: '@widget' },
      async ({ comfyPage }) => {
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/shared-definition-two-hosts-promoted-text'
        )
        await comfyPage.vueNodes.enterSubgraph('11')
        const panel = comfyPage.subgraph.inputPanel
        const input = panel.getByRole('textbox', { name: 'text', exact: true })
        const sizes = () =>
          panel.or(input).evaluateAll((elements) =>
            elements.map((element) => ({
              width: element.clientWidth,
              height: element.clientHeight
            }))
          )
        await comfyPage.subgraph.fillInput('text', 'resized instance text')
        const before = await panel.boundingBox()
        const textBefore = await input.boundingBox()
        if (!before || !textBefore) {
          throw new Error('Expected the input node and native textarea')
        }

        await test.step('Drag the native southeast resize handle', async () => {
          await new VueNodeFixture(panel).resizeFromCorner('SE', 120, 100)
          await expect
            .poll(async () => (await panel.boundingBox())?.width)
            .toBeGreaterThan(before.width + 100)
          await expect
            .poll(async () => (await panel.boundingBox())?.height)
            .toBeGreaterThan(before.height + 80)
          await expect
            .poll(async () => (await input.boundingBox())?.width)
            .toBeGreaterThan(textBefore.width + 100)
          await expect
            .poll(async () => (await input.boundingBox())?.height)
            .toBeGreaterThan(textBefore.height + 80)
          await expect(input).toHaveValue('resized instance text')
        })

        await test.step('Saving and reloading preserves the node and textarea sizes', async () => {
          const resized = await sizes()
          await comfyPage.subgraph.exitViaBreadcrumb()
          await comfyPage.subgraph.serializeAndReload()
          await comfyPage.vueNodes.enterSubgraph('11')
          await expect.poll(sizes).toEqual(resized)
        })
      }
    )

    test('creates outputs by dragging to and from the trailing empty port', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/shared-definition-two-hosts-promoted-text'
      )
      await comfyPage.vueNodes.enterSubgraph('11')
      const { outputPorts, addOutputSocket } = comfyPage.subgraph
      const sampler = await comfyPage.nodeOps.getNodeRefByType('KSampler', true)
      const encoder = await comfyPage.nodeOps.getNodeRefByType(
        'CLIPTextEncode',
        true
      )

      await test.step('Drag from the empty port to an interior output', async () => {
        await expect(outputPorts).toHaveCount(0)
        await addOutputSocket.dragTo(
          comfyPage.vueNodes.getOutputSlotConnectionDot(String(sampler.id), 0)
        )
        await expect(outputPorts).toHaveCount(1)
        await expect(outputPorts.first()).toHaveAccessibleName('LATENT')
        await (await sampler.getOutput(0)).expectLinkCount(1)
      })

      await test.step('Drag from an interior output to the empty port', async () => {
        await comfyPage.vueNodes
          .getOutputSlotConnectionDot(String(encoder.id), 0)
          .dragTo(addOutputSocket)
        await expect(outputPorts).toHaveCount(2)
        await expect(outputPorts.nth(1)).toHaveAccessibleName('CONDITIONING')
        await (await encoder.getOutput(0)).expectLinkCount(1)
      })
    })
  }
)
