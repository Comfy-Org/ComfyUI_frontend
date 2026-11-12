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
        const panel = comfyPage.page.getByTestId('subgraph-input-values')
        const hostPicker = panel.getByRole('combobox', {
          name: 'Editing values for'
        })
        const input = panel.getByRole('textbox', { name: 'text', exact: true })

        await test.step('Entering Host A identifies the instance and preserves saved values', async () => {
          await renderer.enter(comfyPage, '11')
          await expect(panel).toBeVisible()
          await expect(hostPicker).toHaveText('Host A · #11')
          await expect(input).toHaveValue('')
          expect(await savedValues()).toEqual(initial)
        })

        await test.step('Editing inside Host A changes only its promoted value', async () => {
          await input.fill('boundary-host-a')
          await hostPicker.focus()
          await expect
            .poll(async () => (await savedValues()).hosts)
            .toEqual([
              { id: '11', values: ['boundary-host-a'] },
              { id: '12', values: [''] }
            ])
          expect((await savedValues()).defaults).toEqual(initial.defaults)
        })

        await test.step('Selecting Host B changes the editing target without leaving the definition', async () => {
          await hostPicker.click()
          await comfyPage.page
            .getByRole('option', { name: 'Host B · #12', exact: true })
            .click()
          await expect(hostPicker).toHaveText('Host B · #12')
          await expect(input).toHaveValue('')
          await input.fill('boundary-host-b')
          await hostPicker.focus()
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
          await expect(hostPicker).toHaveText('Host B · #12')
          await expect(input).toHaveValue('boundary-host-b')
          expect((await savedValues()).defaults).toEqual(initial.defaults)
        })

        await test.step('Panning and zooming past the boundary keeps the editing controls onscreen', async () => {
          {
            await using _pan = await comfyPage.keyboard.hold('Space')
            await comfyPage.canvasOps.pan(
              { x: 2100, y: 1500 },
              { x: 1100, y: 350 }
            )
          }
          const boundary = await comfyPage.page.evaluate(() => {
            const app = window.app
            if (!app) throw new Error('Expected an active application')
            const graph = app.canvas.graph
            if (!graph || !('inputNode' in graph)) {
              throw new Error('Expected the entered subgraph')
            }
            const [x, y] = app.canvasPosToClientPos([
              graph.inputNode.pos[0],
              graph.inputNode.pos[1]
            ])
            return {
              x,
              y,
              width: window.innerWidth,
              height: window.innerHeight
            }
          })
          expect(boundary.x).toBeGreaterThan(boundary.width)
          expect(boundary.y).toBeGreaterThan(boundary.height)
          const readScale = () =>
            comfyPage.page.evaluate(() => {
              const app = window.app
              if (!app) throw new Error('Expected an active application')
              return app.canvas.ds.scale
            })
          const scale = await readScale()
          {
            await using _zoom = await comfyPage.keyboard.hold('Control')
            await comfyPage.page.mouse.move(1100, 350)
            await comfyPage.page.mouse.wheel(0, -120)
          }
          await expect.poll(readScale).not.toBe(scale)
          await expect
            .poll(() =>
              panel
                .or(hostPicker)
                .or(input)
                .evaluateAll((elements) =>
                  elements.map((element) => {
                    const { left, top, right, bottom } =
                      element.getBoundingClientRect()
                    return (
                      Math.min(
                        left,
                        top,
                        window.innerWidth - right,
                        window.innerHeight - bottom
                      ) >= 0
                    )
                  })
                )
            )
            .toEqual([true, true, true])
          await expect(hostPicker).toHaveText('Host B · #12')
          await expect(input).toHaveValue('boundary-host-b')
        })
      })
    }
  )
}
