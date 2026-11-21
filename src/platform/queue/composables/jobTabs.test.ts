import { describe, expect, it } from 'vitest'

import { getVisibleJobTabs } from '@/platform/queue/composables/jobTabs'

describe('getVisibleJobTabs', () => {
  it.for([
    { hasFailedJobs: true, expected: ['All', 'Completed', 'Failed'] },
    { hasFailedJobs: false, expected: ['All', 'Completed'] }
  ])(
    'shows $expected when hasFailedJobs is $hasFailedJobs',
    ({ hasFailedJobs, expected }) => {
      expect(getVisibleJobTabs(hasFailedJobs)).toEqual(expected)
    }
  )
})
