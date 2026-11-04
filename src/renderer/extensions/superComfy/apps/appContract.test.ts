import type { InputSpec as InputSpecV2 } from '@comfyorg/object-info-parser/schemas/nodeDefSchemaV2'
import { describe, expect, it } from 'vitest'

import type { LinearData } from '@/platform/workflow/management/stores/comfyWorkflow'
import {
  classifyAppInput,
  classifyAppOutput,
  deriveAppContract
} from '@/renderer/extensions/superComfy/apps/appContract'
import type {
  AppWidgetResolver,
  ResolvedAppOutput,
  ResolvedAppWidget
} from '@/renderer/extensions/superComfy/apps/appWidgetResolver'

const GRAPH_ID = '3f2a9c1e-5b7d-4e8f-9a0b-1c2d3e4f5a6b'

const IMAGE_UPLOAD: InputSpecV2 = {
  type: 'COMBO',
  name: 'image',
  options: ['example.png'],
  image_upload: true
}

const SAVE_IMAGE: ResolvedAppOutput = {
  nodeId: '9',
  nodeType: 'SaveImage',
  label: 'Save Image',
  inputTypes: ['IMAGE']
}

function widget(
  nodeType: string,
  spec: InputSpecV2 | undefined,
  overrides: Partial<ResolvedAppWidget> = {}
): ResolvedAppWidget {
  return {
    nodeType,
    mode: 'always',
    linked: false,
    label: spec?.name ?? 'value',
    value: undefined,
    spec,
    ...overrides
  }
}

function resolverOf(
  widgets: Record<string, ResolvedAppWidget>,
  outputs: readonly ResolvedAppOutput[] = [SAVE_IMAGE]
): AppWidgetResolver {
  const widgetsByTarget = new Map(Object.entries(widgets))
  const outputsById = new Map(outputs.map((output) => [output.nodeId, output]))
  return {
    widget: (nodeId, widgetName) =>
      widgetsByTarget.get(`${nodeId}/${widgetName}`) ?? null,
    output: (nodeId) => outputsById.get(nodeId) ?? null
  }
}

describe('classifyAppInput', () => {
  it.for([
    {
      name: 'an image upload combo becomes an image socket',
      nodeType: 'LoadImage',
      spec: IMAGE_UPLOAD,
      expected: { as: 'port', modality: 'image' }
    },
    {
      name: 'an animated image upload combo becomes an image socket',
      nodeType: 'LoadImageAnimated',
      spec: { type: 'COMBO', name: 'image', animated_image_upload: true },
      expected: { as: 'port', modality: 'image' }
    },
    {
      name: 'a video upload combo becomes a video socket',
      nodeType: 'LoadVideo',
      spec: { type: 'COMBO', name: 'file', video_upload: true },
      expected: { as: 'port', modality: 'video' }
    },
    {
      name: 'an audio upload combo becomes an audio socket',
      nodeType: 'LoadAudio',
      spec: { type: 'COMBO', name: 'audio', audio_upload: true },
      expected: { as: 'port', modality: 'audio' }
    },
    {
      name: 'a mesh upload combo becomes a 3D socket',
      nodeType: 'CustomMeshLoader',
      spec: { type: 'COMBO', name: 'mesh', mesh_upload: true },
      expected: { as: 'port', modality: '3d' }
    },
    {
      name: 'a combo on a Load3D loader becomes a 3D socket',
      nodeType: 'Load3D',
      spec: { type: 'COMBO', name: 'model_file', options: ['a.glb'] },
      expected: { as: 'port', modality: '3d' }
    },
    {
      name: 'a combo on a 3D result viewer stays a select',
      nodeType: 'Preview3D',
      spec: { type: 'COMBO', name: 'view', options: ['front', 'side'] },
      expected: {
        as: 'setting',
        setting: { control: 'select', options: ['front', 'side'] }
      }
    },
    {
      name: 'a STRING widget becomes inline text',
      nodeType: 'CLIPTextEncode',
      spec: { type: 'STRING', name: 'text', multiline: true },
      expected: { as: 'text' }
    },
    {
      name: 'an INT widget becomes an integer setting with its bounds',
      nodeType: 'KSampler',
      spec: { type: 'INT', name: 'steps', min: 1, max: 150, step: 1 },
      expected: {
        as: 'setting',
        setting: { control: 'number', integer: true, min: 1, max: 150, step: 1 }
      }
    },
    {
      name: 'a FLOAT widget becomes a decimal setting with its bounds',
      nodeType: 'KSampler',
      spec: { type: 'FLOAT', name: 'cfg', min: 0, max: 30, step: 0.5 },
      expected: {
        as: 'setting',
        setting: {
          control: 'number',
          integer: false,
          min: 0,
          max: 30,
          step: 0.5
        }
      }
    },
    {
      name: 'a BOOLEAN widget becomes a toggle',
      nodeType: 'ImageScale',
      spec: { type: 'BOOLEAN', name: 'crop' },
      expected: { as: 'setting', setting: { control: 'toggle' } }
    },
    {
      name: 'a plain combo becomes a select over its options',
      nodeType: 'KSampler',
      spec: { type: 'COMBO', name: 'sampler_name', options: ['euler', 'dpm'] },
      expected: {
        as: 'setting',
        setting: { control: 'select', options: ['euler', 'dpm'] }
      }
    },
    {
      name: 'a combo with no options is unsupported',
      nodeType: 'RemoteModelPicker',
      spec: { type: 'COMBO', name: 'model' },
      expected: { as: 'unsupported' }
    },
    {
      name: 'a socket-only type is unsupported',
      nodeType: 'ImageBlend',
      spec: { type: 'IMAGE', name: 'image2' },
      expected: { as: 'unsupported' }
    },
    {
      name: 'a widget without a spec is unsupported',
      nodeType: 'KSampler',
      spec: undefined,
      expected: { as: 'unsupported' }
    }
  ])('$name', ({ nodeType, spec, expected }) => {
    expect(classifyAppInput(nodeType, spec)).toEqual(expected)
  })
})

describe('classifyAppOutput', () => {
  it.for([
    { nodeType: 'SaveImage', inputTypes: ['IMAGE'], expected: 'image' },
    { nodeType: 'PreviewImage', inputTypes: ['IMAGE'], expected: 'image' },
    { nodeType: 'SaveVideo', inputTypes: ['VIDEO'], expected: 'video' },
    { nodeType: 'SaveAudio', inputTypes: ['AUDIO'], expected: 'audio' },
    { nodeType: 'PreviewAny', inputTypes: ['*'], expected: 'text' },
    { nodeType: 'Preview3D', inputTypes: [], expected: '3d' },
    { nodeType: 'SaveGLB', inputTypes: ['MESH'], expected: '3d' },
    { nodeType: 'VHS_VideoCombine', inputTypes: ['VIDEO'], expected: 'video' },
    {
      nodeType: 'ShowImageAndText',
      inputTypes: ['STRING', 'IMAGE'],
      expected: 'image'
    },
    { nodeType: 'ShowText', inputTypes: ['STRING'], expected: 'text' },
    { nodeType: 'PreviewLatent', inputTypes: ['LATENT'], expected: null }
  ])(
    '$nodeType with $inputTypes is $expected',
    ({ nodeType, inputTypes, expected }) => {
      expect(
        classifyAppOutput({
          nodeId: '1',
          nodeType,
          label: nodeType,
          inputTypes
        })
      ).toBe(expected)
    }
  )
})

describe('deriveAppContract', () => {
  it('maps an app to media sockets, inline text, settings and outputs', () => {
    const linearData: LinearData = {
      inputs: [
        [`${GRAPH_ID}:10:image`, 'image'],
        [`${GRAPH_ID}:6:text`, 'text', { description: 'Prompt' }],
        [`${GRAPH_ID}:3:seed`, 'seed'],
        ['3', 'cfg'],
        [`${GRAPH_ID}:3:sampler_name`, 'sampler_name'],
        [`${GRAPH_ID}:14:crop`, 'crop'],
        ['99', 'steps']
      ],
      outputs: ['9', 20]
    }
    const resolver = resolverOf(
      {
        '10/image': widget('LoadImage', IMAGE_UPLOAD, {
          label: 'Photo',
          value: 'portrait.png'
        }),
        '6/text': widget(
          'CLIPTextEncode',
          { type: 'STRING', name: 'text', multiline: true },
          { value: 'a cat in a hat' }
        ),
        '3/seed': widget(
          'KSampler',
          { type: 'INT', name: 'seed', min: 0, max: 1000 },
          { value: 42 }
        ),
        '3/cfg': widget(
          'KSampler',
          { type: 'FLOAT', name: 'cfg', min: 0, max: 30, step: 0.5 },
          { value: 7.5 }
        ),
        '3/sampler_name': widget(
          'KSampler',
          { type: 'COMBO', name: 'sampler_name', options: ['euler', 'dpm'] },
          { value: 'dpm' }
        ),
        '14/crop': widget(
          'ImageScale',
          { type: 'BOOLEAN', name: 'crop' },
          { value: true }
        )
      },
      [
        SAVE_IMAGE,
        {
          nodeId: '20',
          nodeType: 'PreviewAny',
          label: 'Caption',
          inputTypes: ['*']
        }
      ]
    )

    expect(deriveAppContract(linearData, resolver, 1700)).toEqual({
      ok: true,
      contract: {
        version: 1700,
        inputs: [
          {
            name: 'in:10:image',
            label: 'Photo',
            modality: 'image',
            required: true,
            multi: false,
            target: { nodeId: '10', widgetName: 'image' }
          },
          {
            name: 'in:6:text',
            label: 'Prompt',
            modality: 'text',
            required: false,
            multi: false,
            inline: true,
            default: 'a cat in a hat',
            target: { nodeId: '6', widgetName: 'text' }
          }
        ],
        outputs: [
          {
            name: 'out:9',
            label: 'Save Image',
            modality: 'image',
            required: false,
            multi: false,
            outputNodeId: '9'
          },
          {
            name: 'out:20',
            label: 'Caption',
            modality: 'text',
            required: false,
            multi: false,
            outputNodeId: '20'
          }
        ],
        settings: [
          {
            control: 'number',
            name: '3:seed',
            label: 'seed',
            integer: true,
            min: 0,
            max: 1000,
            default: 42,
            required: false,
            target: { nodeId: '3', widgetName: 'seed' }
          },
          {
            control: 'number',
            name: '3:cfg',
            label: 'cfg',
            integer: false,
            min: 0,
            max: 30,
            step: 0.5,
            default: 7.5,
            required: false,
            target: { nodeId: '3', widgetName: 'cfg' }
          },
          {
            control: 'select',
            name: '3:sampler_name',
            label: 'sampler_name',
            options: ['euler', 'dpm'],
            default: 'dpm',
            required: false,
            target: { nodeId: '3', widgetName: 'sampler_name' }
          },
          {
            control: 'toggle',
            name: '14:crop',
            label: 'crop',
            default: true,
            required: false,
            target: { nodeId: '14', widgetName: 'crop' }
          }
        ],
        dropped: 1
      }
    })
  })

  it.for<{ name: string; widgets: Record<string, ResolvedAppWidget> }>([
    {
      name: 'a widget that no longer resolves',
      widgets: {}
    },
    {
      name: 'a widget on a bypassed node',
      widgets: {
        '3/steps': widget(
          'KSampler',
          { type: 'INT', name: 'steps' },
          { mode: 'other' }
        )
      }
    },
    {
      name: 'a widget fed by a link',
      widgets: {
        '3/steps': widget(
          'KSampler',
          { type: 'INT', name: 'steps' },
          { linked: true }
        )
      }
    },
    {
      name: 'a widget of an unsupported type',
      widgets: {
        '3/steps': widget('KSampler', { type: 'CURVE', name: 'steps' })
      }
    }
  ])('drops and counts $name', ({ widgets }) => {
    const outcome = deriveAppContract(
      { inputs: [[`${GRAPH_ID}:3:steps`, 'steps']], outputs: ['9'] },
      resolverOf(widgets),
      1
    )

    expect(outcome).toMatchObject({
      ok: true,
      contract: { inputs: [], settings: [], dropped: 1 }
    })
  })

  it.for([
    { name: 'a WidgetId', id: `${GRAPH_ID}:12:steps` },
    { name: 'a WidgetId from a stale graph id', id: 'old-graph:12:steps' },
    { name: 'a plain legacy node id', id: '12' },
    { name: 'a numeric legacy node id', id: 12 }
  ])('targets the node named by $name', ({ id }) => {
    const outcome = deriveAppContract(
      { inputs: [[id, 'steps']], outputs: ['9'] },
      resolverOf({
        '12/steps': widget('KSampler', { type: 'INT', name: 'steps' })
      }),
      1
    )

    expect(outcome).toMatchObject({
      ok: true,
      contract: {
        settings: [
          { name: '12:steps', target: { nodeId: '12', widgetName: 'steps' } }
        ]
      }
    })
  })

  it('keeps one entry when the same widget is listed twice', () => {
    const outcome = deriveAppContract(
      {
        inputs: [
          [`${GRAPH_ID}:12:steps`, 'steps'],
          ['12', 'steps']
        ],
        outputs: ['9']
      },
      resolverOf({
        '12/steps': widget('KSampler', { type: 'INT', name: 'steps' })
      }),
      1
    )

    expect(outcome).toMatchObject({
      ok: true,
      contract: { settings: [{ name: '12:steps' }], dropped: 0 }
    })
  })

  it('suffixes duplicate labels with their node id', () => {
    const outcome = deriveAppContract(
      {
        inputs: [
          ['3', 'seed'],
          ['7', 'seed']
        ],
        outputs: ['9']
      },
      resolverOf({
        '3/seed': widget('KSampler', { type: 'INT', name: 'seed' }),
        '7/seed': widget('KSampler', { type: 'INT', name: 'seed' })
      }),
      1
    )

    expect(outcome).toMatchObject({
      ok: true,
      contract: {
        settings: [{ label: 'seed (#3)' }, { label: 'seed (#7)' }]
      }
    })
  })

  it('skips and counts outputs it cannot resolve or classify', () => {
    const outcome = deriveAppContract(
      { inputs: [], outputs: ['9', '30', '31'] },
      resolverOf({}, [
        SAVE_IMAGE,
        {
          nodeId: '30',
          nodeType: 'PreviewLatent',
          label: 'Latent',
          inputTypes: ['LATENT']
        }
      ]),
      1
    )

    expect(outcome).toMatchObject({
      ok: true,
      contract: { outputs: [{ name: 'out:9' }], dropped: 2 }
    })
  })

  it('refuses an app without usable outputs', () => {
    expect(
      deriveAppContract(
        { inputs: [['3', 'seed']], outputs: [] },
        resolverOf({
          '3/seed': widget('KSampler', { type: 'INT', name: 'seed' })
        }),
        1
      )
    ).toEqual({ ok: false, reason: 'noOutputs' })
  })
})
