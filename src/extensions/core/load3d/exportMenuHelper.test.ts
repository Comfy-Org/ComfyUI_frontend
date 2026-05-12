import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type Load3d from './Load3d'
import { createExportMenuItems } from './exportMenuHelper'

const { contextMenuMock, addToastMock, addAlertMock } = vi.hoisted(() => ({
  contextMenuMock: vi.fn(),
  addToastMock: vi.fn(),
  addAlertMock: vi.fn()
}))

vi.mock('@/i18n', () => ({
  t: (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key}:${JSON.stringify(vars)}` : key
}))

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({ add: addToastMock, addAlert: addAlertMock })
}))

vi.mock(import('@/lib/litegraph/src/litegraph'), async (importOriginal) => {
  const actual = await importOriginal()
  class MockContextMenu {
    constructor(...args: unknown[]) {
      contextMenuMock(...args)
    }
  }
  // Replace ContextMenu in-place on the real LiteGraph singleton so consumers
  // that import other members keep getting the real implementations.
  ;(actual.LiteGraph as unknown as { ContextMenu: unknown }).ContextMenu =
    MockContextMenu
  return actual
})

function makeLoad3d(
  exportImpl: (format: string) => Promise<void> = vi
    .fn()
    .mockResolvedValue(undefined)
): Load3d {
  return { exportModel: exportImpl } as unknown as Load3d
}

describe('createExportMenuItems', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

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
      'STL'
    ])
  })

  it('forwards the parent menu and event when opening the submenu', () => {
    const items = createExportMenuItems(makeLoad3d())
    const event = { x: 100 } as unknown as MouseEvent
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

  it.each([
    ['GLB', 'glb'],
    ['OBJ', 'obj'],
    ['STL', 'stl']
  ])(
    'invokes load3d.exportModel(%s) and shows a success toast when the %s submenu item is clicked',
    async (label, value) => {
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
        expect(addToastMock).toHaveBeenCalledWith(
          expect.objectContaining({
            severity: 'success',
            summary: `toastMessages.exportSuccess:${JSON.stringify({ format: label })}`
          })
        )
      )
      expect(addAlertMock).not.toHaveBeenCalled()
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
      expect(addAlertMock).toHaveBeenCalledWith(
        `toastMessages.failedToExportModel:${JSON.stringify({ format: 'GLB' })}`
      )
    )
    expect(consoleError).toHaveBeenCalledWith(
      'Export failed:',
      expect.any(Error)
    )
    expect(addToastMock).not.toHaveBeenCalled()
  })
})
