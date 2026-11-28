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

it('hides update popups while picking nodes and restores them afterwards', async () => {
  const canvas = useCanvasStore()
  render(HelpCenterPopups, {
    global: {
      plugins: [getActivePinia()!],
      stubs: {
        Teleport: true,
        HelpCenterMenuContent: true,
        WhatsNewPopup: {
          template: '<div>What’s New</div>'
        },
        ReleaseNotificationToast: {
          props: ['isVisible'],
          template: '<div>Release toast visible: {{ isVisible }}</div>'
        }
      }
    }
  })
  expect(screen.getByText('Release toast visible: true')).toBeInTheDocument()
  expect(screen.getByText('What’s New')).toBeVisible()

  canvas.isPickingNodes = true
  await nextTick()
  expect(screen.getByText('Release toast visible: false')).toBeInTheDocument()
  expect(screen.getByText('What’s New')).not.toBeVisible()

  canvas.stopNodePicking()
  await nextTick()
  expect(screen.getByText('Release toast visible: true')).toBeInTheDocument()
  expect(screen.getByText('What’s New')).toBeVisible()
})
