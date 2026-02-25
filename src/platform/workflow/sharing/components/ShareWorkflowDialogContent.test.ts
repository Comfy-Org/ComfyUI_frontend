import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import ShareWorkflowDialogContent from '@/platform/workflow/sharing/components/ShareWorkflowDialogContent.vue'

const mockWorkflowStore = reactive<{
  activeWorkflow: {
    path: string
    directory: string
    filename: string
    isTemporary: boolean
    isModified: boolean
    lastModified: number
  } | null
}>({
  activeWorkflow: null
})

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => mockWorkflowStore
}))

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({
    add: vi.fn()
  })
}))

vi.mock('@formkit/auto-animate/vue', () => ({
  vAutoAnimate: {}
}))

const mockFlags = vi.hoisted(() => ({
  comfyHubUploadEnabled: false,
  comfyHubProfileGateEnabled: true
}))

const mockShowPublishDialog = vi.hoisted(() => vi.fn())
const mockCheckProfile = vi.hoisted(() => vi.fn(() => Promise.resolve(true)))
const mockHasProfile = ref<boolean | null>(null)

vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    flags: mockFlags
  })
}))

vi.mock(
  '@/platform/workflow/sharing/composables/useComfyHubPublishDialog',
  () => ({
    useComfyHubPublishDialog: () => ({
      show: mockShowPublishDialog
    })
  })
)

vi.mock(
  '@/platform/workflow/sharing/composables/useComfyHubProfileGate',
  () => ({
    useComfyHubProfileGate: () => ({
      hasProfile: mockHasProfile,
      checkProfile: mockCheckProfile
    })
  })
)

vi.mock('@/platform/workflow/core/services/workflowService', () => ({
  useWorkflowService: () => ({
    saveWorkflow: vi.fn(),
    renameWorkflow: vi.fn()
  })
}))

const mockShareServiceData = vi.hoisted(() => ({
  assets: [{ name: 'test.png', thumbnailUrl: null }] as {
    name: string
    thumbnailUrl: string | null
  }[],
  models: [{ name: 'model.safetensors' }] as { name: string }[]
}))

vi.mock('@/platform/workflow/sharing/services/workflowShareService', () => ({
  useWorkflowShareService: () => ({
    getPublishStatus: () =>
      Promise.resolve({
        isPublished: false,
        shareUrl: null,
        publishedAt: null,
        hasChangesSincePublish: false
      }),
    publishWorkflow: () =>
      Promise.resolve({
        shareUrl: 'https://comfy.org/shared/test-123',
        publishedAt: new Date('2026-01-15')
      }),
    getShareableAssets: () =>
      Promise.resolve({
        assets: mockShareServiceData.assets,
        models: mockShareServiceData.models
      })
  })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { close: 'Close' },
      shareWorkflow: {
        unsavedDescription: 'You must save your workflow before sharing.',
        shareLinkTab: 'Share',
        publishToHubTab: 'Publish',
        workflowNameLabel: 'Workflow name',
        saving: 'Saving...',
        saveButton: 'Save workflow',
        createLinkButton: 'Create link',
        creatingLink: 'Creating link...',
        checkingAssets: 'Checking assets...',
        successDescription: 'Anyone with this link...',
        hasChangesDescription: 'You have made changes...',
        updateLinkButton: 'Update link',
        updatingLink: 'Updating link...',
        publishedOn: 'Published on {date}',
        mediaLabel: '{count} Media File | {count} Media Files',
        modelsLabel: '{count} Model | {count} Models',
        acknowledgeCheckbox: 'I understand these assets...'
      },
      comfyHubProfile: {
        introTitle: 'Introducing ComfyHub',
        createProfileButton: 'Create my profile',
        startPublishingButton: 'Start Publishing'
      }
    }
  }
})

describe('ShareWorkflowDialogContent', () => {
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockWorkflowStore.activeWorkflow = {
      path: 'workflows/test.json',
      directory: 'workflows',
      filename: 'test.json',
      isTemporary: false,
      isModified: false,
      lastModified: 1000
    }
    mockFlags.comfyHubUploadEnabled = false
    mockHasProfile.value = null
    mockCheckProfile.mockResolvedValue(true)
    mockShareServiceData.assets = [{ name: 'test.png', thumbnailUrl: null }]
    mockShareServiceData.models = [{ name: 'model.safetensors' }]
  })

  function createWrapper() {
    return mount(ShareWorkflowDialogContent, {
      props: { onClose },
      global: {
        plugins: [i18n],
        stubs: {
          ComfyHubIntroPopover: {
            template:
              '<section data-testid="publish-intro"><button data-testid="publish-intro-cta" @click="$props.onCreateProfile()">{{ $props.hasProfile ? "Start Publishing" : "Create my profile" }}</button></section>',
            props: ['onCreateProfile', 'hasProfile']
          },
          'comfy-hub-intro-popover': {
            template:
              '<section data-testid="publish-intro"><button data-testid="publish-intro-cta" @click="$props.onCreateProfile()">{{ $props.hasProfile ? "Start Publishing" : "Create my profile" }}</button></section>',
            props: ['onCreateProfile', 'hasProfile']
          },
          Input: {
            template: '<input v-bind="$attrs" />',
            methods: { focus() {}, select() {} }
          }
        }
      }
    })
  }

  it('renders in unsaved state when workflow is modified', async () => {
    mockWorkflowStore.activeWorkflow = {
      path: 'workflows/test.json',
      directory: 'workflows',
      filename: 'test.json',
      isTemporary: false,
      isModified: true,
      lastModified: 1000
    }
    const wrapper = createWrapper()
    await flushPromises()

    expect(wrapper.text()).toContain(
      'You must save your workflow before sharing.'
    )
    expect(wrapper.text()).toContain('Save workflow')
  })

  it('renders share-link and publish tabs when comfy hub upload is enabled', async () => {
    mockFlags.comfyHubUploadEnabled = true
    const wrapper = createWrapper()
    await flushPromises()

    expect(wrapper.text()).toContain('Share')
    expect(wrapper.text()).toContain('Publish')
    const publishTabPanel = wrapper.find('[data-testid="publish-tab-panel"]')
    expect(publishTabPanel.exists()).toBe(true)
    expect(publishTabPanel.attributes('style') ?? '').toContain(
      'display: none;'
    )
  })

  it('hides the publish tab when comfy hub upload is disabled', async () => {
    const wrapper = createWrapper()
    await flushPromises()

    expect(wrapper.text()).toContain('Share')
    expect(wrapper.text()).not.toContain('Publish')
    expect(wrapper.find('[data-testid="publish-intro"]').exists()).toBe(false)
  })

  it('shows publish intro panel in the share dialog', async () => {
    mockFlags.comfyHubUploadEnabled = true
    const wrapper = createWrapper()
    await flushPromises()

    const publishTab = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Publish'))

    expect(publishTab).toBeDefined()
    await publishTab!.trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="publish-intro"]').exists()).toBe(true)
  })

  it('shows start publishing CTA when user already has a profile', async () => {
    mockFlags.comfyHubUploadEnabled = true
    mockHasProfile.value = true
    const wrapper = createWrapper()
    await flushPromises()

    const publishTab = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Publish'))
    expect(publishTab).toBeDefined()

    await publishTab!.trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="publish-intro-cta"]').text()).toBe(
      'Start Publishing'
    )
  })

  it('opens publish dialog from intro cta and closes share dialog', async () => {
    mockFlags.comfyHubUploadEnabled = true
    const wrapper = createWrapper()
    await flushPromises()

    const publishTab = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Publish'))

    expect(publishTab).toBeDefined()
    await publishTab!.trigger('click')
    await flushPromises()

    await wrapper.find('[data-testid="publish-intro-cta"]').trigger('click')
    await nextTick()

    expect(onClose).toHaveBeenCalledOnce()
    expect(mockShowPublishDialog).toHaveBeenCalledOnce()
  })

  it('disables publish button when acknowledgment is unchecked', async () => {
    const wrapper = createWrapper()
    await flushPromises()

    const publishButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Create link'))

    expect(publishButton?.attributes('disabled')).toBeDefined()
  })

  it('enables publish button when acknowledgment is checked', async () => {
    const wrapper = createWrapper()
    await flushPromises()

    const checkbox = wrapper.find('input[type="checkbox"]')
    await checkbox.setValue(true)
    await nextTick()

    const publishButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Create link'))

    expect(publishButton?.attributes('disabled')).toBeUndefined()
  })

  it('calls onClose when close button is clicked', async () => {
    const wrapper = createWrapper()
    await flushPromises()

    const closeButton = wrapper.find('[aria-label="Close"]')
    await closeButton.trigger('click')

    expect(onClose).toHaveBeenCalled()
  })
})
