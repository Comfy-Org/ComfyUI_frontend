import { mint } from '@comfyorg/comfy-multi-player'
import { expect, mergeTests } from '@playwright/test'
import type { WebSocketRoute } from '@playwright/test'
import * as Y from 'yjs'

import { webSocketFixture } from '@e2e/fixtures/ws'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import {
  AGENT_TEST_THREAD_ID,
  AGENT_TEST_WORKFLOW_ID,
  MESSAGE_DONE_EVENT,
  agentTest
} from '@e2e/tests/agent/agentPanelMocks'

const test = mergeTests(agentTest, webSocketFixture)

function graphBuildUpdate(): string {
  const host = mint(
    {
      nodes: [
        {
          id: 101,
          type: 'LoadImage',
          title: 'Load references',
          pos: [80, 120],
          size: [240, 120],
          inputs: [],
          outputs: [{ name: 'image', type: 'IMAGE', links: [201] }],
          widgets_values: {}
        },
        {
          id: 102,
          type: 'ImageScale',
          title: 'Prepare frames',
          pos: [440, 120],
          size: [240, 120],
          inputs: [{ name: 'image', type: 'IMAGE', link: 201 }],
          outputs: [{ name: 'image', type: 'IMAGE', links: [202] }],
          widgets_values: {}
        },
        {
          id: 103,
          type: 'PreviewImage',
          title: 'Preview result',
          pos: [800, 120],
          size: [240, 120],
          inputs: [{ name: 'images', type: 'IMAGE', link: 202 }],
          outputs: [],
          widgets_values: {}
        }
      ],
      links: [
        [201, 101, 0, 102, 0, 'IMAGE'],
        [202, 102, 0, 103, 0, 'IMAGE']
      ]
    },
    {
      types: {
        LoadImage: { widget_order: [] },
        ImageScale: { widget_order: [] },
        PreviewImage: { widget_order: [] }
      }
    }
  )
  const update = Y.encodeStateAsUpdate(host)
  host.destroy()
  return JSON.stringify({
    type: 'doc_update',
    data: {
      v: 1,
      workflow_id: AGENT_TEST_WORKFLOW_ID,
      seq: 1,
      update_b64: Buffer.from(update).toString('base64'),
      actor: 'agent:e2e',
      op_ids: ['build-reference-workflow']
    }
  })
}

function waitForClientFrame(
  ws: WebSocketRoute,
  type: string
): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    ws.onMessage((message) => {
      if (typeof message !== 'string') return
      const frame = JSON.parse(message) as {
        type?: unknown
        data?: Record<string, unknown>
      }
      if (frame.type === type) resolve(frame.data ?? {})
    })
  })
}

async function deliverGraphBuild(ws: WebSocketRoute): Promise<void> {
  const subscribed = waitForClientFrame(ws, 'doc_subscribe')
  ws.send(
    JSON.stringify({
      type: 'agent_active_tab',
      data: {
        workflow_id: AGENT_TEST_WORKFLOW_ID,
        name: 'Reference preparation',
        thread_id: AGENT_TEST_THREAD_ID
      }
    })
  )
  await expect(subscribed).resolves.toMatchObject({
    workflow_id: AGENT_TEST_WORKFLOW_ID
  })
  ws.send(
    JSON.stringify({
      type: 'doc_subscribed',
      data: {
        v: 1,
        workflow_id: AGENT_TEST_WORKFLOW_ID,
        ok: true,
        seq: 0
      }
    })
  )
  ws.send(graphBuildUpdate())
}

test.describe('Agent canvas entry', { tag: ['@cloud', '@ui'] }, () => {
  test.use({ connectWebSocketToServer: false })
  test.use({ viewport: { width: 1024, height: 768 } })

  test('sends with Enter and keeps the learning flow on the canvas', async ({
    comfyPage,
    postedMessages,
    getWebSocket
  }) => {
    const page = comfyPage.page
    const composer = page.getByRole('textbox', {
      name: enMessages.agent.compactComposer.label
    })
    const prompt = 'Build a product photo workflow with a saved image output.'

    await expect(composer).toBeVisible()
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
    postedMessages,
    getWebSocket
  }) => {
    const page = comfyPage.page
    let uploadCount = 0
    await page.route('**/api/upload/image', (route) => {
      uploadCount += 1
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          name: uploadCount === 1 ? 'uploaded_dog.png' : 'uploaded_sheep.png',
          subfolder: '',
          type: 'input'
        })
      })
    })
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
    const composer = page.getByRole('textbox', {
      name: enMessages.agent.compactComposer.label
    })
    await composer.fill('Animate the dog and sheep in a consistent story.')
    await composer.press('Enter')

    await expect.poll(() => postedMessages.length).toBe(1)
    expect(postedMessages[0]).toContain('uploaded_dog.png')
    expect(postedMessages[0]).toContain('uploaded_sheep.png')
    const ws = await getWebSocket()
    ws.send(JSON.stringify(MESSAGE_DONE_EVENT))
    await expect(composer).toBeEnabled()
  })

  test('shows real-node build playback for the generated graph', async ({
    comfyPage,
    postedMessages,
    getWebSocket
  }) => {
    const page = comfyPage.page
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    const composer = page.getByRole('textbox', {
      name: enMessages.agent.compactComposer.label
    })
    const ws = await getWebSocket()
    await composer.fill('Build a clear image preparation workflow.')
    await composer.press('Enter')
    await expect.poll(() => postedMessages.length).toBe(1)

    await deliverGraphBuild(ws)

    await expect(page.getByText(/Building \d of 3:/)).toBeVisible()
    await expect(page.getByText(/Adding /)).toBeVisible()
    const firstNode = page.locator('.lg-node[data-node-id="101"]')
    await expect(firstNode).toHaveCSS('will-change', 'translate')
    await page
      .getByRole('button', { name: enMessages.agent.graphBuild.pause })
      .click()
    await expect(
      page.getByRole('button', { name: enMessages.agent.graphBuild.resume })
    ).toBeVisible()
    await page
      .getByRole('button', { name: enMessages.agent.graphBuild.resume })
      .click()
    await expect(
      page.getByText('Load references', { exact: true })
    ).toBeVisible()
    await expect(
      page.getByText('Prepare frames', { exact: true })
    ).toBeVisible()
    await expect(
      page.getByText('Preview result', { exact: true })
    ).toBeVisible()
    await expect(page.getByText(/Building \d of 3:/)).toBeHidden()
    await expect
      .poll(() =>
        firstNode.evaluate((node) => node.style.getPropertyValue('translate'))
      )
      .toBe('')

    ws.send(JSON.stringify(MESSAGE_DONE_EVENT))
    await expect(composer).toBeEnabled()
  })

  test('keeps teaching playback scoped to the compact canvas entry', async ({
    comfyPage,
    postedMessages,
    getWebSocket
  }) => {
    const page = comfyPage.page
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    await page
      .getByRole('button', { name: enMessages.agent.compactComposer.open })
      .click()
    const panel = page.getByTestId('docked-agent-panel')
    await expect(panel).toBeVisible()

    const panelComposer = panel.getByRole('textbox', {
      name: /Describe ideas/
    })
    await panelComposer.fill('Build this workflow from the full Agent panel.')
    await panelComposer.press('Enter')
    await expect.poll(() => postedMessages.length).toBe(1)

    const ws = await getWebSocket()
    await deliverGraphBuild(ws)

    await expect(
      page.getByText('Load references', { exact: true })
    ).toBeVisible()
    await expect(page.getByText(/Building \d of 3:/)).toBeHidden()
    await expect(page.locator('.lg-node[data-node-id="101"]')).not.toHaveCSS(
      'will-change',
      'translate'
    )

    ws.send(JSON.stringify(MESSAGE_DONE_EVENT))
  })
})
