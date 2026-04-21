import type { Locator, WebSocketRoute } from '@playwright/test'
import { mergeTests } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  comfyPageFixture,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { webSocketFixture } from '@e2e/fixtures/ws'

const test = mergeTests(comfyPageFixture, webSocketFixture)

const GLSL_NODE_ID = '1'
const GLSL_NODE_TITLE = 'GLSL Shader'
const PRIMITIVE_FLOAT_NODE_TITLE = 'Float'
const PRIMITIVE_INT_NODE_TITLE = 'Int'
const PRIMITIVE_BOOLEAN_NODE_TITLE = 'Boolean'

const RED_SHADER = [
  '#version 300 es',
  'precision highp float;',
  'uniform vec2 u_resolution;',
  'in vec2 v_texCoord;',
  'layout(location = 0) out vec4 fragColor0;',
  'void main() {',
  '    fragColor0 = vec4(1.0, 0.0, 0.0, 1.0);',
  '}'
].join('\n')

/** Page-object helper bound to the GLSLShader node under test. */
class GLSLShaderNode {
  readonly node: Locator
  /**
   * Any `<img>` inside the node whose src is a `blob:` URL. Covers both
   * the standalone-node `LivePreview` path and the subgraph-wrapped
   * promoted-preview path (where the blob surfaces via `ImagePreview`).
   */
  readonly previewImage: Locator
  readonly shaderTextbox: Locator
  readonly widthInput: Locator
  readonly heightInput: Locator

  constructor(
    private readonly comfyPage: ComfyPage,
    readonly nodeId: string,
    readonly title: string
  ) {
    this.node = comfyPage.vueNodes.getNodeLocator(nodeId)
    this.previewImage = this.node.locator('img[src^="blob:"]')
    this.shaderTextbox = this.node.getByRole('textbox', {
      name: 'fragment_shader'
    })
    this.widthInput = this.node
      .getByLabel('size_mode.width', { exact: true })
      .locator('input')
    this.heightInput = this.node
      .getByLabel('size_mode.height', { exact: true })
      .locator('input')
  }

  /**
   * Fire `execution_start` + `executed` with an image output for this node,
   * which satisfies the `hasExecutionOutput` gate in `useGLSLPreview`.
   */
  async simulateExecutionOutput(ws: WebSocketRoute) {
    const exec = new ExecutionHelper(this.comfyPage, ws)
    const jobId = await exec.run()
    await this.comfyPage.nextFrame()
    exec.executionStart(jobId)
    exec.executed(jobId, this.nodeId, {
      images: [{ filename: 'glsl_test.png', subfolder: '', type: 'output' }]
    })
    exec.executionSuccess(jobId)
  }

  async getPreviewSrc(): Promise<string | null> {
    return this.previewImage.getAttribute('src')
  }

  async getPreviewNaturalSize(): Promise<{ width: number; height: number }> {
    return this.previewImage.evaluate((el: HTMLImageElement) => ({
      width: el.naturalWidth,
      height: el.naturalHeight
    }))
  }

  async selectSizeMode(option: 'from_input' | 'custom'): Promise<void> {
    await this.comfyPage.vueNodes.selectComboOption(
      this.title,
      'size_mode',
      option
    )
  }

  /** Wait until the preview image has a blob: URL and return it. */
  async waitForBlobSrc(): Promise<string> {
    await expect.poll(() => this.getPreviewSrc()).toMatch(/^blob:/)
    return (await this.getPreviewSrc())!
  }

  /**
   * Draw the preview blob to a 2D canvas and verify every pixel matches.
   */
  async expectEveryPixelToBe(
    expected: [number, number, number, number],
    tolerance = 1
  ): Promise<void> {
    const mismatch = await this.previewImage.evaluate(
      (
        img: HTMLImageElement,
        args: { exp: [number, number, number, number]; tol: number }
      ) => {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0)
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
        for (let i = 0; i < data.length; i += 4) {
          for (let c = 0; c < 4; c++) {
            if (Math.abs(data[i + c] - args.exp[c]) > args.tol) {
              return {
                index: i / 4,
                actual: [data[i], data[i + 1], data[i + 2], data[i + 3]]
              }
            }
          }
        }
        return null
      },
      { exp: expected, tol: tolerance }
    )
    const message = mismatch
      ? `expected every pixel ≈ [${expected.join(',')}] ±${tolerance}; pixel ${mismatch.index} was [${mismatch.actual.join(',')}]`
      : undefined
    expect(mismatch, message).toBeNull()
  }
}

/**
 * Drop an image file onto a LoadImage node and wait for its preview to render.
 */
async function dropImageOntoLoadImage(
  comfyPage: ComfyPage,
  nodeId: string,
  filename: string
): Promise<void> {
  const node = comfyPage.vueNodes.getNodeLocator(nodeId)
  const box = await node.boundingBox()
  expect(
    box,
    `LoadImage node ${nodeId} must have a bounding box`
  ).not.toBeNull()
  await comfyPage.dragDrop.dragAndDropFile(filename, {
    dropPosition: { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 }
  })
  await expect(node.locator('.image-preview img')).toBeVisible()
}

test.describe('GLSL Shader Preview', { tag: ['@vue-nodes', '@node'] }, () => {
  test.describe('standalone node', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('nodes/glsl_shader_standalone')
      await comfyPage.vueNodes.waitForNodes(1)
    })

    test('renders a blob preview into the node after execution', async ({
      comfyPage,
      getWebSocket
    }) => {
      const ws = await getWebSocket()
      const glsl = new GLSLShaderNode(comfyPage, GLSL_NODE_ID, GLSL_NODE_TITLE)

      await test.step('no preview is present before execution', async () => {
        await expect(glsl.previewImage).toHaveCount(0)
      })

      await test.step('execution populates preview with a blob URL', async () => {
        await glsl.simulateExecutionOutput(ws)

        await expect(glsl.previewImage).toBeVisible()
        await glsl.waitForBlobSrc()
      })
    })

    test('refreshes the preview when the fragment shader is edited', async ({
      comfyPage,
      getWebSocket
    }) => {
      const ws = await getWebSocket()
      const glsl = new GLSLShaderNode(comfyPage, GLSL_NODE_ID, GLSL_NODE_TITLE)

      await glsl.simulateExecutionOutput(ws)
      const initialSrc = await glsl.waitForBlobSrc()

      await test.step('editing the shader replaces the blob URL', async () => {
        await glsl.shaderTextbox.fill(RED_SHADER)

        await expect.poll(() => glsl.getPreviewSrc()).not.toBe(initialSrc)
        await expect.poll(() => glsl.getPreviewSrc()).toMatch(/^blob:/)
      })
    })

    test('custom size_mode controls rendered resolution', async ({
      comfyPage,
      getWebSocket
    }) => {
      const ws = await getWebSocket()
      const glsl = new GLSLShaderNode(comfyPage, GLSL_NODE_ID, GLSL_NODE_TITLE)

      await test.step('switch size_mode to custom and set width/height', async () => {
        await glsl.selectSizeMode('custom')

        await expect(glsl.widthInput).toBeVisible()
        await expect(glsl.heightInput).toBeVisible()

        await glsl.widthInput.fill('16')
        await glsl.widthInput.blur()
        await glsl.heightInput.fill('32')
        await glsl.heightInput.blur()
      })

      await test.step('executed preview uses the custom resolution', async () => {
        await glsl.simulateExecutionOutput(ws)

        await expect(glsl.previewImage).toBeVisible()
        await glsl.waitForBlobSrc()
        await expect
          .poll(() => glsl.getPreviewNaturalSize())
          .toEqual({ width: 16, height: 32 })
      })
    })

    test('logs a compile failure then recovers when shader becomes valid again', async ({
      comfyPage,
      getWebSocket
    }) => {
      const ws = await getWebSocket()
      const glsl = new GLSLShaderNode(comfyPage, GLSL_NODE_ID, GLSL_NODE_TITLE)

      // Captures every `[GLSL] shader compilation failed` warning emitted
      // by `useGLSLPreview.ts` during this test.
      const compileFailure = comfyPage.page.waitForEvent('console', {
        predicate: (msg) =>
          msg.type() === 'warning' &&
          msg.text().includes('[GLSL] shader compilation failed')
      })

      await glsl.simulateExecutionOutput(ws)
      const goodSrc = await glsl.waitForBlobSrc()

      await glsl.shaderTextbox.fill('not valid glsl at all')
      await compileFailure // ensures the invalid shader actually hit the compiler

      await glsl.shaderTextbox.fill(RED_SHADER)
      await expect.poll(() => glsl.getPreviewSrc()).not.toBe(goodSrc)
      await expect.poll(() => glsl.getPreviewSrc()).toMatch(/^blob:/)
    })
  })

  test.describe('with primitive float source', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('nodes/glsl_shader_with_float')
      await comfyPage.vueNodes.waitForNodes(2)
    })

    test('refreshes preview when upstream PrimitiveFloat value changes', async ({
      comfyPage,
      getWebSocket
    }) => {
      const ws = await getWebSocket()
      const glsl = new GLSLShaderNode(comfyPage, GLSL_NODE_ID, GLSL_NODE_TITLE)
      const floatValueWidget = comfyPage.vueNodes.getWidgetByName(
        PRIMITIVE_FLOAT_NODE_TITLE,
        'value'
      )
      const { input: floatValueInput } =
        comfyPage.vueNodes.getInputNumberControls(floatValueWidget)

      await glsl.simulateExecutionOutput(ws)
      const initialSrc = await glsl.waitForBlobSrc()

      await test.step('changing the upstream float value re-renders the preview', async () => {
        await expect(floatValueInput).toBeVisible()
        await floatValueInput.fill('0.9')
        await floatValueInput.blur()

        await expect.poll(() => glsl.getPreviewSrc()).not.toBe(initialSrc)
        await expect.poll(() => glsl.getPreviewSrc()).toMatch(/^blob:/)
      })
    })
  })

  test.describe('with upstream LoadImage', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('nodes/glsl_shader_with_loadimage')
      await comfyPage.vueNodes.waitForNodes(2)
    })

    const LOAD_IMAGE_NODE_ID = '2'

    test('uses upstream image dimensions and binds it as u_image0', async ({
      comfyPage,
      getWebSocket
    }) => {
      const ws = await getWebSocket()
      const glsl = new GLSLShaderNode(comfyPage, GLSL_NODE_ID, GLSL_NODE_TITLE)

      await dropImageOntoLoadImage(
        comfyPage,
        LOAD_IMAGE_NODE_ID,
        'image64x64.webp'
      )

      await glsl.simulateExecutionOutput(ws)
      await glsl.waitForBlobSrc()
      await expect
        .poll(() => glsl.getPreviewNaturalSize())
        .toEqual({ width: 64, height: 64 })
    })

    test('ensures shaders are correctly executed', async ({
      comfyPage,
      getWebSocket
    }) => {
      const ws = await getWebSocket()
      const glsl = new GLSLShaderNode(comfyPage, GLSL_NODE_ID, GLSL_NODE_TITLE)

      await dropImageOntoLoadImage(
        comfyPage,
        LOAD_IMAGE_NODE_ID,
        'image64x64.webp'
      )
      await glsl.shaderTextbox.fill(RED_SHADER)
      await glsl.simulateExecutionOutput(ws)
      await glsl.waitForBlobSrc()

      await expect
        .poll(() => glsl.getPreviewNaturalSize())
        .toEqual({ width: 64, height: 64 })
      await glsl.expectEveryPixelToBe([255, 0, 0, 255])
    })
  })

  test.describe('with primitive int source', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('nodes/glsl_shader_with_int')
      await comfyPage.vueNodes.waitForNodes(2)
    })

    test('refreshes preview when upstream PrimitiveInt value changes', async ({
      comfyPage,
      getWebSocket
    }) => {
      const ws = await getWebSocket()
      const glsl = new GLSLShaderNode(comfyPage, GLSL_NODE_ID, GLSL_NODE_TITLE)
      const intValueWidget = comfyPage.vueNodes.getWidgetByName(
        PRIMITIVE_INT_NODE_TITLE,
        'value'
      )
      const { input: intValueInput } =
        comfyPage.vueNodes.getInputNumberControls(intValueWidget)

      await glsl.simulateExecutionOutput(ws)
      const initialSrc = await glsl.waitForBlobSrc()

      await test.step('changing the upstream int value re-renders the preview', async () => {
        await expect(intValueInput).toBeVisible()
        await intValueInput.fill('100')
        await intValueInput.blur()

        await expect.poll(() => glsl.getPreviewSrc()).not.toBe(initialSrc)
        await expect.poll(() => glsl.getPreviewSrc()).toMatch(/^blob:/)
      })

      await test.step('upstream int value flows through as the u_int0 uniform', async () => {
        // Shader writes vec4(float(u_int0) / 100.0, 0, 0, 1); value 100 → red.
        await glsl.expectEveryPixelToBe([255, 0, 0, 255])
      })
    })
  })

  test.describe('with primitive boolean source', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('nodes/glsl_shader_with_bool')
      await comfyPage.vueNodes.waitForNodes(2)
    })

    test('upstream PrimitiveBoolean value flows through as the u_bool0 uniform', async ({
      comfyPage,
      getWebSocket
    }) => {
      const ws = await getWebSocket()
      const glsl = new GLSLShaderNode(comfyPage, GLSL_NODE_ID, GLSL_NODE_TITLE)
      const booleanToggle = comfyPage.vueNodes
        .getNodeByTitle(PRIMITIVE_BOOLEAN_NODE_TITLE)
        .getByRole('switch', { name: 'value' })

      await test.step('boolean=false renders blue', async () => {
        await glsl.simulateExecutionOutput(ws)
        await glsl.waitForBlobSrc()
        // Blue (non-max channel) through RGBA16F → PNG round-trip can drift by 2.
        await glsl.expectEveryPixelToBe([0, 0, 255, 255], 2)
      })

      await test.step('toggling boolean=true re-renders red', async () => {
        const blueSrc = (await glsl.getPreviewSrc())!
        await expect(booleanToggle).toBeVisible()
        await booleanToggle.click()

        await expect.poll(() => glsl.getPreviewSrc()).not.toBe(blueSrc)
        await expect.poll(() => glsl.getPreviewSrc()).toMatch(/^blob:/)
        await glsl.expectEveryPixelToBe([255, 0, 0, 255])
      })
    })
  })

  test.describe('GLSL inside a subgraph', () => {
    const SUBGRAPH_NODE_ID = '1'

    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('nodes/glsl_shader_in_subgraph')
      await comfyPage.vueNodes.waitForNodes(1)
    })

    test('renders a GLSL blob preview on the outer subgraph node', async ({
      comfyPage,
      getWebSocket
    }) => {
      const ws = await getWebSocket()
      // Inside a subgraph, the GLSL renderer writes the blob preview to the
      // INNER GLSLShader's locator; the outer subgraph node surfaces it via
      // the promoted-preview path (ImagePreview component), not LivePreview.
      // Either way, the observable signal is an <img> with a blob: src.
      const subgraph = new GLSLShaderNode(
        comfyPage,
        SUBGRAPH_NODE_ID,
        'GLSL Subgraph'
      )

      await subgraph.simulateExecutionOutput(ws)
      await expect(subgraph.previewImage).toBeVisible()
      await subgraph.waitForBlobSrc()
      await subgraph.expectEveryPixelToBe([255, 0, 0, 255])
    })
  })

  test.describe('GLSL inside a subgraph with uniform source', () => {
    const SUBGRAPH_NODE_ID = '1'

    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow(
        'nodes/glsl_shader_subgraph_with_float'
      )
      await comfyPage.vueNodes.waitForNodes(1)
    })

    test('extracts uniform sources from inner upstream widgets', async ({
      comfyPage,
      getWebSocket
    }) => {
      const ws = await getWebSocket()
      // Inner PrimitiveFloat is wired to the inner GLSLShader's floats.u_float0
      // input. useGLSLUniforms.extractUniformSources should pick it up and feed
      // 1.0 as u_float0 — shader outputs vec4(u_float0, 0, 0, 1) → red.
      const subgraph = new GLSLShaderNode(
        comfyPage,
        SUBGRAPH_NODE_ID,
        'GLSL Subgraph With Float'
      )

      await subgraph.simulateExecutionOutput(ws)
      await expect(subgraph.previewImage).toBeVisible()
      await subgraph.waitForBlobSrc()
      await subgraph.expectEveryPixelToBe([255, 0, 0, 255])
    })
  })
})
