import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

export class ContextMenu {
  public readonly ariaMenu: Locator
  public readonly litegraphMenu: Locator
  public readonly litegraphContextMenu: Locator
  public readonly menuItems: Locator
  protected readonly anyMenu: Locator

  constructor(public readonly page: Page) {
    this.ariaMenu = page.locator('[role="menu"]:visible')
    this.litegraphMenu = page.locator('.litemenu')
    this.litegraphContextMenu = page.locator('.litecontextmenu')
    this.menuItems = page
      .getByRole('menuitem')
      .or(page.locator('.litemenu-entry'))
    this.anyMenu = this.ariaMenu
      .or(this.litegraphMenu)
      .or(this.litegraphContextMenu)
  }

  async clickMenuItem(name: string): Promise<void> {
    await this.page.getByRole('menuitem', { name }).click()
  }

  async clickMenuItemExact(name: string): Promise<void> {
    await this.page.getByRole('menuitem', { name, exact: true }).click()
    await this.waitForHidden()
  }

  menuItem(name: string): Locator {
    return this.anyMenu.getByRole('menuitem', { name, exact: true })
  }

  async distanceFrom(point: { x: number; y: number }): Promise<number> {
    return this.ariaMenu.evaluate((element, point) => {
      const { x, y } = element.getBoundingClientRect()
      return Math.hypot(x - point.x, y - point.y)
    }, point)
  }

  async hoverItem(name: string, area: 'padding' | 'content') {
    const item = this.menuItem(name)
    const position = await item.evaluate((element, area) => {
      const { width, height } = element.getBoundingClientRect()
      return {
        x:
          area === 'padding'
            ? parseFloat(getComputedStyle(element).paddingLeft) / 2
            : width / 2,
        y: height / 2
      }
    }, area)
    await item.hover({ position })
  }

  async getItemBackgrounds(name: string) {
    return this.menuItem(name).evaluate((item) => {
      const rect = item.getBoundingClientRect()
      const row = getComputedStyle(item).backgroundColor
      const content = document
        .elementsFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
        .filter((element) => item.contains(element))
        .map((element) => getComputedStyle(element).backgroundColor)
        .find(
          (color) => color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent'
        )
      return { row, content }
    })
  }

  async focusItemWithKeyboard(name: string): Promise<void> {
    await this.page.mouse.move(0, 0)
    await this.page.keyboard.press('ArrowDown')
    await expect(this.menuItem(name)).toBeFocused()
  }

  async getItemStyle(name: string) {
    return this.menuItem(name).evaluate((item) => {
      const style = getComputedStyle(item)
      return {
        backgroundColor: style.backgroundColor,
        borderRadius: style.borderRadius,
        paddingBottom: style.paddingBottom,
        paddingLeft: style.paddingLeft,
        paddingRight: style.paddingRight,
        paddingTop: style.paddingTop
      }
    })
  }

  async resolveBackgroundToken(token: string): Promise<string> {
    return this.page.evaluate((token) => {
      const probe = document.createElement('div')
      probe.style.backgroundColor = `var(${token})`
      document.body.append(probe)
      const backgroundColor = getComputedStyle(probe).backgroundColor
      probe.remove()
      return backgroundColor
    }, token)
  }

  async openColorSubmenu(): Promise<Locator> {
    await this.menuItem('Color').click()
    const submenu = this.page.getByRole('menu').filter({
      has: this.page.getByRole('menuitem', { name: 'Red', exact: true })
    })
    await expect(submenu).toBeVisible()
    return submenu
  }

  colorSwatch(name: string, submenu: Locator): Locator {
    return submenu
      .getByRole('menuitem', { name, exact: true })
      .locator('[style*="background-color"]')
  }

  async openShapeSubmenu(): Promise<Locator> {
    await this.menuItem('Shape').click()
    const submenu = this.page.getByRole('menu').filter({
      has: this.page.getByRole('menuitemradio', {
        name: 'Box',
        exact: true
      })
    })
    await expect(submenu).toBeVisible()
    return submenu
  }

  async selectShape(name: string): Promise<void> {
    const submenu = await this.openShapeSubmenu()
    await submenu.getByRole('menuitemradio', { name, exact: true }).click()
  }

  async measureCanvasTracking(node: Locator, motion: 'pan' | 'zoom') {
    const nodeElement = await node.elementHandle()

    return this.ariaMenu.evaluate(
      async (menu, { nodeElement, motion }) => {
        const { ds } = window.app!.canvas
        const initialTransform = {
          x: ds.offset[0],
          y: ds.offset[1],
          scale: ds.scale
        }
        const initialNode = nodeElement.getBoundingClientRect()
        const initialMenu = menu.getBoundingClientRect()
        const errors: number[] = []

        try {
          for (let frame = 0; frame < 12; frame++) {
            if (motion === 'pan') {
              ds.offset[0] += 4 / ds.scale
              ds.offset[1] -= 3 / ds.scale
            } else {
              ds.scale *= 1.01
            }
            await new Promise(requestAnimationFrame)

            const nodeRect = nodeElement.getBoundingClientRect()
            const menuRect = menu.getBoundingClientRect()
            const scale = nodeRect.width / initialNode.width
            errors.push(
              Math.hypot(
                menuRect.x -
                  (nodeRect.x + (initialMenu.x - initialNode.x) * scale),
                menuRect.y -
                  (nodeRect.y + (initialMenu.y - initialNode.y) * scale)
              )
            )
          }

          const finalNode = nodeElement.getBoundingClientRect()
          return {
            errors,
            nodeMovement: Math.hypot(
              finalNode.x - initialNode.x,
              finalNode.y - initialNode.y
            )
          }
        } finally {
          ds.offset = [initialTransform.x, initialTransform.y]
          ds.scale = initialTransform.scale
        }
      },
      { nodeElement, motion }
    )
  }

  /**
   * Click a litegraph menu entry. Selects the most recently opened matching
   * entry so nested submenu items can be reached without being shadowed by
   * the parent menu still visible behind them.
   */
  async clickLitegraphMenuItem(name: string): Promise<void> {
    await this.page
      .locator('.litemenu-entry:visible', { hasText: name })
      .last()
      .click()
  }

  async isVisible(): Promise<boolean> {
    return await this.anyMenu.isVisible()
  }

  async assertHasItems(items: string[]): Promise<void> {
    for (const item of items) {
      await expect
        .soft(this.page.getByRole('menuitem', { name: item }))
        .toBeVisible()
    }
  }

  async openFor(locator: Locator): Promise<this> {
    await locator.click({ button: 'right' })
    await expect(this.anyMenu).toBeVisible()
    return this
  }

  async dispatchFor(locator: Locator): Promise<{ defaultPrevented: boolean }> {
    const defaultPrevented = await locator.evaluate((element) => {
      const { x, y, width, height } = element.getBoundingClientRect()
      const event = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        button: 2,
        clientX: x + width / 2,
        clientY: y + height / 2
      })
      element.dispatchEvent(event)
      return event.defaultPrevented
    })
    await expect(this.anyMenu).toBeVisible()
    return { defaultPrevented }
  }

  async openForDisabledElement(locator: Locator): Promise<this> {
    await locator.dispatchEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      button: 2
    })
    await expect(this.anyMenu).toBeVisible()
    return this
  }

  /**
   * Select a Vue node by clicking its header, then right-click to open
   * the context menu. Vue nodes require a selection click before the
   * right-click so the correct per-node menu items appear.
   */
  async openForVueNode(header: Locator): Promise<this> {
    await header.click()
    await header.click({ button: 'right' })
    await this.ariaMenu.waitFor({ state: 'visible' })
    return this
  }

  async waitForHidden(): Promise<void> {
    await Promise.all([
      this.ariaMenu.waitFor({ state: 'hidden' }),
      this.litegraphMenu.waitFor({ state: 'hidden' }),
      this.litegraphContextMenu.waitFor({ state: 'hidden' })
    ])
  }
}
