/* eslint-disable testing-library/no-container, testing-library/no-node-access */
import { fromPartial } from '@total-typescript/shoehorn'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import OpenSharedWorkflowDialogContent from '@/platform/workflow/sharing/components/OpenSharedWorkflowDialogContent.vue'
import type { SharedWorkflowPayload } from '@/platform/workflow/sharing/types/shareTypes'

const mockGetSharedWorkflow = vi.fn()

vi.mock('@/platform/workflow/sharing/services/workflowShareService', () => ({
  SharedWorkflowLoadError: class extends Error {},
  useWorkflowShareService: () => ({
    getSharedWorkflow: mockGetSharedWorkflow
  })
}))

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
        openWorkflow: 'Open workflow',
        openWithoutImporting: 'Open without importing',
        loadError:
          'Could not load this shared workflow. Please try again later.'
      },
      shareWorkflow: {
        mediaLabel: '{count} Media File | {count} Media Files',
        modelsLabel: '{count} Model | {count} Models'
      }
    }
  }
})

function makePayload(
  overrides: Partial<SharedWorkflowPayload> = {}
): SharedWorkflowPayload {
  return {
    shareId: 'share-id-1',
    workflowId: 'workflow-id-1',
    name: 'Test Workflow',
    listed: true,
    publishedAt: new Date('2026-02-20T00:00:00Z'),
    workflowJson: fromPartial<SharedWorkflowPayload['workflowJson']>({
      nodes: []
    }),
    assets: [],
    ...overrides
  }
}

async function flushPromises() {
  await new Promise((r) => setTimeout(r, 0))
}

function renderComponent(props: Record<string, unknown> = {}) {
  return render(OpenSharedWorkflowDialogContent, {
    global: {
      plugins: [i18n],
      stubs: {
        AssetSectionList: { template: '<div class="asset-list-stub" />' },
        'asset-section-list': { template: '<div class="asset-list-stub" />' }
      }
    },
    props: {
      shareId: 'test-share-id',
      onConfirm: vi.fn(),
      onOpenWithoutImporting: vi.fn(),
      onCancel: vi.fn(),
      ...props
    }
  })
}

describe('OpenSharedWorkflowDialogContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('loading state', () => {
    it('shows skeleton placeholders while loading', () => {
      mockGetSharedWorkflow.mockReturnValue(new Promise(() => {}))
      renderComponent()

      expect(screen.getByRole('status')).toBeDefined()
    })

    it('shows dialog title in header while loading', () => {
      mockGetSharedWorkflow.mockReturnValue(new Promise(() => {}))
      const { container } = renderComponent()
      const header = container.querySelector('header h2') as HTMLElement
      expect(header.textContent).toBe('Open shared workflow')
    })
  })

  describe('error state', () => {
    it('shows error message when fetch fails', async () => {
      mockGetSharedWorkflow.mockRejectedValue(new Error('Network error'))
      const { container } = renderComponent()
      await flushPromises()

      expect(container.textContent).toContain(
        'Could not load this shared workflow. Please try again later.'
      )
    })

    it('shows close button in error state', async () => {
      mockGetSharedWorkflow.mockRejectedValue(new Error('Network error'))
      const { container } = renderComponent()
      await flushPromises()

      const footerButtons = container.querySelectorAll('footer button')
      expect(footerButtons).toHaveLength(1)
      expect(footerButtons[0].textContent).toBe('Close')
    })

    it('calls onCancel when close is clicked in error state', async () => {
      mockGetSharedWorkflow.mockRejectedValue(new Error('Network error'))
      const onCancel = vi.fn()
      const { container } = renderComponent({ onCancel })
      await flushPromises()

      const closeButton = Array.from(
        container.querySelectorAll('footer button')
      ).find((b) => b.textContent === 'Close') as HTMLElement
      await userEvent.click(closeButton)
      expect(onCancel).toHaveBeenCalled()
    })
  })

  describe('loaded state - no assets', () => {
    it('shows workflow name in body', async () => {
      mockGetSharedWorkflow.mockResolvedValue(
        makePayload({ name: 'My Workflow' })
      )
      const { container } = renderComponent()
      await flushPromises()

      expect(
        (container.querySelector('main h2') as HTMLElement).textContent
      ).toBe('My Workflow')
    })

    it('shows "Open workflow" as primary CTA', async () => {
      mockGetSharedWorkflow.mockResolvedValue(makePayload())
      const { container } = renderComponent()
      await flushPromises()

      const buttons = container.querySelectorAll('footer button')
      const primaryButton = buttons[buttons.length - 1]
      expect(primaryButton.textContent).toBe('Open workflow')
    })

    it('does not show "Open without importing" button', async () => {
      mockGetSharedWorkflow.mockResolvedValue(makePayload())
      const { container } = renderComponent()
      await flushPromises()

      expect(container.textContent).not.toContain('Open without importing')
    })

    it('does not show warning or asset sections', async () => {
      mockGetSharedWorkflow.mockResolvedValue(makePayload())
      const { container } = renderComponent()
      await flushPromises()

      expect(container.textContent).not.toContain('non-public assets')
    })

    it('calls onConfirm with payload when primary button is clicked', async () => {
      const payload = makePayload()
      mockGetSharedWorkflow.mockResolvedValue(payload)
      const onConfirm = vi.fn()
      const { container } = renderComponent({ onConfirm })
      await flushPromises()

      const buttons = container.querySelectorAll('footer button')
      await userEvent.click(buttons[buttons.length - 1] as HTMLElement)
      expect(onConfirm).toHaveBeenCalledWith(payload)
    })

    it('calls onCancel when cancel button is clicked', async () => {
      mockGetSharedWorkflow.mockResolvedValue(makePayload())
      const onCancel = vi.fn()
      const { container } = renderComponent({ onCancel })
      await flushPromises()

      const cancelButton = Array.from(
        container.querySelectorAll('footer button')
      ).find((b) => b.textContent === 'Cancel') as HTMLElement
      await userEvent.click(cancelButton)
      expect(onCancel).toHaveBeenCalled()
    })
  })

  describe('loaded state - with assets', () => {
    const assetsPayload = makePayload({
      assets: [
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
    })

    it('shows "Copy assets & open workflow" as primary CTA', async () => {
      mockGetSharedWorkflow.mockResolvedValue(assetsPayload)
      const { container } = renderComponent()
      await flushPromises()

      const buttons = container.querySelectorAll('footer button')
      const primaryButton = buttons[buttons.length - 1]
      expect(primaryButton.textContent).toBe('Copy assets & open workflow')
    })

    it('shows non-public assets warning', async () => {
      mockGetSharedWorkflow.mockResolvedValue(assetsPayload)
      const { container } = renderComponent()
      await flushPromises()

      expect(container.textContent).toContain('non-public assets')
    })

    it('shows "Open without importing" button', async () => {
      mockGetSharedWorkflow.mockResolvedValue(assetsPayload)
      renderComponent()
      await flushPromises()

      const openWithoutImporting = screen
        .getAllByRole('button')
        .find((b) => b.textContent === 'Open without importing')
      expect(openWithoutImporting).toBeDefined()
    })

    it('calls onOpenWithoutImporting with payload', async () => {
      mockGetSharedWorkflow.mockResolvedValue(assetsPayload)
      const onOpenWithoutImporting = vi.fn()
      renderComponent({ onOpenWithoutImporting })
      await flushPromises()

      const button = screen
        .getAllByRole('button')
        .find((b) => b.textContent === 'Open without importing')
      await userEvent.click(button!)
      expect(onOpenWithoutImporting).toHaveBeenCalledWith(assetsPayload)
    })

    it('calls onConfirm with payload when primary button is clicked', async () => {
      mockGetSharedWorkflow.mockResolvedValue(assetsPayload)
      const onConfirm = vi.fn()
      const { container } = renderComponent({ onConfirm })
      await flushPromises()

      const buttons = container.querySelectorAll('footer button')
      await userEvent.click(buttons[buttons.length - 1] as HTMLElement)
      expect(onConfirm).toHaveBeenCalledWith(assetsPayload)
    })

    it('filters out assets already in library', async () => {
      const mixedPayload = makePayload({
        assets: [
          {
            id: 'a1',
            name: 'needed.png',
            preview_url: '',
            storage_url: '',
            model: false,
            public: false,
            in_library: false
          },
          {
            id: 'a2',
            name: 'already-have.png',
            preview_url: '',
            storage_url: '',
            model: false,
            public: false,
            in_library: true
          }
        ]
      })
      mockGetSharedWorkflow.mockResolvedValue(mixedPayload)
      const { container } = renderComponent()
      await flushPromises()

      expect(container.textContent).toContain('non-public assets')
    })
  })

  describe('fetches with correct shareId', () => {
    it('passes shareId to getSharedWorkflow', async () => {
      mockGetSharedWorkflow.mockResolvedValue(makePayload())
      renderComponent({ shareId: 'my-share-123' })
      await flushPromises()

      expect(mockGetSharedWorkflow).toHaveBeenCalledWith('my-share-123')
    })
  })
})
