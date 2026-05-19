import type { Locator } from '@playwright/test'

import type { RootCategoryId } from '@/components/searchbox/v2/rootCategories'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

const { searchBoxV2 } = TestIds

export type { RootCategoryId }

export class ComfyNodeSearchBoxV2 {
  readonly dialog: Locator
  readonly input: Locator
  readonly filterSearch: Locator
  readonly results: Locator
  readonly filterOptions: Locator
  readonly filterChips: Locator
  readonly noResults: Locator
  readonly nodeIdBadge: Locator
  readonly sidebarToggle: Locator
  readonly sidebarBackdrop: Locator
  readonly filterChipsScroll: Locator

  constructor(private comfyPage: ComfyPage) {
    const page = comfyPage.page
    this.dialog = page.getByRole('search')
    this.input = this.dialog.getByRole('combobox')
    this.filterSearch = this.dialog.getByRole('textbox', { name: 'Search' })
    this.results = this.dialog.getByTestId(searchBoxV2.resultItem)
    this.filterOptions = this.dialog.getByTestId(searchBoxV2.filterOption)
    this.filterChips = this.dialog.getByTestId(searchBoxV2.filterChip)
    this.noResults = this.dialog.getByTestId(searchBoxV2.noResults)
    this.nodeIdBadge = this.dialog.getByTestId(searchBoxV2.nodeIdBadge)
    this.sidebarToggle = this.dialog.getByTestId(searchBoxV2.sidebarToggle)
    this.sidebarBackdrop = this.dialog.getByTestId(searchBoxV2.sidebarBackdrop)
    this.filterChipsScroll = this.dialog.getByTestId(
      searchBoxV2.filterChipsScroll
    )
  }

  /** Sidebar category tree button (e.g. `sampling`, `sampling/custom_sampling`). */
  categoryButton(categoryId: string): Locator {
    return this.dialog.getByTestId(searchBoxV2.category(categoryId))
  }

  /** Top filter-bar root category chip (e.g. `comfy`, `essentials`). */
  rootCategoryButton(id: RootCategoryId): Locator {
    return this.dialog.getByTestId(searchBoxV2.rootCategory(id))
  }

  /** Top filter-bar input/output type popover trigger. */
  typeFilterButton(key: 'input' | 'output'): Locator {
    return this.dialog.getByTestId(searchBoxV2.typeFilter(key))
  }

  async applyTypeFilter(
    key: 'input' | 'output',
    typeName: string
  ): Promise<void> {
    const trigger = this.typeFilterButton(key)
    await trigger.click()
    await this.filterOptions.first().waitFor({ state: 'visible' })
    await this.filterSearch.fill(typeName)
    await this.filterOptions.filter({ hasText: typeName }).first().click()
    // The popover does not auto-close on selection — toggle the trigger.
    await trigger.click()
    await this.filterOptions.first().waitFor({ state: 'hidden' })
  }

  async removeFilterChip(index = 0): Promise<void> {
    await this.filterChips
      .nth(index)
      .getByTestId(searchBoxV2.chipDelete)
      .click()
  }

  async toggle(): Promise<void> {
    await this.comfyPage.command.executeCommand('Workspace.SearchBox.Toggle')
  }

  async open(): Promise<void> {
    if (await this.input.isVisible()) return
    await this.toggle()
    await this.input.waitFor({ state: 'visible' })
  }

  async openByDoubleClickCanvas(): Promise<void> {
    // Use page.mouse.dblclick (not canvas.dblclick) so the z-999 Vue overlay
    // does not intercept; coords target a viewport spot that is on the canvas
    // and clear of both the side toolbar and any default-graph nodes.
    await this.comfyPage.page.mouse.dblclick(200, 200, { delay: 5 })
  }

  async ensureV2Search(): Promise<void> {
    await this.comfyPage.settings.setSetting(
      'Comfy.NodeSearchBoxImpl',
      'default'
    )
  }

  async setup(): Promise<void> {
    await this.ensureV2Search()
    await this.comfyPage.settings.setSetting(
      'Comfy.LinkRelease.Action',
      'search box'
    )
    await this.comfyPage.settings.setSetting(
      'Comfy.LinkRelease.ActionShift',
      'search box'
    )
  }
}
