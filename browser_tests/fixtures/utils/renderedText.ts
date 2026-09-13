import { comfyExpect as expect } from '@e2e/fixtures/utils/customMatchers'
import type { Locator } from '@playwright/test'

export async function expectRenderedTextUnclipped(
  text: Locator,
  screenshotTarget: Locator
) {
  const clipping = await text.evaluate(
    (element, target) => {
      if (!target) throw new Error('Expected screenshot target to be attached')
      const range = document.createRange()
      range.selectNodeContents(element)
      const laidOut = range.getBoundingClientRect()
      const style = getComputedStyle(element)
      const natural = document.createElement('span')
      natural.textContent = element.textContent
      natural.style.cssText =
        'position:fixed;visibility:hidden;width:max-content;max-width:none;white-space:pre'
      natural.style.font = style.font
      natural.style.letterSpacing = style.letterSpacing
      natural.style.textTransform = style.textTransform
      document.body.append(natural)
      range.selectNodeContents(natural)
      const naturalWidth = range.getBoundingClientRect().width
      natural.remove()
      const scaleX =
        element instanceof HTMLElement && element.offsetWidth > 0
          ? element.getBoundingClientRect().width / element.offsetWidth
          : 1
      const visible = target.getBoundingClientRect().toJSON()
      let ancestor: Element | null = element

      while (ancestor) {
        const ancestorStyle = getComputedStyle(ancestor)
        if (
          [
            ancestorStyle.overflow,
            ancestorStyle.overflowX,
            ancestorStyle.overflowY
          ].some((overflow) =>
            ['hidden', 'clip', 'scroll', 'auto'].includes(overflow)
          )
        ) {
          const bounds = ancestor.getBoundingClientRect()
          visible.bottom = Math.min(visible.bottom, bounds.bottom)
          visible.left = Math.max(visible.left, bounds.left)
          visible.right = Math.min(visible.right, bounds.right)
          visible.top = Math.max(visible.top, bounds.top)
        }
        ancestor = ancestor.parentElement
      }

      return (
        laidOut.left >= visible.left - 1 &&
        laidOut.top >= visible.top - 1 &&
        laidOut.left + naturalWidth * scaleX <= visible.right + 1 &&
        laidOut.bottom <= visible.bottom + 1
      )
    },
    await screenshotTarget.elementHandle()
  )

  expect(clipping, 'complete text layout must fit within clipping bounds').toBe(
    true
  )

  const rendered = await screenshotTarget.screenshot({ animations: 'disabled' })
  const inlineColor = await text.evaluate((element) => {
    const color = element.style.color
    element.style.color = 'transparent'
    return color
  })
  const withoutText = await screenshotTarget
    .screenshot({ animations: 'disabled' })
    .finally(() =>
      text.evaluate((element, color) => {
        element.style.color = color
      }, inlineColor)
    )

  const ink = await text.page().evaluate(
    async ({ rendered, withoutText }) => {
      const decode = async (base64: string) => {
        const image = new Image()
        image.src = `data:image/png;base64,${base64}`
        await image.decode()
        const canvas = document.createElement('canvas')
        canvas.width = image.width
        canvas.height = image.height
        const context = canvas.getContext('2d')
        if (!context) throw new Error('Failed to create 2D canvas context')
        context.drawImage(image, 0, 0)
        return context.getImageData(0, 0, image.width, image.height)
      }
      const [visible, hidden] = await Promise.all([
        decode(rendered),
        decode(withoutText)
      ])
      const bounds = {
        left: visible.width,
        top: visible.height,
        right: -1,
        bottom: -1
      }
      let pixels = 0
      for (let index = 0; index < visible.data.length; index += 4) {
        const difference =
          Math.abs(visible.data[index] - hidden.data[index]) +
          Math.abs(visible.data[index + 1] - hidden.data[index + 1]) +
          Math.abs(visible.data[index + 2] - hidden.data[index + 2])
        if (difference < 24) continue
        const pixel = index / 4
        const x = pixel % visible.width
        const y = Math.floor(pixel / visible.width)
        bounds.left = Math.min(bounds.left, x)
        bounds.top = Math.min(bounds.top, y)
        bounds.right = Math.max(bounds.right, x)
        bounds.bottom = Math.max(bounds.bottom, y)
        pixels++
      }
      return { bounds, height: visible.height, pixels, width: visible.width }
    },
    {
      rendered: rendered.toString('base64'),
      withoutText: withoutText.toString('base64')
    }
  )

  expect(ink.pixels).toBeGreaterThan(10)
  expect(ink.bounds.left).toBeGreaterThan(0)
  expect(ink.bounds.top).toBeGreaterThan(0)
  expect(ink.bounds.right).toBeLessThan(ink.width - 1)
  expect(ink.bounds.bottom).toBeLessThan(ink.height - 1)
}
