import { beforeEach, describe, expect, it } from 'vitest'

describe('useErrorSurveyPopoverState', () => {
  beforeEach(async () => {
    const { useErrorSurveyPopoverState } =
      await import('./useErrorSurveyPopoverState')
    useErrorSurveyPopoverState().isPopoverOpen.value = false
  })

  it('returns a singleton shared across callers', async () => {
    const { useErrorSurveyPopoverState } =
      await import('./useErrorSurveyPopoverState')
    const first = useErrorSurveyPopoverState()
    const second = useErrorSurveyPopoverState()

    expect(first.isPopoverOpen).toBe(second.isPopoverOpen)
  })

  it('open() sets isPopoverOpen to true', async () => {
    const { useErrorSurveyPopoverState } =
      await import('./useErrorSurveyPopoverState')
    const { isPopoverOpen, open } = useErrorSurveyPopoverState()

    expect(isPopoverOpen.value).toBe(false)
    open()
    expect(isPopoverOpen.value).toBe(true)
  })

  it('state persists across multiple invocations', async () => {
    const { useErrorSurveyPopoverState } =
      await import('./useErrorSurveyPopoverState')
    useErrorSurveyPopoverState().open()

    const { isPopoverOpen } = useErrorSurveyPopoverState()
    expect(isPopoverOpen.value).toBe(true)
  })
})
