import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { agentCanvasTest as test } from '@e2e/fixtures/agentCanvasFixture'
import {
  deliverGraphBuild,
  waitForClientFrame
} from '@e2e/fixtures/utils/agentGraphBuild'
import { MESSAGE_DONE_EVENT } from '@e2e/tests/agent/agentPanelMocks'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

test.describe(
  'Agent canvas entry',
  { tag: ['@cloud', '@ui', '@canvas'] },
  () => {
    test.use({ connectWebSocketToServer: false })
    test.use({ viewport: { width: 1024, height: 768 } })
    test.slow()

    test('sends with Enter and keeps the learning flow on the canvas', async ({
      comfyPage,
      agentCanvas,
      postedMessages,
      getWebSocket
    }) => {
      const page = comfyPage.page
      const composer = agentCanvas.composer
      const prompt = 'Build a product photo workflow with a saved image output.'

      await expect(composer).toBeVisible()
      await expect(async () => {
        const composerBox = await page
          .getByTestId('agent-compact-composer')
          .boundingBox()
        const toolbarBox = await page
          .getByRole('toolbar', {
            name: enMessages.graphCanvasMenu.canvasToolbar
          })
          .boundingBox()
        expect(composerBox).not.toBeNull()
        expect(toolbarBox).not.toBeNull()
        if (!composerBox || !toolbarBox)
          throw new Error('Expected compact composer and canvas toolbar bounds')
        expect(
          composerBox.x + composerBox.width <= toolbarBox.x ||
            toolbarBox.x + toolbarBox.width <= composerBox.x ||
            composerBox.y + composerBox.height <= toolbarBox.y ||
            toolbarBox.y + toolbarBox.height <= composerBox.y
        ).toBe(true)
      }).toPass({ timeout: 5000 })
      await composer.fill(prompt)
      await composer.press('Enter')

      await expect.poll(() => postedMessages.length).toBe(1)
      expect(postedMessages[0]).toContain(prompt)
      await expect(page.locator('#agent-panel-root')).toBeHidden()
      await expect(page.getByTestId('docked-agent-panel')).toBeHidden()
      await expect(composer).toBeVisible()
      await expect(composer).toBeDisabled()
      await expect(
        page.getByText(enMessages.agent.compactComposer.building)
      ).toBeVisible()

      const ws = await getWebSocket()
      ws.send(JSON.stringify(MESSAGE_DONE_EVENT))
      await expect(composer).toBeEnabled()
    })

    test('uploads two references through the compact entry', async ({
      comfyPage,
      agentCanvas,
      postedMessages,
      getWebSocket
    }) => {
      const page = comfyPage.page
      await page.getByTestId('agent-compact-file-input').setInputFiles([
        { name: 'dog.png', mimeType: 'image/png', buffer: Buffer.from('dog') },
        {
          name: 'sheep.png',
          mimeType: 'image/png',
          buffer: Buffer.from('sheep')
        }
      ])

      const compactComposer = page.getByTestId('agent-compact-composer')
      await expect(compactComposer.getByText('dog.png')).toBeVisible()
      await expect(compactComposer.getByText('sheep.png')).toBeVisible()
      await agentCanvas.composer.fill(
        'Animate the dog and sheep in a consistent story.'
      )
      await agentCanvas.composer.press('Enter')

      await expect.poll(() => postedMessages.length).toBe(1)
      expect(postedMessages[0]).toContain('uploaded_dog.png')
      expect(postedMessages[0]).toContain('uploaded_sheep.png')
      const ws = await getWebSocket()
      ws.send(JSON.stringify(MESSAGE_DONE_EVENT))
      await expect(agentCanvas.composer).toBeEnabled()
    })

    test.describe(
      'Real-node teaching playback',
      { tag: ['@node', '@slow'] },
      () => {
        test.beforeEach(async ({ comfyPage }) => {
          await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
        })

        test('selects real library results, freezes while paused, and frames the graph', async ({
          comfyPage,
          agentCanvas,
          postedMessages,
          getWebSocket
        }) => {
          const page = comfyPage.page
          const previousLinkMode = await page.evaluate(
            () => window.app!.canvas.links_render_mode
          )
          const ws = await getWebSocket()
          const subscribed = waitForClientFrame(ws, 'doc_subscribe')
          await agentCanvas.composer.fill(
            'Build a clear image preparation workflow.'
          )
          await agentCanvas.composer.press('Enter')
          await expect.poll(() => postedMessages.length).toBe(1)
          await deliverGraphBuild(ws, subscribed)

          await expect(page.getByText(/Choosing 1 of \d+:/)).toBeVisible()
          await expect(page.getByText(/Find and select /)).toBeVisible()
          await agentCanvas.expectLibrarySelection('LoadImage')
          await agentCanvas.expectQueuedControlsHidden()
          await expect(page.getByText(/Placing 1 of \d+:/)).toBeVisible()
          const firstNode = comfyPage.vueNodes.getNodeLocator('101')
          await expect(firstNode).toHaveCSS('will-change', 'translate')
          await agentCanvas.pauseButton.press('Enter')
          await expect(agentCanvas.resumeButton).toBeVisible()
          await expect(firstNode).toHaveCSS('will-change', 'translate')
          await agentCanvas.expectPositionFrozenForFrames(firstNode)
          await agentCanvas.expectGraphPreserved()
          const pausedBounds = await firstNode.boundingBox()
          expect(pausedBounds).not.toBeNull()
          await agentCanvas.resumeButton.click()
          await expect
            .poll(() => firstNode.boundingBox())
            .not.toEqual(pausedBounds)

          await agentCanvas.expectLibrarySelection('ImageScale')
          await agentCanvas.expectLibrarySelection('PreviewImage')
          await expect(page.getByText(/Connecting \d+ of \d+:/)).toBeVisible({
            timeout: 12_000
          })
          await agentCanvas.expectCleanedUp(previousLinkMode)
          await expect(
            firstNode.getByRole('button', { name: 'Upload', exact: true })
          ).toBeVisible()
          await expect(
            comfyPage.vueNodes.getNodeLocator('102').getByRole('spinbutton')
          ).toHaveCount(2)
          await agentCanvas.expectNodesWithinCanvas()
          await expect(agentCanvas.librarySearch).toBeHidden()

          ws.send(JSON.stringify(MESSAGE_DONE_EVENT))
          await expect(agentCanvas.composer).toBeEnabled()
        })

        test('skips paused playback and restores presentation without moving graph nodes', async ({
          comfyPage,
          agentCanvas,
          postedMessages,
          getWebSocket
        }) => {
          const page = comfyPage.page
          await comfyPage.menu.nodeLibraryTabV2.open()
          await agentCanvas.librarySearch.fill('Preview')
          const previousLinkMode = await page.evaluate(
            () => window.app!.canvas.links_render_mode
          )
          const ws = await getWebSocket()
          const subscribed = waitForClientFrame(ws, 'doc_subscribe')
          await agentCanvas.composer.fill(
            'Build the reference image preparation graph.'
          )
          await agentCanvas.composer.press('Enter')
          await expect.poll(() => postedMessages.length).toBe(1)
          await deliverGraphBuild(ws, subscribed)

          await agentCanvas.expectLibrarySelection('LoadImage')
          await expect(page.getByText(/Placing 1 of \d+:/)).toBeVisible()
          await agentCanvas.pauseButton.click()
          await agentCanvas.expectPositionFrozenForFrames(
            comfyPage.vueNodes.getNodeLocator('101')
          )
          await agentCanvas.skipButton.click()

          await agentCanvas.expectCleanedUp(previousLinkMode)
          await expect(agentCanvas.librarySearch).toBeVisible()
          await expect(agentCanvas.librarySearch).toHaveValue('Preview')
          await agentCanvas.expectNodesWithinCanvas()
          ws.send(JSON.stringify(MESSAGE_DONE_EVENT))
          await expect(agentCanvas.composer).toBeEnabled()
        })

        test('resizes during paused playback without leaving stranded nodes or links', async ({
          comfyPage,
          agentCanvas,
          postedMessages,
          getWebSocket
        }) => {
          const page = comfyPage.page
          const previousLinkMode = await page.evaluate(
            () => window.app!.canvas.links_render_mode
          )
          const ws = await getWebSocket()
          const subscribed = waitForClientFrame(ws, 'doc_subscribe')
          await agentCanvas.composer.fill('Prepare a reference image workflow.')
          await agentCanvas.composer.press('Enter')
          await expect.poll(() => postedMessages.length).toBe(1)
          await deliverGraphBuild(ws, subscribed)
          await agentCanvas.expectLibrarySelection('LoadImage')
          await agentCanvas.pauseButton.click()
          await expect(agentCanvas.resumeButton).toBeVisible()

          await page.setViewportSize({ width: 840, height: 640 })
          await comfyPage.nextFrame()
          await agentCanvas.expectCleanedUp(previousLinkMode)
          await agentCanvas.expectNodesWithinCanvas()
          await expect(agentCanvas.librarySearch).toBeHidden()
          ws.send(JSON.stringify(MESSAGE_DONE_EVENT))
          await expect(agentCanvas.composer).toBeEnabled()
        })

        for (const gesture of ['zoom', 'pan'] as const) {
          test(`hands the canvas back when the user uses ${gesture} during playback`, async ({
            comfyPage,
            agentCanvas,
            postedMessages,
            getWebSocket
          }) => {
            const page = comfyPage.page
            const previousLinkMode = await page.evaluate(
              () => window.app!.canvas.links_render_mode
            )
            const ws = await getWebSocket()
            const subscribed = waitForClientFrame(ws, 'doc_subscribe')
            await agentCanvas.composer.fill(
              'Prepare a reference image workflow.'
            )
            await agentCanvas.composer.press('Enter')
            await expect.poll(() => postedMessages.length).toBe(1)
            await deliverGraphBuild(ws, subscribed)
            await agentCanvas.expectLibrarySelection('LoadImage')
            await agentCanvas.pauseButton.click()
            await expect(agentCanvas.resumeButton).toBeVisible()

            await agentCanvas.interruptWithCanvasGesture(gesture)
            await agentCanvas.expectCleanedUp(previousLinkMode)
            await expect(agentCanvas.librarySearch).toBeHidden()
            ws.send(JSON.stringify(MESSAGE_DONE_EVENT))
            await expect(agentCanvas.composer).toBeEnabled()
          })
        }

        test('keeps teaching playback scoped to the compact canvas entry', async ({
          comfyPage,
          agentCanvas,
          postedMessages,
          getWebSocket
        }) => {
          const page = comfyPage.page
          await page
            .getByRole('button', {
              name: enMessages.agent.compactComposer.open
            })
            .click()
          const panel = page.getByTestId('docked-agent-panel')
          await expect(panel).toBeVisible()

          const panelComposer = panel.getByRole('textbox', {
            name: /Describe ideas/
          })
          const ws = await getWebSocket()
          const subscribed = waitForClientFrame(ws, 'doc_subscribe')
          await panelComposer.fill(
            'Build this workflow from the full Agent panel.'
          )
          await panelComposer.press('Enter')
          await expect.poll(() => postedMessages.length).toBe(1)
          await deliverGraphBuild(ws, subscribed)

          await expect(
            page.getByText('Load references', { exact: true })
          ).toBeVisible()
          await expect(agentCanvas.phase).toBeHidden()
          await expect(comfyPage.vueNodes.getNodeLocator('101')).not.toHaveCSS(
            'will-change',
            'translate'
          )
          await agentCanvas.expectGraphPreserved()
          ws.send(JSON.stringify(MESSAGE_DONE_EVENT))
        })
      }
    )
  }
)
