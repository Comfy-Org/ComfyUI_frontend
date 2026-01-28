import { nextTick, onMounted, onUnmounted } from 'vue'
import type { Ref } from 'vue'

import type { EnrichedModel } from '@/types/modelBrowserTypes'

interface GridItem {
  key: string
  model: EnrichedModel
}

/**
 * Composable for handling keyboard navigation in model browser
 * Per spec: Arrow keys navigate list, Enter opens details, Escape closes panel
 * Note: With responsive grid (auto-fill columns), arrow keys navigate sequentially
 */
export function useModelKeyboardNav(
  gridItems: Ref<GridItem[]>,
  focusedModel: Ref<EnrichedModel | null>,
  isRightPanelOpen: Ref<boolean>,
  viewMode: Ref<'grid' | 'list'>,
  callbacks: {
    onShowInfo: (model: EnrichedModel) => void
    onClose: () => void
  }
) {
  /**
   * Scroll the focused model card into view
   */
  function scrollFocusedIntoView() {
    void nextTick(() => {
      const focusedElement = document.querySelector('[data-focused="true"]')
      if (focusedElement) {
        focusedElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest'
        })
      }
    })
  }

  /**
   * Calculate the number of columns in the grid by measuring DOM
   * Returns 1 for list mode or if can't determine
   */
  function getGridColumns(): number {
    if (viewMode.value === 'list') return 1

    const gridContainer = document.querySelector('.grid')
    if (!gridContainer) return 3 // Default fallback

    const computedStyle = window.getComputedStyle(gridContainer)
    const columns = computedStyle.gridTemplateColumns.split(' ').length
    return columns || 3 // Default to 3 if can't determine
  }

  function handleKeydown(event: KeyboardEvent) {
    // Skip if typing in input field
    const target = event.target
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement
    ) {
      return
    }

    const currentIndex = focusedModel.value
      ? gridItems.value.findIndex(
          (item) => item.model.id === focusedModel.value?.id
        )
      : -1

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        if (viewMode.value === 'grid') {
          // In grid mode, move down by number of columns
          const columns = getGridColumns()
          const nextIndex = currentIndex + columns
          if (nextIndex < gridItems.value.length) {
            focusedModel.value = gridItems.value[nextIndex].model
            scrollFocusedIntoView()
          } else if (currentIndex === -1 && gridItems.value.length > 0) {
            // No selection, select first item
            focusedModel.value = gridItems.value[0].model
            scrollFocusedIntoView()
          }
        } else {
          // In list mode, move down by 1
          if (currentIndex < gridItems.value.length - 1) {
            focusedModel.value = gridItems.value[currentIndex + 1].model
            scrollFocusedIntoView()
          } else if (currentIndex === -1 && gridItems.value.length > 0) {
            focusedModel.value = gridItems.value[0].model
            scrollFocusedIntoView()
          }
        }
        break

      case 'ArrowUp':
        event.preventDefault()
        if (viewMode.value === 'grid') {
          // In grid mode, move up by number of columns
          const columns = getGridColumns()
          if (currentIndex >= columns) {
            focusedModel.value = gridItems.value[currentIndex - columns].model
            scrollFocusedIntoView()
          }
        } else {
          // In list mode, move up by 1
          if (currentIndex > 0) {
            focusedModel.value = gridItems.value[currentIndex - 1].model
            scrollFocusedIntoView()
          } else if (currentIndex === -1 && gridItems.value.length > 0) {
            focusedModel.value = gridItems.value[0].model
            scrollFocusedIntoView()
          }
        }
        break

      case 'ArrowRight':
        // Grid mode only: move right
        if (viewMode.value === 'grid') {
          event.preventDefault()
          if (currentIndex < gridItems.value.length - 1) {
            focusedModel.value = gridItems.value[currentIndex + 1].model
            scrollFocusedIntoView()
          }
        }
        break

      case 'ArrowLeft':
        // Grid mode only: move left
        if (viewMode.value === 'grid') {
          event.preventDefault()
          if (currentIndex > 0) {
            focusedModel.value = gridItems.value[currentIndex - 1].model
            scrollFocusedIntoView()
          }
        }
        break

      case 'Enter':
        // Per spec: Enter opens details panel
        event.preventDefault()
        if (focusedModel.value) {
          callbacks.onShowInfo(focusedModel.value)
        }
        break

      case 'Escape':
        event.preventDefault()
        // Close right panel first if open, otherwise close dialog
        if (isRightPanelOpen.value) {
          isRightPanelOpen.value = false
        } else {
          callbacks.onClose()
        }
        break
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeydown)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown)
  })

  return {
    handleKeydown
  }
}
