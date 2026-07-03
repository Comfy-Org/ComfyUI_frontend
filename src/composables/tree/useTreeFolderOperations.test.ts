import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent } from 'vue'
import { createI18n } from 'vue-i18n'

import type { RenderedTreeExplorerNode } from '@/types/treeExplorerTypes'

import { useTreeFolderOperations } from './useTreeFolderOperations'

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} } })

function withI18n<T>(fn: () => T): T {
  let result!: T
  const app = createApp(
    defineComponent({
      setup() {
        result = fn()
        return () => null
      }
    })
  )
  app.use(i18n)
  app.mount(document.createElement('div'))
  return result
}

function makeFolder(
  overrides: Partial<RenderedTreeExplorerNode> = {}
): RenderedTreeExplorerNode {
  return {
    key: 'root',
    label: 'Root',
    leaf: false,
    children: [],
    icon: 'pi pi-folder',
    type: 'folder',
    totalLeaves: 0,
    ...overrides
  }
}

describe('useTreeFolderOperations', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(123)
  })

  it('creates a temporary editable folder under the selected target', () => {
    const expandNode = vi.fn()
    const target = makeFolder({ key: 'models', handleAddFolder: vi.fn() })
    const operations = withI18n(() => useTreeFolderOperations(expandNode))

    operations.addFolderCommand(target)

    expect(expandNode).toHaveBeenCalledWith(target)
    expect(operations.newFolderNode.value).toMatchObject({
      key: 'models/new_folder_123',
      label: '',
      leaf: false,
      icon: 'pi pi-folder',
      type: 'folder',
      isEditingLabel: true
    })
  })

  it('passes the confirmed name to the target and clears temporary state', async () => {
    const handleAddFolder = vi.fn()
    const target = makeFolder({ handleAddFolder })
    const operations = withI18n(() => useTreeFolderOperations(vi.fn()))

    operations.addFolderCommand(target)
    await operations.handleFolderCreation('New Folder')

    expect(handleAddFolder).toHaveBeenCalledWith('New Folder')
    expect(operations.newFolderNode.value).toBeNull()
  })

  it('clears temporary state even when folder creation fails', async () => {
    const handleAddFolder = vi.fn().mockRejectedValue(new Error('failed'))
    const target = makeFolder({ handleAddFolder })
    const operations = withI18n(() => useTreeFolderOperations(vi.fn()))

    operations.addFolderCommand(target)

    await expect(operations.handleFolderCreation('New Folder')).rejects.toThrow(
      'failed'
    )
    expect(operations.newFolderNode.value).toBeNull()
  })

  it('ignores folder creation when no target is pending', async () => {
    const operations = withI18n(() => useTreeFolderOperations(vi.fn()))

    await operations.handleFolderCreation('Unused')

    expect(operations.newFolderNode.value).toBeNull()
  })

  it('returns a hidden menu item when the target cannot add folders', () => {
    const operations = withI18n(() => useTreeFolderOperations(vi.fn()))

    expect(operations.getAddFolderMenuItem(null)).toMatchObject({
      label: 'g.newFolder',
      visible: false,
      isAsync: false
    })
    expect(
      operations.getAddFolderMenuItem(makeFolder({ leaf: true }))
    ).toMatchObject({ visible: false })
    expect(
      operations.getAddFolderMenuItem(makeFolder({ leaf: false }))
    ).toMatchObject({ visible: false })
  })

  it('does nothing when the menu command fires without a target', () => {
    const expandNode = vi.fn()
    const operations = withI18n(() => useTreeFolderOperations(expandNode))
    const item = operations.getAddFolderMenuItem(null)

    expect(() =>
      item.command?.({ originalEvent: new Event('click'), item })
    ).not.toThrow()

    expect(expandNode).not.toHaveBeenCalled()
    expect(operations.newFolderNode.value).toBeNull()
  })

  it('runs the add folder command from a visible menu item', () => {
    const expandNode = vi.fn()
    const target = makeFolder({ handleAddFolder: vi.fn() })
    const operations = withI18n(() => useTreeFolderOperations(expandNode))
    const item = operations.getAddFolderMenuItem(target)

    expect(item.visible).toBe(true)
    item.command?.({ originalEvent: new Event('click'), item })

    expect(expandNode).toHaveBeenCalledWith(target)
    expect(operations.newFolderNode.value?.key).toBe('root/new_folder_123')
  })
})
