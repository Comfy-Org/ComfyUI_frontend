import Fuse from 'fuse.js'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

import { SMALL_MODEL_SIZE_LIMIT } from '@/constants/templateWorkflows'
import { i18n, st } from '@/i18n'
import { api } from '@/scripts/api'
import type { NavGroupData, NavItemData } from '@/types/navTypes'
import type {
  TemplateGroup,
  TemplateInfo,
  WorkflowTemplates
} from '@/types/workflowTemplateTypes'
import { getCategoryIcon } from '@/utils/categoryIcons'
import { normalizeI18nKey } from '@/utils/formatUtil'

// Enhanced template interface for easier filtering
interface EnhancedTemplate extends TemplateInfo {
  sourceModule: string
  category?: string
  categoryType?: string
  isAPI?: boolean
  isPerformance?: boolean
  isMacCompatible?: boolean
  searchableText?: string
}

export const useWorkflowTemplatesStore = defineStore(
  'workflowTemplates',
  () => {
    const customTemplates = shallowRef<{ [moduleName: string]: string[] }>({})
    const coreTemplates = shallowRef<WorkflowTemplates[]>([])
    const isLoaded = ref(false)

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
          const isAPI = category.title?.includes('API') || false
          // Determine performance ("Small Models") based primarily on explicit size prop (<=3GB)
          // Fallback to heuristic based on model name keywords for backward compatibility.
          const explicitSize = template.size
          const heuristicPerformance = template.models?.some(
            (model) =>
              model.toLowerCase().includes('turbo') ||
              model.toLowerCase().includes('fast') ||
              model.toLowerCase().includes('schnell') ||
              model.toLowerCase().includes('fp8')
          )
          const isPerformance =
            (typeof explicitSize === 'number' &&
              explicitSize <= SMALL_MODEL_SIZE_LIMIT) ||
            (!!explicitSize === false && heuristicPerformance) ||
            false

          const isMacCompatible =
            template.models?.some(
              (model) =>
                model.toLowerCase().includes('fp8') ||
                model.toLowerCase().includes('turbo') ||
                model.toLowerCase().includes('schnell')
            ) || false

          const enhancedTemplate: EnhancedTemplate = {
            ...template,
            sourceModule: category.moduleName,
            category: category.title,
            categoryType: category.type,
            isAPI,
            isPerformance,
            isMacCompatible,
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
              isAPI: false,
              isPerformance: false,
              isMacCompatible: false,
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
     * Filter templates by category using Fuse.js
     */
    const filterTemplatesByCategory = (categoryId: string) => {
      if (categoryId === 'all') {
        return enhancedTemplates.value
      }

      switch (categoryId) {
        case 'getting-started':
          return enhancedTemplates.value.filter((t) => t.category === 'Basics')

        case 'generation-image':
          return enhancedTemplates.value.filter(
            (t) => t.categoryType === 'image' && !t.isAPI
          )

        case 'generation-video':
          return enhancedTemplates.value.filter(
            (t) => t.categoryType === 'video' && !t.isAPI
          )

        case 'generation-3d':
          return enhancedTemplates.value.filter(
            (t) => t.categoryType === '3d' && !t.isAPI
          )

        case 'generation-audio':
          return enhancedTemplates.value.filter(
            (t) => t.categoryType === 'audio' && !t.isAPI
          )

        case 'generation-llm':
          return enhancedTemplates.value.filter(
            (t) => t.tags?.includes('LLM') || t.tags?.includes('Chat')
          )

        case 'api-nodes':
          return enhancedTemplates.value.filter((t) => t.isAPI)

        case 'extensions':
          return enhancedTemplates.value.filter(
            (t) => t.sourceModule !== 'default'
          )

        case 'lora-training':
          return enhancedTemplates.value.filter(
            (t) =>
              t.tags?.includes('LoRA') ||
              t.tags?.includes('Training') ||
              t.name?.toLowerCase().includes('lora') ||
              t.title?.toLowerCase().includes('lora')
          )

        case 'performance-small':
          return enhancedTemplates.value.filter(
            (t) =>
              (typeof t.size === 'number' &&
                t.size <= SMALL_MODEL_SIZE_LIMIT) ||
              (typeof t.size !== 'number' && t.isPerformance)
          )

        case 'performance-mac':
          return enhancedTemplates.value.filter((t) => t.isMacCompatible)

        default:
          return enhancedTemplates.value
      }
    }

    /**
     * New navigation structure matching NavItemData | NavGroupData format
     */
    const navGroupedTemplates = computed<(NavItemData | NavGroupData)[]>(() => {
      if (!isLoaded.value) return []

      const items: (NavItemData | NavGroupData)[] = []

      // Count templates for each category
      const imageCounts = enhancedTemplates.value.filter(
        (t) => t.categoryType === 'image' && !t.isAPI
      ).length
      const videoCounts = enhancedTemplates.value.filter(
        (t) => t.categoryType === 'video' && !t.isAPI
      ).length
      const audioCounts = enhancedTemplates.value.filter(
        (t) => t.categoryType === 'audio' && !t.isAPI
      ).length
      const llmCounts = enhancedTemplates.value.filter(
        (t) => t.tags?.includes('LLM') || t.tags?.includes('Chat')
      ).length
      const threeDCounts = enhancedTemplates.value.filter(
        (t) => t.categoryType === '3d' && !t.isAPI
      ).length
      const apiCounts = enhancedTemplates.value.filter((t) => t.isAPI).length
      const gettingStartedCounts = enhancedTemplates.value.filter(
        (t) => t.category === 'Basics'
      ).length
      const extensionCounts = enhancedTemplates.value.filter(
        (t) => t.sourceModule !== 'default'
      ).length
      const performanceCounts = enhancedTemplates.value.filter(
        (t) =>
          (typeof t.size === 'number' && t.size <= SMALL_MODEL_SIZE_LIMIT) ||
          (typeof t.size !== 'number' && t.isPerformance)
      ).length
      const macCompatibleCounts = enhancedTemplates.value.filter(
        (t) => t.isMacCompatible
      ).length
      const loraTrainingCounts = enhancedTemplates.value.filter(
        (t) =>
          t.tags?.includes('LoRA') ||
          t.tags?.includes('Training') ||
          t.name?.toLowerCase().includes('lora') ||
          t.title?.toLowerCase().includes('lora')
      ).length

      // All Templates - as a simple selector
      items.push({
        id: 'all',
        label: st('templateWorkflows.category.All', 'All Templates'),
        icon: getCategoryIcon('all')
      })

      // Getting Started - as a simple selector
      if (gettingStartedCounts > 0) {
        items.push({
          id: 'getting-started',
          label: st(
            'templateWorkflows.category.GettingStarted',
            'Getting Started'
          ),
          icon: getCategoryIcon('getting-started')
        })
      }

      // Generation Type - as a group with sub-items
      if (
        imageCounts > 0 ||
        videoCounts > 0 ||
        threeDCounts > 0 ||
        audioCounts > 0 ||
        llmCounts > 0
      ) {
        const generationTypeItems: NavItemData[] = []

        if (imageCounts > 0) {
          generationTypeItems.push({
            id: 'generation-image',
            label: st('templateWorkflows.category.Image', 'Image'),
            icon: getCategoryIcon('generation-image')
          })
        }

        if (videoCounts > 0) {
          generationTypeItems.push({
            id: 'generation-video',
            label: st('templateWorkflows.category.Video', 'Video'),
            icon: getCategoryIcon('generation-video')
          })
        }

        if (threeDCounts > 0) {
          generationTypeItems.push({
            id: 'generation-3d',
            label: st('templateWorkflows.category.3DModels', '3D Models'),
            icon: getCategoryIcon('generation-3d')
          })
        }

        if (audioCounts > 0) {
          generationTypeItems.push({
            id: 'generation-audio',
            label: st('templateWorkflows.category.Audio', 'Audio'),
            icon: getCategoryIcon('generation-audio')
          })
        }

        if (llmCounts > 0) {
          generationTypeItems.push({
            id: 'generation-llm',
            label: st('templateWorkflows.category.LLMs', 'LLMs'),
            icon: getCategoryIcon('generation-llm')
          })
        }

        items.push({
          title: st(
            'templateWorkflows.category.GenerationType',
            'Generation Type'
          ),
          items: generationTypeItems
        })
      }

      // Closed Models (API nodes) - as a group
      if (apiCounts > 0) {
        items.push({
          title: st(
            'templateWorkflows.category.ClosedSourceModels',
            'Closed Source Models'
          ),
          items: [
            {
              id: 'api-nodes',
              label: st('templateWorkflows.category.APINodes', 'API nodes'),
              icon: getCategoryIcon('api-nodes')
            }
          ]
        })
      }

      // Extensions - as a simple selector
      if (extensionCounts > 0) {
        items.push({
          id: 'extensions',
          label: st('templateWorkflows.category.Extensions', 'Extensions'),
          icon: getCategoryIcon('extensions')
        })
      }

      // Model Training - as a group
      if (loraTrainingCounts > 0) {
        items.push({
          title: st(
            'templateWorkflows.category.ModelTraining',
            'Model Training'
          ),
          items: [
            {
              id: 'lora-training',
              label: st(
                'templateWorkflows.category.LoRATraining',
                'LoRA Training'
              ),
              icon: getCategoryIcon('lora-training')
            }
          ]
        })
      }

      // Performance - as a group
      if (performanceCounts > 0) {
        const performanceItems: NavItemData[] = [
          {
            id: 'performance-small',
            label: st('templateWorkflows.category.SmallModels', 'Small Models'),
            icon: getCategoryIcon('small-models')
          }
        ]

        // Mac compatibility (only if there are compatible models)
        if (macCompatibleCounts > 0) {
          performanceItems.push({
            id: 'performance-mac',
            label: st(
              'templateWorkflows.category.RunsOnMac',
              'Runs on Mac (Silicon)'
            ),
            icon: getCategoryIcon('runs-on-mac')
          })
        }

        items.push({
          title: st('templateWorkflows.category.Performance', 'Performance'),
          items: performanceItems
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
