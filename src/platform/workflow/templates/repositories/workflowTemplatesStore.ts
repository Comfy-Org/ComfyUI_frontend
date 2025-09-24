import Fuse from 'fuse.js'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

import { i18n, st } from '@/i18n'
import { api } from '@/scripts/api'
import type { NavGroupData, NavItemData } from '@/types/navTypes'
import { getCategoryIcon } from '@/utils/categoryIcons'
import { normalizeI18nKey } from '@/utils/formatUtil'

import type {
  TemplateGroup,
  TemplateInfo,
  WorkflowTemplates
} from '../types/template'

// Enhanced template interface for easier filtering
interface EnhancedTemplate extends TemplateInfo {
  sourceModule: string
  category?: string
  categoryType?: string
  categoryGroup?: string // 'GENERATION TYPE' or 'CLOSED SOURCE MODELS'
  isEssential?: boolean
  searchableText?: string
}

export const useWorkflowTemplatesStore = defineStore(
  'workflowTemplates',
  () => {
    const customTemplates = shallowRef<{ [moduleName: string]: string[] }>({})
    const coreTemplates = shallowRef<WorkflowTemplates[]>([])
    const isLoaded = ref(false)

    // Store filter mappings for dynamic categories
    type FilterData = {
      category?: string
      categoryGroup?: string
    }

    const categoryFilters = ref(new Map<string, FilterData>())

    /**
     * Add localization fields to a template.
     */
    const addLocalizedFieldsToTemplate = (
      template: TemplateInfo,
      categoryTitle: string
    ) => ({
      ...template,
      localizedTitle: st(
        `templateWorkflows.template.${normalizeI18nKey(categoryTitle)}.${normalizeI18nKey(template.name)}`,
        template.title ?? template.name
      ),
      localizedDescription: st(
        `templateWorkflows.templateDescription.${normalizeI18nKey(categoryTitle)}.${normalizeI18nKey(template.name)}`,
        template.description
      )
    })

    /**
     * Add localization fields to all templates in a list of templates.
     */
    const localizeTemplateList = (
      templates: TemplateInfo[],
      categoryTitle: string
    ) =>
      templates.map((template) =>
        addLocalizedFieldsToTemplate(template, categoryTitle)
      )

    /**
     * Add localization fields to a template category and all its constituent templates.
     */
    const localizeTemplateCategory = (templateCategory: WorkflowTemplates) => ({
      ...templateCategory,
      localizedTitle: st(
        `templateWorkflows.category.${normalizeI18nKey(templateCategory.title)}`,
        templateCategory.title ?? templateCategory.moduleName
      ),
      templates: localizeTemplateList(
        templateCategory.templates,
        templateCategory.title
      )
    })

    // Create an "All" category that combines all templates
    const createAllCategory = () => {
      // First, get core templates with source module added
      const coreTemplatesWithSourceModule = coreTemplates.value.flatMap(
        (category) =>
          // For each template in each category, add the sourceModule and pass through any localized fields
          category.templates.map((template) => {
            // Get localized template with its original category title for i18n lookup
            const localizedTemplate = addLocalizedFieldsToTemplate(
              template,
              category.title
            )
            return {
              ...localizedTemplate,
              sourceModule: category.moduleName
            }
          })
      )

      // Now handle custom templates
      const customTemplatesWithSourceModule = Object.entries(
        customTemplates.value
      ).flatMap(([moduleName, templates]) =>
        templates.map((name) => ({
          name,
          mediaType: 'image',
          mediaSubtype: 'jpg',
          description: name,
          sourceModule: moduleName
        }))
      )

      return {
        moduleName: 'all',
        title: 'All',
        localizedTitle: st('templateWorkflows.category.All', 'All Templates'),
        templates: [
          ...coreTemplatesWithSourceModule,
          ...customTemplatesWithSourceModule
        ]
      }
    }

    /**
     * Original grouped templates for backward compatibility
     */
    const groupedTemplates = computed<TemplateGroup[]>(() => {
      // Get regular categories
      const allTemplates = [
        ...coreTemplates.value.map(localizeTemplateCategory),
        ...Object.entries(customTemplates.value).map(
          ([moduleName, templates]) => ({
            moduleName,
            title: moduleName,
            localizedTitle: st(
              `templateWorkflows.category.${normalizeI18nKey(moduleName)}`,
              moduleName
            ),
            templates: templates.map((name) => ({
              name,
              mediaType: 'image',
              mediaSubtype: 'jpg',
              description: name
            }))
          })
        )
      ]

      // Group templates by their main category
      const groupedByCategory = [
        {
          label: st(
            'templateWorkflows.category.ComfyUI Examples',
            'ComfyUI Examples'
          ),
          modules: [
            createAllCategory(),
            ...allTemplates.filter((t) => t.moduleName === 'default')
          ]
        },
        ...(Object.keys(customTemplates.value).length > 0
          ? [
              {
                label: st(
                  'templateWorkflows.category.Custom Nodes',
                  'Custom Nodes'
                ),
                modules: allTemplates.filter((t) => t.moduleName !== 'default')
              }
            ]
          : [])
      ]

      return groupedByCategory
    })

    /**
     * Enhanced templates with proper categorization for filtering
     */
    const enhancedTemplates = computed<EnhancedTemplate[]>(() => {
      const allTemplates: EnhancedTemplate[] = []

      // Process core templates
      coreTemplates.value.forEach((category) => {
        category.templates.forEach((template) => {
          const enhancedTemplate: EnhancedTemplate = {
            ...template,
            sourceModule: category.moduleName,
            category: category.title,
            categoryType: category.type,
            categoryGroup: category.category,
            isEssential: category.isEssential,
            searchableText: [
              template.title || template.name,
              template.description || '',
              category.title,
              ...(template.tags || []),
              ...(template.models || [])
            ].join(' ')
          }

          allTemplates.push(enhancedTemplate)
        })
      })

      // Process custom templates
      Object.entries(customTemplates.value).forEach(
        ([moduleName, templates]) => {
          templates.forEach((name) => {
            const enhancedTemplate: EnhancedTemplate = {
              name,
              title: name,
              description: name,
              mediaType: 'image',
              mediaSubtype: 'jpg',
              sourceModule: moduleName,
              category: 'Extensions',
              categoryType: 'extension',
              searchableText: `${name} ${moduleName} extension`
            }
            allTemplates.push(enhancedTemplate)
          })
        }
      )

      return allTemplates
    })

    /**
     * Fuse.js instance for advanced template searching and filtering
     */
    const templateFuse = computed(() => {
      const fuseOptions = {
        keys: [
          { name: 'searchableText', weight: 0.4 },
          { name: 'title', weight: 0.3 },
          { name: 'name', weight: 0.2 },
          { name: 'tags', weight: 0.1 }
        ],
        threshold: 0.3,
        includeScore: true
      }

      return new Fuse(enhancedTemplates.value, fuseOptions)
    })

    /**
     * Filter templates by category ID using stored filter mappings
     */
    const filterTemplatesByCategory = (categoryId: string) => {
      if (categoryId === 'all') {
        return enhancedTemplates.value
      }

      if (categoryId === 'basics') {
        // Filter for templates from categories marked as essential
        return enhancedTemplates.value.filter((t) => t.isEssential)
      }

      // Handle extension-specific filters
      if (categoryId.startsWith('extension-')) {
        const moduleName = categoryId.replace('extension-', '')
        return enhancedTemplates.value.filter(
          (t) => t.sourceModule === moduleName
        )
      }

      // Look up the filter from our stored mappings
      const filter = categoryFilters.value.get(categoryId)
      if (!filter) {
        return enhancedTemplates.value
      }

      // Apply the filter
      return enhancedTemplates.value.filter((template) => {
        if (filter.category && template.category !== filter.category) {
          return false
        }
        if (
          filter.categoryGroup &&
          template.categoryGroup !== filter.categoryGroup
        ) {
          return false
        }
        return true
      })
    }

    /**
     * New navigation structure dynamically built from JSON categories
     */
    const navGroupedTemplates = computed<(NavItemData | NavGroupData)[]>(() => {
      if (!isLoaded.value) return []

      const items: (NavItemData | NavGroupData)[] = []

      // Clear and rebuild filter mappings
      categoryFilters.value.clear()

      // 1. All Templates - always first
      items.push({
        id: 'all',
        label: st('templateWorkflows.category.All', 'All Templates'),
        icon: getCategoryIcon('all')
      })

      // 2. Basics (isEssential categories) - always second if it exists
      let gettingStartedText = 'Getting Started'
      const essentialCat = coreTemplates.value.find(
        (cat) => cat.isEssential && cat.templates.length > 0
      )
      const hasEssentialCategories = Boolean(essentialCat)

      if (essentialCat) {
        gettingStartedText = essentialCat.title
      }
      if (hasEssentialCategories) {
        items.push({
          id: 'basics',
          label: gettingStartedText,
          icon: 'icon-[lucide--graduation-cap]'
        })
      }

      // 3. Group categories from JSON dynamically
      const categoryGroups = new Map<
        string,
        { title: string; items: NavItemData[] }
      >()

      // Process all categories from JSON
      coreTemplates.value.forEach((category) => {
        // Skip essential categories as they're handled as Basics
        if (category.isEssential) return

        const categoryGroup = category.category
        const categoryIcon = category.icon

        if (categoryGroup) {
          if (!categoryGroups.has(categoryGroup)) {
            categoryGroups.set(categoryGroup, {
              title: categoryGroup,
              items: []
            })
          }

          const group = categoryGroups.get(categoryGroup)!

          // Generate unique ID for this category
          const categoryId = `${categoryGroup.toLowerCase().replace(/\s+/g, '-')}-${category.title.toLowerCase().replace(/\s+/g, '-')}`

          // Store the filter mapping
          categoryFilters.value.set(categoryId, {
            category: category.title,
            categoryGroup: categoryGroup
          })

          group.items.push({
            id: categoryId,
            label: st(
              `templateWorkflows.category.${normalizeI18nKey(category.title)}`,
              category.title
            ),
            icon: categoryIcon || getCategoryIcon(category.type || 'default')
          })
        }
      })

      // Add grouped categories
      categoryGroups.forEach((group, groupName) => {
        if (group.items.length > 0) {
          items.push({
            title: st(
              `templateWorkflows.category.${normalizeI18nKey(groupName)}`,
              groupName
                .split(' ')
                .map(
                  (word) =>
                    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                )
                .join(' ')
            ),
            items: group.items
          })
        }
      })

      // 4. Extensions - always last
      const extensionCounts = enhancedTemplates.value.filter(
        (t) => t.sourceModule !== 'default'
      ).length

      if (extensionCounts > 0) {
        // Get unique extension modules
        const extensionModules = Array.from(
          new Set(
            enhancedTemplates.value
              .filter((t) => t.sourceModule !== 'default')
              .map((t) => t.sourceModule)
          )
        ).sort()

        const extensionItems: NavItemData[] = extensionModules.map(
          (moduleName) => ({
            id: `extension-${moduleName}`,
            label: st(
              `templateWorkflows.category.${normalizeI18nKey(moduleName)}`,
              moduleName
            ),
            icon: getCategoryIcon('extensions')
          })
        )

        items.push({
          title: st('templateWorkflows.category.Extensions', 'Extensions'),
          items: extensionItems,
          collapsible: true
        })
      }

      return items
    })

    async function loadWorkflowTemplates() {
      try {
        if (!isLoaded.value) {
          customTemplates.value = await api.getWorkflowTemplates()
          const locale = i18n.global.locale.value
          coreTemplates.value = await api.getCoreWorkflowTemplates(locale)
          isLoaded.value = true
        }
      } catch (error) {
        console.error('Error fetching workflow templates:', error)
      }
    }

    return {
      groupedTemplates,
      navGroupedTemplates,
      enhancedTemplates,
      templateFuse,
      filterTemplatesByCategory,
      isLoaded,
      loadWorkflowTemplates
    }
  }
)
