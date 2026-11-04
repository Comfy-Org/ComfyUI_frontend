import type { ComfyWorkflowJSON } from '@comfyorg/graph-model/workflowSchema'
import { describe, expect, it, vi } from 'vitest'

import { resolveAppContract } from '@/renderer/extensions/superComfy/apps/appContract'
import {
  APP_ROOT_ID,
  registerAppNodeDefs,
  registerAppNodeTypes,
  savedAppJson,
  storeSavedApp
} from '@/renderer/extensions/superComfy/apps/appTestFixtures'

vi.mock(import('firebase/auth'))

async function savedApp(
  extraTypes: readonly string[] = []
): Promise<ComfyWorkflowJSON> {
  registerAppNodeTypes()
  registerAppNodeDefs()
  const json = await savedAppJson(extraTypes)
  return {
    ...json,
    extra: {
      ...json.extra,
      linearMode: true,
      linearData: {
        inputs: [
          [`${APP_ROOT_ID}:1:image`, 'image'],
          [`${APP_ROOT_ID}:2:text`, 'text', { description: 'Prompt' }],
          [`${APP_ROOT_ID}:3:seed`, 'seed']
        ],
        outputs: ['4']
      }
    }
  }
}

describe('resolveAppContract', () => {
  it('derives the ports of a saved app from its node definitions', async () => {
    const workflow = storeSavedApp(await savedApp())

    expect(await resolveAppContract(workflow.path)).toEqual({
      ok: true,
      title: workflow.filename,
      contract: {
        version: 1000,
        inputs: [
          {
            name: 'in:1:image',
            label: 'image',
            modality: 'image',
            required: true,
            multi: false,
            target: { nodeId: '1', widgetName: 'image' }
          },
          {
            name: 'in:2:text',
            label: 'Prompt',
            modality: 'text',
            required: false,
            multi: false,
            inline: true,
            default: 'saved prompt',
            target: { nodeId: '2', widgetName: 'text' }
          }
        ],
        outputs: [
          {
            name: 'out:4',
            label: 'PreviewImage',
            modality: 'image',
            required: false,
            multi: false,
            outputNodeId: '4'
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
            default: 0,
            required: false,
            target: { nodeId: '3', widgetName: 'seed' }
          }
        ],
        dropped: 0
      }
    })
  })

  it('drops inputs of a bypassed node', async () => {
    const json = await savedApp()
    json.nodes[2].mode = 4
    const workflow = storeSavedApp(json)

    expect(await resolveAppContract(workflow.path)).toMatchObject({
      ok: true,
      contract: { settings: [], dropped: 1 }
    })
  })

  it('names the node types the app needs but this server lacks', async () => {
    const workflow = storeSavedApp(await savedApp(['CustomUpscaler']))

    expect(await resolveAppContract(workflow.path)).toEqual({
      ok: false,
      reason: 'missingNodes',
      detail: 'CustomUpscaler'
    })
  })

  it('reports an app that is no longer in the workflow list', async () => {
    storeSavedApp(await savedApp())

    expect(await resolveAppContract('workflows/Gone.app.json')).toEqual({
      ok: false,
      reason: 'notFound'
    })
  })
})
