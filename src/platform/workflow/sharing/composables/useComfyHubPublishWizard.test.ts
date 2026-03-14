import { beforeEach, describe, expect, it, vi } from 'vitest'

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

const { useComfyHubPublishWizard } = await import('./useComfyHubPublishWizard')

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
