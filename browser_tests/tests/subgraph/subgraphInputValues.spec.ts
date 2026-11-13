import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
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
              inputBounds: workflow.definitions?.subgraphs?.map(
                (definition) => definition.inputNode.bounding
              ),
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
        const { inputPanel: panel, exitButton } = comfyPage.subgraph
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
          await exitButton.getByText('Exit subgraph', { exact: true }).click()
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
          await comfyPage.keyboard.undo(exitButton)
          await expect
            .poll(async () => (await savedValues()).hosts)
            .toEqual([
              { id: '11', values: ['boundary-host-a'] },
              { id: '12', values: [''] }
            ])
          await comfyPage.keyboard.redo(exitButton)
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
