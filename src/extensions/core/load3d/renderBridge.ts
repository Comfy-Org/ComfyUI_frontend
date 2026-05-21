/**
 * Round-trip render bridge for Preview3D / SaveGLB IMAGE+MASK outputs.
 *
 * The backend node sends a "preview3d.render_request" websocket event with
 * {render_id, node_id, file_path, type, camera_info?}. We find the
 * matching node, load the model, capture at the (frontend-defaulted)
 * resolution with the derived camera state, upload the PNGs to /temp/,
 * then POST {render_id, image, mask} back to /3d/render_response so the
 * awaiting backend Future resolves.
 */
import { nodeToLoad3dMap } from '@/composables/useLoad3d'
import {
  type CameraInfoSerialized,
  toCameraState
} from '@/extensions/core/load3d/cameraInfo'
import Load3DConfiguration from '@/extensions/core/load3d/Load3DConfiguration'
import type { CameraState } from '@/extensions/core/load3d/interfaces'
import Load3dUtils from '@/extensions/core/load3d/Load3dUtils'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { getNodeByLocatorId } from '@/utils/graphTraversalUtil'

interface RenderRequestPayload {
  render_id: string
  node_id: string
  file_path: string
  type: 'input' | 'output' | 'temp'
  width?: number
  height?: number
  camera_info?: CameraInfoSerialized | null
}

const DEFAULT_RENDER_WIDTH = 512
const DEFAULT_RENDER_HEIGHT = 512

async function postResponse(
  render_id: string,
  body: { image?: string; mask?: string; error?: string }
) {
  try {
    await api.fetchApi('/3d/render_response', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ render_id, ...body })
    })
  } catch (error) {
    // POST failure leaves the backend Future to time out on its own.
    // Log for observability and debugging.
    console.error(
      `[Preview3D bridge] failed to POST render response for render_id=${render_id}:`,
      error
    )
  }
}

async function handleRenderRequest(payload: RenderRequestPayload) {
  const { render_id, node_id, file_path, type } = payload
  const width = payload.width ?? DEFAULT_RENDER_WIDTH
  const height = payload.height ?? DEFAULT_RENDER_HEIGHT

  const node = getNodeByLocatorId(app.rootGraph, node_id)
  if (!node) {
    await postResponse(render_id, { error: `node ${node_id} not found` })
    return
  }

  const load3d = nodeToLoad3dMap.get(node)
  if (!load3d) {
    // Realistic only if the node was deleted between queue and execute.
    await postResponse(render_id, {
      error: `load3d instance not available for node ${node_id}`
    })
    return
  }

  try {
    const folder: 'input' | 'output' = type === 'input' ? 'input' : 'output'

    const config = new Load3DConfiguration(load3d, node.properties)
    config.configureForSaveMesh(folder, file_path, { silentOnNotFound: true })

    await load3d.whenLoadIdle()

    // Camera priority:
    // 1. payload.camera_info (upstream camera_info node input) — overwrites
    //    everything, including user's manual adjustments
    // 2. node.properties['Camera Config'].state — the user's persisted manual
    //    adjustments (tracked by useLoad3d's cameraChanged handler)
    // 3. undefined — leave the viewer at its current state (which after the
    //    load is the model's default fit-to-bbox)
    let cameraState: CameraState | undefined
    if (payload.camera_info) {
      cameraState = toCameraState(payload.camera_info)
    } else {
      const savedConfig = node.properties['Camera Config'] as
        | { state?: CameraInfoSerialized }
        | undefined
      if (savedConfig?.state) {
        cameraState = toCameraState(savedConfig.state)
      }
    }

    const result = await load3d.captureSceneFixedCamera(
      width,
      height,
      cameraState
    )

    const [imageUpload, maskUpload] = await Promise.all([
      Load3dUtils.uploadTempImage(result.scene, 'preview3d_scene'),
      Load3dUtils.uploadTempImage(result.mask, 'preview3d_mask')
    ])

    load3d.handleResize()

    await postResponse(render_id, {
      image: `threed/${imageUpload.name} [temp]`,
      mask: `threed/${maskUpload.name} [temp]`
    })
  } catch (error) {
    await postResponse(render_id, {
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

api.addCustomEventListener(
  'preview3d.render_request',
  (event: CustomEvent<unknown>) => {
    const detail = event.detail as RenderRequestPayload | null
    if (!detail || !detail.render_id) return
    void handleRenderRequest(detail)
  }
)
