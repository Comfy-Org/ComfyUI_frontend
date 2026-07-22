import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useCommandStore } from '@/stores/commandStore'

import { createNodeHandle } from './nodeHandle'

describe('createNodeHandle', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('setSize', () => {
    it('dispatches Comfy.Node.Resize with the node id and requested size', async () => {
      const resize = vi.fn()
      useCommandStore().registerCommand({
        id: 'Comfy.Node.Resize',
        function: resize
      })

      await createNodeHandle('42').setSize(300, 150)

      expect(resize).toHaveBeenCalledWith({
        nodeId: '42',
        width: 300,
        height: 150
      })
    })

    it('rejects when the command is not registered', async () => {
      await expect(createNodeHandle('1').setSize(100, 100)).rejects.toThrow(
        'Comfy.Node.Resize'
      )
    })
  })

  describe('not-yet-implemented stubs', () => {
    it('autosize rejects referencing the follow-up', async () => {
      await expect(createNodeHandle('1').autosize()).rejects.toThrow(
        /not implemented yet/i
      )
    })

    it("on('resize') throws referencing the follow-up", () => {
      expect(() => createNodeHandle('1').on('resize', () => {})).toThrow(
        /not implemented yet/i
      )
    })
  })
})
