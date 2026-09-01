import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { EssentialsMediaType } from '@/constants/essentialsNodes'
import { i18n } from '@/i18n'

import EssentialNodesPanel from './EssentialNodesPanel.vue'

vi.mock('./EssentialNodeCard.vue', () => ({
  default: {
    props: ['tile', 'previewPanel'],
    template: '<div data-testid="essential-node-card">{{ tile.nodeName }}</div>'
  }
}))

function createMediaFilters(
  overrides: Partial<Record<EssentialsMediaType, boolean>> = {}
): Record<EssentialsMediaType, boolean> {
  return {
    image: true,
    video: true,
    text: true,
    audio: true,
    '3d': true,
    ...overrides
  }
}

describe('EssentialNodesPanel', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia())
  })

  function renderComponent({
    searchQuery = '',
    mediaFilters = createMediaFilters()
  } = {}) {
    return render(EssentialNodesPanel, {
      global: { plugins: [i18n] },
      props: {
        searchQuery,
        mediaFilters
      }
    })
  }

  describe('section rendering', () => {
    it('should render all sections when unfiltered', () => {
      renderComponent()
      expect(screen.getByText('Inputs & Outputs')).toBeInTheDocument()
      expect(screen.getByText('Generate')).toBeInTheDocument()
      expect(screen.getByText('Control & Guidance')).toBeInTheDocument()
      expect(screen.getByText('Editing & Utilities')).toBeInTheDocument()
    })
  })

  describe('media filters', () => {
    it('should hide tiles whose media is disabled', () => {
      renderComponent({ mediaFilters: createMediaFilters({ video: false }) })
      expect(screen.getByText('LoadImage')).toBeInTheDocument()
      expect(screen.queryByText('LoadVideo')).not.toBeInTheDocument()
    })

    it('should hide subgroups whose media is disabled', () => {
      renderComponent({ mediaFilters: createMediaFilters({ video: false }) })
      expect(screen.queryByText('Text to Video')).not.toBeInTheDocument()
      expect(screen.getByText(/Text to Image/)).toBeInTheDocument()
    })
  })

  describe('search', () => {
    it('should only show tiles matching the query', () => {
      renderComponent({ searchQuery: 'loadimage' })
      expect(screen.getByText('LoadImage')).toBeInTheDocument()
      expect(screen.queryByText('SaveImage')).not.toBeInTheDocument()
    })

    it('should drop sections with no matching tiles', () => {
      renderComponent({ searchQuery: 'LoadImage' })
      expect(screen.getByText('Inputs & Outputs')).toBeInTheDocument()
      expect(screen.queryByText('Generate')).not.toBeInTheDocument()
    })

    it('should match tiles inside subgroups', () => {
      renderComponent({ searchQuery: 'batchimage' })
      expect(screen.getByText('Image Utilities')).toBeInTheDocument()
      expect(screen.getByText('BatchImagesNode')).toBeInTheDocument()
      expect(screen.queryByText('Inputs & Outputs')).not.toBeInTheDocument()
    })

    it('should render nothing when no tile matches', () => {
      renderComponent({ searchQuery: 'zzz-no-match' })
      expect(
        screen.queryByTestId('essential-node-card')
      ).not.toBeInTheDocument()
    })
  })
})
