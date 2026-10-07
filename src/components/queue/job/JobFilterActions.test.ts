import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import { createI18n } from 'vue-i18n'

import JobFilterActions from './JobFilterActions.vue'

const trackFeatureUsed = vi.hoisted(() => vi.fn())

vi.mock(import('@/platform/surveys/useSurveyFeatureTracking'), () => ({
  useSurveyFeatureTracking: () => ({
    trackFeatureUsed,
    useCount: computed(() => 0)
  })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      sideToolbar: {
        queueProgressOverlay: {
          filterJobs: 'Filter jobs',
          filterBy: 'Filter by',
          filterAllWorkflows: 'All workflows',
          filterCurrentWorkflow: 'Current workflow',
          sortJobs: 'Sort jobs',
          sortBy: 'Sort by',
          showAssetsPanel: 'Show assets panel',
          showAssets: 'Show assets',
          searchJobs: 'Search jobs'
        }
      },
      queue: {
        jobList: {
          sortMostRecent: 'Most recent',
          sortTotalGenerationTime: 'Generation time'
        }
      }
    }
  }
})

describe('JobFilterActions', () => {
  it('tracks reselecting the unchanged workflow filter', async () => {
    const user = userEvent.setup()
    render(JobFilterActions, {
      global: {
        plugins: [i18n],
        directives: { tooltip: {} }
      },
      props: {
        selectedWorkflowFilter: 'all',
        selectedSortMode: 'mostRecent'
      }
    })

    await user.click(screen.getByRole('button', { name: 'Filter jobs' }))
    await user.click(
      screen.getByRole('menuitemradio', { name: 'All workflows' })
    )

    expect(trackFeatureUsed).toHaveBeenCalledOnce()
  })
})
