import { setActivePinia } from 'pinia'
import { describe, expect, it } from 'vitest'

import { useExtensionStore } from '@/stores/extensionStore'
import { createDisposablePinia } from '@/testing/pinia'

const registeredNames = () =>
  useExtensionStore().extensions.map((extension) => extension.name)

async function namesRegisteredByImporting(loaders: (() => Promise<unknown>)[]) {
  using importScope = createDisposablePinia()
  setActivePinia(importScope.pinia)
  await Promise.all(loaders.map((load) => load()))
  return registeredNames()
}

const namesRegisteredOnImport = await namesRegisteredByImporting(
  Object.values(
    import.meta.glob([
      './*.ts',
      './load3d/*.ts',
      '!./*.test.ts',
      '!./load3d/*.test.ts'
    ])
  )
)
const { registerCoreExtensions } = await import('./index')

describe('core extensions', () => {
  it('registers nothing when their modules are imported', () => {
    expect(namesRegisteredOnImport).toEqual([])
  })

  it('registers the core extensions once, in their fixed order', async () => {
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
