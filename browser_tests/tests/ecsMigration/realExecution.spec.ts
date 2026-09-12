import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { zPromptResponse } from '@comfyorg/ingest-types/zod'
import { collectConsoleErrors } from '@e2e/fixtures/utils/consoleErrorCollector'
import {
  expectNoVisibleErrors,
  trackVisibleErrors
} from '@e2e/fixtures/utils/errorSurfaces'
import { z } from 'zod'

import { zTaskOutput } from '@/schemas/apiSchema'

const zLegacyHistoryResponse = z.record(
  z.object({
    status: z.object({
      completed: z.boolean(),
      status_str: z.string()
    }),
    outputs: zTaskOutput.optional()
  })
)

type OutputEvidence = {
  promptId: string
  filename: string
  width: number
  height: number
  rgb: [number, number, number]
}

async function readOutputImage(
  comfyPage: ComfyPage,
  outputImage: { filename: string; subfolder: string; type: string }
) {
  return comfyPage.page.evaluate(async (outputImage) => {
    const query = new URLSearchParams(outputImage)
    const imageResponse = await fetch(`/api/view?${query}`)
    if (!imageResponse.ok) {
      throw new Error(`image request failed: ${imageResponse.status}`)
    }
    const bytes = new Uint8Array(await imageResponse.clone().arrayBuffer())
    const view = new DataView(bytes.buffer)
    const bitmap = await createImageBitmap(await imageResponse.blob())
    const canvas = new OffscreenCanvas(1, 1)
    const context = canvas.getContext('2d')!
    context.drawImage(bitmap, 0, 0)
    const pixel = context.getImageData(0, 0, 1, 1).data
    return {
      filename: outputImage.filename,
      width: view.getUint32(16),
      height: view.getUint32(20),
      rgb: [pixel[0], pixel[1], pixel[2]] as [number, number, number]
    }
  }, outputImage)
}

function findCompletedImage(body: unknown, promptId: string) {
  const history = zLegacyHistoryResponse.parse(body)
  if (!Object.hasOwn(history, promptId)) return null
  const entry = history[promptId]
  if (!entry.status.completed) return null
  if (entry.status.status_str !== 'success') {
    throw new Error(`prompt ${promptId} ended with ${entry.status.status_str}`)
  }
  const image = Object.values(entry.outputs ?? {})
    .flatMap((node) => node.images ?? [])
    .at(0)
  if (!image?.filename || typeof image.subfolder !== 'string' || !image.type) {
    return null
  }
  return {
    filename: image.filename,
    subfolder: image.subfolder,
    type: image.type
  }
}

async function queueAndReadPng(comfyPage: ComfyPage): Promise<OutputEvidence> {
  const responsePromise = comfyPage.page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname.endsWith('/prompt')
  )
  await comfyPage.command.executeCommand('Comfy.QueuePrompt')
  const response = await responsePromise
  expect(response.status(), await response.text()).toBe(200)
  const body = zPromptResponse.parse(await response.json())
  expect(body.prompt_id).toEqual(expect.any(String))
  const promptId = body.prompt_id!
  let completed: Omit<OutputEvidence, 'promptId'> | null = null
  await expect
    .poll(
      async () => {
        const historyResponse = await comfyPage.page.evaluate(async (id) => {
          const response = await fetch(`/api/history/${id}`)
          return {
            ok: response.ok,
            status: response.status,
            body: await response.json()
          }
        }, promptId)
        if (!historyResponse.ok) {
          throw new Error(`history request failed: ${historyResponse.status}`)
        }
        const outputImage = findCompletedImage(historyResponse.body, promptId)
        if (!outputImage) return null
        completed = await readOutputImage(comfyPage, outputImage)
        return completed
      },
      { timeout: 30_000 }
    )
    .not.toBeNull()
  expect(completed).not.toBeNull()
  expect(completed!.rgb).toEqual([0x33, 0x66, 0x99])
  return {
    promptId,
    ...completed!
  }
}

async function setMode(comfyPage: ComfyPage, mode: 0 | 2) {
  await comfyPage.page.evaluate((value) => {
    const node = window.app!.graph.nodes.find(({ id }) => String(id) === '2')!
    node.mode = value
    node.graph?.setDirtyCanvas(true, true)
  }, mode)
}

async function expectEndpoint(
  comfyPage: ComfyPage,
  targetId: string,
  originId: string
) {
  await expect
    .poll(() =>
      comfyPage.page.evaluate((id) => {
        const graph = window.app!.graph
        const target = graph.nodes.find((node) => String(node.id) === id)!
        const link = graph.links.get(target.inputs[0].link!)
        return (
          link && {
            linkCount: graph.links.size,
            originId: String(link.origin_id),
            targetId: String(link.target_id)
          }
        )
      }, targetId)
    )
    .toEqual({ linkCount: 2, originId, targetId })
}

async function saveWorkflowAs(comfyPage: ComfyPage, workflowName: string) {
  await comfyPage.menu.topbar.saveWorkflowAs(workflowName)
}

test.describe(
  'ECS migration: real model-free execution gaps',
  { tag: ['@canvas', '@workflow'] },
  () => {
    test.use({
      initialSettings: {
        'Comfy.TutorialCompleted': true,
        'Comfy.Workflow.Persist': true,
        'Comfy.UseNewMenu': 'Top'
      }
    })
    for (const vueNodesEnabled of [false, true]) {
      test(`normal, mute, bypass and restore use backend semantics (VueNodes=${vueNodesEnabled})`, async ({
        comfyPage
      }) => {
        await comfyPage.settings.setSetting(
          'Comfy.VueNodes.Enabled',
          vueNodesEnabled
        )
        await comfyPage.workflow.loadWorkflow(
          'ecsMigration/model_free_execution'
        )
        const normal = await queueAndReadPng(comfyPage)
        expect(normal).toMatchObject({ width: 128, height: 96 })

        await setMode(comfyPage, 2)
        const mutedResponse = comfyPage.page.waitForResponse(
          (response) =>
            response.request().method() === 'POST' &&
            new URL(response.url()).pathname.endsWith('/prompt')
        )
        await comfyPage.command.executeCommand('Comfy.QueuePrompt')
        const rejected = await mutedResponse
        expect(rejected.status()).toBe(400)
        expect(await rejected.text()).toContain(
          'Required input is missing: images'
        )

        await comfyPage.page.keyboard.press('Escape')
        await setMode(comfyPage, 0)
        const middle = (
          await comfyPage.nodeOps.getNodeRefsByType('ImageScale')
        )[0]
        await middle.click('title')
        await comfyPage.canvas.press('Control+b')
        await expect.poll(() => middle.isBypassed()).toBe(true)
        const bypassed = await queueAndReadPng(comfyPage)
        expect(bypassed).toMatchObject({ width: 64, height: 48 })

        await comfyPage.canvas.press('Control+b')
        await expect.poll(() => middle.isBypassed()).toBe(false)
        const restored = await queueAndReadPng(comfyPage)
        expect(restored).toMatchObject({ width: 128, height: 96 })
        expect(restored.filename).not.toBe(bypassed.filename)
      })

      test(`five UI disconnect/reconnect cycles survive saved-workflow reload (VueNodes=${vueNodesEnabled})`, async ({
        comfyPage
      }) => {
        test.slow()
        test.setTimeout(180_000)
        await comfyPage.settings.setSetting(
          'Comfy.VueNodes.Enabled',
          vueNodesEnabled
        )
        await comfyPage.workflow.loadWorkflow(
          'ecsMigration/model_free_execution'
        )
        const sources = [
          (await comfyPage.nodeOps.getNodeRefsByType('EmptyImage'))[0],
          (await comfyPage.nodeOps.getNodeRefsByType('ImageScale'))[0]
        ]
        const target = (
          await comfyPage.nodeOps.getNodeRefsByType('SaveImage')
        )[0]
        const input = await target.getInput(0)
        for (let cycle = 0; cycle < 5; cycle++) {
          const position = await input.getPosition()
          await comfyPage.page.keyboard.down('Control')
          await comfyPage.page.keyboard.down('Alt')
          await comfyPage.page.mouse.click(position.x, position.y)
          await comfyPage.page.keyboard.up('Alt')
          await comfyPage.page.keyboard.up('Control')
          await input.expectLinkCount(0)
          await sources[cycle % sources.length].connectOutput(0, target, 0)
          await input.expectLinkCount(1)
        }
        await sources[1].connectOutput(0, target, 0)
        await input.expectLinkCount(1)
        const workflowName = `ecs-qa-032-${vueNodesEnabled}-${Date.now()}`
        await saveWorkflowAs(comfyPage, workflowName)
        await comfyPage.page.reload()
        await comfyPage.waitForAppReady()
        await expectEndpoint(comfyPage, '3', '2')
        expect(await queueAndReadPng(comfyPage)).toMatchObject({
          width: 128,
          height: 96
        })
      })

      test(`malformed conflicting origins retain the visibly chosen endpoint after save/reload (VueNodes=${vueNodesEnabled})`, async ({
        comfyPage
      }) => {
        await comfyPage.settings.setSetting(
          'Comfy.VueNodes.Enabled',
          vueNodesEnabled
        )
        await comfyPage.workflow.loadWorkflow(
          'ecsMigration/conflicting_origins_execution'
        )
        await expectEndpoint(comfyPage, '3', '2')
        const workflowName = `ecs-qa-040-${vueNodesEnabled}-${Date.now()}`
        await saveWorkflowAs(comfyPage, workflowName)
        await comfyPage.page.reload()
        await comfyPage.waitForAppReady()
        await expectEndpoint(comfyPage, '3', '2')
        expect(await queueAndReadPng(comfyPage)).toMatchObject({
          width: 128,
          height: 96,
          rgb: [0x33, 0x66, 0x99]
        })
      })
    }

    test('blank search, connect and Queue finish with a real artifact and no errors', async ({
      comfyPage
    }) => {
      const consoleErrors = collectConsoleErrors(comfyPage.page)
      await trackVisibleErrors(comfyPage.page)
      await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
      await comfyPage.searchBoxV2.ensureV2Search()
      await comfyPage.searchBoxV2.addNode('Empty Image', {
        position: { x: 220, y: 220 }
      })
      await comfyPage.searchBoxV2.addNode('Save Image', {
        position: { x: 650, y: 220 }
      })
      await comfyPage.page.evaluate(() => {
        const graph = window.app!.graph
        const source = graph.nodes.find((node) => node.type === 'EmptyImage')!
        const target = graph.nodes.find((node) => node.type === 'SaveImage')!
        source.widgets![0].value = 64
        source.widgets![1].value = 48
        source.widgets![3].value = 0x336699
        target.widgets![0].value = 'ecs_qa_execution'
      })
      const source = (
        await comfyPage.nodeOps.getNodeRefsByType('EmptyImage')
      )[0]
      const target = (await comfyPage.nodeOps.getNodeRefsByType('SaveImage'))[0]
      await source.connectOutput(0, target, 0)
      const output = await queueAndReadPng(comfyPage)
      expect(output).toMatchObject({ width: 64, height: 48 })
      consoleErrors.stop()
      expect(consoleErrors.errors).toEqual([])
      await expectNoVisibleErrors(
        comfyPage.page,
        'after real blank-workflow Queue'
      )
    })
  }
)
