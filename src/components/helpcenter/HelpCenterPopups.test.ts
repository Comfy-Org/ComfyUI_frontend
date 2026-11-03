import { render, screen } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { getActivePinia } from 'pinia'
import { expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

import HelpCenterPopups from './HelpCenterPopups.vue'

vi.mock(import('@/renderer/core/canvas/useCanvasInteractions'))
vi.mock(import('@/composables/useHelpCenter'), () => ({
  useHelpCenter: () =>
    fromPartial({
      isHelpCenterVisible: ref(false),
      sidebarLocation: ref('left')
    })
}))

it('passes node-picking visibility to the release toast', async () => {
  const canvas = useCanvasStore()
  render(HelpCenterPopups, {
    global: {
      plugins: [getActivePinia()!],
      stubs: {
        Teleport: true,
        HelpCenterMenuContent: true,
        WhatsNewPopup: true,
        ReleaseNotificationToast: {
          props: ['isVisible'],
          template: '<div>Release toast visible: {{ isVisible }}</div>'
        }
      }
    }
  })
  expect(screen.getByText('Release toast visible: true')).toBeInTheDocument()

  canvas.isPickingNodes = true
  await nextTick()
  expect(screen.getByText('Release toast visible: false')).toBeInTheDocument()

  canvas.stopNodePicking()
  await nextTick()
  expect(screen.getByText('Release toast visible: true')).toBeInTheDocument()
})
