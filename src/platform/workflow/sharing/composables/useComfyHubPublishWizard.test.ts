import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ComfyHubPublishFormData } from '@/platform/workflow/sharing/types/comfyHubTypes'

const mockActiveWorkflow = vi.hoisted(() => ({
  value: { filename: 'my-workflow.json' } as { filename: string } | null
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({
    get activeWorkflow() {
      return mockActiveWorkflow.value
    }
  })
}))

const { useComfyHubPublishWizard, cachePublishPrefill, getCachedPrefill } =
  await import('./useComfyHubPublishWizard')

function makeFormData(overrides: Partial<ComfyHubPublishFormData> = {}) {
  return {
    name: '',
    description: '',
    tags: [],
    models: [],
    customNodes: [],
    thumbnailType: 'image' as const,
    thumbnailFile: null,
    thumbnailUrl: null,
    comparisonBeforeFile: null,
    comparisonBeforeUrl: null,
    comparisonAfterFile: null,
    comparisonAfterUrl: null,
    exampleImages: [],
    tutorialUrl: '',
    metadata: {},
    ...overrides
  } satisfies ComfyHubPublishFormData
}

describe('useComfyHubPublishWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockActiveWorkflow.value = { filename: 'my-workflow.json' }
  })

  describe('createDefaultFormData', () => {
    it('initialises name from active workflow filename', () => {
      const { formData } = useComfyHubPublishWizard()
      expect(formData.value.name).toBe('my-workflow.json')
    })

    it('defaults name to empty string when no active workflow', () => {
      mockActiveWorkflow.value = null
      const { formData } = useComfyHubPublishWizard()
      expect(formData.value.name).toBe('')
    })

    it('initialises all other form fields to defaults', () => {
      const { formData } = useComfyHubPublishWizard()
      expect(formData.value.description).toBe('')
      expect(formData.value.tags).toEqual([])
      expect(formData.value.thumbnailType).toBe('image')
      expect(formData.value.thumbnailFile).toBeNull()
      expect(formData.value.comparisonBeforeFile).toBeNull()
      expect(formData.value.comparisonAfterFile).toBeNull()
      expect(formData.value.exampleImages).toEqual([])
    })
  })

  describe('canGoNext', () => {
    it('returns false on describe step when name is empty', () => {
      const { canGoNext, formData } = useComfyHubPublishWizard()
      formData.value.name = ''
      expect(canGoNext.value).toBe(false)
    })

    it('returns false on describe step when name is whitespace only', () => {
      const { canGoNext, formData } = useComfyHubPublishWizard()
      formData.value.name = '   '
      expect(canGoNext.value).toBe(false)
    })

    it('returns true on describe step when name has content', () => {
      const { canGoNext, formData } = useComfyHubPublishWizard()
      formData.value.name = 'Valid Name'
      expect(canGoNext.value).toBe(true)
    })

    it('returns true on non-describe steps regardless of name', () => {
      const { canGoNext, goNext, formData } = useComfyHubPublishWizard()
      formData.value.name = 'something'
      goNext()
      formData.value.name = ''
      expect(canGoNext.value).toBe(true)
    })
  })

  describe('step navigation', () => {
    it('starts on the describe step', () => {
      const { currentStep, isFirstStep } = useComfyHubPublishWizard()
      expect(currentStep.value).toBe('describe')
      expect(isFirstStep.value).toBe(true)
    })

    it('navigates forward through steps', () => {
      const { currentStep, goNext } = useComfyHubPublishWizard()
      expect(currentStep.value).toBe('describe')

      goNext()
      expect(currentStep.value).toBe('examples')

      goNext()
      expect(currentStep.value).toBe('finish')
    })

    it('navigates backward through steps', () => {
      const { currentStep, goNext, goBack } = useComfyHubPublishWizard()
      goNext()
      goNext()
      expect(currentStep.value).toBe('finish')

      goBack()
      expect(currentStep.value).toBe('examples')

      goBack()
      expect(currentStep.value).toBe('describe')
    })

    it('reports isLastStep correctly on finish step', () => {
      const { isLastStep, goNext } = useComfyHubPublishWizard()
      expect(isLastStep.value).toBe(false)

      goNext()
      expect(isLastStep.value).toBe(false)

      goNext()
      expect(isLastStep.value).toBe(true)
    })
  })

  describe('applyPrefill', () => {
    it('populates every form field from the prefill payload', () => {
      const { applyPrefill, formData } = useComfyHubPublishWizard()
      mockActiveWorkflow.value = { filename: 'my-workflow.json' }

      applyPrefill({
        name: 'Cinematic Upscale',
        description: 'A polished workflow',
        tags: ['art', 'upscale'],
        models: ['sdxl'],
        customNodes: ['impact-pack'],
        thumbnailType: 'image',
        thumbnailUrl: 'https://cdn.example.com/thumb.png',
        sampleImageUrls: ['https://cdn.example.com/sample-1.png'],
        tutorialUrl: 'https://youtube.com/watch?v=abc',
        metadata: { extended_description: 'long form' }
      })

      expect(formData.value).toMatchObject({
        name: 'Cinematic Upscale',
        description: 'A polished workflow',
        tags: ['art', 'upscale'],
        models: ['sdxl'],
        customNodes: ['impact-pack'],
        thumbnailType: 'image',
        thumbnailUrl: 'https://cdn.example.com/thumb.png',
        comparisonBeforeUrl: null,
        comparisonAfterUrl: null,
        tutorialUrl: 'https://youtube.com/watch?v=abc',
        metadata: { extended_description: 'long form' }
      })
      expect(formData.value.exampleImages).toHaveLength(1)
      expect(formData.value.exampleImages[0]?.url).toBe(
        'https://cdn.example.com/sample-1.png'
      )
    })

    it('routes thumbnail URLs into comparison slots when type is imageComparison', () => {
      const { applyPrefill, formData } = useComfyHubPublishWizard()

      applyPrefill({
        thumbnailType: 'imageComparison',
        thumbnailUrl: 'https://cdn.example.com/before.png',
        thumbnailComparisonUrl: 'https://cdn.example.com/after.png'
      })

      expect(formData.value.thumbnailType).toBe('imageComparison')
      expect(formData.value.thumbnailUrl).toBeNull()
      expect(formData.value.comparisonBeforeUrl).toBe(
        'https://cdn.example.com/before.png'
      )
      expect(formData.value.comparisonAfterUrl).toBe(
        'https://cdn.example.com/after.png'
      )
    })

    it('respects user input over prefill for fields the user has edited', () => {
      const { applyPrefill, formData } = useComfyHubPublishWizard()

      formData.value.description = 'User-typed description'
      formData.value.tags = ['user-tag']
      formData.value.tutorialUrl = 'https://user.example.com'

      applyPrefill({
        description: 'Prefill description',
        tags: ['prefill-tag'],
        tutorialUrl: 'https://prefill.example.com'
      })

      expect(formData.value.description).toBe('User-typed description')
      expect(formData.value.tags).toEqual(['user-tag'])
      expect(formData.value.tutorialUrl).toBe('https://user.example.com')
    })

    it('does not overwrite an already chosen thumbnail file with a prefill URL', () => {
      const { applyPrefill, formData } = useComfyHubPublishWizard()
      const userFile = new File(['x'], 'user.png', { type: 'image/png' })
      formData.value.thumbnailFile = userFile

      applyPrefill({
        thumbnailUrl: 'https://cdn.example.com/prefilled.png'
      })

      expect(formData.value.thumbnailFile?.name).toBe('user.png')
      expect(formData.value.thumbnailUrl).toBeNull()
    })

    it('preserves user-chosen models, customNodes, exampleImages, and metadata over prefill', () => {
      const { applyPrefill, formData } = useComfyHubPublishWizard()
      formData.value.models = ['user-model']
      formData.value.customNodes = ['user-node']
      formData.value.exampleImages = [
        { id: 'user-1', url: 'https://user.example.com/a.png' }
      ]
      formData.value.metadata = { user_key: 'user_value' }

      applyPrefill({
        models: ['prefill-model'],
        customNodes: ['prefill-node'],
        sampleImageUrls: ['https://prefill.example.com/b.png'],
        metadata: { prefill_key: 'prefill_value' }
      })

      expect(formData.value.models).toEqual(['user-model'])
      expect(formData.value.customNodes).toEqual(['user-node'])
      expect(formData.value.exampleImages).toEqual([
        { id: 'user-1', url: 'https://user.example.com/a.png' }
      ])
      expect(formData.value.metadata).toEqual({ user_key: 'user_value' })
    })

    it('treats an empty prefill metadata object as no prefill', () => {
      const { applyPrefill, formData } = useComfyHubPublishWizard()

      applyPrefill({ metadata: {} })

      expect(formData.value.metadata).toEqual({})
    })

    it('does not overwrite a prefilled thumbnailUrl on a second applyPrefill', () => {
      const { applyPrefill, formData } = useComfyHubPublishWizard()

      applyPrefill({ thumbnailUrl: 'https://cdn.example.com/first.png' })
      applyPrefill({ thumbnailUrl: 'https://cdn.example.com/second.png' })

      expect(formData.value.thumbnailUrl).toBe(
        'https://cdn.example.com/first.png'
      )
    })

    it('does not overwrite a chosen comparison-before file when applying comparison prefill', () => {
      const { applyPrefill, formData } = useComfyHubPublishWizard()
      const beforeFile = new File(['b'], 'before.png', { type: 'image/png' })
      formData.value.thumbnailType = 'imageComparison'
      formData.value.comparisonBeforeFile = beforeFile

      applyPrefill({
        thumbnailType: 'imageComparison',
        thumbnailUrl: 'https://cdn.example.com/before-prefill.png',
        thumbnailComparisonUrl: 'https://cdn.example.com/after-prefill.png'
      })

      expect(formData.value.comparisonBeforeFile?.name).toBe('before.png')
      expect(formData.value.comparisonBeforeUrl).toBeNull()
      expect(formData.value.comparisonAfterUrl).toBe(
        'https://cdn.example.com/after-prefill.png'
      )
    })
  })

  describe('cachePublishPrefill / getCachedPrefill', () => {
    it('returns null when no prefill is cached for the workflow path', () => {
      expect(getCachedPrefill('workflows/never-cached.json')).toBeNull()
    })

    it('roundtrips every cacheable form field through extractPrefillFromFormData', () => {
      const path = 'workflows/cached-full.json'
      cachePublishPrefill(
        path,
        makeFormData({
          name: 'My Workflow',
          description: 'Cached description',
          tags: ['art'],
          models: ['sdxl'],
          customNodes: ['impact-pack'],
          thumbnailType: 'image',
          thumbnailUrl: 'https://cdn.example.com/thumb.png',
          exampleImages: [
            { id: 'a', url: 'https://cdn.example.com/sample.png' },
            { id: 'b', url: 'blob:https://localhost/abc' },
            { id: 'c', url: '' }
          ],
          tutorialUrl: 'https://youtube.com/abc',
          metadata: { extra: 'value' }
        })
      )

      expect(getCachedPrefill(path)).toEqual({
        name: 'My Workflow',
        description: 'Cached description',
        tags: ['art'],
        models: ['sdxl'],
        customNodes: ['impact-pack'],
        thumbnailType: 'image',
        thumbnailUrl: 'https://cdn.example.com/thumb.png',
        thumbnailComparisonUrl: undefined,
        sampleImageUrls: ['https://cdn.example.com/sample.png'],
        tutorialUrl: 'https://youtube.com/abc',
        metadata: { extra: 'value' }
      })
    })

    it('routes comparison-before URL into thumbnailUrl when type is imageComparison', () => {
      const path = 'workflows/cached-comparison.json'
      cachePublishPrefill(
        path,
        makeFormData({
          thumbnailType: 'imageComparison',
          comparisonBeforeUrl: 'https://cdn.example.com/before.png',
          comparisonAfterUrl: 'https://cdn.example.com/after.png'
        })
      )

      const cached = getCachedPrefill(path)
      expect(cached?.thumbnailUrl).toBe('https://cdn.example.com/before.png')
      expect(cached?.thumbnailComparisonUrl).toBe(
        'https://cdn.example.com/after.png'
      )
    })

    it('omits sampleImageUrls when every example URL is blob: or empty', () => {
      const path = 'workflows/cached-blobs.json'
      cachePublishPrefill(
        path,
        makeFormData({
          exampleImages: [
            { id: 'a', url: 'blob:https://localhost/x' },
            { id: 'b', url: '' }
          ]
        })
      )

      expect(getCachedPrefill(path)?.sampleImageUrls).toBeUndefined()
    })

    it('omits empty arrays/strings/metadata fields', () => {
      const path = 'workflows/cached-minimal.json'
      cachePublishPrefill(path, makeFormData({ thumbnailType: 'image' }))

      const cached = getCachedPrefill(path)
      expect(cached).toEqual({
        name: undefined,
        description: undefined,
        tags: undefined,
        models: undefined,
        customNodes: undefined,
        thumbnailType: 'image',
        thumbnailUrl: undefined,
        thumbnailComparisonUrl: undefined,
        sampleImageUrls: undefined,
        tutorialUrl: undefined,
        metadata: undefined
      })
    })

    it('clones tags/models/metadata so later form mutations do not leak into the cache', () => {
      const tags = ['t1']
      const models = ['m1']
      const metadata = { k: 'v' }
      const path = 'workflows/cache-cloning.json'

      cachePublishPrefill(path, makeFormData({ tags, models, metadata }))
      tags.push('mutated')
      models.push('mutated')
      metadata.k = 'mutated'

      expect(getCachedPrefill(path)).toMatchObject({
        tags: ['t1'],
        models: ['m1'],
        metadata: { k: 'v' }
      })
    })
  })

  describe('profile creation step', () => {
    it('navigates to profileCreation step', () => {
      const { currentStep, openProfileCreationStep } =
        useComfyHubPublishWizard()
      openProfileCreationStep()
      expect(currentStep.value).toBe('profileCreation')
    })

    it('reports isProfileCreationStep correctly', () => {
      const { isProfileCreationStep, openProfileCreationStep } =
        useComfyHubPublishWizard()
      expect(isProfileCreationStep.value).toBe(false)

      openProfileCreationStep()
      expect(isProfileCreationStep.value).toBe(true)
    })

    it('returns to finish step from profileCreation', () => {
      const { currentStep, openProfileCreationStep, closeProfileCreationStep } =
        useComfyHubPublishWizard()
      openProfileCreationStep()
      expect(currentStep.value).toBe('profileCreation')

      closeProfileCreationStep()
      expect(currentStep.value).toBe('finish')
    })
  })
})
