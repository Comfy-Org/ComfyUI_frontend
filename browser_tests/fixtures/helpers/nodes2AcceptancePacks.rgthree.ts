import type { NodeId } from '@comfyorg/graph-model/nodeId'

import type { ComfyFiles, ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  BLUE,
  RED,
  addPackNode,
  countColour,
  dispatchExecuted,
  inputImage,
  nodeScreenRect,
  padRect,
  uploadSolidImage
} from '@e2e/fixtures/helpers/nodes2AcceptancePacks'

const IMAGE_COMPARER = 'Image Comparer (rgthree)'

export const REROUTE = 'Reroute (rgthree)'

export const RELAY = 'Mute / Bypass Relay (rgthree)'

export const LABEL = 'Label (rgthree)'

export const POWER_LORA = 'Power Lora Loader (rgthree)'

export const FAST_GROUPS_BYPASSER = 'Fast Groups Bypasser (rgthree)'

const REROUTE_LABEL_GREY = [0x88, 0x88, 0x88] as const

export async function addImageComparerWithRunOutput(comfyPage: ComfyPage) {
  const id = await addPackNode(
    comfyPage,
    IMAGE_COMPARER,
    [100, 100],
    [420, 460]
  )
  return id
}

export async function deliverComparerImages(
  comfyPage: ComfyPage,
  comfyFiles: ComfyFiles,
  id: NodeId
) {
  const imageA = await uploadSolidImage(
    comfyPage,
    comfyFiles,
    'n2a_rgthree_a.png',
    RED
  )
  const imageB = await uploadSolidImage(
    comfyPage,
    comfyFiles,
    'n2a_rgthree_b.png',
    BLUE
  )
  await dispatchExecuted(comfyPage, id, {
    a_images: [inputImage(imageA)],
    b_images: [inputImage(imageB)]
  })
}

export async function greyLabelPixels(comfyPage: ComfyPage, id: NodeId) {
  return countColour(
    comfyPage,
    padRect(await nodeScreenRect(comfyPage, id), 4),
    REROUTE_LABEL_GREY,
    10
  )
}
