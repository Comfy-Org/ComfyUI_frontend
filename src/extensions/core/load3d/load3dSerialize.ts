import { toRaw } from 'vue'

import type Load3d from '@/extensions/core/load3d/Load3d'
import type {
  CameraConfig,
  CameraState,
  Model3DInfo
} from '@/extensions/core/load3d/interfaces'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

type Load3dSerializedBase = {
  camera_info: CameraState | null
  model_3d_info: Model3DInfo
}

export function snapshotLoad3dState(
  node: LGraphNode,
  load3d: Load3d
): Load3dSerializedBase {
  // `node.properties` is the node data store's reactive proxy, and useLoad3d
  // deep-watches `Camera Config` to mark the scene dirty. Recording the live
  // camera into the snapshot is a read of the scene, not a change to it, so
  // write through the raw object; otherwise every capture re-dirties the
  // scene and the capture-until-stable loop in load3d.ts never settles.
  const properties = toRaw(node.properties)
  const cameraConfig: CameraConfig = (properties['Camera Config'] as
    | CameraConfig
    | undefined) || {
    cameraType: load3d.getCurrentCameraType(),
    fov: load3d.cameraManager.perspectiveCamera.fov
  }
  cameraConfig.state = load3d.getCameraState()
  properties['Camera Config'] = cameraConfig

  load3d.stopRecording()

  const modelInfo = load3d.getModelInfo()
  const model_3d_info: Model3DInfo = modelInfo ? [modelInfo] : []

  return {
    camera_info: cameraConfig.state ?? null,
    model_3d_info
  }
}
