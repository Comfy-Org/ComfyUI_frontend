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
import { defineComponent, nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import {
  createDeployToComfyApiGate,
  useDeployToComfyApiGate
} from '@/platform/workflow/deploy/composables/useDeployToComfyApiGate'
import type { DeployGateState } from '@/platform/workflow/deploy/composables/useDeployToComfyApiGate'
import { useWorkflowActionsMenu as useWorkflowActionsMenuComposable } from '@/composables/useWorkflowActionsMenu'
import en from '@/locales/en/main.json'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import type { WorkflowMenuAction } from '@/types/workflowMenuItem'
import { toNodeId } from '@/types/nodeId'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} },
  missingWarn: false,
  fallbackWarn: false
})

let mockBookmarkStore: ReturnType<typeof useWorkflowBookmarkStore>

let mockWorkflowStore: ReturnType<typeof useWorkflowStore>

let mockCommandStore: ReturnType<typeof useCommandStore>

let mockSubgraphStore: ReturnType<typeof useSubgraphStore>

let mockMenuItemStore: ReturnType<typeof useMenuItemStore>

let mockAppModeStore: ReturnType<typeof useAppModeStore>

vi.mock(import('@/platform/workflow/core/services/workflowService'))

const mockOpenDeployDialog = vi.hoisted(() => vi.fn(() => Promise.resolve()))
vi.mock(
  import('@/platform/workflow/deploy/composables/lazyDeployToComfyApiDialog'),
  () => ({ openDeployToComfyApiDialog: mockOpenDeployDialog })
)

vi.mock(import('@/composables/useFeatureFlags'))

vi.mock(
  import('@/platform/workflow/deploy/composables/useDeployToComfyApiGate'),
  { spy: true }
)
const AWAITING: DeployGateState = { status: 'awaiting' }

function answered(generation: number, enabled: boolean): DeployGateState {
  return { status: 'answered', generation, enabled }
}

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
    vi.mocked(useDeployToComfyApiGate).mockReturnValue({
      state: ref(answered(0, false)),
      check: vi.fn()
    })
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
    vi.mocked(useFeatureFlags().flags).linearToggleEnabled = true

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

    const { menuItems } = useWorkflowActionsMenu(vi.fn(), { isRoot: true })
    const labels = menuLabels(menuItems.value)

    expect(labels).not.toContain('breadcrumbsMenu.enterAppMode')
  })

  it('hides app mode items when not root', () => {
    vi.mocked(useFeatureFlags().flags).linearToggleEnabled = true

    const { menuItems } = useWorkflowActionsMenu(vi.fn(), { isRoot: false })
    const labels = menuLabels(menuItems.value)

    expect(labels).not.toContain('breadcrumbsMenu.enterAppMode')
  })

  it('shows "go to workflow mode" when in linear mode', () => {
    vi.mocked(useFeatureFlags().flags).linearToggleEnabled = true
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
    vi.mocked(useFeatureFlags().flags).linearToggleEnabled = true

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

    expect(useWorkflowService().duplicateWorkflow).toHaveBeenCalledWith(
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

    expect(useWorkflowService().deleteWorkflow).toHaveBeenCalledWith(
      mockWorkflowStore.activeWorkflow
    )
  })

  it('bookmark toggle calls bookmarkStore.toggleBookmarked', async () => {
    const { menuItems } = useWorkflowActionsMenu(vi.fn(), { isRoot: true })
    await findItem(menuItems.value, 'tabMenu.addToBookmarks').command?.()

    expect(mockBookmarkStore.toggleBookmarked).toHaveBeenCalledWith('test.json')
  })

  it('enter builder mode calls enterBuilder', async () => {
    vi.mocked(useFeatureFlags().flags).linearToggleEnabled = true

    const { menuItems } = useWorkflowActionsMenu(vi.fn(), { isRoot: true })
    await findItem(
      menuItems.value,
      'breadcrumbsMenu.enterBuilderMode'
    ).command?.()

    expect(mockAppModeStore.enterBuilder).toHaveBeenCalled()
  })

  it('shows "Edit app" when workflow has linear data', async () => {
    vi.mocked(useFeatureFlags().flags).linearToggleEnabled = true
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
    vi.mocked(useFeatureFlags().flags).linearToggleEnabled = true

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

  it('offers Deploy to Comfy API as a new root-level item once the platform has distributions on', () => {
    vi.mocked(useDeployToComfyApiGate).mockReturnValue({
      state: ref(answered(0, true)),
      check: vi.fn()
    })
    const { menuItems } = useWorkflowActionsMenu(vi.fn(), { isRoot: true })
    const deploy = findItem(menuItems.value, 'deployToComfyApi.buttonLabel')

    expect(en.deployToComfyApi.buttonLabel).toBe('Deploy to Comfy API')
    expect(deploy.isNew).toBe(true)
    expect(deploy.badge).toBe('g.new')

    const nested = useWorkflowActionsMenu(vi.fn(), { isRoot: false })
    expect(menuLabels(nested.menuItems.value)).not.toContain(
      'deployToComfyApi.buttonLabel'
    )
  })

  it('keeps Deploy to Comfy API hidden until the platform has distributions on', () => {
    const { menuItems } = useWorkflowActionsMenu(vi.fn(), { isRoot: true })

    expect(menuLabels(menuItems.value)).not.toContain(
      'deployToComfyApi.buttonLabel'
    )
  })

  it('holds the Deploy to Comfy API row still while the menu is open, and follows the flag once it closes', async () => {
    const state = ref(answered(0, false))
    vi.mocked(useDeployToComfyApiGate).mockReturnValue({
      state,
      check: vi.fn()
    })
    const isOpen = ref(true)
    const { menuItems } = useWorkflowActionsMenu(vi.fn(), {
      isRoot: true,
      isOpen
    })

    state.value = answered(0, true)
    await nextTick()
    expect(menuLabels(menuItems.value)).not.toContain(
      'deployToComfyApi.buttonLabel'
    )

    isOpen.value = false
    await nextTick()
    expect(menuLabels(menuItems.value)).toContain(
      'deployToComfyApi.buttonLabel'
    )
  })

  it('checks the gate each time the menu opens', async () => {
    const check = vi.fn()
    vi.mocked(useDeployToComfyApiGate).mockReturnValue({
      state: ref(answered(0, false)),
      check
    })
    const isOpen = ref(false)
    useWorkflowActionsMenu(vi.fn(), { isRoot: true, isOpen })
    expect(check).not.toHaveBeenCalled()

    isOpen.value = true
    await nextTick()
    isOpen.value = false
    await nextTick()
    isOpen.value = true
    await nextTick()

    expect(check).toHaveBeenCalledTimes(2)
  })

  it('keeps a visible row in place, disabled, when another account without access signs in while the menu is open', async () => {
    const state = ref(answered(0, true))
    const check = vi.fn()
    vi.mocked(useDeployToComfyApiGate).mockReturnValue({
      state,
      check
    })
    const isOpen = ref(false)
    const { menuItems } = useWorkflowActionsMenu(vi.fn(), {
      isRoot: true,
      isOpen
    })
    isOpen.value = true
    await nextTick()

    state.value = AWAITING
    await nextTick()
    expect(check).toHaveBeenCalledTimes(2)
    expect(
      findItem(menuItems.value, 'deployToComfyApi.buttonLabel').disabled
    ).toBe(true)

    state.value = answered(1, false)
    await nextTick()
    expect(
      findItem(menuItems.value, 'deployToComfyApi.buttonLabel').disabled
    ).toBe(true)

    isOpen.value = false
    await nextTick()
    expect(menuLabels(menuItems.value)).not.toContain(
      'deployToComfyApi.buttonLabel'
    )
  })

  it('asks for the account that signs in while the menu is already open, and shows its answer in that open', async () => {
    const state = ref(answered(0, false))
    const check = vi.fn()
    vi.mocked(useDeployToComfyApiGate).mockReturnValue({
      state,
      check
    })
    const isOpen = ref(false)
    const { menuItems } = useWorkflowActionsMenu(vi.fn(), {
      isRoot: true,
      isOpen
    })
    isOpen.value = true
    await nextTick()
    expect(check).toHaveBeenCalledOnce()

    state.value = AWAITING
    await nextTick()
    expect(check).toHaveBeenCalledTimes(2)

    state.value = answered(1, true)
    await nextTick()
    expect(menuLabels(menuItems.value)).toContain(
      'deployToComfyApi.buttonLabel'
    )
  })

  it('shows the row in the same open when a new account arrives already answered yes', async () => {
    const state = ref(answered(0, false))
    vi.mocked(useDeployToComfyApiGate).mockReturnValue({
      state,
      check: vi.fn()
    })
    const isOpen = ref(false)
    const { menuItems } = useWorkflowActionsMenu(vi.fn(), {
      isRoot: true,
      isOpen
    })
    isOpen.value = true
    await nextTick()

    state.value = answered(1, true)
    await nextTick()

    expect(menuLabels(menuItems.value)).toContain(
      'deployToComfyApi.buttonLabel'
    )
  })

  it('shows the row in the same open when the menu opened before the account had an answer', async () => {
    const state = ref<DeployGateState>(AWAITING)
    vi.mocked(useDeployToComfyApiGate).mockReturnValue({
      state,
      check: vi.fn()
    })
    const isOpen = ref(false)
    const { menuItems } = useWorkflowActionsMenu(vi.fn(), {
      isRoot: true,
      isOpen
    })
    isOpen.value = true
    await nextTick()

    state.value = answered(1, true)
    await nextTick()

    expect(menuLabels(menuItems.value)).toContain(
      'deployToComfyApi.buttonLabel'
    )
  })

  it('keeps the Deploy to Comfy API row in place but inert when the account loses access while the menu is open', async () => {
    const state = ref(answered(0, true))
    vi.mocked(useDeployToComfyApiGate).mockReturnValue({
      state,
      check: vi.fn()
    })
    const isOpen = ref(true)
    const { menuItems } = useWorkflowActionsMenu(vi.fn(), {
      isRoot: true,
      isOpen
    })

    state.value = answered(0, false)
    await nextTick()
    const deploy = findItem(menuItems.value, 'deployToComfyApi.buttonLabel')
    expect(deploy.disabled).toBe(true)
    await deploy.command?.()
    expect(mockOpenDeployDialog).not.toHaveBeenCalled()

    isOpen.value = false
    await nextTick()
    expect(menuLabels(menuItems.value)).not.toContain(
      'deployToComfyApi.buttonLabel'
    )
  })

  it('keeps a hidden row hidden in an open menu when the same account resolves again', async () => {
    const resolved: { signIn?: (userId: string) => void } = {}
    const askPlatform = vi
      .fn<() => Promise<boolean>>()
      .mockResolvedValueOnce(false)
      .mockResolvedValue(true)
    const gate = createDeployToComfyApiGate({
      loadFlags: () => Promise.reject(new Error('PostHog is Cloud only')),
      askPlatform,
      onSignIn: (check) => {
        resolved.signIn = check
      },
      onSignOut: () => {}
    })
    vi.mocked(useDeployToComfyApiGate).mockReturnValue(gate)
    resolved.signIn?.('alice')
    const isOpen = ref(false)
    const { menuItems } = useWorkflowActionsMenu(vi.fn(), {
      isRoot: true,
      isOpen
    })
    isOpen.value = true
    await vi.waitFor(() => expect(gate.state.value).toEqual(answered(1, false)))

    resolved.signIn?.('alice')
    await nextTick()

    expect(askPlatform).toHaveBeenCalledOnce()
    expect(menuLabels(menuItems.value)).not.toContain(
      'deployToComfyApi.buttonLabel'
    )
  })

  it('deploy command opens the Deploy to Comfy API dialog', async () => {
    vi.mocked(useDeployToComfyApiGate).mockReturnValue({
      state: ref(answered(0, true)),
      check: vi.fn()
    })
    const { menuItems } = useWorkflowActionsMenu(vi.fn(), { isRoot: true })
    const deploy = findItem(menuItems.value, 'deployToComfyApi.buttonLabel')

    await deploy.command?.()

    expect(mockOpenDeployDialog).toHaveBeenCalledOnce()
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

    expect(useWorkflowService().openWorkflow).toHaveBeenCalledWith(
      customWorkflow.value
    )
    expect(startRename).toHaveBeenCalled()
  })

  it('switches to the right-clicked workflow before opening the deploy dialog', async () => {
    vi.mocked(useDeployToComfyApiGate).mockReturnValue({
      state: ref(answered(0, true)),
      check: vi.fn()
    })
    const customWorkflow = ref(
      fromPartial<ComfyWorkflow>({ path: 'other.json', isPersisted: true })
    )

    const { menuItems } = useWorkflowActionsMenu(vi.fn(), {
      isRoot: true,
      workflow: customWorkflow
    })
    const activation: { finish?: () => void } = {}
    vi.mocked(useWorkflowService().openWorkflow).mockReturnValueOnce(
      new Promise<boolean>((resolve) => {
        activation.finish = () => resolve(true)
      })
    )

    const deploying = findItem(
      menuItems.value,
      'deployToComfyApi.buttonLabel'
    ).command?.()

    expect(useWorkflowService().openWorkflow).toHaveBeenCalledWith(
      customWorkflow.value
    )
    expect(mockOpenDeployDialog).not.toHaveBeenCalled()
    expect(activation.finish).toBeTypeOf('function')
    activation.finish?.()
    await deploying
    expect(mockOpenDeployDialog).toHaveBeenCalledOnce()
  })

  it('does not open the deploy dialog when access is revoked while the workflow switch is pending', async () => {
    const state = ref(answered(0, true))
    vi.mocked(useDeployToComfyApiGate).mockReturnValue({
      state,
      check: vi.fn()
    })
    const customWorkflow = ref(
      fromPartial<ComfyWorkflow>({ path: 'other.json', isPersisted: true })
    )
    const { menuItems } = useWorkflowActionsMenu(vi.fn(), {
      isRoot: true,
      workflow: customWorkflow
    })
    const activation: { finish?: () => void } = {}
    vi.mocked(useWorkflowService().openWorkflow).mockReturnValueOnce(
      new Promise<boolean>((resolve) => {
        activation.finish = () => resolve(true)
      })
    )

    const deploying = findItem(
      menuItems.value,
      'deployToComfyApi.buttonLabel'
    ).command?.()
    state.value = answered(0, false)
    activation.finish?.()
    await deploying

    expect(mockOpenDeployDialog).not.toHaveBeenCalled()
  })
})
