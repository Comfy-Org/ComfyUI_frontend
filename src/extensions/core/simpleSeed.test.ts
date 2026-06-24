import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useExtensionService } from '@/services/extensionService'

let extension: any = null
vi.spyOn(useExtensionService(), 'registerExtension').mockImplementation((ext) => {
  if (ext.name === 'Comfy.SimpleSeedNode') {
    extension = ext
  }
})

import './simpleSeed'

describe('Comfy.SimpleSeedNode', () => {
  let nodeTypeMock: any
  let nodeDataMock: any

  beforeEach(() => {
    vi.clearAllMocks()
    nodeTypeMock = {
      prototype: {
        onNodeCreated: vi.fn()
      }
    }
    nodeDataMock = {
      name: 'SimpleSeedNode'
    }
  })

  it('hooks into SimpleSeedNode and adds a button widget', async () => {
    expect(extension).toBeDefined()

    if (extension?.beforeRegisterNodeDef) {
      await extension.beforeRegisterNodeDef(nodeTypeMock, nodeDataMock)

      const mockNode = {
        widgets: [
          {
            name: 'seed',
            value: 0,
            options: { min: 10, max: 20, step: 2 },
            callback: vi.fn()
          }
        ],
        size: [100, 100],
        addWidget: vi.fn().mockImplementation((type, name, value, callback) => {
          return { type, name, value, callback }
        }),
        computeSize: vi.fn().mockReturnValue([150, 150]),
        setDirtyCanvas: vi.fn()
      }

      nodeTypeMock.prototype.onNodeCreated.call(mockNode)

      expect(mockNode.addWidget).toHaveBeenCalledWith(
        'button',
        expect.any(String),
        '',
        expect.any(Function),
        { serialize: false }
      )

      const addedButton = (mockNode.addWidget as any).mock.calls[0]
      const buttonCallback = addedButton[3]

      buttonCallback()

      const seedWidget = mockNode.widgets[0]
      expect(seedWidget.value).toBeGreaterThanOrEqual(10)
      expect(seedWidget.value).toBeLessThanOrEqual(20)
      expect(seedWidget.value % 2).toBe(0)
      expect(seedWidget.callback).toHaveBeenCalledWith(seedWidget.value)
    }
  })

  it('warns if seed widget is missing when randomized', async () => {
    if (extension?.beforeRegisterNodeDef) {
      await extension.beforeRegisterNodeDef(nodeTypeMock, nodeDataMock)

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const mockNode = {
        widgets: [],
        size: [100, 100],
        addWidget: vi.fn().mockImplementation((type, name, value, callback) => {
          return { type, name, value, callback }
        }),
        computeSize: vi.fn().mockReturnValue([150, 150])
      }

      nodeTypeMock.prototype.onNodeCreated.call(mockNode)

      const addedButton = (mockNode.addWidget as any).mock.calls[0]
      const buttonCallback = addedButton[3]

      buttonCallback()

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Could not find the 'seed' widget")
      )

      consoleWarnSpy.mockRestore()
    }
  })
})
