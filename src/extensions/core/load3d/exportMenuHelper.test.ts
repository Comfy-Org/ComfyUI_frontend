import { describe, expect, it, vi } from 'vitest'

import { t } from '@/i18n'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'

import type Load3d from './Load3d'
import { createExportMenuItems } from './exportMenuHelper'

const { contextMenuMock } = vi.hoisted(() => ({
  contextMenuMock: vi.fn()
}))

vi.mock(import('@/i18n'))

vi.mock(import('@/lib/litegraph/src/litegraph'), { spy: true })

class MockContextMenu {
  constructor(...args: unknown[]) {
    contextMenuMock(...args)
  }
}

fromAny<{ ContextMenu: unknown }, unknown>(LiteGraph).ContextMenu =
  MockContextMenu

function makeLoad3d(
  exportImpl: (format: string) => Promise<void> = vi
    .fn()
    .mockResolvedValue(undefined)
): Load3d {
  return fromAny<Load3d, unknown>({ exportModel: exportImpl })
}

describe('createExportMenuItems', () => {
  it('returns a separator followed by a Save submenu', () => {
    const items = createExportMenuItems(makeLoad3d())

    expect(items).toHaveLength(2)
    expect(items[0]).toBeNull()
    expect(items[1]).toMatchObject({
      content: 'Save',
      has_submenu: true
    })
  })

  it('opens a submenu with GLB, OBJ, STL when the Save item is invoked', () => {
    const items = createExportMenuItems(makeLoad3d())
    const saveItem = items[1]!

    ;(saveItem.callback as (...args: unknown[]) => void)(
      undefined,
      {},
      undefined,
      undefined
    )

    expect(contextMenuMock).toHaveBeenCalledOnce()
    const submenuOptions = contextMenuMock.mock.calls[0][0]
    expect(submenuOptions.map((o: { content: string }) => o.content)).toEqual([
      'GLB',
      'OBJ',
      'STL',
      'FBX'
    ])
  })

  it('forwards the parent menu and event when opening the submenu', () => {
    const items = createExportMenuItems(makeLoad3d())
    const event = fromAny<MouseEvent, unknown>({ x: 100 })
    const parentMenu = { id: 'prev' }

    ;(items[1]!.callback as (...args: unknown[]) => void)(
      undefined,
      {},
      event,
      parentMenu
    )

    expect(contextMenuMock).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ event, parentMenu })
    )
  })

  it.for<[label: string, value: string]>([
    ['GLB', 'glb'],
    ['OBJ', 'obj'],
    ['STL', 'stl']
  ])(
    'invokes load3d.exportModel(%s) and shows a success toast when the %s submenu item is clicked',
    async ([label, value]) => {
      const exportModel = vi.fn().mockResolvedValue(undefined)
      const items = createExportMenuItems(makeLoad3d(exportModel))
      ;(items[1]!.callback as (...args: unknown[]) => void)(
        undefined,
        {},
        undefined,
        undefined
      )
      const submenuOptions = contextMenuMock.mock.calls[0][0]
      const item = submenuOptions.find(
        (o: { content: string }) => o.content === label
      )

      item.callback()
      await vi.waitFor(() => expect(exportModel).toHaveBeenCalledWith(value))
      await vi.waitFor(() =>
        expect(useToastStore().add).toHaveBeenCalledWith(
          expect.objectContaining({
            severity: 'success',
            summary: 'toastMessages.exportSuccess'
          })
        )
      )
      expect(t).toHaveBeenCalledWith('toastMessages.exportSuccess', {
        format: label
      })
      expect(useToastStore().addAlert).not.toHaveBeenCalled()
    }
  )

  it('shows an alert toast and logs when exportModel rejects', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const exportModel = vi.fn().mockRejectedValue(new Error('boom'))
    const items = createExportMenuItems(makeLoad3d(exportModel))
    ;(items[1]!.callback as (...args: unknown[]) => void)(
      undefined,
      {},
      undefined,
      undefined
    )
    const glb = contextMenuMock.mock.calls[0][0].find(
      (o: { content: string }) => o.content === 'GLB'
    )

    glb.callback()

    await vi.waitFor(() =>
      expect(useToastStore().addAlert).toHaveBeenCalledWith(
        'toastMessages.failedToExportModel'
      )
    )
    expect(t).toHaveBeenCalledWith('toastMessages.failedToExportModel', {
      format: 'GLB'
    })
    expect(consoleError).toHaveBeenCalledWith(
      'Export failed:',
      expect.any(Error)
    )
    expect(useToastStore().add).not.toHaveBeenCalled()
  })
})
