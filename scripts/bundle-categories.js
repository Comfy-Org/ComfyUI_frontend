// @ts-check
/**
 * Bundle categorization configuration
 *
 * This file defines how bundles are categorized in size reports.
 * Categories help identify which parts of the application are growing.
 */

/**
 * @typedef {Object} BundleCategory
 * @property {string} name - Display name of the category
 * @property {string} description - Description of what this category includes
 * @property {RegExp[]} patterns - Regex patterns to match bundle files
 * @property {number} order - Sort order for display (lower = first)
 */

/** @type {BundleCategory[]} */
export const BUNDLE_CATEGORIES = [
  {
    name: 'App Entry Points',
    description: 'Main application bundles',
    patterns: [/^index-.*\.js$/],
    order: 1
  },
  {
    name: 'Core Views',
    description: 'Major application views and screens',
    patterns: [/GraphView-.*\.js$/, /UserSelectView-.*\.js$/],
    order: 2
  },
  {
    name: 'UI Panels',
    description: 'Settings and configuration panels',
    patterns: [/.*Panel-.*\.js$/],
    order: 3
  },
  {
    name: 'UI Components',
    description: 'Reusable UI components',
    patterns: [/Avatar-.*\.js$/, /Badge-.*\.js$/],
    order: 4
  },
  {
    name: 'Services',
    description: 'Business logic and services',
    patterns: [/.*Service-.*\.js$/, /.*Store-.*\.js$/],
    order: 5
  },
  {
    name: 'Utilities',
    description: 'Helper functions and utilities',
    patterns: [/.*[Uu]til.*\.js$/],
    order: 6
  },
  {
    name: 'Other',
    description: 'Uncategorized bundles',
    patterns: [/.*/], // Catch-all pattern
    order: 99
  }
]

/**
 * Categorize a bundle file based on its name
 *
 * @param {string} fileName - The bundle file name (e.g., "assets/GraphView-BnV6iF9h.js")
 * @returns {string} - The category name
 */
export function categorizeBundle(fileName) {
  // Extract just the file name without path
  const baseName = fileName.split('/').pop() || fileName

  // Find the first matching category
  for (const category of BUNDLE_CATEGORIES) {
    for (const pattern of category.patterns) {
      if (pattern.test(baseName)) {
        return category.name
      }
    }
  }

  return 'Other'
}

/**
 * Get category metadata by name
 *
 * @param {string} categoryName - The category name
 * @returns {BundleCategory | undefined} - The category metadata
 */
export function getCategoryMetadata(categoryName) {
  return BUNDLE_CATEGORIES.find((cat) => cat.name === categoryName)
}
