import { groupBy } from 'lodash'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

import { st } from '@/i18n'
import { api } from '@/scripts/api'
import type {
  TemplateGroup,
  TemplateInfo,
  WorkflowTemplates
} from '@/types/workflowTemplateTypes'
import { normalizeI18nKey } from '@/utils/formatUtil'

const SHOULD_SORT_CATEGORIES = new Set([
  // API Node templates should be strictly sorted by name to avoid any
  // favoritism or bias towards a particular API. Other categories can
  // have their ordering specified in index.json freely.
  'Image API',
  'Video API'
])

export const useWorkflowTemplatesStore = defineStore(
  'workflowTemplates',
  () => {
    const customTemplates = shallowRef<{ [moduleName: string]: string[] }>({})
    const coreTemplates = shallowRef<WorkflowTemplates[]>([])
    const isLoaded = ref(false)

    /**
     * Sort a list of templates in alphabetical order by localized display name.
     */
    const sortTemplateList = (templates: TemplateInfo[]) =>
      templates.sort((a, b) => {
        const aName = st(
          `templateWorkflows.name.${normalizeI18nKey(a.name)}`,
          a.title ?? a.name
        )
        const bName = st(
          `templateWorkflows.name.${normalizeI18nKey(b.name)}`,
          b.name
        )
        return aName.localeCompare(bName)
      })

    /**
     * Sort any template categories (grouped templates) that should be sorted.
     * Leave other categories' templates in their original order specified in index.json
     */
    const sortCategoryTemplates = (categories: WorkflowTemplates[]) =>
      categories.map((category) => {
        if (SHOULD_SORT_CATEGORIES.has(category.title)) {
          return {
            ...category,
            templates: sortTemplateList(category.templates)
          }
        }
        return category
      })

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

    const groupedTemplates = computed<TemplateGroup[]>(() => {
      // Get regular categories
      const allTemplates = [
        ...sortCategoryTemplates(coreTemplates.value).map(
          localizeTemplateCategory
        ),
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
      const groupedByCategory = Object.entries(
        groupBy(allTemplates, (template) =>
          template.moduleName === 'default'
            ? st(
                'templateWorkflows.category.ComfyUI Examples',
                'ComfyUI Examples'
              )
            : st('templateWorkflows.category.Custom Nodes', 'Custom Nodes')
        )
      ).map(([label, modules]) => ({ label, modules }))

      // Insert the "All" category at the top of the "ComfyUI Examples" group
      const comfyExamplesGroupIndex = groupedByCategory.findIndex(
        (group) =>
          group.label ===
          st('templateWorkflows.category.ComfyUI Examples', 'ComfyUI Examples')
      )

      if (comfyExamplesGroupIndex !== -1) {
        groupedByCategory[comfyExamplesGroupIndex].modules.unshift(
          createAllCategory()
        )
      }

      return groupedByCategory
    })

    async function loadWorkflowTemplates() {
      try {
        if (!isLoaded.value) {
          customTemplates.value = await api.getWorkflowTemplates()
          coreTemplates.value = await api.getCoreWorkflowTemplates()
          isLoaded.value = true
        }
      } catch (error) {
        console.error('Error fetching workflow templates:', error)
      }
    }

    return {
      groupedTemplates,
      isLoaded,
      loadWorkflowTemplates
    }
  }
)
