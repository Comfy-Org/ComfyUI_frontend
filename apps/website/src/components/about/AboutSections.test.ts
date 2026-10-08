import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import OurValuesSection from './OurValuesSection.vue'
import StorySection from './StorySection.vue'

describe('About badges', () => {
  it.for(['en', 'zh-CN'] as const)(
    'preserves the original segmented badges in %s',
    (locale) => {
      render(StorySection, { props: { locale } })
      render(OurValuesSection, { props: { locale } })

      expect(screen.getByText('OUR', { exact: true })).toBeTruthy()
      expect(screen.getByText('INVESTORS', { exact: true })).toBeTruthy()
      expect(screen.getAllByText('SHIP', { exact: true })).toHaveLength(2)
      expect(screen.getAllByText('SHARE', { exact: true })).toHaveLength(2)
      expect(screen.getAllByText('OPEN-SOURCE', { exact: true })).toHaveLength(
        2
      )
      expect(screen.getAllByText('THE CRAFT', { exact: true })).toHaveLength(2)
    }
  )

  it('translates the investor badge', () => {
    render(StorySection, { props: { locale: 'ja' } })

    expect(screen.getByText('投資家')).toBeTruthy()
    expect(screen.queryByText('INVESTORS')).toBeNull()
  })

  it('translates the values badges as complete messages', () => {
    render(OurValuesSection, { props: { locale: 'ja' } })

    expect(screen.getAllByText('形にする')).toHaveLength(2)
    expect(screen.getAllByText('オープンソースにする')).toHaveLength(2)
    expect(screen.queryByText('SHIP')).toBeNull()
  })
})
