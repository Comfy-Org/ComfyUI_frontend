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

it('hides the release toast only while picking nodes', async () => {
  const canvas = useCanvasStore()
  render(HelpCenterPopups, {
    global: {
      plugins: [getActivePinia()!],
      stubs: {
        Teleport: true,
        HelpCenterMenuContent: true,
        WhatsNewPopup: true,
        ReleaseNotificationToast: { template: '<div>New release</div>' }
      }
    }
  })
  expect(screen.getByText('New release')).toBeVisible()

  canvas.isPickingNodes = true
  await nextTick()
  expect(screen.getByText('New release')).not.toBeVisible()

  canvas.stopNodePicking()
  await nextTick()
  expect(screen.getByText('New release')).toBeVisible()
})
