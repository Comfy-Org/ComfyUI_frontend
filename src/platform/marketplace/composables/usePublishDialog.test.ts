import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { MarketplaceTemplate } from '@/platform/marketplace/apiTypes'
import PublishTemplateWizard from '@/platform/marketplace/components/PublishTemplateWizard.vue'
import { usePublishDialog } from '@/platform/marketplace/composables/usePublishDialog'
import { useDialogStore } from '@/stores/dialogStore'

vi.mock('@/stores/dialogStore')

function makeMockTemplate(
  overrides: Partial<MarketplaceTemplate> = {}
): MarketplaceTemplate {
  return {
    id: 'tpl_1',
    title: 'Test Template',
    description: 'A test',
    shortDescription: 'Short',
    author: {
      id: 'a1',
      name: 'Author',
      isVerified: false,
      profileUrl: ''
    },
    categories: [],
    tags: [],
    difficulty: 'beginner',
    requiredModels: [],
    requiredNodes: [],
    vramRequirement: 0,
    thumbnail: '',
    gallery: [],
    workflowPreview: '',
    license: 'mit',
    version: '1.0.0',
    status: 'draft',
    updatedAt: new Date().toISOString(),
    stats: {
      downloads: 0,
      favorites: 0,
      rating: 0,
      reviewCount: 0,
      weeklyTrend: 0
    },
    ...overrides
  }
}

function setupDialogMocks() {
  const mockShowDialog = vi.fn()
  const mockCloseDialog = vi.fn()
  vi.mocked(useDialogStore, { partial: true }).mockReturnValue({
    showDialog: mockShowDialog,
    closeDialog: mockCloseDialog
  })

  return { mockShowDialog, mockCloseDialog }
}

describe('usePublishDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('show() opens dialog with PublishTemplateWizard and default props', () => {
    const { mockShowDialog } = setupDialogMocks()
    const dialog = usePublishDialog()

    dialog.show()

    expect(mockShowDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'publish-to-marketplace',
        title: 'Publish to Marketplace',
        component: PublishTemplateWizard,
        props: expect.objectContaining({
          onClose: expect.any(Function)
        })
      })
    )
    const call = mockShowDialog.mock.calls[0][0]
    expect(call.props.initialTemplate).toBeUndefined()
  })

  it('show({ initialTemplate }) passes initialTemplate to wizard', () => {
    const { mockShowDialog } = setupDialogMocks()
    const dialog = usePublishDialog()
    const mockTemplate = makeMockTemplate({
      id: 'tpl_99',
      title: 'My Template'
    })

    dialog.show({ initialTemplate: mockTemplate })

    expect(mockShowDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        props: expect.objectContaining({
          initialTemplate: mockTemplate
        })
      })
    )
  })

  it('hide() closes dialog with correct key', () => {
    const { mockCloseDialog } = setupDialogMocks()
    const dialog = usePublishDialog()

    dialog.hide()

    expect(mockCloseDialog).toHaveBeenCalledWith({
      key: 'publish-to-marketplace'
    })
  })
})
