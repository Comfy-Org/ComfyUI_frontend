import { render, screen } from '@testing-library/vue'
import { assert, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'

import AssetMediaPreview from './AssetMediaPreview.vue'

describe('retained asset media previews', () => {
  it.for(['video', 'audio'] as const)(
    'stops and resets %s when closed before unmounting',
    async (kind) => {
      const { rerender } = render(AssetMediaPreview, {
        props: { name: 'Media', mediaUrl: '/media', kind, active: true },
        global: { plugins: [i18n] }
      })
      const player = screen.getByLabelText('Media', { selector: kind })
      assert.instanceOf(player, HTMLMediaElement)
      player.currentTime = 1
      const pause = vi.spyOn(player, 'pause')
      await rerender({ active: false })
      expect(player).toBeInTheDocument()
      expect(pause).toHaveBeenCalledOnce()
      expect(player.currentTime).toBe(0)
      await rerender({ active: true })
      expect(screen.getByLabelText('Media', { selector: kind })).toBe(player)
      expect(player.currentTime).toBe(0)
    }
  )
})
