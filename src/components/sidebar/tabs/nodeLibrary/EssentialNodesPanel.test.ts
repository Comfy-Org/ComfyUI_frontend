import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { EssentialsMediaType } from '@/composables/useEssentialsFilters'

import EssentialNodesPanel from './EssentialNodesPanel.vue'

vi.mock('./EssentialNodeCard.vue', () => ({
  default: {
    props: ['tile', 'previewPanel'],
    template: '<div data-testid="essential-node-card">{{ tile.label }}</div>'
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
const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      sideToolbar: {
        nodeLibraryTab: {
          noMatchingNodes: 'No nodes match "{query}"'
        }
      }
    }
  }
})

describe('EssentialNodesPanel', () => {
  function renderComponent({
    searchQuery = '',
    mediaFilters = createMediaFilters()
  } = {}) {
    return render(EssentialNodesPanel, {
      global: { plugins: [i18n] },
      props: {
        searchQuery,
        mediaFilters,
        'onUpdate:mediaFilters': vi.fn()
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
      expect(screen.getByText('Load Image')).toBeInTheDocument()
      expect(screen.queryByText('Load Video')).not.toBeInTheDocument()
    })

    it('should hide subgroups whose media is disabled', () => {
      renderComponent({ mediaFilters: createMediaFilters({ video: false }) })
      expect(screen.queryByText('Text to Video')).not.toBeInTheDocument()
      expect(screen.getByText('Text to Image')).toBeInTheDocument()
    })
  })

  describe('search', () => {
    it('should only show tiles matching the query', () => {
      renderComponent({ searchQuery: 'load image' })
      expect(screen.getByText('Load Image')).toBeInTheDocument()
      expect(screen.queryByText('Save Image')).not.toBeInTheDocument()
    })

    it('should drop sections with no matching tiles', () => {
      renderComponent({ searchQuery: 'Load Image' })
      expect(screen.getByText('Inputs & Outputs')).toBeInTheDocument()
      expect(screen.queryByText('Generate')).not.toBeInTheDocument()
    })

    it('should match tiles inside subgroups', () => {
      renderComponent({ searchQuery: 'nano banana' })
      expect(screen.getByText('Generate')).toBeInTheDocument()
      expect(screen.getByText('Nano Banana')).toBeInTheDocument()
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
