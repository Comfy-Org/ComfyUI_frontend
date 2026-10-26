import { fromAny } from '@total-typescript/shoehorn'
import { describe, expect, it } from 'vitest'

import { load3dWidgets } from '@/extensions/core/load3d/load3dWidgets'
import {
  audioWidgetExtension,
  recordAudioExtension
} from '@/extensions/core/uploadAudio'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { proveWidgetForm } from '@/lib/litegraph/src/node/widgetFormProof'
import type { WidgetFormRefusal } from '@/lib/litegraph/src/node/widgetFormProof'
import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useImageUploadWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useImageUploadWidget'
// Installs LGraphNode.prototype.addDOMWidget, which the audio widget constructors call.
import '@/scripts/domWidget'

/**
 * What {@link proveWidgetForm} returns for DOM widgets, driven through the shipped widget
 * constructors rather than hand-built widget objects: `LOAD_3D`, `PREVIEW_3D`, `AUDIO_UI` and
 * `IMAGEUPLOAD`, plus `AUDIO_RECORD` because it is the one that collides.
 *
 * Every assertion below pins which widgets occupy a positional slot, which is the thing three
 * systems reconstruct independently today. The flag trap is the whole game: `widget.serialize`
 * governs `widgets_values`, `widget.options.serialize` governs the API prompt ONLY, and
 * `addWidget` does not hoist the options-bag flag — so a widget flagged only there DOES occupy a
 * slot. A form built from the wrong flag comes out a slot short and silently shifts every value
 * after it.
 *
 * The invariant is one-directional — either no form, or a form that agrees; never a form that
 * disagrees — so a `provable: false` here is a pass, not a limitation. Subgraph hosts are the
 * other three cases and live in `src/lib/litegraph/src/node/widgetFormProof.subgraph.test.ts`.
 */

interface CapturedSerialization {
  final: ISerialisedNode
  /** `widgets_values` as core produced it, observed from inside the extension serialize hook. */
  atCoreSite: unknown
  widgetsAtCoreSite: readonly IBaseWidget[] | undefined
}

function serializeWithCapture(node: LGraphNode): CapturedSerialization {
  let atCoreSite: unknown
  let widgetsAtCoreSite: readonly IBaseWidget[] | undefined
  const previous = node.onSerialize
  node.onSerialize = function (data: ISerialisedNode) {
    atCoreSite = data.widgets_values
    widgetsAtCoreSite = this.widgets
    previous?.call(this, data)
  }
  try {
    return { final: node.serialize(), atCoreSite, widgetsAtCoreSite }
  } finally {
    node.onSerialize = previous
  }
}

function proveSerialization(node: LGraphNode) {
  const captured = serializeWithCapture(node)
  return {
    values: captured.final.widgets_values,
    proof: proveWidgetForm(
      captured.widgetsAtCoreSite,
      captured.final,
      captured.atCoreSite,
      { serializeWidgets: node.serialize_widgets }
    )
  }
}

/**
 * The exact shape a refusal must have. Typing the reason as `WidgetFormRefusal` means a renamed
 * or deleted refusal fails typecheck here instead of silently becoming an unasserted string.
 */
function refusal(reason: WidgetFormRefusal) {
  return { provable: false, refusal: reason, order: null }
}

/**
 * A node as `litegraphService` registers one: `serialize_widgets = true` is set in the generated
 * `ComfyNode` constructor, and nothing in litegraph sets it, so a bare `LGraphNode` writes no
 * values at all and every case below would refuse for the uninteresting reason.
 */
function registeredNode(title: string): LGraphNode {
  const node = new LGraphNode(title)
  node.serialize_widgets = true
  return node
}

describe('case 4 — DOM widgets', () => {
  it('proves PREVIEW_3D, whose viewport widget occupies a slot', () => {
    // The viewport widget is a ComponentWidgetImpl built with `options: { hideInPanel: true }`
    // and no serialize flag of either spelling, so it serializes.
    const node = registeredNode('Preview3D')
    load3dWidgets.PREVIEW_3D(node, 'image', ['PREVIEW_3D', {}], fromAny({}))

    expect(proveSerialization(node)).toEqual({
      values: [''],
      proof: { provable: true, refusal: null, order: ['image'] }
    })
  })

  it('proves LOAD_3D, counting its three unflagged buttons', () => {
    // `addModelFileButtons` adds three button widgets with NO options bag at all, so each
    // occupies a positional slot and serializes its callback-name string. A form describing only
    // `model_file` and the viewport would be two slots short of this array.
    const node = registeredNode('Load3D')
    node.addWidget('combo', 'model_file', 'a.glb', () => {}, {
      values: ['a.glb']
    })
    load3dWidgets.LOAD_3D(node, 'image', ['LOAD_3D', {}], fromAny({}))

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
    // The button is created with `{ serialize: false }` in the OPTIONS bag, which `addWidget`
    // does not hoist, so it occupies a slot -- the measured reason every LoadImage serializes 2
    // values. A form built from `options.serialize` would be one slot short and would address
    // the button's value as `image`.
    const node = registeredNode('LoadImage')
    node.addWidget('combo', 'image', 'x.png', () => {}, { values: ['x.png'] })
    useImageUploadWidget()(
      node,
      'upload',
      ['IMAGEUPLOAD', { imageInputName: 'image' }],
      fromAny({})
    )

    const uploadWidget = node.widgets?.at(-1)
    expect(uploadWidget?.serialize).toBeUndefined()
    expect(uploadWidget?.options.serialize).toBe(false)

    expect(proveSerialization(node)).toEqual({
      values: ['x.png', 'image'],
      proof: { provable: true, refusal: null, order: ['image', 'upload'] }
    })
  })

  it('excludes the AUDIO_UI player, which is flagged on the widget itself', () => {
    // AUDIO_UI sets BOTH spellings: `serialize = false` on the widget (out of widgets_values) and
    // `options.serialize = false` (out of the API prompt). The upload button beside it is created
    // the way AUDIOUPLOAD creates it -- `{ serialize: false }` in the options bag only -- because
    // that constructor also reads `app.rootGraph.id` and cannot run without a booted app.
    const node = registeredNode('LoadAudio')
    // AUDIO_UI reads `node.constructor.nodeData.output_node` and throws without it. A registered
    // ComfyNode carries it on the generated subclass; here it is the only static the constructor
    // is asked for.
    Object.defineProperty(node, 'constructor', {
      value: fromAny({ nodeData: { output_node: false } }),
      configurable: true
    })
    node.addWidget('combo', 'audio', 'a.mp3', () => {}, { values: ['a.mp3'] })
    const audioWidgets = audioWidgetExtension.getCustomWidgets?.(fromAny({}))
    if (typeof audioWidgets !== 'object' || audioWidgets instanceof Promise)
      throw new TypeError('AUDIO_UI widget constructor unavailable')
    audioWidgets.AUDIO_UI(node, 'audioUI', ['AUDIO_UI', {}], fromAny({}))
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

  it('refuses AUDIO_RECORD, whose player and button share one name', () => {
    // The constructor adds a DOM widget named after the input and then a button with the SAME
    // name, and neither is excluded: the player sets no `serialize` flag at all (unlike AUDIO_UI)
    // and the button is options-bag-flagged only. Two slots, one name. The named projection
    // collapses them via defineProperty and the document rejects the second address, so listing
    // both would promise an address that does not resolve.
    const node = registeredNode('RecordAudio')
    const recordWidgets = recordAudioExtension.getCustomWidgets?.(fromAny({}))
    if (typeof recordWidgets !== 'object' || recordWidgets instanceof Promise)
      throw new TypeError('AUDIO_RECORD widget constructor unavailable')
    recordWidgets.AUDIO_RECORD(node, 'audio', ['AUDIO_RECORD', {}], fromAny({}))

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
