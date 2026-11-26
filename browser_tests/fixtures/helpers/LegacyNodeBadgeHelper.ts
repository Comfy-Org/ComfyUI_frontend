import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

type BadgeTarget =
  | { key: string; title: string; type?: never }
  | { key: string; title?: never; type: string }

export class LegacyNodeBadgeHelper {
  private readonly probe: Locator

  constructor(private readonly page: Page) {
    this.probe = page.locator('#legacy-node-badge-draw-probe')
  }

  async install(targets: readonly BadgeTarget[]) {
    await this.page.evaluate((targets) => {
      const probe = document.createElement('output')
      probe.id = 'legacy-node-badge-draw-probe'
      probe.hidden = true
      probe.dataset.frames = '0'
      document.body.append(probe)

      for (const target of targets) {
        const node = window.app!.graph.nodes.find((node) =>
          target.title ? node.title === target.title : node.type === target.type
        )
        if (!node) throw new Error(`Badge node not found: ${target.key}`)

        const drawBadges = node.drawBadges
        node.drawBadges = function (ctx, options) {
          const texts: string[] = []
          const fillText = ctx.fillText
          ctx.fillText = function (text, ...args) {
            fillText.call(this, text, ...args)
            texts.push(text)
          }
          try {
            drawBadges.call(this, ctx, options)
            probe.setAttribute(
              `data-${target.key}-texts`,
              JSON.stringify(texts)
            )
            probe.dataset.frames = String(Number(probe.dataset.frames) + 1)
          } finally {
            ctx.fillText = fillText
          }
        }
      }
      window.app!.graph.setDirtyCanvas(true, true)
    }, targets)
  }

  async redraw() {
    const frame = Number(await this.probe.getAttribute('data-frames'))
    await this.page.evaluate(() => window.app!.graph.setDirtyCanvas(true, true))
    await expect
      .poll(async () => Number(await this.probe.getAttribute('data-frames')))
      .toBeGreaterThan(frame)
  }

  async expectText(key: string, text: string, visible: boolean) {
    const getTexts = async () => {
      const serialized = await this.probe.getAttribute(`data-${key}-texts`)
      // No frame has redrawn this node since install(). Return a value that
      // matches neither `true` nor `false` so the poll keeps waiting: a probe
      // that never draws must time out, not silently satisfy `visible: false`.
      if (serialized === null) return null
      const parsed: unknown = JSON.parse(serialized)
      if (
        !Array.isArray(parsed) ||
        !parsed.every((value): value is string => typeof value === 'string')
      ) {
        throw new Error(`Invalid legacy badge probe value: ${key}`)
      }
      return parsed.some((value) => value.includes(text))
    }

    await expect.poll(getTexts).toBe(visible)
  }

  async expectState(
    expectations: readonly { key: string; text: string; visible: boolean }[]
  ) {
    await this.redraw()
    for (const expectation of expectations) {
      await this.expectText(
        expectation.key,
        expectation.text,
        expectation.visible
      )
    }
  }
}
