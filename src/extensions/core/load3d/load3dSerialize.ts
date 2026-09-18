import type {
  CameraConfig,
  CameraState,
  CameraType,
  Model3DTransform,
  Model3DInfo
} from '@/extensions/core/load3d/interfaces'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

type Load3dSerializedBase = {
  camera_info: CameraState | null
  model_3d_info: Model3DInfo
}

interface Load3dStateSource {
  cameraManager: { perspectiveCamera: { fov: number } }
  getCameraState(): CameraState
  getCurrentCameraType(): CameraType
  getModelInfo(): Model3DTransform | null
  stopRecording(): void
}

export function snapshotLoad3dState(
  node: Pick<LGraphNode, 'properties'>,
  load3d: Load3dStateSource
): Load3dSerializedBase {
  const cameraConfig: CameraConfig = (node.properties['Camera Config'] as
    | CameraConfig
    | undefined) || {
    cameraType: load3d.getCurrentCameraType(),
    fov: load3d.cameraManager.perspectiveCamera.fov
  }
  cameraConfig.state = load3d.getCameraState()
  node.properties['Camera Config'] = cameraConfig

  load3d.stopRecording()

  const modelInfo = load3d.getModelInfo()
  const model_3d_info: Model3DInfo = modelInfo ? [modelInfo] : []

  return {
    camera_info: cameraConfig.state ?? null,
    model_3d_info
  }
}
