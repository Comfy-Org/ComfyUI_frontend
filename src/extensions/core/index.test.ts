import { describe, expect, it } from 'vitest'

import { useExtensionStore } from '@/stores/extensionStore'

const coreModules = import.meta.glob(['./*.ts', '!./*.test.ts'])

const registeredNames = () =>
  useExtensionStore().extensions.map((extension) => extension.name)

describe('core extensions', () => {
  it.for(Object.keys(coreModules))(
    'importing %s registers nothing',
    { timeout: 30_000 },
    async (path) => {
      await coreModules[path]()

      expect(registeredNames()).toEqual([])
    }
  )

  it('registers the core extensions once, in their fixed order', async () => {
    const { registerCoreExtensions } = await import('./index')

    await registerCoreExtensions()
    await registerCoreExtensions()

    expect(registeredNames()).toEqual([
      'Comfy.Clipspace',
      'Comfy.ContextMenuFilter',
      'Comfy.CreateBoundingBoxes',
      'Comfy.CustomWidgets',
      'Comfy.DynamicPrompts',
      'Comfy.EditAttention',
      'Comfy.WidgetInputs',
      'Comfy.GroupNode',
      'Comfy.GroupOptions',
      'Comfy.ImageCompare',
      'Comfy.ImageCompositor',
      'Comfy.ImageCrop',
      'Comfy.LayerEditor',
      'Comfy.Load3DLazy',
      'Comfy.MaskEditor',
      'Comfy.NoteNode',
      'Comfy.Painter',
      'Comfy.PreviewAny',
      'Comfy.saveText',
      'Comfy.RerouteNode',
      'Comfy.SaveImageExtraOutput',
      'Comfy.SelectionBorder',
      'Comfy.SimpleTouchSupport',
      'Comfy.SlotDefaults',
      'Comfy.AudioWidget',
      'Comfy.UploadAudio',
      'Comfy.RecordAudio',
      'Comfy.UploadImage',
      'Comfy.WebcamCapture',
      'Comfy.NodeTemplates',
      'Comfy.AgentPanel'
    ])
  })
})
