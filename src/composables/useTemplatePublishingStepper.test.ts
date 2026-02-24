import { describe, expect, it, vi } from 'vitest'

const { mockLoad, mockSave } = vi.hoisted(() => ({
  mockLoad: vi.fn(),
  mockSave: vi.fn()
}))

vi.mock(
  '@/platform/workflow/templates/composables/useTemplatePublishStorage',
  () => ({
    loadTemplateUnderway: mockLoad,
    saveTemplateUnderway: mockSave
  })
)

import { useTemplatePublishingStepper } from './useTemplatePublishingStepper'

describe('useTemplatePublishingStepper', () => {
  it('starts at step 1 by default', () => {
    const { currentStep } = useTemplatePublishingStepper()
    expect(currentStep.value).toBe(1)
  })

  it('starts at the given initialStep', () => {
    const { currentStep } = useTemplatePublishingStepper({ initialStep: 4 })
    expect(currentStep.value).toBe(4)
  })

  it('clamps initialStep to valid range', () => {
    const low = useTemplatePublishingStepper({ initialStep: 0 })
    expect(low.currentStep.value).toBe(1)

    const high = useTemplatePublishingStepper({ initialStep: 99 })
    expect(high.currentStep.value).toBe(high.totalSteps)
  })

  it('nextStep advances by one', () => {
    const { currentStep, nextStep } = useTemplatePublishingStepper()
    nextStep()
    expect(currentStep.value).toBe(2)
  })

  it('nextStep does not exceed totalSteps', () => {
    const { currentStep, nextStep, totalSteps } = useTemplatePublishingStepper({
      initialStep: 8
    })
    nextStep()
    expect(currentStep.value).toBe(totalSteps)
  })

  it('prevStep goes back by one', () => {
    const { currentStep, prevStep } = useTemplatePublishingStepper({
      initialStep: 3
    })
    prevStep()
    expect(currentStep.value).toBe(2)
  })

  it('prevStep does not go below 1', () => {
    const { currentStep, prevStep } = useTemplatePublishingStepper()
    prevStep()
    expect(currentStep.value).toBe(1)
  })

  it('goToStep navigates to the given step', () => {
    const { currentStep, goToStep } = useTemplatePublishingStepper()
    goToStep(5)
    expect(currentStep.value).toBe(5)
  })

  it('goToStep clamps out-of-range values', () => {
    const { currentStep, goToStep, totalSteps } = useTemplatePublishingStepper()
    goToStep(100)
    expect(currentStep.value).toBe(totalSteps)
    goToStep(-1)
    expect(currentStep.value).toBe(1)
  })

  it('isFirstStep and isLastStep reflect current position', () => {
    const { isFirstStep, isLastStep, nextStep, goToStep, totalSteps } =
      useTemplatePublishingStepper()

    expect(isFirstStep.value).toBe(true)
    expect(isLastStep.value).toBe(false)

    nextStep()
    expect(isFirstStep.value).toBe(false)

    goToStep(totalSteps)
    expect(isLastStep.value).toBe(true)
  })

  it('canProceed reflects step validity', () => {
    const { canProceed, setStepValid } = useTemplatePublishingStepper()
    expect(canProceed.value).toBe(false)

    setStepValid(1, true)
    expect(canProceed.value).toBe(true)

    setStepValid(1, false)
    expect(canProceed.value).toBe(false)
  })

  it('saveDraft delegates to saveTemplateUnderway', () => {
    const { template, saveDraft } = useTemplatePublishingStepper()
    template.value = { title: 'Test Template' }
    saveDraft()
    expect(mockSave).toHaveBeenCalledWith({ title: 'Test Template' })
  })

  it('loads existing draft on initialisation', () => {
    const draft = { title: 'Saved Draft', description: 'A draft' }
    mockLoad.mockReturnValueOnce(draft)

    const { template } = useTemplatePublishingStepper()
    expect(template.value).toEqual(draft)
  })

  it('uses empty object when no draft is stored', () => {
    mockLoad.mockReturnValueOnce(null)

    const { template } = useTemplatePublishingStepper()
    expect(template.value).toEqual({})
  })

  it('exposes the correct number of step definitions', () => {
    const { stepDefinitions, totalSteps } = useTemplatePublishingStepper()
    expect(stepDefinitions).toHaveLength(totalSteps)
    expect(totalSteps).toBe(8)
  })
})
