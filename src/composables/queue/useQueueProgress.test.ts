import { render } from '@testing-library/vue'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import { describe, it, expect, beforeEach } from 'vitest'
import { useExecutionStore } from '@/stores/executionStore'

import { useQueueProgress } from '@/composables/queue/useQueueProgress'
import { formatPercent0 } from '@/utils/numberUtil'

const i18n = createI18n({
  legacy: false,
  locale: 'en-US',
  messages: { 'en-US': {}, 'fr-FR': {} }
})

const mountUseQueueProgress = () => {
  let composable: ReturnType<typeof useQueueProgress>
  render(
    {
      template: '<div />',
      setup() {
        composable = useQueueProgress()
        return {}
      }
    },
    { global: { plugins: [i18n] } }
  )
  return { composable: composable! }
}

const setExecutionProgress = (value?: number | null) => {
  Object.assign(useExecutionStore(), { executionProgress: value ?? undefined })
}

const setExecutingNodeProgress = (value?: number | null) => {
  Object.assign(useExecutionStore(), {
    executingNodeProgress: value ?? undefined
  })
}

describe('useQueueProgress', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'en-US'
    setExecutionProgress(null)
    setExecutingNodeProgress(null)
  })

  it.for([
    {
      description: 'defaults to 0% when execution store values are missing',
      execution: undefined,
      node: undefined,
      expectedTotal: 0,
      expectedNode: 0
    },
    {
      description: 'rounds fractional progress to the nearest integer',
      execution: 0.324,
      node: 0.005,
      expectedTotal: 32,
      expectedNode: 1
    },
    {
      description: 'clamps values below 0 and above 100%',
      execution: 1.5,
      node: -0.25,
      expectedTotal: 100,
      expectedNode: 0
    },
    {
      description: 'caps near-complete totals at 100%',
      execution: 0.999,
      node: 0.731,
      expectedTotal: 100,
      expectedNode: 73
    }
  ])('$description', ({ execution, node, expectedTotal, expectedNode }) => {
    setExecutionProgress(execution ?? null)
    setExecutingNodeProgress(node ?? null)

    const { composable } = mountUseQueueProgress()

    expect(composable.totalPercent.value).toBe(expectedTotal)
    expect(composable.currentNodePercent.value).toBe(expectedNode)
    expect(composable.totalPercentFormatted.value).toBe(
      formatPercent0(i18n.global.locale.value, expectedTotal)
    )
    expect(composable.currentNodePercentFormatted.value).toBe(
      formatPercent0(i18n.global.locale.value, expectedNode)
    )
  })

  it('reformats output when the active locale changes', async () => {
    setExecutionProgress(0.32)
    setExecutingNodeProgress(0.58)

    const { composable } = mountUseQueueProgress()

    expect(composable.totalPercentFormatted.value).toBe(
      formatPercent0('en-US', composable.totalPercent.value)
    )
    expect(composable.currentNodePercentFormatted.value).toBe(
      formatPercent0('en-US', composable.currentNodePercent.value)
    )

    i18n.global.locale.value = 'fr-FR'
    await nextTick()

    expect(composable.totalPercentFormatted.value).toBe(
      formatPercent0('fr-FR', composable.totalPercent.value)
    )
    expect(composable.currentNodePercentFormatted.value).toBe(
      formatPercent0('fr-FR', composable.currentNodePercent.value)
    )
  })

  it('builds progress bar styles that track store updates', async () => {
    setExecutionProgress(0.1)
    setExecutingNodeProgress(0.25)

    const { composable } = mountUseQueueProgress()

    expect(composable.totalProgressStyle.value).toEqual({
      transform: 'scaleX(0.1)',
      background: 'var(--color-interface-panel-job-progress-primary)'
    })
    expect(composable.currentNodeProgressStyle.value).toEqual({
      transform: 'scaleX(0.25)',
      background: 'var(--color-interface-panel-job-progress-secondary)'
    })

    setExecutionProgress(0.755)
    setExecutingNodeProgress(0.02)
    await nextTick()

    expect(composable.totalProgressStyle.value.transform).toBe('scaleX(0.76)')
    expect(composable.currentNodeProgressStyle.value.transform).toBe(
      'scaleX(0.02)'
    )
  })
})
