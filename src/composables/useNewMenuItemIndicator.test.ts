import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useNewMenuItemIndicator } from '@/composables/useNewMenuItemIndicator'
import type { WorkflowMenuItem } from '@/types/workflowMenuItem'

const mockSettingStore = vi.hoisted(() => ({
  get: vi.fn((): string[] => []),
  set: vi.fn()
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: vi.fn(() => mockSettingStore)
}))

function createItems(...ids: string[]): WorkflowMenuItem[] {
  return ids.map((id) => ({
    id,
    label: `Label for ${id}`,
    icon: 'pi pi-test',
    command: vi.fn(),
    isNew: true,
    badge: 'BETA'
  }))
}

describe('useNewMenuItemIndicator', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockSettingStore.get.mockReturnValue([])
  })

  it('reports unseen items when no items have been seen', () => {
    const items = createItems('feature-a')
    const { hasUnseenItems } = useNewMenuItemIndicator(() => items)

    expect(hasUnseenItems.value).toBe(true)
  })

  it('reports no unseen items when all new items are already seen', () => {
    mockSettingStore.get.mockReturnValue(['feature-a'])
    const items = createItems('feature-a')
    const { hasUnseenItems } = useNewMenuItemIndicator(() => items)

    expect(hasUnseenItems.value).toBe(false)
  })

  it('reports unseen when some new items are not yet seen', () => {
    mockSettingStore.get.mockReturnValue(['feature-a'])
    const items = createItems('feature-a', 'feature-b')
    const { hasUnseenItems } = useNewMenuItemIndicator(() => items)

    expect(hasUnseenItems.value).toBe(true)
  })

  it('reports no unseen items when menu has no isNew items', () => {
    const items: WorkflowMenuItem[] = [
      { id: 'regular', label: 'Regular', icon: 'pi pi-test', command: vi.fn() }
    ]
    const { hasUnseenItems } = useNewMenuItemIndicator(() => items)

    expect(hasUnseenItems.value).toBe(false)
  })

  it('ignores separators', () => {
    const items: WorkflowMenuItem[] = [
      { separator: true },
      ...createItems('feature-a')
    ]
    const { hasUnseenItems } = useNewMenuItemIndicator(() => items)

    expect(hasUnseenItems.value).toBe(true)
  })

  it('markAsSeen persists current new item ids', () => {
    const items = createItems('feature-a', 'feature-b')
    const { markAsSeen } = useNewMenuItemIndicator(() => items)

    markAsSeen()

    expect(mockSettingStore.set).toHaveBeenCalledWith(
      'Comfy.WorkflowActions.SeenItems',
      ['feature-a', 'feature-b']
    )
  })

  it('markAsSeen replaces stale entries with current new items', () => {
    mockSettingStore.get.mockReturnValue(['old-feature', 'feature-a'])
    const items = createItems('feature-a')
    const { markAsSeen } = useNewMenuItemIndicator(() => items)

    markAsSeen()

    expect(mockSettingStore.set).toHaveBeenCalledWith(
      'Comfy.WorkflowActions.SeenItems',
      ['feature-a']
    )
  })

  it('does not count hidden items as unseen', () => {
    const items: WorkflowMenuItem[] = [
      {
        id: 'hidden-feature',
        label: 'Hidden',
        icon: 'pi pi-test',
        command: vi.fn(),
        isNew: true,
        badge: 'BETA',
        visible: false
      }
    ]
    const { hasUnseenItems } = useNewMenuItemIndicator(() => items)

    expect(hasUnseenItems.value).toBe(false)
  })

  it('markAsSeen does not include never-seen hidden items', () => {
    const items: WorkflowMenuItem[] = [
      ...createItems('feature-a'),
      {
        id: 'hidden-feature',
        label: 'Hidden',
        icon: 'pi pi-test',
        command: vi.fn(),
        isNew: true,
        badge: 'BETA',
        visible: false
      }
    ]
    const { markAsSeen } = useNewMenuItemIndicator(() => items)

    markAsSeen()

    expect(mockSettingStore.set).toHaveBeenCalledWith(
      'Comfy.WorkflowActions.SeenItems',
      ['feature-a']
    )
  })

  it('markAsSeen retains previously-seen hidden items', () => {
    mockSettingStore.get.mockReturnValue(['hidden-feature'])
    const items: WorkflowMenuItem[] = [
      ...createItems('feature-a'),
      {
        id: 'hidden-feature',
        label: 'Hidden',
        icon: 'pi pi-test',
        command: vi.fn(),
        isNew: true,
        badge: 'BETA',
        visible: false
      }
    ]
    const { markAsSeen } = useNewMenuItemIndicator(() => items)

    markAsSeen()

    expect(mockSettingStore.set).toHaveBeenCalledWith(
      'Comfy.WorkflowActions.SeenItems',
      ['feature-a', 'hidden-feature']
    )
  })

  it('markAsSeen skips write when stored list already matches', () => {
    mockSettingStore.get.mockReturnValue(['feature-a', 'feature-b'])
    const items = createItems('feature-a', 'feature-b')
    const { markAsSeen } = useNewMenuItemIndicator(() => items)

    markAsSeen()

    expect(mockSettingStore.set).not.toHaveBeenCalled()
  })

  it('markAsSeen does nothing when there are no new items', () => {
    const items: WorkflowMenuItem[] = [
      { id: 'regular', label: 'Regular', icon: 'pi pi-test', command: vi.fn() }
    ]
    const { markAsSeen } = useNewMenuItemIndicator(() => items)

    markAsSeen()

    expect(mockSettingStore.set).not.toHaveBeenCalled()
  })
})
