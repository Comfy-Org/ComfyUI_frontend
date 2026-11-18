import { fromPartial } from '@total-typescript/shoehorn'
import { assert, describe, expect, it, vi } from 'vitest'

import { load3dWidgets } from '@/extensions/core/load3d/load3dWidgets'
import {
  audioWidgetExtension,
  recordAudioExtension
} from '@/extensions/core/uploadAudio'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { LGraphNodeConstructor } from '@/lib/litegraph/src/litegraph'
import {
  coreIsLastWriter,
  serializeWithCapture
} from '@/lib/litegraph/src/widgets/__fixtures__/widgetFormProofHarness'
import { proveWidgetForm } from '@/lib/litegraph/src/widgets/widgetFormProof'
import type { WidgetFormProof } from '@/lib/litegraph/src/widgets/widgetFormProof'
import { useImageUploadWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useImageUploadWidget'
import type { ComfyApp } from '@/scripts/app'
import '@/scripts/domWidget'

const noApp = () => fromPartial<ComfyApp>({})

function proveSerialization(node: LGraphNode) {
  const captured = serializeWithCapture(node)
  return {
    values: captured.final.widgets_values,
    proof: proveWidgetForm(
      captured.widgetsAtCoreSite,
      captured.final,
      captured.atCoreSite,
      {
        serializeWidgets: node.serialize_widgets,
        replayed: false,
        coreIsLastWriter: coreIsLastWriter(node)
      }
    )
  }
}

function refusal(reason: NonNullable<WidgetFormProof['refusal']>) {
  return { provable: false, refusal: reason, order: null }
}

function registeredNode(title: string): LGraphNode {
  const node = new LGraphNode(title)
  node.serialize_widgets = true
  return node
}

describe('case 4 — DOM widgets', () => {
  it('proves PREVIEW_3D, whose viewport widget occupies a slot', () => {
    const node = registeredNode('Preview3D')
    load3dWidgets.PREVIEW_3D(node, 'image', ['PREVIEW_3D', {}], noApp())

    expect(proveSerialization(node)).toEqual({
      values: [''],
      proof: { provable: true, refusal: null, order: ['image'] }
    })
  })

  it('proves LOAD_3D, counting its three unflagged buttons', () => {
    const node = registeredNode('Load3D')
    node.addWidget('combo', 'model_file', 'a.glb', () => {}, {
      values: ['a.glb']
    })
    load3dWidgets.LOAD_3D(node, 'image', ['LOAD_3D', {}], noApp())

    expect(proveSerialization(node)).toEqual({
      values: ['a.glb', 'upload3dmodel', 'uploadExtraResources', 'clear', ''],
      proof: {
        provable: true,
        refusal: null,
        order: [
          'model_file',
          'upload 3d model',
          'upload extra resources',
          'clear',
          'image'
        ]
      }
    })
  })

  it('proves IMAGEUPLOAD at two slots, because the upload button is options-bag-flagged', () => {
    const node = registeredNode('LoadImage')
    node.addWidget('combo', 'image', 'x.png', () => {}, { values: ['x.png'] })
    vi.stubGlobal('requestAnimationFrame', vi.fn())
    useImageUploadWidget()(
      node,
      'upload',
      ['IMAGEUPLOAD', { imageInputName: 'image' }],
      noApp()
    )

    const uploadWidget = node.widgets?.at(-1)
    expect(uploadWidget?.serialize).toBeUndefined()
    expect(uploadWidget?.options.serialize).toBe(false)

    expect(proveSerialization(node)).toEqual({
      values: ['x.png', 'image'],
      proof: { provable: true, refusal: null, order: ['image', 'upload'] }
    })
  })

  it('excludes the AUDIO_UI player, which is flagged on the widget itself', async () => {
    const node = registeredNode('LoadAudio')
    Object.defineProperty(node, 'constructor', {
      value: fromPartial<LGraphNodeConstructor>({
        nodeData: { output_node: false }
      }),
      configurable: true
    })
    node.addWidget('combo', 'audio', 'a.mp3', () => {}, { values: ['a.mp3'] })
    const audioWidgets = await audioWidgetExtension.getCustomWidgets?.(noApp())
    assert.exists(audioWidgets)
    audioWidgets.AUDIO_UI(node, 'audioUI', ['AUDIO_UI', {}], noApp())
    node.addWidget('button', 'upload', '', () => {}, { serialize: false })

    expect(
      node.widgets?.map((widget) => [
        widget.name,
        widget.serialize,
        widget.options.serialize
      ])
    ).toEqual([
      ['audio', undefined, undefined],
      ['audioUI', false, false],
      ['upload', undefined, false]
    ])

    expect(proveSerialization(node)).toEqual({
      values: ['a.mp3', ''],
      proof: { provable: true, refusal: null, order: ['audio', 'upload'] }
    })
  })

  it('refuses AUDIO_RECORD, whose player and button share one name', async () => {
    const node = registeredNode('RecordAudio')
    const recordWidgets = await recordAudioExtension.getCustomWidgets?.(noApp())
    assert.exists(recordWidgets)
    recordWidgets.AUDIO_RECORD(node, 'audio', ['AUDIO_RECORD', {}], noApp())

    expect(node.widgets?.map((widget) => widget.name)).toEqual([
      'audio',
      'audio'
    ])
    expect(proveSerialization(node)).toEqual({
      values: ['', ''],
      proof: refusal('duplicate_widget_name')
    })
  })
})
