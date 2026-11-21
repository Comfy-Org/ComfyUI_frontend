import { fromPartial } from '@total-typescript/shoehorn'
import { assert, describe, expect, it, vi } from 'vitest'

import type Load3d from '@comfyorg/viewport3d/load3d/Load3d'
import { useToast } from '@/components/ui/toast/toastStore'
import { useLoad3dService } from '@/extensions/core/load3d/services/load3dService'
import { t } from '@/i18n'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IContextMenuValue } from '@/lib/litegraph/src/types/contextMenu'

import {
  createExportMenuItems,
  createNodeExportMenuItems
} from './exportMenuHelper'

vi.mock(import('@/i18n'))

function makeLoad3d(
  exportModel: Load3d['exportModel'] = vi.fn().mockResolvedValue(undefined)
): Load3d {
  return fromPartial<Load3d>({ exportModel, isSplatModel: () => false })
}

function exportChildren(items: (IContextMenuValue | null)[]) {
  const save = items.find((item) => item?.content === 'Save')
  assert.exists(save?.submenu)
  return save.submenu.options.filter(
    (item): item is IContextMenuValue =>
      item !== null && typeof item !== 'string'
  )
}

describe('createExportMenuItems', () => {
  it('declares all export formats without starting an export', () => {
    const exportModel = vi.fn().mockResolvedValue(undefined)
    const items = createExportMenuItems(makeLoad3d(exportModel))

    expect(items[0]).toBeNull()
    expect(items).toHaveLength(2)
    expect(items[1]).toMatchObject({ content: 'Save', has_submenu: true })
    expect(items[1]?.callback).toBeUndefined()
    expect(exportChildren(items).map((item) => item.content)).toEqual([
      'GLB',
      'OBJ',
      'STL',
      'FBX'
    ])
    expect(exportModel).not.toHaveBeenCalled()
    expect(useToast().toasts).toEqual([])
  })

  it.for([
    ['GLB', 'glb'],
    ['OBJ', 'obj'],
    ['STL', 'stl'],
    ['FBX', 'fbx']
  ])(
    'exports %s only when selected and reports completion',
    async ([label, value]) => {
      let completeExport: (() => void) | undefined
      const completion = new Promise<void>((resolve) => {
        completeExport = resolve
      })
      const exportModel = vi.fn(() => completion)
      const items = createExportMenuItems(makeLoad3d(exportModel))
      const item = exportChildren(items).find((item) => item.content === label)
      assert.exists(item?.callback)

      void item.callback.call(document.createElement('div'))

      expect(exportModel).toHaveBeenCalledExactlyOnceWith(value)
      expect(useToast().toasts).toEqual([])
      assert.exists(completeExport)
      completeExport()
      await vi.waitFor(() =>
        expect(useToast().toasts).toEqual([
          expect.objectContaining({
            kind: 'success',
            title: 'toastMessages.exportSuccess'
          })
        ])
      )
      expect(t).toHaveBeenCalledWith('toastMessages.exportSuccess', {
        format: label
      })
    }
  )

  it('shows a warning toast and logs when exportModel rejects', async () => {
    const error = new Error('boom')
    const exportModel = vi.fn().mockRejectedValue(error)
    const items = createExportMenuItems(makeLoad3d(exportModel))
    const glb = exportChildren(items).find((item) => item.content === 'GLB')
    assert.exists(glb?.callback)

    void glb.callback.call(document.createElement('div'))

    await vi.waitFor(() =>
      expect(useToast().toasts).toEqual([
        expect.objectContaining({
          kind: 'warning',
          title: 'toastMessages.failedToExportModel'
        })
      ])
    )
    expect(t).toHaveBeenCalledWith('toastMessages.failedToExportModel', {
      format: 'GLB'
    })
    expect(console.error).toHaveBeenCalledWith('Export failed:', error)
  })
})

describe('createNodeExportMenuItems', () => {
  it('omits exports when no viewer is available', () => {
    vi.spyOn(useLoad3dService(), 'getLoad3d').mockReturnValue(null)

    expect(createNodeExportMenuItems(new LGraphNode('Load3D'))).toEqual([])
  })

  it('omits exports for splat models', () => {
    const load3d = makeLoad3d()
    vi.spyOn(load3d, 'isSplatModel').mockReturnValue(true)
    vi.spyOn(useLoad3dService(), 'getLoad3d').mockReturnValue(load3d)

    expect(createNodeExportMenuItems(new LGraphNode('Load3D'))).toEqual([])
  })

  it('declares exports for an available non-splat viewer', () => {
    vi.spyOn(useLoad3dService(), 'getLoad3d').mockReturnValue(makeLoad3d())

    expect(
      exportChildren(createNodeExportMenuItems(new LGraphNode('Load3D'))).map(
        (item) => item.content
      )
    ).toEqual(['GLB', 'OBJ', 'STL', 'FBX'])
  })
})
