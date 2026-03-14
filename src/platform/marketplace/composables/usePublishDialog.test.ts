import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { MarketplaceTemplate } from '@/platform/marketplace/apiTypes'
import PublishTemplateWizard from '@/platform/marketplace/components/PublishTemplateWizard.vue'
import { usePublishDialog } from '@/platform/marketplace/composables/usePublishDialog'

const mockShowLayoutDialog = vi.hoisted(() => vi.fn())
const mockCloseDialog = vi.hoisted(() => vi.fn())

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({ showLayoutDialog: mockShowLayoutDialog })
}))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({ closeDialog: mockCloseDialog })
}))

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

describe('usePublishDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('show() opens layout dialog with PublishTemplateWizard and default props', () => {
    const dialog = usePublishDialog()

    dialog.show()

    expect(mockShowLayoutDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'publish-to-marketplace',
        component: PublishTemplateWizard,
        props: expect.objectContaining({
          onClose: expect.any(Function)
        })
      })
    )
    const call = mockShowLayoutDialog.mock.calls[0][0]
    expect(call.props.initialTemplate).toBeUndefined()
  })

  it('show({ initialTemplate }) passes initialTemplate to wizard', () => {
    const dialog = usePublishDialog()
    const mockTemplate = makeMockTemplate({
      id: 'tpl_99',
      title: 'My Template'
    })

    dialog.show({ initialTemplate: mockTemplate })

    expect(mockShowLayoutDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        props: expect.objectContaining({
          initialTemplate: mockTemplate
        })
      })
    )
  })

  it('show({ initialTemplate, readOnly: true }) passes readOnly to wizard', () => {
    const dialog = usePublishDialog()
    const mockTemplate = makeMockTemplate()

    dialog.show({ initialTemplate: mockTemplate, readOnly: true })

    expect(mockShowLayoutDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        props: expect.objectContaining({
          initialTemplate: mockTemplate,
          readOnly: true
        })
      })
    )
  })

  it('hide() closes dialog with correct key', () => {
    const dialog = usePublishDialog()

    dialog.hide()

    expect(mockCloseDialog).toHaveBeenCalledWith({
      key: 'publish-to-marketplace'
    })
  })
})
