import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { collectConsoleErrors } from '@e2e/fixtures/utils/consoleErrorCollector'
import {
  expectNoVisibleErrors,
  trackVisibleErrors
} from '@e2e/fixtures/utils/errorSurfaces'

type OutputEvidence = {
  promptId: string
  filename: string
  width: number
  height: number
  rgb: [number, number, number]
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
  const { prompt_id: promptId } = (await response.json()) as {
    prompt_id: string
  }
  await expect
    .poll(
      () =>
        comfyPage.page.evaluate(async (id) => {
          const historyResponse = await fetch(`/api/history/${id}`)
          const history = await historyResponse.json()
          const nodes = Object.values(history[id]?.outputs ?? {}) as Array<{
            images?: Array<{
              filename: string
              subfolder: string
              type: string
            }>
          }>
          const image = nodes.flatMap((node) => node.images ?? []).at(0)
          if (!image) return null
          const query = new URLSearchParams({
            filename: image.filename,
            subfolder: image.subfolder,
            type: image.type
          })
          const imageResponse = await fetch(`/api/view?${query}`)
          const bytes = new Uint8Array(
            await imageResponse.clone().arrayBuffer()
          )
          const view = new DataView(bytes.buffer)
          const bitmap = await createImageBitmap(await imageResponse.blob())
          const canvas = new OffscreenCanvas(1, 1)
          const context = canvas.getContext('2d')!
          context.drawImage(bitmap, 0, 0)
          return {
            filename: image.filename,
            width: view.getUint32(16),
            height: view.getUint32(20),
            rgb: [...context.getImageData(0, 0, 1, 1).data.slice(0, 3)]
          }
        }, promptId),
      { timeout: 30_000 }
    )
    .not.toBeNull()

  // Re-read after the polling assertion; Playwright's matcher does not return
  // the matched value.
  const history = await comfyPage.page.evaluate(async (id) => {
    const value = await (await fetch(`/api/history/${id}`)).json()
    const nodes = Object.values(value[id].outputs) as Array<{
      images?: Array<{ filename: string; subfolder: string; type: string }>
    }>
    return nodes.flatMap((node) => node.images ?? [])[0]
  }, promptId)
  const query = new URLSearchParams(history)
  const artifact = await comfyPage.page.evaluate(async (url) => {
    const response = await fetch(url)
    const bytes = new Uint8Array(await response.clone().arrayBuffer())
    const bitmap = await createImageBitmap(await response.blob())
    const canvas = new OffscreenCanvas(1, 1)
    const context = canvas.getContext('2d')!
    context.drawImage(bitmap, 0, 0)
    return {
      bytes: [...bytes],
      rgb: [...context.getImageData(0, 0, 1, 1).data.slice(0, 3)]
    }
  }, `/api/view?${query}`)
  const png = new DataView(Uint8Array.from(artifact.bytes).buffer)
  expect(artifact.rgb).toEqual([0x33, 0x66, 0x99])
  return {
    promptId,
    filename: history.filename,
    width: png.getUint32(16),
    height: png.getUint32(20),
    rgb: [0x33, 0x66, 0x99]
  }
}

async function setMode(comfyPage: ComfyPage, mode: 0 | 2 | 4) {
  await comfyPage.page.evaluate((value) => {
    const node = window.app!.graph.nodes.find(({ id }) => String(id) === '2')!
    node.mode = value
    node.graph?.setDirtyCanvas(true, true)
  }, mode)
}

test.describe(
  'ECS migration: real model-free execution gaps',
  { tag: ['@canvas', '@workflow'] },
  () => {
    test.use({
      initialSettings: {
        'Comfy.TutorialCompleted': true,
        'Comfy.Workflow.Persist': true,
        'Comfy.UseNewMenu': 'Disabled'
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
        await trackVisibleErrors(comfyPage.page)

        const normal = await queueAndReadPng(comfyPage)
        expect(normal).toMatchObject({ width: 128, height: 96 })

        // Mute (mode 2) is not bypass. Removing the middle producer leaves
        // SaveImage without its required input, so the backend must reject it.
        await setMode(comfyPage, 2)
        const mutedResponse = comfyPage.page.waitForResponse(
          (response) =>
            response.request().method() === 'POST' &&
            new URL(response.url()).pathname.endsWith('/prompt')
        )
        await comfyPage.command.executeCommand('Comfy.QueuePrompt')
        expect((await mutedResponse).status()).toBe(400)

        await setMode(comfyPage, 4)
        const bypassed = await queueAndReadPng(comfyPage)
        expect(bypassed).toMatchObject({ width: 64, height: 48 })

        await setMode(comfyPage, 0)
        const restored = await queueAndReadPng(comfyPage)
        expect(restored).toMatchObject({ width: 128, height: 96 })
        expect(restored.filename).not.toBe(bypassed.filename)
      })

      test(`five reconnects and conflicting origins retain one executable wire (VueNodes=${vueNodesEnabled})`, async ({
        comfyPage
      }) => {
        await comfyPage.settings.setSetting(
          'Comfy.VueNodes.Enabled',
          vueNodesEnabled
        )
        await comfyPage.workflow.loadWorkflow(
          'ecsMigration/model_free_execution'
        )
        await comfyPage.page.evaluate(() => {
          const graph = window.app!.graph
          const source = graph.nodes.find(({ id }) => String(id) === '2')!
          const target = graph.nodes.find(({ id }) => String(id) === '3')!
          for (let cycle = 0; cycle < 5; cycle++) {
            target.disconnectInput(0)
            source.connect(0, target, 0)
          }
        })
        const serialized = await comfyPage.nodeOps.getSerializedGraph()
        await comfyPage.workflow.loadGraphData(serialized)
        const retained = await comfyPage.page.evaluate(() => {
          const graph = window.app!.graph
          const target = graph.nodes.find(({ id }) => String(id) === '3')!
          const link = graph.links.get(target.inputs[0].link!)!
          return {
            linkCount: graph.links.size,
            originId: String(link.origin_id),
            targetId: String(link.target_id)
          }
        })
        expect(retained).toEqual({
          linkCount: 2,
          originId: '2',
          targetId: '3'
        })
        expect(await queueAndReadPng(comfyPage)).toMatchObject({
          width: 128,
          height: 96
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
        source.connect(0, target, 0)
      })
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
