import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import QueueAssetCard from '@/components/assetLibrary/QueueAssetCard.vue'
import type { AssetMeta } from '@/types/media.types'

describe('QueueAssetCard', () => {
  const mockAsset: AssetMeta = {
    id: 'test-asset-1',
    name: 'test-image.png',
    kind: 'image',
    size: 1048576,
    timestamp: Date.now(),
    thumbnailUrl: 'test-thumbnail.jpg',
    dimensions: {
      width: 1920,
      height: 1080
    }
  }

  it('renders loading skeleton when loading prop is true', () => {
    const wrapper = mount(QueueAssetCard, {
      props: {
        context: 'input',
        asset: mockAsset,
        loading: true
      }
    })

    expect(wrapper.find('.animate-pulse').exists()).toBe(true)
    expect(wrapper.find('h3').exists()).toBe(false)
  })

  it('renders error state when error prop is provided', () => {
    const errorMessage = 'Failed to load asset'
    const wrapper = mount(QueueAssetCard, {
      props: {
        context: 'input',
        asset: mockAsset,
        error: errorMessage
      }
    })

    expect(wrapper.find('.pi-exclamation-triangle').exists()).toBe(true)
    expect(wrapper.text()).toContain(errorMessage)
  })

  it('renders asset information correctly', () => {
    const wrapper = mount(QueueAssetCard, {
      props: {
        context: 'input',
        asset: mockAsset
      }
    })

    expect(wrapper.find('h3').text()).toBe(mockAsset.name)
    expect(wrapper.text()).toContain('1 MB')
    expect(wrapper.text()).toContain('1920×1080')
  })

  it('shows job ID and copy button only in output context', () => {
    const assetWithJob = {
      ...mockAsset,
      jobId: 'job-123'
    }

    // Test input context - no job ID
    const inputWrapper = mount(QueueAssetCard, {
      props: {
        context: 'input',
        asset: assetWithJob
      }
    })
    expect(inputWrapper.text()).not.toContain('Job:')
    expect(inputWrapper.find('.pi-copy').exists()).toBe(false)

    // Test output context - has job ID
    const outputWrapper = mount(QueueAssetCard, {
      props: {
        context: 'output',
        asset: assetWithJob
      }
    })
    expect(outputWrapper.text()).toContain('Job: job-123')
    expect(outputWrapper.find('.pi-copy').exists()).toBe(true)
  })

  it('emits download event when download button is clicked', async () => {
    const wrapper = mount(QueueAssetCard, {
      props: {
        context: 'input',
        asset: mockAsset
      }
    })

    const downloadBtn = wrapper.find('[aria-label="Download image"]')
    await downloadBtn.trigger('click')

    expect(wrapper.emitted('download')).toBeTruthy()
    expect(wrapper.emitted('download')![0]).toEqual([mockAsset.id])
  })

  it('emits copyJobId event when copy button is clicked in output context', async () => {
    const assetWithJob = {
      ...mockAsset,
      jobId: 'job-456'
    }

    const wrapper = mount(QueueAssetCard, {
      props: {
        context: 'output',
        asset: assetWithJob
      }
    })

    const copyBtn = wrapper
      .find('.pi-copy')
      .element.closest('button') as HTMLButtonElement
    await copyBtn.click()

    expect(wrapper.emitted('copyJobId')).toBeTruthy()
    expect(wrapper.emitted('copyJobId')![0]).toEqual(['job-456'])
  })

  it('emits openDetail event when card is clicked', async () => {
    const wrapper = mount(QueueAssetCard, {
      props: {
        context: 'input',
        asset: mockAsset
      }
    })

    await wrapper.find('[role="button"]').trigger('click')

    expect(wrapper.emitted('openDetail')).toBeTruthy()
    expect(wrapper.emitted('openDetail')![0]).toEqual([mockAsset.id])
  })

  it('handles keyboard activation with Enter and Space keys', async () => {
    const wrapper = mount(QueueAssetCard, {
      props: {
        context: 'input',
        asset: mockAsset
      }
    })

    const card = wrapper.find('[role="button"]')

    await card.trigger('keydown.enter')
    expect(wrapper.emitted('openDetail')).toHaveLength(1)

    await card.trigger('keydown.space')
    expect(wrapper.emitted('openDetail')).toHaveLength(2)
  })

  it('applies dense mode correctly', () => {
    const wrapper = mount(QueueAssetCard, {
      props: {
        context: 'input',
        asset: mockAsset,
        dense: true
      }
    })

    // CardContainer component applies the aspect ratio based on the ratio prop
    const card = wrapper.findComponent({ name: 'CardContainer' })
    expect(card.props('ratio')).toBe('smallSquare')
  })

  it('shows fallback icon when thumbnailUrl is not provided', () => {
    const assetWithoutThumbnail = {
      ...mockAsset,
      thumbnailUrl: undefined
    }

    const wrapper = mount(QueueAssetCard, {
      props: {
        context: 'input',
        asset: assetWithoutThumbnail
      }
    })

    // Should show icon when no thumbnail
    expect(wrapper.find('.pi-image, .pi-file').exists()).toBe(true)
  })

  it('formats audio duration correctly', () => {
    const audioAsset: AssetMeta = {
      ...mockAsset,
      kind: 'audio',
      duration: 125,
      dimensions: undefined
    }

    const wrapper = mount(QueueAssetCard, {
      props: {
        context: 'input',
        asset: audioAsset
      }
    })

    expect(wrapper.text()).toContain('2:05')
  })
})
