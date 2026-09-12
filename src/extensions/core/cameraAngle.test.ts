import { describe, expect, it, vi } from 'vitest'

import type { ComfyExtension } from '@/types/comfy'

interface WidgetCtorArgs {
  name: string
  type?: string
  options: {
    serialize?: boolean
    getValue?: () => unknown
    setValue?: (value: unknown) => void
  }
}

const { state } = vi.hoisted(() => ({
  state: {
    extension: null as ComfyExtension | null,
    addWidget: vi.fn(),
    lastCtorArgs: null as WidgetCtorArgs | null
  }
}))

vi.mock('@/services/extensionService', () => ({
  useExtensionService: () => ({
    registerExtension: (ext: ComfyExtension) => {
      state.extension = ext
    }
  })
}))

vi.mock('@/scripts/domWidget', () => ({
  ComponentWidgetImpl: class {
    name: string
    type = 'custom'
    options: WidgetCtorArgs['options']
    constructor(args: WidgetCtorArgs) {
      state.lastCtorArgs = args
      this.name = args.name
      this.options = args.options
    }
    get value() {
      return this.options.getValue?.()
    }
    set value(next: unknown) {
      this.options.setValue?.(next)
    }
  },
  addWidget: state.addWidget
}))

await import('./cameraAngle')

function makeNode(comfyClass: string) {
  return {
    constructor: { comfyClass },
    size: [100, 100] as [number, number],
    setSize: vi.fn()
  }
}

async function createViewWidget() {
  const widgets = await state.extension!.getCustomWidgets!({} as never)
  const build = widgets.CAMERA_ANGLE_VIEW
  if (!build) throw new Error('CAMERA_ANGLE_VIEW widget not registered')
  const result = build(
    makeNode('CameraAngle') as never,
    'view',
    [] as never,
    {} as never
  )
  if (!result) throw new Error('widget was not created')
  const widget = 'name' in result ? result : result.widget
  if (!widget) throw new Error('widget was not created')
  return widget
}

describe('Comfy.CameraAngle extension', () => {
  it('registers a non-prompt view widget that remembers a valid view mode', async () => {
    const widget = await createViewWidget()

    expect(state.addWidget).toHaveBeenCalledWith(expect.anything(), widget)
    expect(state.lastCtorArgs?.options.serialize).toBe(false)
    expect(widget.value).toBe('camera')

    widget.value = 'object'
    expect(widget.value).toBe('object')

    widget.value = 'not-a-mode'
    expect(widget.value).toBe('object')
  })

  it('enlarges CameraAngle nodes only', () => {
    const node = makeNode('CameraAngle')
    const other = makeNode('SomethingElse')

    state.extension!.nodeCreated!(node as never, {} as never)
    state.extension!.nodeCreated!(other as never, {} as never)

    expect(node.setSize).toHaveBeenCalledWith([360, 480])
    expect(other.setSize).not.toHaveBeenCalled()
  })
})
