import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  RENDERERS,
  addKSamplerWidget,
  callbackCount,
  center,
  dragHorizontally,
  firstSocketOffsets,
  nodeProperty,
  showKSamplerAtZoomOne,
  widgetRow,
  widgetValue
} from '@e2e/fixtures/helpers/nodes2AcceptanceInputs'

for (const renderer of RENDERERS) {
  test.describe(
    `Node input acceptance: ${renderer.name}`,
    { tag: ['@widget', '@node', '@nodes2-acceptance', ...renderer.tags] },
    () => {
      if (renderer.name === 'Nodes 2.0') {
        test('widget rows are 20 px tall', async ({ comfyPage }) => {
          await showKSamplerAtZoomOne(comfyPage)
          const cfg = await widgetRow(comfyPage, 'cfg')

          expect(cfg.height, 'row height').toBeCloseTo(20, 0)
        })

        test('widget rows are 24 px apart', async ({ comfyPage }) => {
          await showKSamplerAtZoomOne(comfyPage)
          const steps = await widgetRow(comfyPage, 'steps')
          const cfg = await widgetRow(comfyPage, 'cfg')

          expect(cfg.y - steps.y, 'row pitch').toBeCloseTo(24, 0)
        })
      }

      test('the first input and output sockets are centred 14 px below the body top', async ({
        comfyPage
      }) => {
        await showKSamplerAtZoomOne(comfyPage)
        const offsets = await firstSocketOffsets(comfyPage)

        expect(offsets.inputY, 'input socket y').toBeCloseTo(14, 0)
        expect(offsets.outputY, 'output socket y').toBeCloseTo(14, 0)
      })

      test('input sockets sit 10 px inside the left edge of the node', async ({
        comfyPage
      }) => {
        await showKSamplerAtZoomOne(comfyPage)

        expect((await firstSocketOffsets(comfyPage)).inputX).toBeCloseTo(10, 0)
      })

      test('output sockets sit 9 px inside the right edge of the node', async ({
        comfyPage
      }) => {
        await showKSamplerAtZoomOne(comfyPage)

        expect((await firstSocketOffsets(comfyPage)).outputX).toBeCloseTo(-9, 0)
      })

      test('a value change notifies the node, bumps the graph version and syncs the bound property', async ({
        comfyPage
      }) => {
        await showKSamplerAtZoomOne(comfyPage)
        await addKSamplerWidget(comfyPage, {
          type: 'number',
          name: 'acceptance_number',
          value: 1.5,
          options: {
            min: 0,
            max: 10,
            step2: 0.01,
            precision: 2,
            property: 'acceptance_property'
          }
        })
        await comfyPage.page.evaluate(() => {
          const node = window.app!.graph.nodes.find(
            (n) => n.type === 'KSampler'
          )!
          node.properties.acceptance_property = 1.5
          node.properties.acceptance_changes = 0
          node.onWidgetChanged = () => {
            node.properties.acceptance_changes =
              Number(node.properties.acceptance_changes) + 1
          }
        })
        const versionBefore = await comfyPage.page.evaluate(
          () => window.app!.graph._version
        )

        if (comfyPage.isVueNodes) {
          const row = comfyPage.vueNodes
            .getWidgetRowByLabel('KSampler', 'acceptance_number')
            .first()
          await comfyPage.vueNodes
            .getInputNumberControls(row)
            .incrementButton.click()
        } else {
          const row = await widgetRow(comfyPage, 'acceptance_number')
          await comfyPage.page.mouse.click(
            row.x + row.width - 5,
            row.y + row.height / 2
          )
        }

        await expect
          .poll(() => widgetValue(comfyPage, 'acceptance_number'))
          .toBeCloseTo(1.51, 5)
        const after = await comfyPage.page.evaluate(() => {
          const node = window.app!.graph.nodes.find(
            (n) => n.type === 'KSampler'
          )!
          return {
            changes: node.properties.acceptance_changes,
            property: node.properties.acceptance_property,
            version: window.app!.graph._version
          }
        })
        expect(after.changes, 'onWidgetChanged calls').toBe(1)
        expect(after.version, 'graph version').toBeGreaterThan(versionBefore)
        expect(after.property, 'bound property').toBeCloseTo(1.51, 5)
      })

      test('dragging a number moves it one step per screen pixel', async ({
        comfyPage
      }) => {
        await showKSamplerAtZoomOne(comfyPage)
        await comfyPage.page.evaluate(() => {
          const node = window.app!.graph.nodes.find(
            (n) => n.type === 'KSampler'
          )!
          node.widgets!.find((w) => w.name === 'seed')!.value = 1_000_000_000
          window.app!.canvas.setDirty(true, true)
        })
        await comfyPage.nextFrame()

        await dragHorizontally(
          comfyPage,
          center(await widgetRow(comfyPage, 'seed')),
          50
        )

        const moved = Number(await widgetValue(comfyPage, 'seed')) - 1e9
        expect(
          moved,
          '50 px at zoom 1 from seed 1e9, allowing one pixel of coordinate rounding'
        ).toBeGreaterThanOrEqual(49)
        expect(
          moved,
          '50 px at zoom 1 from seed 1e9, allowing one pixel of coordinate rounding'
        ).toBeLessThanOrEqual(51)
      })

      test('a read-only slider ignores drags', async ({ comfyPage }) => {
        await showKSamplerAtZoomOne(comfyPage)
        await addKSamplerWidget(comfyPage, {
          type: 'slider',
          name: 'acceptance_slider',
          value: 5,
          options: { min: 0, max: 10, step2: 0.5, read_only: true }
        })

        const start = comfyPage.isVueNodes
          ? center(
              (await comfyPage.vueNodes
                .getWidgetRowByLabel('KSampler', 'acceptance_slider')
                .first()
                .getByRole('slider')
                .boundingBox())!
            )
          : center(await widgetRow(comfyPage, 'acceptance_slider'))
        await dragHorizontally(comfyPage, start, 40)

        expect(await widgetValue(comfyPage, 'acceptance_slider')).toBe(5)
      })

      test('a single-line text widget reports its value once, when typing is committed', async ({
        comfyPage
      }) => {
        await showKSamplerAtZoomOne(comfyPage)
        await addKSamplerWidget(comfyPage, {
          type: 'text',
          name: 'acceptance_text',
          value: ''
        })

        if (comfyPage.isVueNodes) {
          await comfyPage.vueNodes
            .getWidgetRowByLabel('KSampler', 'acceptance_text')
            .first()
            .getByRole('textbox')
            .click()
        } else {
          const row = await widgetRow(comfyPage, 'acceptance_text')
          await comfyPage.page.mouse.click(center(row).x, center(row).y)
          await expect(
            comfyPage.page.locator('.graphdialog input')
          ).toBeFocused()
        }
        await comfyPage.page.keyboard.type('hello')
        expect(
          await callbackCount(comfyPage, 'acceptance_text'),
          'no callback before Enter'
        ).toBe(0)
        await comfyPage.page.keyboard.press('Enter')

        await expect
          .poll(() => widgetValue(comfyPage, 'acceptance_text'))
          .toBe('hello')
        expect(await callbackCount(comfyPage, 'acceptance_text')).toBe(1)
      })

      test('a disabled toggle with on/off labels ignores clicks', async ({
        comfyPage
      }) => {
        await showKSamplerAtZoomOne(comfyPage)
        await addKSamplerWidget(comfyPage, {
          type: 'toggle',
          name: 'acceptance_toggle',
          value: false,
          options: { on: 'yes', off: 'no' }
        })
        await comfyPage.page.evaluate(() => {
          const node = window.app!.graph.nodes.find(
            (n) => n.type === 'KSampler'
          )!
          node.widgets!.find((w) => w.name === 'acceptance_toggle')!.disabled =
            true
          window.app!.canvas.setDirty(true, true)
        })
        await comfyPage.nextFrame()

        if (comfyPage.isVueNodes) {
          const yes = await comfyPage.vueNodes
            .getWidgetRowByLabel('KSampler', 'acceptance_toggle')
            .first()
            .getByLabel('yes', { exact: true })
            .boundingBox()
          if (!yes) throw new Error('Toggle "yes" segment has no box')
          await comfyPage.page.mouse.click(center(yes).x, center(yes).y)
        } else {
          const row = await widgetRow(comfyPage, 'acceptance_toggle')
          await comfyPage.page.mouse.click(center(row).x, center(row).y)
        }
        await comfyPage.nextFrame()

        expect(await widgetValue(comfyPage, 'acceptance_toggle')).toBe(false)
      })

      test('a button keeps its value and passes the click position and event to its callback', async ({
        comfyPage
      }) => {
        await showKSamplerAtZoomOne(comfyPage)
        await comfyPage.page.evaluate(() => {
          const node = window.app!.graph.nodes.find(
            (n) => n.type === 'KSampler'
          )!
          node.properties.acceptance_button_args = ''
          node.addWidget(
            'button',
            'acceptance_button',
            'initial',
            (...args: unknown[]) => {
              node.properties.acceptance_button_args = JSON.stringify({
                count: args.length,
                hasPosition: Array.isArray(args[3]),
                hasEvent: args[4] instanceof Event
              })
            },
            {}
          )
          window.app!.canvas.setDirty(true, true)
        })
        await comfyPage.nextFrame()

        if (comfyPage.isVueNodes) {
          await comfyPage.vueNodes
            .getNodeByTitle('KSampler')
            .getByRole('button', { name: 'acceptance_button' })
            .click()
        } else {
          const row = await widgetRow(comfyPage, 'acceptance_button')
          await comfyPage.page.mouse.click(center(row).x, center(row).y)
        }

        await expect
          .poll(() => nodeProperty(comfyPage, 'acceptance_button_args'))
          .not.toBe('')
        const args = JSON.parse(
          String(await nodeProperty(comfyPage, 'acceptance_button_args'))
        )
        expect(await widgetValue(comfyPage, 'acceptance_button')).toBe(
          'initial'
        )
        expect(args.hasPosition, 'callback position argument').toBe(true)
        expect(args.hasEvent, 'callback event argument').toBe(true)
      })

      test('stepping back from an invalid combo value selects the first option', async ({
        comfyPage
      }) => {
        await showKSamplerAtZoomOne(comfyPage)
        const firstOption = await comfyPage.page.evaluate(() => {
          const node = window.app!.graph.nodes.find(
            (n) => n.type === 'KSampler'
          )!
          const widget = node.widgets!.find((w) => w.name === 'sampler_name')!
          widget.value = 'not-a-sampler'
          window.app!.canvas.setDirty(true, true)
          const values = widget.options.values
          return Array.isArray(values) ? values[0] : undefined
        })
        await comfyPage.nextFrame()

        if (comfyPage.isVueNodes) {
          await comfyPage.vueNodes
            .getWidgetRowByLabel('KSampler', 'sampler_name')
            .first()
            .getByRole('button', { name: /previous/i })
            .click()
        } else {
          const row = await widgetRow(comfyPage, 'sampler_name')
          await comfyPage.page.mouse.click(row.x + 5, row.y + row.height / 2)
        }

        await expect
          .poll(() => widgetValue(comfyPage, 'sampler_name'))
          .toBe(firstOption)
      })
    }
  )
}
