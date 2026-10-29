import { describe, expect, it } from 'vitest'

import { useDialogStore } from '@/stores/dialogStore'

import {
  openCreateCustomDeploymentDialog,
  openDeployCustomNodesDialog
} from './openCustomDeploymentDialog'

describe('custom deployment dialogs', () => {
  it.for([
    {
      open: openCreateCustomDeploymentDialog,
      key: 'global-create-custom-deployment',
      title: 'Create a custom deployment',
      firstPoint: "Use custom nodes and models that aren't on Comfy Cloud",
      platformLabel: 'Create on Platform'
    },
    {
      open: openDeployCustomNodesDialog,
      key: 'global-deploy-custom-nodes',
      title: 'Deploy Custom Nodes on Comfy Cloud',
      firstPoint: 'Deploy the custom or private node packs your workflows need',
      platformLabel: 'Deploy on Platform'
    }
  ])(
    'opens $key with its own pitch',
    async ({ open, key, title, firstPoint, platformLabel }) => {
      await open()

      const dialog = useDialogStore().dialogStack.find(
        (entry) => entry.key === key
      )
      expect(dialog?.contentProps.pitch).toMatchObject({
        title,
        points: [
          firstPoint,
          'Work in ComfyUI on the GPU you choose',
          'Call it from your product as an autoscaling API'
        ],
        platformLabel
      })
    }
  )
})
