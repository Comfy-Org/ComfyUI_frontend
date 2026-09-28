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

  const rendered = await text.screenshot({ animations: 'disabled' })

  const ink = await text.page().evaluate(async (rendered) => {
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
    const visible = await decode(rendered)
    const colors = new Map<number, number>()
    for (let index = 0; index < visible.data.length; index += 4) {
      const color =
        (visible.data[index] << 16) |
        (visible.data[index + 1] << 8) |
        visible.data[index + 2]
      colors.set(color, (colors.get(color) ?? 0) + 1)
    }
    const background = [...colors].reduce((mostCommon, current) =>
      current[1] > mostCommon[1] ? current : mostCommon
    )[0]
    const backgroundRed = background >> 16
    const backgroundGreen = (background >> 8) & 0xff
    const backgroundBlue = background & 0xff
    let pixels = 0
    for (let index = 0; index < visible.data.length; index += 4) {
      const difference =
        Math.abs(visible.data[index] - backgroundRed) +
        Math.abs(visible.data[index + 1] - backgroundGreen) +
        Math.abs(visible.data[index + 2] - backgroundBlue)
      if (difference < 24) continue
      pixels++
    }
    return pixels
  }, rendered.toString('base64'))

  expect(ink).toBeGreaterThan(10)
}
