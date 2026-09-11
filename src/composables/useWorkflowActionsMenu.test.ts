import { fromPartial } from '@total-typescript/shoehorn'
import {
  useWorkflowBookmarkStore,
  useWorkflowStore
} from '@/platform/workflow/management/stores/workflowStore'
import { useCommandStore } from '@/stores/commandStore'
import { useSubgraphStore } from '@/stores/subgraphStore'
import { useMenuItemStore } from '@/stores/menuItemStore'
import { useAppModeStore } from '@/stores/appModeStore'
import { render } from '@testing-library/vue'
import { defineComponent, ref } from 'vue'
import { createI18n } from 'vue-i18n'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useWorkflowActionsMenu as useWorkflowActionsMenuComposable } from '@/composables/useWorkflowActionsMenu'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import type { WorkflowMenuAction } from '@/types/workflowMenuItem'
import { toNodeId } from '@/types/nodeId'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} },
  missingWarn: false,
  fallbackWarn: false
})

let mockBookmarkStore: ReturnType<typeof useWorkflowBookmarkStore>

let mockWorkflowStore: ReturnType<typeof useWorkflowStore>

const mockWorkflowService = vi.hoisted(() => ({
  openWorkflow: vi.fn(),
  duplicateWorkflow: vi.fn(),
  saveWorkflowAs: vi.fn(),
  deleteWorkflow: vi.fn()
}))

let mockCommandStore: ReturnType<typeof useCommandStore>

let mockSubgraphStore: ReturnType<typeof useSubgraphStore>

let mockMenuItemStore: ReturnType<typeof useMenuItemStore>

let mockAppModeStore: ReturnType<typeof useAppModeStore>

const mockFeatureFlags = vi.hoisted(() => ({
  flags: { linearToggleEnabled: false }
}))

vi.mock<unknown>(
  import('@/platform/workflow/core/services/workflowService'),
  () => ({
    useWorkflowService: vi.fn(() => mockWorkflowService)
  })
)

vi.mock<unknown>(import('@/composables/useFeatureFlags'), () => ({
  useFeatureFlags: vi.fn(() => mockFeatureFlags)
}))

function useWorkflowActionsMenu(
  ...args: Parameters<typeof useWorkflowActionsMenuComposable>
) {
  let composable!: ReturnType<typeof useWorkflowActionsMenuComposable>
  const Wrapper = defineComponent({
    setup() {
      composable = useWorkflowActionsMenuComposable(...args)
      return () => null
    }
  })
  render(Wrapper, { global: { plugins: [i18n] } })
  return composable
}

type MenuItems = ReturnType<typeof useWorkflowActionsMenu>['menuItems']['value']

function actionItems(items: MenuItems): WorkflowMenuAction[] {
  return items.filter(
    (i): i is WorkflowMenuAction => !i.separator && i.visible !== false
  )
}

function menuLabels(items: MenuItems) {
  return actionItems(items).map((i) => i.label)
}

function findItem(items: MenuItems, label: string): WorkflowMenuAction {
  const item = actionItems(items).find((i) => i.label === label)
  if (!item) throw new Error(`Menu item "${label}" not found`)
  return item
}

describe('useWorkflowActionsMenu', () => {
  beforeEach(() => {
    mockBookmarkStore = useWorkflowBookmarkStore()
    mockWorkflowStore = useWorkflowStore()
    mockCommandStore = useCommandStore()
    mockSubgraphStore = useSubgraphStore()
    mockMenuItemStore = useMenuItemStore()
    mockAppModeStore = useAppModeStore()
    vi.mocked(mockCommandStore.execute).mockResolvedValue(undefined)
    vi.mocked(mockBookmarkStore.toggleBookmarked).mockResolvedValue(undefined)
    vi.mocked(mockBookmarkStore.isBookmarked).mockReturnValue(false)
    vi.mocked(mockSubgraphStore.isSubgraphBlueprint).mockReturnValue(false)
    mockMenuItemStore.hasSeenLinear = false
    mockFeatureFlags.flags.linearToggleEnabled = false
    mockAppModeStore.selectedInputs.length = 0
    mockAppModeStore.selectedOutputs.length = 0
    mockWorkflowStore.activeWorkflow = fromPartial<
      NonNullable<typeof mockWorkflowStore.activeWorkflow>
    >({
      path: 'test.json',
      isPersisted: true
    })
  })

  it('shows root-level items by default', () => {
    const { menuItems } = useWorkflowActionsMenu(vi.fn(), { isRoot: true })
    const labels = menuLabels(menuItems.value)

    expect(labels).toContain('g.rename')
    expect(labels).toContain('breadcrumbsMenu.duplicate')
    expect(labels).toContain('menuLabels.Save')
    expect(labels).toContain('menuLabels.Save As')
    expect(labels).toContain('menuLabels.Export')
    expect(labels).toContain('menuLabels.Export (API)')
    expect(labels).toContain('breadcrumbsMenu.clearWorkflow')
    expect(labels).toContain('breadcrumbsMenu.deleteWorkflow')
  })

  it('hides root-only items when isRoot is false', () => {
    const { menuItems } = useWorkflowActionsMenu(vi.fn(), { isRoot: false })
    const labels = menuLabels(menuItems.value)

    expect(labels).toContain('g.rename')
    expect(labels).toContain('breadcrumbsMenu.clearWorkflow')
    expect(labels).not.toContain('breadcrumbsMenu.duplicate')
    expect(labels).not.toContain('menuLabels.Save')
    expect(labels).not.toContain('menuLabels.Save As')
  })

  it('hides delete item when includeDelete is false', () => {
    const { menuItems } = useWorkflowActionsMenu(vi.fn(), {
      isRoot: true,
      includeDelete: false
    })
    const labels = menuLabels(menuItems.value)

    expect(labels).not.toContain('breadcrumbsMenu.deleteWorkflow')
  })

  it('shows app mode items when linearToggleEnabled flag is set', () => {
    mockFeatureFlags.flags.linearToggleEnabled = true

    const { menuItems } = useWorkflowActionsMenu(vi.fn(), { isRoot: true })
    const labels = menuLabels(menuItems.value)

    expect(labels).toContain('breadcrumbsMenu.enterAppMode')
  })

  it('shows app mode items when user has seen linear mode', () => {
    mockMenuItemStore.hasSeenLinear = true

    const { menuItems } = useWorkflowActionsMenu(vi.fn(), { isRoot: true })
    const labels = menuLabels(menuItems.value)

    expect(labels).toContain('breadcrumbsMenu.enterAppMode')
  })

  it('hides app mode items when conditions not met', () => {
    mockMenuItemStore.hasSeenLinear = false
    mockFeatureFlags.flags.linearToggleEnabled = false

    const { menuItems } = useWorkflowActionsMenu(vi.fn(), { isRoot: true })
    const labels = menuLabels(menuItems.value)

    expect(labels).not.toContain('breadcrumbsMenu.enterAppMode')
  })

  it('hides app mode items when not root', () => {
    mockFeatureFlags.flags.linearToggleEnabled = true

    const { menuItems } = useWorkflowActionsMenu(vi.fn(), { isRoot: false })
    const labels = menuLabels(menuItems.value)

    expect(labels).not.toContain('breadcrumbsMenu.enterAppMode')
  })

  it('shows "go to workflow mode" when in linear mode', () => {
    mockFeatureFlags.flags.linearToggleEnabled = true
    mockWorkflowStore.activeWorkflow = fromPartial<
      NonNullable<typeof mockWorkflowStore.activeWorkflow>
    >({
      path: 'test.json',
      isPersisted: true,
      activeMode: 'app'
    })

    const { menuItems } = useWorkflowActionsMenu(vi.fn(), { isRoot: true })
    const labels = menuLabels(menuItems.value)

    expect(labels).toContain('breadcrumbsMenu.exitAppMode')
    expect(labels).not.toContain('breadcrumbsMenu.enterAppMode')
  })

  it('shows bookmark label based on bookmark state', () => {
    vi.mocked(mockBookmarkStore.isBookmarked).mockReturnValue(true)

    const { menuItems } = useWorkflowActionsMenu(vi.fn(), { isRoot: true })
    const labels = menuLabels(menuItems.value)

    expect(labels).toContain('tabMenu.removeFromBookmarks')
    expect(labels).not.toContain('tabMenu.addToBookmarks')
  })

  it('adds badge to app mode items', () => {
    mockFeatureFlags.flags.linearToggleEnabled = true

    const { menuItems } = useWorkflowActionsMenu(vi.fn(), { isRoot: true })
    const appModeItem = findItem(
      menuItems.value,
      'breadcrumbsMenu.enterAppMode'
    )

    expect(appModeItem.badge).toBeDefined()
  })

  it('calls startRename when rename command is invoked', async () => {
    const startRename = vi.fn()
    const { menuItems } = useWorkflowActionsMenu(startRename, {
      isRoot: true
    })

    await findItem(menuItems.value, 'g.rename').command?.()

    expect(startRename).toHaveBeenCalled()
  })

  it('uses provided workflow ref instead of activeWorkflow', () => {
    const customWorkflow = ref({
      path: 'custom.json',
      isPersisted: true,
      isTemporary: false
    } as ComfyWorkflow)

    vi.mocked(mockBookmarkStore.isBookmarked).mockReturnValue(false)

    const { menuItems } = useWorkflowActionsMenu(vi.fn(), {
      isRoot: true,
      workflow: customWorkflow
    })

    expect(menuItems.value.length).toBeGreaterThan(0)
    expect(mockBookmarkStore.isBookmarked).toHaveBeenCalledWith('custom.json')
  })

  it('shows publish item for blueprints', () => {
    vi.mocked(mockSubgraphStore.isSubgraphBlueprint).mockReturnValue(true)

    const { menuItems } = useWorkflowActionsMenu(vi.fn(), { isRoot: true })
    const labels = menuLabels(menuItems.value)

    expect(labels).toContain('subgraphStore.publish')
    expect(labels).toContain('breadcrumbsMenu.deleteBlueprint')
    expect(labels).not.toContain('breadcrumbsMenu.duplicate')
  })

  it('duplicate command calls workflowService.duplicateWorkflow', async () => {
    const { menuItems } = useWorkflowActionsMenu(vi.fn(), { isRoot: true })
    await findItem(menuItems.value, 'breadcrumbsMenu.duplicate').command?.()

    expect(mockWorkflowService.duplicateWorkflow).toHaveBeenCalledWith(
      mockWorkflowStore.activeWorkflow
    )
  })

  it('save command executes Comfy.SaveWorkflow', async () => {
    const { menuItems } = useWorkflowActionsMenu(vi.fn(), { isRoot: true })
    await findItem(menuItems.value, 'menuLabels.Save').command?.()

    expect(mockCommandStore.execute).toHaveBeenCalledWith('Comfy.SaveWorkflow')
  })

  it('delete command calls workflowService.deleteWorkflow', async () => {
    const { menuItems } = useWorkflowActionsMenu(vi.fn(), { isRoot: true })
    await findItem(
      menuItems.value,
      'breadcrumbsMenu.deleteWorkflow'
    ).command?.()

    expect(mockWorkflowService.deleteWorkflow).toHaveBeenCalledWith(
      mockWorkflowStore.activeWorkflow
    )
  })

  it('bookmark toggle calls bookmarkStore.toggleBookmarked', async () => {
    const { menuItems } = useWorkflowActionsMenu(vi.fn(), { isRoot: true })
    await findItem(menuItems.value, 'tabMenu.addToBookmarks').command?.()

    expect(mockBookmarkStore.toggleBookmarked).toHaveBeenCalledWith('test.json')
  })

  it('enter builder mode calls enterBuilder', async () => {
    mockFeatureFlags.flags.linearToggleEnabled = true

    const { menuItems } = useWorkflowActionsMenu(vi.fn(), { isRoot: true })
    await findItem(
      menuItems.value,
      'breadcrumbsMenu.enterBuilderMode'
    ).command?.()

    expect(mockAppModeStore.enterBuilder).toHaveBeenCalled()
  })

  it('shows "Edit app" when workflow has linear data', async () => {
    mockFeatureFlags.flags.linearToggleEnabled = true
    mockWorkflowStore.activeWorkflow = fromPartial<
      NonNullable<typeof mockWorkflowStore.activeWorkflow>
    >({
      path: 'test.json',
      isPersisted: true
    })
    mockAppModeStore.selectedInputs.push([1, 'widget'])
    mockAppModeStore.selectedOutputs.push(toNodeId(2))

    const { menuItems } = useWorkflowActionsMenu(vi.fn(), { isRoot: true })
    const item = findItem(menuItems.value, 'breadcrumbsMenu.editBuilderMode')

    expect(item).toBeDefined()
    expect(item.isNew).toBeTruthy()
  })

  it('app mode toggle executes Comfy.ToggleLinear', async () => {
    mockFeatureFlags.flags.linearToggleEnabled = true

    const { menuItems } = useWorkflowActionsMenu(vi.fn(), { isRoot: true })
    await findItem(menuItems.value, 'breadcrumbsMenu.enterAppMode').command?.()

    expect(mockCommandStore.execute).toHaveBeenCalledWith(
      'Comfy.ToggleLinear',
      { metadata: { source: 'breadcrumb_menu' } }
    )
  })

  it('rename is disabled for unpersisted root workflows', () => {
    mockWorkflowStore.activeWorkflow = fromPartial<
      NonNullable<typeof mockWorkflowStore.activeWorkflow>
    >({
      path: 'test.json',
      isPersisted: false
    })

    const { menuItems } = useWorkflowActionsMenu(vi.fn(), { isRoot: true })
    const rename = findItem(menuItems.value, 'g.rename')

    expect(rename.disabled).toBe(true)
  })

  it('bookmark is disabled for temporary workflows', () => {
    mockWorkflowStore.activeWorkflow = fromPartial<
      NonNullable<typeof mockWorkflowStore.activeWorkflow>
    >({
      path: 'test.json',
      isPersisted: true,
      isTemporary: true
    })

    const { menuItems } = useWorkflowActionsMenu(vi.fn(), { isRoot: true })
    const bookmark = findItem(menuItems.value, 'tabMenu.addToBookmarks')

    expect(bookmark.disabled).toBe(true)
  })

  it('switches to custom workflow before executing rename', async () => {
    const customWorkflow = ref({
      path: 'other.json',
      isPersisted: true
    } as ComfyWorkflow)
    const startRename = vi.fn()

    const { menuItems } = useWorkflowActionsMenu(startRename, {
      isRoot: true,
      workflow: customWorkflow
    })
    await findItem(menuItems.value, 'g.rename').command?.()

    expect(mockWorkflowService.openWorkflow).toHaveBeenCalledWith(
      customWorkflow.value
    )
    expect(startRename).toHaveBeenCalled()
  })
})
