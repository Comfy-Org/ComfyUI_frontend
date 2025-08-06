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

      // Create subcategories based on template types and content

      // USE CASES SUBCATEGORIES
      const imageCreationTemplates = allTemplates.filter((template) =>
        ['Basics', 'Flux', 'Image'].includes(template.title)
      )

      const videoAnimationTemplates = allTemplates.filter(
        (template) => template.title === 'Video'
      )

      const spatialTemplates = allTemplates.filter((template) =>
        ['3D', 'Area Composition'].includes(template.title)
      )

      const audioTemplates = allTemplates.filter(
        (template) => template.title === 'Audio'
      )

      // TOOLS & BUILDING SUBCATEGORIES
      const advancedApisTemplates = allTemplates.filter((template) =>
        ['Image API', 'Video API', '3D API', 'LLM API'].includes(template.title)
      )

      const postProcessingTemplates = allTemplates.filter((template) =>
        ['Upscaling', 'ControlNet'].includes(template.title)
      )

      // CUSTOM & COMMUNITY SUBCATEGORIES
      const customNodesTemplates = allTemplates.filter(
        (template) =>
          template.moduleName !== 'default' &&
          !advancedApisTemplates.includes(template)
      )

      const communityPicksTemplates: WorkflowTemplates[] = [] // This could be populated with featured community content

      const groups: TemplateGroup[] = []

      // USE CASES GROUP
      const useCasesSubcategories = []

      if (imageCreationTemplates.length > 0) {
        useCasesSubcategories.push({
          label: st(
            'templateWorkflows.subcategory.imageCreation',
            'Image Creation'
          ),
          modules: imageCreationTemplates
        })
      }

      if (videoAnimationTemplates.length > 0) {
        useCasesSubcategories.push({
          label: st(
            'templateWorkflows.subcategory.videoAnimation',
            'Video & Animation'
          ),
          modules: videoAnimationTemplates
        })
      }

      if (spatialTemplates.length > 0) {
        useCasesSubcategories.push({
          label: st('templateWorkflows.subcategory.spatial', '3D & Spatial'),
          modules: spatialTemplates
        })
      }

      if (audioTemplates.length > 0) {
        useCasesSubcategories.push({
          label: st('templateWorkflows.subcategory.audio', 'Audio'),
          modules: audioTemplates
        })
      }

      if (useCasesSubcategories.length > 0) {
        groups.push({
          label: st('templateWorkflows.group.useCases', 'USE CASES'),
          subcategories: useCasesSubcategories
        })
      }

      // TOOLS & BUILDING GROUP
      const toolsBuildingSubcategories = []

      if (advancedApisTemplates.length > 0) {
        toolsBuildingSubcategories.push({
          label: st(
            'templateWorkflows.subcategory.advancedApis',
            'Advanced APIs'
          ),
          modules: advancedApisTemplates
        })
      }

      if (postProcessingTemplates.length > 0) {
        toolsBuildingSubcategories.push({
          label: st(
            'templateWorkflows.subcategory.postProcessing',
            'Post-Processing & Utilities'
          ),
          modules: postProcessingTemplates
        })
      }

      if (toolsBuildingSubcategories.length > 0) {
        groups.push({
          label: st(
            'templateWorkflows.group.toolsBuilding',
            'TOOLS & BUILDING'
          ),
          subcategories: toolsBuildingSubcategories
        })
      }

      // CUSTOM & COMMUNITY GROUP
      const customCommunitySubcategories = []

      if (customNodesTemplates.length > 0) {
        customCommunitySubcategories.push({
          label: st(
            'templateWorkflows.subcategory.customNodes',
            'Custom Nodes'
          ),
          modules: customNodesTemplates
        })
      }

      if (communityPicksTemplates.length > 0) {
        customCommunitySubcategories.push({
          label: st(
            'templateWorkflows.subcategory.communityPicks',
            'Community Picks'
          ),
          modules: communityPicksTemplates
        })
      }

      if (customCommunitySubcategories.length > 0) {
        groups.push({
          label: st(
            'templateWorkflows.group.customCommunity',
            'CUSTOM & COMMUNITY'
          ),
          subcategories: customCommunitySubcategories
        })
      }

      return groups
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
