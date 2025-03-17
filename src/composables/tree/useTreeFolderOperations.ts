import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { RenderedTreeExplorerNode } from '@/types/treeExplorerTypes'

/**
 * Use this to handle folder operations in a tree.
 * @param expandNode - The function to expand a node.
 */
export function useTreeFolderOperations(
  expandNode: (node: RenderedTreeExplorerNode) => void
) {
  const { t } = useI18n()
  const newFolderNode = ref<RenderedTreeExplorerNode | null>(null)
  const addFolderTargetNode = ref<RenderedTreeExplorerNode | null>(null)

  // Generate a unique temporary key for the new folder
  const generateTempKey = (parentKey: string) => {
    return `${parentKey}/new_folder_${Date.now()}`
  }

  // Handle folder creation after name is confirmed
  const handleFolderCreation = async (newName: string) => {
    if (!newFolderNode.value || !addFolderTargetNode.value) return

    try {
      // Call the handleAddFolder method with the new folder name
      await addFolderTargetNode.value?.handleAddFolder?.(newName)
    } finally {
      newFolderNode.value = null
      addFolderTargetNode.value = null
    }
  }

  /**
   * The command to add a folder to a node via the context menu
   * @param targetNode - The node where the folder will be added under
   */
  const addFolderCommand = (targetNode: RenderedTreeExplorerNode) => {
    expandNode(targetNode)
    newFolderNode.value = {
      key: generateTempKey(targetNode.key),
      label: '',
      leaf: false,
      children: [],
      icon: 'pi pi-folder',
      type: 'folder',
      totalLeaves: 0,
      badgeText: '',
      isEditingLabel: true
    }
    addFolderTargetNode.value = targetNode
  }

  // Generate the "Add Folder" menu item
  const getAddFolderMenuItem = (
    targetNode: RenderedTreeExplorerNode | null
  ) => {
    return {
      label: t('g.newFolder'),
      icon: 'pi pi-folder-plus',
      command: () => {
        if (targetNode) addFolderCommand(targetNode)
      },
      visible: targetNode && !targetNode.leaf && !!targetNode.handleAddFolder,
      isAsync: false
    }
  }

  return {
    newFolderNode,
    addFolderCommand,
    getAddFolderMenuItem,
    handleFolderCreation
  }
}
