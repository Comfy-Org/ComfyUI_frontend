import { describe, expect, it } from 'vitest'

import { DEPLOY_VIDEO_SOURCES } from '@/platform/workflow/deploy/constants'
import { CUSTOM_DEPLOYMENT_BRIEF } from '@/platform/workspace/customDeploymentBrief'
import { NEW_DEPLOYMENT_FROM_NODES } from '@/platform/workspace/platformFrame/platformFrameWaysIn'
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
    'opens $key with its own pitch, the video and the custom deployment brief',
    async ({ open, key, title, firstPoint, platformLabel }) => {
      await open()

      const dialog = useDialogStore().dialogStack.find(
        (entry) => entry.key === key
      )
      expect(dialog?.contentProps).toMatchObject({
        pitch: {
          title,
          points: [
            firstPoint,
            'Work in ComfyUI on the GPU you choose',
            'Call it from your product as an autoscaling API'
          ],
          platformLabel,
          brief: CUSTOM_DEPLOYMENT_BRIEF
        },
        videoSources: DEPLOY_VIDEO_SOURCES
      })
    }
  )

  it('marks Get started in Extensions as the overview dialog way in', async () => {
    await openDeployCustomNodesDialog(NEW_DEPLOYMENT_FROM_NODES)

    const dialog = useDialogStore().dialogStack.find(
      (entry) => entry.key === 'global-deploy-custom-nodes'
    )
    expect(dialog?.contentProps).toMatchObject({
      frameRequest: NEW_DEPLOYMENT_FROM_NODES,
      frameEntry: 'overview_dialog'
    })
  })
})
