import type { Locator } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import workflow from '@e2e/assets/agent/reference-preparation.json' with { type: 'json' }
import enMessages from '@/locales/en/main.json' with { type: 'json' }

export class AgentCanvasEntry {
  public readonly composer: Locator
  public readonly phase: Locator
  public readonly pauseButton: Locator
  public readonly resumeButton: Locator
  public readonly skipButton: Locator
  public readonly librarySearch: Locator
  public readonly generatedNodes: Locator

  constructor(private readonly comfyPage: ComfyPage) {
    const page = comfyPage.page
    this.composer = page.getByRole('textbox', {
      name: enMessages.agent.compactComposer.label
    })
    this.phase = page.getByText(
      /Choosing \d+ of|Placing \d+ of|Connecting \d+ of/
    )
    this.pauseButton = page.getByRole('button', {
      name: enMessages.agent.graphBuild.pause
    })
    this.resumeButton = page.getByRole('button', {
      name: enMessages.agent.graphBuild.resume
    })
    this.skipButton = page.getByRole('button', {
      name: enMessages.agent.graphBuild.skip
    })
    this.librarySearch = comfyPage.menu.nodeLibraryTabV2.searchInput
    this.generatedNodes = page.locator(
      '#graph-canvas-container .lg-node[data-node-id="101"], ' +
        '#graph-canvas-container .lg-node[data-node-id="102"], ' +
        '#graph-canvas-container .lg-node[data-node-id="103"]'
    )
  }

  async expectLibrarySelection(nodeType: string) {
    await expect(this.librarySearch).toHaveValue(nodeType)
    await expect(
      this.comfyPage.page.locator(`[data-node-type="${nodeType}"]`)
    ).toHaveAttribute('data-agent-teaching-selected', 'true')
  }

  async expectQueuedControlsHidden() {
    await expect
      .poll(() =>
        this.generatedNodes.evaluateAll((nodes) => {
          const staged = nodes.filter(
            (node) => getComputedStyle(node).visibility === 'hidden'
          )
          return {
            staged: staged.length,
            leaked: staged.flatMap((node) =>
              [...node.querySelectorAll('*')].filter((child) =>
                child.checkVisibility({
                  checkOpacity: true,
                  checkVisibilityCSS: true
                })
              )
            ).length
          }
        })
      )
      .toEqual({ staged: 2, leaked: 0 })
  }

  async expectPositionFrozenForFrames(node: Locator) {
    const samples = await node.evaluate(
      (element) =>
        new Promise<Pick<DOMRect, 'x' | 'y' | 'width' | 'height'>[]>(
          (resolve) => {
            const samples: Pick<DOMRect, 'x' | 'y' | 'width' | 'height'>[] = []
            const started = performance.now()
            function sample(now: number) {
              const { x, y, width, height } = element.getBoundingClientRect()
              samples.push({ x, y, width, height })
              if (now - started >= 1000 && samples.length >= 10)
                resolve(samples)
              else requestAnimationFrame(sample)
            }
            requestAnimationFrame(sample)
          }
        )
    )
    expect(samples.length).toBeGreaterThanOrEqual(10)
    for (const axis of ['x', 'y', 'width', 'height'] as const) {
      const values = samples.map((sample) => sample[axis])
      expect(Math.max(...values) - Math.min(...values), axis).toBeLessThan(0.1)
    }
    await expect(this.resumeButton).toBeVisible()
  }

  async expectGraphPreserved() {
    await expect
      .poll(() =>
        this.comfyPage.page.evaluate(() => ({
          nodes: window.app!.graph.nodes.map((node) => ({
            id: String(node.id),
            pos: [...node.pos]
          })),
          links: [...window.app!.graph.links.values()].map((link) =>
            link.serialize()
          )
        }))
      )
      .toEqual({
        nodes: workflow.nodes.map(({ id, pos }) => ({ id: String(id), pos })),
        links: workflow.links
      })
  }

  async interruptWithCanvasGesture(gesture: 'zoom' | 'pan') {
    const point = await this.comfyPage.canvas.evaluate((canvas) => {
      const rect = canvas.getBoundingClientRect()
      for (const xRatio of [0.9, 0.7, 0.5]) {
        for (const yRatio of [0.5, 0.7, 0.3]) {
          const x = rect.x + rect.width * xRatio
          const y = rect.y + rect.height * yRatio
          if (document.elementFromPoint(x, y) === canvas) return { x, y }
        }
      }
      return null
    })
    expect(point, 'Expected an unobstructed canvas point').not.toBeNull()
    if (!point) throw new Error('No unobstructed canvas point for the gesture')
    const page = this.comfyPage.page
    const before = await page.evaluate(() => ({
      scale: window.app!.canvas.ds.scale,
      offset: [...window.app!.canvas.ds.offset]
    }))
    await page.mouse.move(point.x, point.y)
    if (gesture === 'zoom') await page.mouse.wheel(0, 120)
    else {
      await page.mouse.down({ button: 'middle' })
      await page.mouse.move(point.x - 80, point.y + 40, { steps: 5 })
      await page.mouse.up({ button: 'middle' })
    }
    await this.comfyPage.nextFrame()
    await expect
      .poll(() =>
        page.evaluate(() => ({
          scale: window.app!.canvas.ds.scale,
          offset: [...window.app!.canvas.ds.offset]
        }))
      )
      .not.toEqual(before)
  }

  async expectCleanedUp(previousLinkMode: number) {
    await expect(this.phase).toBeHidden()
    await expect(this.generatedNodes).toHaveCount(3)
    await expect
      .poll(() =>
        this.generatedNodes.evaluateAll((nodes) =>
          nodes.map((node) => ({
            id: node.getAttribute('data-node-id'),
            translate:
              node instanceof HTMLElement ? node.style.translate : null,
            willChange:
              node instanceof HTMLElement ? node.style.willChange : null,
            opacity: getComputedStyle(node).opacity,
            visible: node.checkVisibility({ checkVisibilityCSS: true }),
            inert: node instanceof HTMLElement ? node.inert : null
          }))
        )
      )
      .toEqual(
        workflow.nodes.map(({ id }) => ({
          id: String(id),
          translate: '',
          willChange: '',
          opacity: '1',
          visible: true,
          inert: false
        }))
      )
    await expect
      .poll(() =>
        this.comfyPage.page.evaluate(() => window.app!.canvas.links_render_mode)
      )
      .toBe(previousLinkMode)
    await expect(
      this.comfyPage.page.locator('[data-agent-teaching-selected="true"]')
    ).toHaveCount(0)
    await this.expectGraphPreserved()
  }

  async expectNodesWithinCanvas() {
    await expect(async () => {
      const canvas = await this.comfyPage.canvas.boundingBox()
      const composer = await this.composer.boundingBox()
      const sidebarContent = this.comfyPage.menu.nodeLibraryTabV2.sidebarContent
      const sidebar = (await sidebarContent.isVisible())
        ? await sidebarContent.boundingBox()
        : null
      expect(canvas).not.toBeNull()
      expect(composer).not.toBeNull()
      if (!canvas || !composer) throw new Error('Canvas or composer is absent')
      const left = Math.max(canvas.x, sidebar ? sidebar.x + sidebar.width : 0)
      const right = canvas.x + canvas.width
      const bottom = Math.min(canvas.y + canvas.height, composer.y)
      for (const node of await this.generatedNodes.all()) {
        const box = await node.boundingBox()
        expect(box).not.toBeNull()
        if (!box) throw new Error('A generated node is absent')
        const bounds = JSON.stringify({ box, canvas, composer, sidebar })
        expect(box.x, bounds).toBeGreaterThanOrEqual(left)
        expect(box.x + box.width, bounds).toBeLessThanOrEqual(right)
        expect(box.y, bounds).toBeGreaterThanOrEqual(canvas.y)
        expect(box.y + box.height, bounds).toBeLessThanOrEqual(bottom)
      }
    }).toPass({ timeout: 5000 })
  }
}
