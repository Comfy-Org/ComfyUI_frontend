import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import ShareWorkflowDialogContent from '@/platform/workflow/sharing/components/ShareWorkflowDialogContent.vue'

vi.mock('@/platform/workflow/sharing/services/workflowShareService', () => ({
  useWorkflowShareService: () => ({
    getPublishStatus: vi.fn().mockReturnValue({
      isPublished: false,
      shareUrl: null,
      publishedAt: null,
      hasChangesSincePublish: false
    }),
    publishWorkflow: vi.fn().mockResolvedValue({
      shareUrl: 'https://comfy.org/shared/test-123',
      publishedAt: new Date('2026-01-15')
    }),
    getWorkflowAssets: vi
      .fn()
      .mockReturnValue([{ name: 'test.png', thumbnailUrl: null }]),
    getWorkflowModels: vi.fn().mockReturnValue([{ name: 'model.safetensors' }])
  })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { close: 'Close' },
      shareWorkflow: {
        publishTitle: 'Publish workflow',
        publishDescription: 'Publishing this workflow...',
        publishButton: 'Publish workflow',
        publishing: 'Publishing...',
        successTitle: 'Workflow successfully published!',
        successDescription: 'Anyone with this link...',
        hasChangesTitle: 'Share workflow',
        hasChangesDescription: 'You have made changes...',
        republishButton: 'Publish updates',
        republishing: 'Publishing...',
        publishedOn: 'Published on {date}',
        copyLink: 'Copy',
        linkCopied: 'Copied!',
        assetWarningTitle: 'This workflow includes...',
        assetsLabel: 'Assets ({count})',
        modelsLabel: 'Models ({count})',
        acknowledgeCheckbox: 'I understand these assets...',
        comfyHubTitle: 'Upload to ComfyHub',
        comfyHubDescription: 'Share your workflow...',
        comfyHubButton: 'Upload to ComfyHub'
      }
    }
  }
})

describe('ShareWorkflowDialogContent', () => {
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  function createWrapper() {
    return mount(ShareWorkflowDialogContent, {
      props: { onClose },
      global: {
        plugins: [i18n]
      }
    })
  }

  it('renders in unpublished state by default', () => {
    const wrapper = createWrapper()

    expect(wrapper.text()).toContain('Publish workflow')
    expect(wrapper.find('button').exists()).toBe(true)
  })

  it('disables publish button when acknowledgment is unchecked', () => {
    const wrapper = createWrapper()

    const publishButton = wrapper
      .findAll('button')
      .find((b) => b.text().includes('Publish workflow'))

    expect(publishButton?.attributes('disabled')).toBeDefined()
  })

  it('enables publish button when acknowledgment is checked', async () => {
    const wrapper = createWrapper()

    const checkbox = wrapper.find('input[type="checkbox"]')
    await checkbox.setValue(true)
    await nextTick()

    const publishButton = wrapper
      .findAll('button')
      .find((b) => b.text().includes('Publish workflow'))

    expect(publishButton?.attributes('disabled')).toBeUndefined()
  })

  it('calls onClose when close button is clicked', async () => {
    const wrapper = createWrapper()

    const closeButton = wrapper.find('[aria-label="Close"]')
    await closeButton.trigger('click')

    expect(onClose).toHaveBeenCalled()
  })

  it('renders ComfyHub upload section', () => {
    const wrapper = createWrapper()

    expect(wrapper.text()).toContain('Upload to ComfyHub')
  })
})
