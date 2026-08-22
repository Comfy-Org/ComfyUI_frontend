import { describe, expect, it } from 'vitest'

import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'

import { resolveLinkedWidgetDisplay } from './linkedWidgetDisplay'

const linkedContext = {
  assetApiEnabled: false,
  linked: true,
  useAssetBrowser: false
}

describe('resolveLinkedWidgetDisplay', () => {
  it.for([
    ['text', 'control'],
    ['string', 'control'],
    ['STRING', 'control'],
    ['int', 'control'],
    ['INT', 'control'],
    ['float', 'control'],
    ['FLOAT', 'control'],
    ['number', 'control'],
    ['slider', 'control'],
    ['boolean', 'switch'],
    ['BOOLEAN', 'switch'],
    ['toggle', 'switch'],
    ['combo', 'control'],
    ['COMBO', 'control'],
    ['color', 'control'],
    ['COLOR', 'control'],
    ['textarea', 'expanding'],
    ['TEXTAREA', 'expanding'],
    ['multiline', 'expanding'],
    ['customtext', 'expanding']
  ] as const)('maps the registered %s type to %s', ([type, display]) => {
    expect(
      resolveLinkedWidgetDisplay(
        { name: 'value', type },
        undefined,
        linkedContext
      )
    ).toBe(display)
  })

  it.for([
    'String',
    'CoMbO',
    'asset',
    'gradientslider',
    'range',
    'curve',
    'imagecrop',
    'boundingbox',
    'chart',
    'galleria',
    'colors',
    'audiorecord',
    'markdown',
    'load3D',
    'painter',
    'imagecompare',
    'boundingboxes',
    'videoedit',
    'legacy',
    'custom_widget'
  ])('leaves the linked %s type rendered', (type) => {
    expect(
      resolveLinkedWidgetDisplay(
        { name: 'value', type },
        undefined,
        linkedContext
      )
    ).toBeUndefined()
  })

  it('leaves upload and asset-browser combos rendered', () => {
    expect(
      resolveLinkedWidgetDisplay(
        {
          name: 'image',
          type: 'COMBO',
          spec: { type: 'COMBO', name: 'image', image_upload: true }
        },
        undefined,
        linkedContext
      )
    ).toBeUndefined()
    expect(
      resolveLinkedWidgetDisplay(
        { name: 'ckpt_name', type: 'COMBO' },
        undefined,
        { ...linkedContext, useAssetBrowser: true }
      )
    ).toBeUndefined()
  })

  it.for([
    {
      nodeType: 'LoadImage',
      name: 'image',
      type: 'asset',
      spec: { type: 'COMBO', name: 'image', image_upload: true }
    },
    {
      nodeType: 'LoadImageMask',
      name: 'image',
      type: 'COMBO',
      spec: { type: 'COMBO', name: 'image', image_upload: true }
    },
    {
      nodeType: 'LoadImageOutput',
      name: 'image',
      type: 'asset',
      spec: { type: 'COMBO', name: 'image', image_upload: true }
    },
    {
      nodeType: 'LoadVideo',
      name: 'file',
      type: 'COMBO',
      spec: { type: 'COMBO', name: 'file', video_upload: true }
    },
    {
      nodeType: 'LoadAudio',
      name: 'audio',
      type: 'combo',
      spec: { type: 'COMBO', name: 'audio', audio_upload: true }
    }
  ] satisfies Array<{
    nodeType: string
    name: string
    type: string
    spec: InputSpec
  }>)(
    'includes the linked core $nodeType $name selector',
    ({ nodeType, name, type, spec }) => {
      expect(
        resolveLinkedWidgetDisplay({ name, type, spec }, undefined, {
          ...linkedContext,
          assetApiEnabled: type === 'asset',
          coreNodeType: nodeType,
          useAssetBrowser: type === 'asset'
        })
      ).toBe('control')
    }
  )

  it.for([
    {
      label: 'custom node with a core type name',
      widget: {
        name: 'image',
        type: 'COMBO',
        spec: { type: 'COMBO', name: 'image', image_upload: true }
      },
      coreNodeType: undefined
    },
    {
      label: 'core node with the wrong widget name',
      widget: {
        name: 'custom_image',
        type: 'COMBO',
        spec: {
          type: 'COMBO',
          name: 'custom_image',
          image_upload: true
        }
      },
      coreNodeType: 'LoadImage'
    },
    {
      label: 'core node with an unregistered mixed-case widget',
      widget: {
        name: 'image',
        type: 'CoMbO',
        spec: { type: 'COMBO', name: 'image', image_upload: true }
      },
      coreNodeType: 'LoadImage'
    },
    {
      label: 'out-of-scope core 3D loader',
      widget: {
        name: 'model_file',
        type: 'load3D',
        spec: { type: 'COMBO', name: 'model_file' }
      },
      coreNodeType: 'Load3D'
    }
  ] satisfies Array<{
    label: string
    widget: { name: string; type: string; spec: InputSpec }
    coreNodeType: string | undefined
  }>)('excludes a $label', ({ widget, coreNodeType }) => {
    expect(
      resolveLinkedWidgetDisplay(widget, undefined, {
        ...linkedContext,
        coreNodeType
      })
    ).toBeUndefined()
  })
})
