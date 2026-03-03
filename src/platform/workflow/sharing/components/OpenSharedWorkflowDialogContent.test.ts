import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import OpenSharedWorkflowDialogContent from '@/platform/workflow/sharing/components/OpenSharedWorkflowDialogContent.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { close: 'Close', cancel: 'Cancel' },
      openSharedWorkflow: {
        dialogTitle: 'Open shared workflow',
        copyDescription:
          'Opening the workflow will create a new copy in your workspace',
        nonPublicAssetsWarningLine1:
          'This workflow comes with non-public assets.',
        nonPublicAssetsWarningLine2:
          'These will be added to your library when you open the workflow',
        copyAssetsAndOpen: 'Copy assets & open workflow',
        openWorkflow: 'Open workflow'
      },
      shareWorkflow: {
        mediaLabel: '{count} Media File | {count} Media Files',
        modelsLabel: '{count} Model | {count} Models'
      }
    }
  }
})

function mountComponent(props: Record<string, unknown> = {}) {
  return mount(OpenSharedWorkflowDialogContent, {
    global: {
      plugins: [i18n]
    },
    props: {
      workflowName: 'Test Workflow',
      onConfirm: vi.fn(),
      onCancel: vi.fn(),
      ...props
    }
  })
}

describe('OpenSharedWorkflowDialogContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('no-assets variant', () => {
    it('shows dialog title in header when no assets', () => {
      const wrapper = mountComponent()
      const header = wrapper.find('header span')
      expect(header.text()).toBe('Open shared workflow')
    })

    it('shows "Open workflow" as primary CTA', () => {
      const wrapper = mountComponent()
      const buttons = wrapper.findAll('button')
      const primaryButton = buttons[buttons.length - 1]
      expect(primaryButton.text()).toBe('Open workflow')
    })

    it('shows workflow name in body', () => {
      const wrapper = mountComponent({ workflowName: 'My Workflow' })
      expect(wrapper.find('h2').text()).toBe('My Workflow')
    })

    it('does not show warning or asset sections', () => {
      const wrapper = mountComponent()
      expect(wrapper.text()).not.toContain('non-public assets')
      expect(wrapper.text()).not.toContain('Media File')
    })

    it('calls onConfirm when primary button is clicked', async () => {
      const onConfirm = vi.fn()
      const wrapper = mountComponent({ onConfirm })
      const buttons = wrapper.findAll('button')
      await buttons[buttons.length - 1].trigger('click')
      expect(onConfirm).toHaveBeenCalled()
    })

    it('calls onCancel when cancel button is clicked', async () => {
      const onCancel = vi.fn()
      const wrapper = mountComponent({ onCancel })
      const cancelButton = wrapper
        .findAll('button')
        .find((b) => b.text() === 'Cancel')
      await cancelButton!.trigger('click')
      expect(onCancel).toHaveBeenCalled()
    })
  })

  describe('assets-present variant', () => {
    const assetsProps = {
      items: [
        {
          id: 'a1',
          name: 'photo.png',
          preview_url: '',
          storage_url: '',
          model: false,
          public: false,
          in_library: false
        },
        {
          id: 'a2',
          name: 'image.jpg',
          preview_url: '',
          storage_url: '',
          model: false,
          public: false,
          in_library: false
        },
        {
          id: 'm1',
          name: 'model.safetensors',
          preview_url: '',
          storage_url: '',
          model: true,
          public: false,
          in_library: false
        }
      ]
    }

    it('shows workflow name in header when assets exist', () => {
      const wrapper = mountComponent({
        workflowName: 'My Workflow',
        ...assetsProps
      })
      const title = wrapper.find('main h2')
      expect(title.text()).toBe('My Workflow')
    })

    it('shows "Copy assets & open workflow" as primary CTA', () => {
      const wrapper = mountComponent(assetsProps)
      const buttons = wrapper.findAll('button')
      const primaryButton = buttons[buttons.length - 1]
      expect(primaryButton.text()).toBe('Copy assets & open workflow')
    })

    it('shows non-public assets warning', () => {
      const wrapper = mountComponent(assetsProps)
      expect(wrapper.text()).toContain('non-public assets')
    })

    it('renders media and model section headers', () => {
      const wrapper = mountComponent(assetsProps)
      expect(wrapper.text()).toContain('2 Media Files')
      expect(wrapper.text()).toContain('1 Model')
    })

    it('calls onConfirm when primary button is clicked', async () => {
      const onConfirm = vi.fn()
      const wrapper = mountComponent({ ...assetsProps, onConfirm })
      const buttons = wrapper.findAll('button')
      await buttons[buttons.length - 1].trigger('click')
      expect(onConfirm).toHaveBeenCalled()
    })
  })
})
