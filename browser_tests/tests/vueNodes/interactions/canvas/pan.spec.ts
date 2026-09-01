import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe('Vue Nodes Canvas Pan', { tag: '@vue-nodes' }, () => {
  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.canvasOps.resetView()
  })

  test(
    'Middle-click drag on a Vue node pans canvas',
    { tag: ['@canvas'] },
    async ({ comfyPage, comfyMouse }) => {
      const node = comfyPage.vueNodes.getNodeByTitle('Load Checkpoint')
      const offsetBefore = await comfyPage.canvasOps.getOffset()

      await comfyMouse.middleDragFromCenter(
        node,
        { x: 140, y: 90 },
        { steps: 10 }
      )

      await expect
        .poll(() => comfyPage.canvasOps.getOffset())
        .not.toEqual(offsetBefore)
    }
  )

  test('spacebar panning', async ({ comfyPage, comfyMouse }) => {
    await comfyPage.settings.setSetting(
      'Comfy.Canvas.NavigationMode',
      'standard'
    )
    await comfyPage.workflow.loadWorkflow('vueNodes/simple-triple')
    const node = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
    const [nodeRef] = await comfyPage.nodeOps.getNodeRefsByTitle('KSampler')
    if (!nodeRef) throw new Error('KSampler is not rendered')
    const softExpect = expect.configure({ soft: true })

    await test.step('Space + click on a node starts a pan', async () => {
      const offsetBefore = await comfyPage.canvasOps.getOffset()

      await comfyPage.canvas.focus()
      await using releaseSpace = await comfyPage.keyboard.hold('Space')
      await softExpect.poll(() => comfyPage.canvasOps.isReadOnly()).toBe(true)
      await comfyMouse.dragElementBy(node.root, { x: -300, y: 0 })
      await releaseSpace.disposeAsync()

      await softExpect
        .poll(() => comfyPage.canvasOps.getOffset())
        .not.toEqual(offsetBefore)
    })

    await test.step('Space switches node dragging to canvas panning', async () => {
      await node.header.hover()
      await using mouseRelease = await comfyMouse.hold()
      await comfyPage.page.mouse.move(500, 500, { steps: 5 })
      const offsetBeforePan = await comfyPage.canvasOps.getOffset()

      await using spaceRelease = await comfyPage.keyboard.hold('Space')
      await comfyPage.page.mouse.move(400, 400, { steps: 5 })
      await softExpect
        .poll(() => comfyPage.canvasOps.getOffset())
        .not.toEqual(offsetBeforePan)

      await test.step('Releasing Space resumes node dragging', async () => {
        await spaceRelease.disposeAsync()
        const offsetAfterPan = await comfyPage.canvasOps.getOffset()
        const positionBeforeResume = [
          ...(await nodeRef.getProperty<[number, number]>('pos'))
        ]
        await comfyPage.page.mouse.move(500, 500, { steps: 5 })
        await comfyPage.nextFrame()

        softExpect(await comfyPage.canvasOps.getOffset()).toEqual(
          offsetAfterPan
        )
        await softExpect
          .poll(async () => [
            ...(await nodeRef.getProperty<[number, number]>('pos'))
          ])
          .not.toEqual(positionBeforeResume)
        await mouseRelease.disposeAsync()
      })
    })
  })

  test(
    'Space in a focused text widget does not start canvas panning',
    { tag: ['@canvas', '@widget'] },
    async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('inputs/string_input')
      const input = comfyPage.vueNodes
        .getWidgetByName('Node With String Input', 'string_input')
        .first()

      await input.focus()
      await input.press('Space')

      await expect
        .poll(async () => [
          await input.inputValue(),
          await comfyPage.canvasOps.isReadOnly()
        ])
        .toEqual([' ', false])
    }
  )

  test(
    'Space in a focused native select does not start canvas panning',
    { tag: ['@canvas', '@widget'] },
    async ({ comfyPage, comfyMouse }) => {
      await comfyPage.workflow.loadWorkflow('vueNodes/simple-triple')
      const node = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
      const [nodeRef] = await comfyPage.nodeOps.getNodeRefsByTitle('KSampler')
      if (!nodeRef) throw new Error('KSampler is not rendered')
      const positionBeforeDrag = [
        ...(await nodeRef.getProperty<[number, number]>('pos'))
      ]
      await node.root.evaluate((element) => {
        const select = document.createElement('select')
        select.ariaLabel = 'Native select'
        select.append(document.createElement('option'))
        element.append(select)
      })
      const select = node.root.getByRole('combobox', {
        name: 'Native select'
      })

      await test.step('Hold and drag the node', async () => {
        await node.header.hover()
        await using mouseRelease = await comfyMouse.hold()
        await comfyPage.page.mouse.move(500, 500, { steps: 5 })
        await expect
          .poll(async () => [
            ...(await nodeRef.getProperty<[number, number]>('pos'))
          ])
          .not.toEqual(positionBeforeDrag)

        await test.step('Press Space in the focused native select', async () => {
          await select.focus()
          await using spaceRelease = await comfyPage.keyboard.hold('Space')

          await expect(select).toBeFocused()
          await expect.poll(() => comfyPage.canvasOps.isReadOnly()).toBe(false)
          await spaceRelease.disposeAsync()
        })

        await mouseRelease.disposeAsync()
      })
    }
  )

  test(
    'releasing the pointer during Space-pan ends the node drag',
    { tag: ['@canvas', '@node'] },
    async ({ comfyPage, comfyMouse }) => {
      await comfyPage.workflow.loadWorkflow('vueNodes/simple-triple')
      const node = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
      const [nodeRef] = await comfyPage.nodeOps.getNodeRefsByTitle('KSampler')
      const headerBox = await node.header.boundingBox()
      if (!nodeRef || !headerBox) throw new Error('KSampler is not rendered')
      const start = {
        x: headerBox.x + headerBox.width / 2,
        y: headerBox.y + headerBox.height / 2
      }

      const positionAfterRelease =
        await test.step('Release the pointer while Space-panning', async () => {
          await comfyPage.page.mouse.move(start.x, start.y)
          await using mouseRelease = await comfyMouse.hold()
          await comfyPage.page.mouse.move(start.x + 40, start.y + 40, {
            steps: 5
          })
          await using spaceRelease = await comfyPage.keyboard.hold('Space')
          await comfyPage.page.mouse.move(start.x + 80, start.y + 80, {
            steps: 5
          })
          await mouseRelease.disposeAsync()
          await spaceRelease.disposeAsync()

          return [...(await nodeRef.getProperty<[number, number]>('pos'))]
        })

      await test.step('Further pointer movement leaves the node in place', async () => {
        const headerAfterRelease = await node.header.boundingBox()
        if (!headerAfterRelease) throw new Error('KSampler is not rendered')
        await comfyPage.page.mouse.move(
          headerAfterRelease.x + 5,
          headerAfterRelease.y + 5
        )
        await comfyPage.nextFrame()

        await expect
          .poll(async () => [
            ...(await nodeRef.getProperty<[number, number]>('pos'))
          ])
          .toEqual(positionAfterRelease)
      })
    }
  )

  test(
    '@mobile Can pan with touch',
    { tag: '@screenshot' },
    async ({ comfyPage }) => {
      const offsetBefore = await comfyPage.canvasOps.getOffset()
      const safeSpot = await comfyPage.canvas.evaluate((canvas) => {
        const { width, height } = canvas.getBoundingClientRect()
        for (let y = 100; y < height - 100; y += 25) {
          for (let x = 75; x < width - 25; x += 25) {
            if (document.elementFromPoint(x, y) === canvas) return { x, y }
          }
        }
        throw new Error('No unobstructed canvas point found for touch pan')
      })

      await comfyPage.canvasOps.panWithTouch({ x: 64, y: 64 }, safeSpot)

      // Fail on a pan that never landed here, not as a screenshot diff.
      await expect
        .poll(() => comfyPage.canvasOps.getOffset())
        .not.toEqual(offsetBefore)

      // Tolerates text anti-aliasing noise in the widget value text.
      await expect(comfyPage.canvas).toHaveScreenshot(
        'vue-nodes-paned-with-touch.png',
        { maxDiffPixels: 100 }
      )
    }
  )
})
