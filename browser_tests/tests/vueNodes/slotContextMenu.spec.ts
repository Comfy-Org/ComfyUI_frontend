import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe(
  'Vue node slot context menu',
  { tag: ['@vue-nodes', '@canvas'] },
  () => {
    test('renames, moves, and quick-connects the same output across renderers', async ({
      comfyPage
    }) => {
      await comfyPage.nodeOps.clearGraph()
      const source = await comfyPage.nodeOps.addNode(
        'EmptyLatentImage',
        undefined,
        { x: 160, y: 180 }
      )
      const target = await comfyPage.nodeOps.addNode('KSampler', undefined, {
        x: 760,
        y: 180
      })
      await comfyPage.nextFrame()

      const sourceNode =
        await comfyPage.vueNodes.getFixtureByTitle('Empty Latent Image')
      const output = sourceNode.getSlot('LATENT')
      comfyPage.page.once('dialog', (dialog) => dialog.accept('RENAMED_LATENT'))
      await output.click({ button: 'right' })
      await comfyPage.page.getByText('Rename slot', { exact: true }).click()

      await expect(sourceNode.root.getByText('RENAMED_LATENT')).toBeVisible()
      await sourceNode.getSlot('RENAMED_LATENT').click({ button: 'right' })
      await expect(
        comfyPage.page.getByText('Rename slot', { exact: true })
      ).toBeVisible()
      await comfyPage.page.keyboard.press('Escape')
      const beforeMove = await source.getPosition()
      await sourceNode.header.dragTo(sourceNode.header, {
        sourcePosition: { x: 60, y: 12 },
        targetPosition: { x: 180, y: 92 }
      })
      await comfyPage.nextFrame()
      await expect.poll(() => source.getPosition()).not.toEqual(beforeMove)

      await sourceNode.getSlot('RENAMED_LATENT').click({ button: 'right' })
      await comfyPage.page
        .getByText('latent_image @ KSampler', { exact: true })
        .click()

      await expect
        .poll(() =>
          comfyPage.page.evaluate(() => {
            const links = [...window.app!.graph.links.values()]
            return links.map((link) => ({
              source: link.origin_id,
              sourceSlot: link.origin_slot,
              target: link.target_id,
              targetSlot: link.target_slot,
              hasPaintedPath: Boolean(link.path)
            }))
          })
        )
        .toEqual([
          {
            source: source.id,
            sourceSlot: 0,
            target: target.id,
            targetSlot: 3,
            hasPaintedPath: true
          }
        ])

      await comfyPage.menu.topbar.setVueNodesEnabled(false)
      await comfyPage.nextFrame()
      await target.dragBy({ x: -120, y: 180 })
      await comfyPage.nextFrame()

      await expect
        .poll(() =>
          comfyPage.page.evaluate(
            ([sourceId, targetId]) => {
              const source = window.app!.graph.getNodeById(sourceId)
              const link = [...window.app!.graph.links.values()].find(
                (candidate) => candidate.target_id === targetId
              )
              return {
                label: source?.outputs[0].label,
                hasPaintedPath: Boolean(link?.path)
              }
            },
            [source.id, target.id] as const
          )
        )
        .toEqual({ label: 'RENAMED_LATENT', hasPaintedPath: true })
    })
  }
)
