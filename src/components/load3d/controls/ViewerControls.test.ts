import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import ViewerControls from '@/components/load3d/controls/ViewerControls.vue'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'

const showDialog = vi.fn()
const handleViewerClose = vi.fn()

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({ showDialog })
}))

vi.mock('@/services/load3dService', () => ({
  useLoad3dService: () => ({ handleViewerClose })
}))

vi.mock('@/components/load3d/Load3dViewerContent.vue', () => ({
  default: { name: 'Load3DViewerContentStub', template: '<div />' }
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      load3d: {
        openIn3DViewer: 'Open in 3D viewer',
        viewer: { title: '3D viewer' }
      }
    }
  }
})

const mockNode = createMockLGraphNode({ id: 'node-1' })

describe('ViewerControls', () => {
  beforeEach(() => {
    showDialog.mockClear()
    handleViewerClose.mockClear()
  })

  it('renders the open-in-viewer button labeled by the localized aria-label', () => {
    render(ViewerControls, {
      props: { node: mockNode },
      global: {
        plugins: [i18n],
        directives: { tooltip: () => {} }
      }
    })

    expect(
      screen.getByRole('button', { name: 'Open in 3D viewer' })
    ).toBeInTheDocument()
  })

  it('opens the dialog with the provided node and viewer component when clicked', async () => {
    const user = userEvent.setup()
    render(ViewerControls, {
      props: { node: mockNode },
      global: {
        plugins: [i18n],
        directives: { tooltip: () => {} }
      }
    })

    await user.click(screen.getByRole('button', { name: 'Open in 3D viewer' }))

    expect(showDialog).toHaveBeenCalledOnce()
    const callArgs = showDialog.mock.calls[0][0]
    expect(callArgs.key).toBe('global-load3d-viewer')
    expect(callArgs.title).toBe('3D viewer')
    expect(callArgs.component).toMatchObject({
      name: 'Load3DViewerContentStub'
    })
    expect(callArgs.props).toEqual({ node: mockNode })
    expect(callArgs.dialogComponentProps.maximizable).toBe(true)
  })

  it('routes the dialog onClose handler through useLoad3dService.handleViewerClose with the node', async () => {
    const user = userEvent.setup()
    render(ViewerControls, {
      props: { node: mockNode },
      global: {
        plugins: [i18n],
        directives: { tooltip: () => {} }
      }
    })

    await user.click(screen.getByRole('button', { name: 'Open in 3D viewer' }))

    const onClose = showDialog.mock.calls[0][0].dialogComponentProps.onClose
    await onClose()

    expect(handleViewerClose).toHaveBeenCalledWith(mockNode)
  })
})
