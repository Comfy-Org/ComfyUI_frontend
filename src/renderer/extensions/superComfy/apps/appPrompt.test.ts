import type { ComfyApiWorkflow } from '@comfyorg/graph-model/workflowSchema'
import { describe, expect, it } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  bindRunValues,
  rewriteBoundOutputs
} from '@/renderer/extensions/superComfy/apps/appPrompt'
import type {
  AppContract,
  AppNode,
  MediaItem,
  SettingValue
} from '@/renderer/extensions/superComfy/engine/documentSchema'
import type { PlannedRun } from '@/renderer/extensions/superComfy/engine/types'

describe('rewriteBoundOutputs', () => {
  it.for([
    {
      name: 'a bound image preview becomes a tagged save',
      node: { class_type: 'PreviewImage', inputs: { images: ['8', 0] } },
      expected: {
        class_type: 'SaveImage',
        inputs: { images: ['8', 0], filename_prefix: 'supercomfy/run_1a2b3c4d' }
      }
    },
    {
      name: 'a bound audio preview becomes a tagged save',
      node: { class_type: 'PreviewAudio', inputs: { audio: ['8', 0] } },
      expected: {
        class_type: 'SaveAudio',
        inputs: { audio: ['8', 0], filename_prefix: 'supercomfy/run_1a2b3c4d' }
      }
    },
    {
      name: 'a bound save keeps its prefix and gains the run tag',
      node: {
        class_type: 'SaveVideo',
        inputs: { video: ['8', 0], filename_prefix: 'video/clip' }
      },
      expected: {
        class_type: 'SaveVideo',
        inputs: { video: ['8', 0], filename_prefix: 'video/clip_1a2b3c4d' }
      }
    },
    {
      name: 'a bound output without a prefix is left as it is',
      node: { class_type: 'PreviewAny', inputs: { source: ['8', 0] } },
      expected: { class_type: 'PreviewAny', inputs: { source: ['8', 0] } }
    }
  ])('$name', ({ node, expected }) => {
    const output: ComfyApiWorkflow = { '9': node }

    expect(rewriteBoundOutputs(output, ['9'], '1a2b3c4d')).toEqual({
      '9': expected
    })
  })

  it('leaves outputs the app does not expose untouched', () => {
    const output: ComfyApiWorkflow = {
      '9': { class_type: 'PreviewImage', inputs: { images: ['8', 0] } },
      '12': {
        class_type: 'SaveImage',
        inputs: { images: ['8', 0], filename_prefix: 'ComfyUI' }
      }
    }

    expect(rewriteBoundOutputs(output, ['12'], '1a2b3c4d')).toEqual({
      '9': { class_type: 'PreviewImage', inputs: { images: ['8', 0] } },
      '12': {
        class_type: 'SaveImage',
        inputs: { images: ['8', 0], filename_prefix: 'ComfyUI_1a2b3c4d' }
      }
    })
  })
})

interface AppGraph {
  graph: LGraph
  loader: LGraphNode
  sampler: LGraphNode
  loaderId: string
  samplerId: string
}

function widgetValue(node: LGraphNode, widgetName: string): unknown {
  return node.widgets?.find((candidate) => candidate.name === widgetName)?.value
}

function appGraph(): AppGraph {
  const graph = new LGraph()
  const loader = new LGraphNode('Load Image')
  loader.addWidget('combo', 'image', 'example.png', () => undefined, {
    values: ['example.png']
  })
  const sampler = new LGraphNode('KSampler')
  sampler.addWidget('text', 'text', 'saved prompt', () => undefined, {})
  sampler.addWidget('number', 'steps', 20, () => undefined, {})
  sampler.addWidget('toggle', 'denoise_full', false, () => undefined, {})
  sampler.addWidget('combo', 'sampler_name', 'euler', () => undefined, {
    values: ['euler', 'dpm']
  })
  graph.add(loader)
  graph.add(sampler)
  return {
    graph,
    loader,
    sampler,
    loaderId: String(loader.id),
    samplerId: String(sampler.id)
  }
}

function contractFor({ loaderId, samplerId }: AppGraph): AppContract {
  return {
    version: 1,
    inputs: [
      {
        name: `in:${loaderId}:image`,
        label: 'Photo',
        modality: 'image',
        required: true,
        multi: false,
        target: { nodeId: loaderId, widgetName: 'image' }
      },
      {
        name: `in:${samplerId}:text`,
        label: 'Prompt',
        modality: 'text',
        required: false,
        multi: false,
        inline: true,
        target: { nodeId: samplerId, widgetName: 'text' }
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
      }
    ],
    settings: [
      {
        control: 'number',
        name: `${samplerId}:steps`,
        label: 'steps',
        integer: true,
        required: false,
        target: { nodeId: samplerId, widgetName: 'steps' }
      },
      {
        control: 'toggle',
        name: `${samplerId}:denoise_full`,
        label: 'denoise_full',
        required: false,
        target: { nodeId: samplerId, widgetName: 'denoise_full' }
      },
      {
        control: 'select',
        name: `${samplerId}:sampler_name`,
        label: 'sampler_name',
        options: ['euler', 'dpm'],
        required: false,
        target: { nodeId: samplerId, widgetName: 'sampler_name' }
      }
    ],
    dropped: 0
  }
}

function appNodeWith(
  contract: AppContract,
  values: Record<string, SettingValue> = {}
): AppNode {
  return {
    id: 'app-1',
    kind: 'app',
    x: 0,
    y: 0,
    width: 280,
    runCount: 1,
    settingsOpen: false,
    values,
    inline: {},
    runs: {},
    result: null,
    workflowPath: 'workflows/Portrait.app.json',
    title: 'Portrait',
    contract
  }
}

function runWith(inputs: Record<string, MediaItem[]>): PlannedRun {
  return { index: 0, repeat: 0, key: 'run-0', inputs }
}

function outputImage(filename: string): MediaItem {
  return {
    kind: 'file',
    modality: 'image',
    ref: { filename, subfolder: 'supercomfy', type: 'output' }
  }
}

describe('bindRunValues', () => {
  it('writes the media reference and text of one run into the app widgets', () => {
    const app = appGraph()
    const contract = contractFor(app)

    const bound = bindRunValues(
      app.graph,
      appNodeWith(contract),
      runWith({
        [`in:${app.loaderId}:image`]: [outputImage('cat.png')],
        [`in:${app.samplerId}:text`]: [{ kind: 'text', text: 'a red fox' }]
      })
    )

    expect(bound).toBe(true)
    expect(widgetValue(app.loader, 'image')).toBe('supercomfy/cat.png [output]')
    expect(widgetValue(app.sampler, 'text')).toBe('a red fox')
  })

  it('clears a text widget whose port has no text this run', () => {
    const app = appGraph()
    const contract = contractFor(app)

    bindRunValues(
      app.graph,
      appNodeWith(contract),
      runWith({ [`in:${app.loaderId}:image`]: [outputImage('cat.png')] })
    )

    expect(widgetValue(app.sampler, 'text')).toBe('')
  })

  it.for([
    { name: 'a numeric string', widget: 'steps', value: '35', expected: 35 },
    { name: 'a number', widget: 'steps', value: 12, expected: 12 },
    { name: 'a toggle', widget: 'denoise_full', value: true, expected: true },
    { name: 'an option', widget: 'sampler_name', value: 'dpm', expected: 'dpm' }
  ])(
    'applies a changed setting given as $name in the widget type',
    ({ widget, value, expected }) => {
      const app = appGraph()
      const contract = contractFor(app)

      bindRunValues(
        app.graph,
        appNodeWith(contract, { [`${app.samplerId}:${widget}`]: value }),
        runWith({ [`in:${app.loaderId}:image`]: [outputImage('cat.png')] })
      )

      expect(widgetValue(app.sampler, widget)).toBe(expected)
    }
  )

  it('keeps the saved value of settings the user did not change', () => {
    const app = appGraph()
    const contract = contractFor(app)

    bindRunValues(
      app.graph,
      appNodeWith(contract),
      runWith({ [`in:${app.loaderId}:image`]: [outputImage('cat.png')] })
    )

    expect(widgetValue(app.sampler, 'steps')).toBe(20)
  })

  it('writes nothing when a target widget is gone from the app', () => {
    const app = appGraph()
    const contract = contractFor(app)
    const stale: AppContract = {
      ...contract,
      settings: [
        ...contract.settings,
        {
          control: 'number',
          name: '404:cfg',
          label: 'cfg',
          integer: false,
          required: false,
          target: { nodeId: '404', widgetName: 'cfg' }
        }
      ]
    }

    const bound = bindRunValues(
      app.graph,
      appNodeWith(stale, { '404:cfg': 4 }),
      runWith({
        [`in:${app.loaderId}:image`]: [outputImage('cat.png')],
        [`in:${app.samplerId}:text`]: [{ kind: 'text', text: 'a red fox' }]
      })
    )

    expect(bound).toBe(false)
    expect(widgetValue(app.loader, 'image')).toBe('example.png')
    expect(widgetValue(app.sampler, 'text')).toBe('saved prompt')
  })
})
