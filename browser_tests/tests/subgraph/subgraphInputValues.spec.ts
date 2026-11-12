import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { NodeBadgeMode } from '@/types/nodeSource'

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
        const panel = comfyPage.page.getByTestId('subgraph-input-values')
        const heading = panel.getByRole('heading')
        const exit = panel.getByRole('button', {
          name: 'Exit subgraph',
          exact: true
        })
        const input = panel.getByRole('textbox', { name: 'text', exact: true })

        await test.step('Entering Host A identifies the instance and preserves saved values', async () => {
          await renderer.enter(comfyPage, '11')
          await expect(panel).toBeVisible()
          await expect(heading).toHaveText('Host A · #11')
          await expect(panel.getByRole('combobox')).toHaveCount(0)
          await expect(input).toHaveValue('')
          expect(await savedValues()).toEqual(initial)
        })

        await test.step('Editing inside Host A changes only its promoted value', async () => {
          await input.fill('boundary-host-a')
          await exit.focus()
          await expect
            .poll(async () => (await savedValues()).hosts)
            .toEqual([
              { id: '11', values: ['boundary-host-a'] },
              { id: '12', values: [''] }
            ])
          expect((await savedValues()).defaults).toEqual(initial.defaults)
          await panel
            .getByRole('button', { name: 'Collapse', exact: true })
            .click()
          expect((await savedValues()).inputBounds).toEqual(initial.inputBounds)
          await panel
            .getByRole('button', { name: 'Expand', exact: true })
            .click()
        })

        await test.step('Leaving the subgraph and entering Host B changes the editing target', async () => {
          await exit.getByText('Exit subgraph', { exact: true }).click()
          await expect(panel).toBeHidden()
          await renderer.enter(comfyPage, '12')
          await expect(heading).toHaveText('Host B · #12')
          await expect(input).toHaveValue('')
          await input.fill('boundary-host-b')
          await exit.focus()
          await expect
            .poll(async () => (await savedValues()).hosts)
            .toEqual([
              { id: '11', values: ['boundary-host-a'] },
              { id: '12', values: ['boundary-host-b'] }
            ])
        })

        await test.step('Workflow undo and redo restore the host values', async () => {
          await exit.press('Control+z')
          await expect
            .poll(async () => (await savedValues()).hosts)
            .toEqual([
              { id: '11', values: ['boundary-host-a'] },
              { id: '12', values: [''] }
            ])
          await panel
            .getByRole('button', { name: 'Collapse', exact: true })
            .press('Control+y')
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
          await expect(heading).toHaveText('Host B · #12')
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
          const boundary = await comfyPage.page.evaluate(() => {
            const app = window.app
            if (!app) throw new Error('Expected an active application')
            const graph = app.canvas.graph
            if (!graph || !('inputNode' in graph)) {
              throw new Error('Expected the entered subgraph')
            }
            const [x, y] = app.canvasPosToClientPos([
              graph.inputNode.boundingRect[0],
              graph.inputNode.boundingRect[1]
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
          await expect(panel).not.toBeInViewport()
          await expect
            .poll(() =>
              panel.evaluate((element) => {
                const app = window.app
                const graph = app?.canvas.graph
                if (!app || !graph || !('inputNode' in graph)) {
                  throw new Error('Expected an entered subgraph')
                }
                const [x, y] = app.canvasPosToClientPos([
                  graph.inputNode.boundingRect[0],
                  graph.inputNode.boundingRect[1]
                ])
                const bounds = element.getBoundingClientRect()
                return Math.abs(bounds.x - x) < 1 && Math.abs(bounds.y - y) < 1
              })
            )
            .toBe(true)
          await expect(heading).toHaveText('Host B · #12')
          await expect(input).toHaveValue('boundary-host-b')
        })
      })
    }
  )
}

test.describe(
  'Subgraph input badge placement',
  { tag: ['@subgraph', '@vue-nodes'] },
  () => {
    test('uses the same positive badge gap as an ordinary node', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting(
        'Comfy.NodeBadge.NodeIdBadgeMode',
        NodeBadgeMode.ShowAll
      )
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/shared-definition-two-hosts-promoted-text'
      )
      await comfyPage.vueNodes.enterSubgraph('11')
      await comfyPage.canvasOps.waitForViewToSettle()
      const interior = await comfyPage.nodeOps.getNodeRefByType(
        'CLIPTextEncode',
        true
      )
      const ordinary = comfyPage.vueNodes.getNodeLocator(String(interior.id))
      const input = comfyPage.page.getByTestId('subgraph-input-values')
      const [ordinaryBounds, ordinaryBadge, inputBounds, inputBadge] =
        await Promise.all([
          ordinary.boundingBox(),
          ordinary.getByTestId('node-badges').boundingBox(),
          input.boundingBox(),
          input.getByRole('img', { name: 'Subgraph' }).boundingBox()
        ])
      if (!ordinaryBounds || !ordinaryBadge || !inputBounds || !inputBadge) {
        throw new Error('Expected both native nodes and their badges')
      }
      const nativeGap =
        ordinaryBounds.y - ordinaryBadge.y - ordinaryBadge.height
      const inputGap = inputBounds.y - inputBadge.y - inputBadge.height

      expect(nativeGap).toBeGreaterThan(0)
      expect(inputGap).toBeCloseTo(nativeGap, 1)
    })
  }
)
