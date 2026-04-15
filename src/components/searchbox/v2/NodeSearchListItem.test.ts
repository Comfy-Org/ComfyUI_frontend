import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'

import NodeSearchListItem from '@/components/searchbox/v2/NodeSearchListItem.vue'
import {
  createMockNodeDef,
  setupTestPinia,
  testI18n
} from '@/components/searchbox/v2/__test__/testUtils'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useNodeFrequencyStore } from '@/stores/nodeDefStore'

function renderItem(
  props: Partial<ComponentProps<typeof NodeSearchListItem>> = {}
) {
  return render(NodeSearchListItem, {
    props: { nodeDef: createMockNodeDef(), currentQuery: '', ...props },
    global: {
      plugins: [testI18n],
      stubs: {
        NodePricingBadge: {
          template: '<div data-testid="pricing-badge" />',
          props: ['nodeDef']
        },
        ComfyLogo: { template: '<div data-testid="comfy-logo" />' }
      }
    }
  })
}

describe('NodeSearchListItem', () => {
  beforeEach(() => {
    setupTestPinia()
    vi.restoreAllMocks()
  })

  describe('id name badge', () => {
    it('shows id name when ShowIdName setting is enabled', () => {
      useSettingStore().settingValues['Comfy.NodeSearchBoxImpl.ShowIdName'] =
        true
      renderItem({
        nodeDef: createMockNodeDef({
          name: 'KSamplerNode',
          display_name: 'KSampler'
        })
      })
      expect(screen.getByText('KSamplerNode')).toBeInTheDocument()
    })

    it('hides id name by default', () => {
      renderItem({
        nodeDef: createMockNodeDef({
          name: 'KSamplerNode',
          display_name: 'KSampler'
        })
      })
      expect(screen.queryByText('KSamplerNode')).not.toBeInTheDocument()
    })
  })

  describe('showDescription mode', () => {
    it('renders description text', () => {
      renderItem({
        nodeDef: createMockNodeDef({ description: 'A sampler node' }),
        showDescription: true
      })
      expect(screen.getByText('A sampler node')).toBeInTheDocument()
    })

    it('renders category when ShowCategory setting is enabled', () => {
      useSettingStore().settingValues['Comfy.NodeSearchBoxImpl.ShowCategory'] =
        true
      renderItem({
        nodeDef: createMockNodeDef({ category: 'sampling/advanced' }),
        showDescription: true
      })
      expect(screen.getByText('sampling / advanced')).toBeInTheDocument()
    })

    it('hides category by default', () => {
      renderItem({
        nodeDef: createMockNodeDef({ category: 'sampling' }),
        showDescription: true
      })
      expect(screen.queryByText('sampling')).not.toBeInTheDocument()
    })
  })

  describe('source badge', () => {
    it('renders core comfy badge for non-custom node when showSourceBadge is true', () => {
      renderItem({
        nodeDef: createMockNodeDef({ python_module: 'nodes' }),
        showDescription: true,
        showSourceBadge: true
      })
      expect(screen.getByTestId('comfy-logo')).toBeInTheDocument()
    })

    it('renders custom node badge for custom node when showSourceBadge is true', () => {
      renderItem({
        nodeDef: createMockNodeDef({
          python_module: 'custom_nodes.my_extension',
          display_name: 'CustomNode'
        }),
        showDescription: true,
        showSourceBadge: true
      })
      expect(screen.getByText('my_extension')).toBeInTheDocument()
    })

    it('does not render source badge when showSourceBadge is false', () => {
      renderItem({
        nodeDef: createMockNodeDef({ python_module: 'nodes' }),
        showDescription: true,
        showSourceBadge: false
      })
      expect(screen.queryByTestId('comfy-logo')).not.toBeInTheDocument()
    })
  })

  describe('API node provider badge', () => {
    it('renders provider badge only when nodeDef.api_node is true', () => {
      renderItem({
        nodeDef: createMockNodeDef({
          api_node: true,
          category: 'api/image/BFL'
        })
      })
      expect(screen.getByText('BFL')).toBeInTheDocument()
    })

    it('does not render provider badge when nodeDef.api_node is false', () => {
      renderItem({
        nodeDef: createMockNodeDef({
          api_node: false,
          category: 'api/image/BFL'
        })
      })
      expect(screen.queryByText('BFL')).not.toBeInTheDocument()
    })
  })

  describe('status flags', () => {
    it('shows deprecated label when deprecated', () => {
      renderItem({ nodeDef: createMockNodeDef({ deprecated: true }) })
      expect(screen.getByText('DEPR')).toBeInTheDocument()
    })

    it('shows experimental label when experimental', () => {
      renderItem({ nodeDef: createMockNodeDef({ experimental: true }) })
      expect(screen.getByText('BETA')).toBeInTheDocument()
    })

    it('shows devOnly label when dev_only is set', () => {
      renderItem({ nodeDef: createMockNodeDef({ dev_only: true }) })
      expect(screen.getByText('DEV')).toBeInTheDocument()
    })

    it('does not show flags in description mode', () => {
      renderItem({
        nodeDef: createMockNodeDef({ deprecated: true, experimental: true }),
        showDescription: true
      })
      expect(screen.queryByText('DEPR')).not.toBeInTheDocument()
      expect(screen.queryByText('BETA')).not.toBeInTheDocument()
    })
  })

  describe('node frequency badge', () => {
    it('shows frequency when ShowNodeFrequency is enabled and frequency > 0', () => {
      useSettingStore().settingValues[
        'Comfy.NodeSearchBoxImpl.ShowNodeFrequency'
      ] = true
      vi.spyOn(useNodeFrequencyStore(), 'getNodeFrequency').mockReturnValue(
        1500
      )
      renderItem({ nodeDef: createMockNodeDef() })
      const badge = screen.getByTestId('frequency-badge')
      expect(badge).toBeInTheDocument()
      expect(badge.textContent).toMatch(/1\.5k/i)
    })

    it('hides frequency when frequency is 0 even if setting is enabled', () => {
      useSettingStore().settingValues[
        'Comfy.NodeSearchBoxImpl.ShowNodeFrequency'
      ] = true
      vi.spyOn(useNodeFrequencyStore(), 'getNodeFrequency').mockReturnValue(0)
      renderItem({ nodeDef: createMockNodeDef() })
      expect(screen.queryByTestId('frequency-badge')).not.toBeInTheDocument()
    })

    it('hides frequency when setting is disabled even if frequency > 0', () => {
      useSettingStore().settingValues[
        'Comfy.NodeSearchBoxImpl.ShowNodeFrequency'
      ] = false
      vi.spyOn(useNodeFrequencyStore(), 'getNodeFrequency').mockReturnValue(
        9999
      )
      renderItem({ nodeDef: createMockNodeDef() })
      expect(screen.queryByTestId('frequency-badge')).not.toBeInTheDocument()
    })
  })

  describe('bookmark icon', () => {
    it('shows bookmark icon when node is bookmarked', () => {
      useSettingStore().settingValues['Comfy.NodeLibrary.Bookmarks.V2'] = [
        'TestNode'
      ]
      renderItem({ nodeDef: createMockNodeDef({ name: 'TestNode' }) })
      expect(
        screen.getByRole('img', { name: 'Bookmarked' })
      ).toBeInTheDocument()
    })

    it('does not show bookmark icon when node is not bookmarked', () => {
      renderItem({ nodeDef: createMockNodeDef({ name: 'TestNode' }) })
      expect(
        screen.queryByRole('img', { name: 'Bookmarked' })
      ).not.toBeInTheDocument()
    })

    it('hides bookmark icon when hideBookmarkIcon prop is true', () => {
      useSettingStore().settingValues['Comfy.NodeLibrary.Bookmarks.V2'] = [
        'TestNode'
      ]
      renderItem({
        nodeDef: createMockNodeDef({ name: 'TestNode' }),
        hideBookmarkIcon: true
      })
      expect(
        screen.queryByRole('img', { name: 'Bookmarked' })
      ).not.toBeInTheDocument()
    })
  })

  describe('query highlighting', () => {
    it('wraps matching portion of display_name in a highlight span', () => {
      renderItem({
        nodeDef: createMockNodeDef({ display_name: 'KSampler Advanced' }),
        currentQuery: 'Sampler'
      })
      expect(
        screen.getByText('Sampler', { selector: 'span.highlight' })
      ).toBeInTheDocument()
    })

    it('does not wrap anything when currentQuery is empty', () => {
      renderItem({
        nodeDef: createMockNodeDef({ display_name: 'KSampler' }),
        currentQuery: ''
      })
      expect(
        screen.queryByText('KSampler', { selector: 'span.highlight' })
      ).not.toBeInTheDocument()
    })
  })

  describe('node source display text', () => {
    it('shows custom node source displayText in non-description mode', () => {
      renderItem({
        nodeDef: createMockNodeDef({
          python_module: 'custom_nodes.my_extension'
        })
      })
      expect(screen.getByText('my_extension')).toBeInTheDocument()
    })
  })
})
