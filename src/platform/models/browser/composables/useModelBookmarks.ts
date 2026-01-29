import { computed, ref, watch } from 'vue'
import type { EnrichedModel } from '../types/modelBrowserTypes'

const STORAGE_KEY = 'comfy-model-bookmarks'

// Singleton state for bookmarks
const bookmarkedModelIds = ref<Set<string>>(new Set())
let initialized = false

/**
 * Load bookmarks from localStorage
 */
function loadBookmarks(): Set<string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as string[]
      return new Set(parsed)
    }
  } catch (error) {
    console.error('Failed to load bookmarks from localStorage:', error)
  }
  return new Set()
}

/**
 * Save bookmarks to localStorage
 */
function saveBookmarks(bookmarks: Set<string>): void {
  try {
    const array = Array.from(bookmarks)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(array))
  } catch (error) {
    console.error('Failed to save bookmarks to localStorage:', error)
  }
}

/**
 * Initialize bookmarks from localStorage (only once)
 */
function initializeBookmarks(): void {
  if (!initialized) {
    bookmarkedModelIds.value = loadBookmarks()
    initialized = true

    // Watch for changes and save to localStorage
    watch(
      bookmarkedModelIds,
      (newBookmarks) => {
        saveBookmarks(newBookmarks)
      },
      { deep: true }
    )
  }
}

/**
 * Composable for managing model bookmarks
 */
export function useModelBookmarks() {
  initializeBookmarks()

  /**
   * Check if a model is bookmarked
   */
  const isBookmarked = (modelId: string): boolean => {
    return bookmarkedModelIds.value.has(modelId)
  }

  /**
   * Toggle bookmark status for a model
   */
  const toggleBookmark = (model: EnrichedModel): void => {
    const newBookmarks = new Set(bookmarkedModelIds.value)
    if (newBookmarks.has(model.id)) {
      newBookmarks.delete(model.id)
    } else {
      newBookmarks.add(model.id)
    }
    bookmarkedModelIds.value = newBookmarks
  }

  /**
   * Add a model to bookmarks
   */
  const addBookmark = (modelId: string): void => {
    const newBookmarks = new Set(bookmarkedModelIds.value)
    newBookmarks.add(modelId)
    bookmarkedModelIds.value = newBookmarks
  }

  /**
   * Remove a model from bookmarks
   */
  const removeBookmark = (modelId: string): void => {
    const newBookmarks = new Set(bookmarkedModelIds.value)
    newBookmarks.delete(modelId)
    bookmarkedModelIds.value = newBookmarks
  }

  /**
   * Get all bookmarked model IDs
   */
  const bookmarkedIds = computed(() => Array.from(bookmarkedModelIds.value))

  /**
   * Get count of bookmarked models
   */
  const bookmarkCount = computed(() => bookmarkedModelIds.value.size)

  /**
   * Filter models to only show bookmarked ones
   */
  const filterBookmarkedModels = (models: EnrichedModel[]): EnrichedModel[] => {
    return models.filter((model) => bookmarkedModelIds.value.has(model.id))
  }

  return {
    isBookmarked,
    toggleBookmark,
    addBookmark,
    removeBookmark,
    bookmarkedIds,
    bookmarkCount,
    filterBookmarkedModels
  }
}
