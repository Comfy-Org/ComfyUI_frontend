import type { Locator, Page } from '@playwright/test'

import type { NodeReference } from './litegraphUtils'

/**
 * VueNodeFixture provides Vue-specific testing utilities for interacting with
 * Vue node components. It bridges the gap between litegraph node references
 * and Vue UI components.
 */
export class VueNodeFixture {
  constructor(
    private readonly nodeRef: NodeReference,
    private readonly page: Page
  ) {}

  /**
   * Get the node's header element using data-testid
   */
  async getHeader(): Promise<Locator> {
    const nodeId = this.nodeRef.id
    return this.page.locator(`[data-testid="node-header-${nodeId}"]`)
  }

  /**
   * Get the node's title element
   */
  async getTitleElement(): Promise<Locator> {
    const header = await this.getHeader()
    return header.locator('[data-testid="node-title"]')
  }

  /**
   * Get the current title text
   */
  async getTitle(): Promise<string> {
    const titleElement = await this.getTitleElement()
    return (await titleElement.textContent()) || ''
  }

  /**
   * Set a new title by double-clicking and entering text
   */
  async setTitle(newTitle: string): Promise<void> {
    const titleElement = await this.getTitleElement()
    await titleElement.dblclick()

    const input = (await this.getHeader()).locator(
      '[data-testid="node-title-input"]'
    )
    await input.fill(newTitle)
    await input.press('Enter')
  }

  /**
   * Cancel title editing
   */
  async cancelTitleEdit(): Promise<void> {
    const titleElement = await this.getTitleElement()
    await titleElement.dblclick()

    const input = (await this.getHeader()).locator(
      '[data-testid="node-title-input"]'
    )
    await input.press('Escape')
  }

  /**
   * Check if the title is currently being edited
   */
  async isEditingTitle(): Promise<boolean> {
    const header = await this.getHeader()
    const input = header.locator('[data-testid="node-title-input"]')
    return await input.isVisible()
  }

  /**
   * Get the collapse/expand button
   */
  async getCollapseButton(): Promise<Locator> {
    const header = await this.getHeader()
    return header.locator('[data-testid="node-collapse-button"]')
  }

  /**
   * Toggle the node's collapsed state
   */
  async toggleCollapse(): Promise<void> {
    const button = await this.getCollapseButton()
    await button.click()
  }

  /**
   * Get the collapse icon element
   */
  async getCollapseIcon(): Promise<Locator> {
    const button = await this.getCollapseButton()
    return button.locator('i')
  }

  /**
   * Get the collapse icon's CSS classes
   */
  async getCollapseIconClass(): Promise<string> {
    const icon = await this.getCollapseIcon()
    return (await icon.getAttribute('class')) || ''
  }

  /**
   * Check if the collapse button is visible
   */
  async isCollapseButtonVisible(): Promise<boolean> {
    const button = await this.getCollapseButton()
    return await button.isVisible()
  }

  /**
   * Get the node's body/content element
   */
  async getBody(): Promise<Locator> {
    const nodeId = this.nodeRef.id
    return this.page.locator(`[data-testid="node-body-${nodeId}"]`)
  }

  /**
   * Check if the node body is visible (not collapsed)
   */
  async isBodyVisible(): Promise<boolean> {
    const body = await this.getBody()
    return await body.isVisible()
  }
}
