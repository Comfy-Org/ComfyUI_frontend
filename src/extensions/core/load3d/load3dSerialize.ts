import type Load3d from '@/extensions/core/load3d/Load3d'
import type {
  CameraState,
  Model3DInfo
} from '@/extensions/core/load3d/interfaces'

type Load3dSerializedBase = {
  camera_info: CameraState | null
  model_3d_info: Model3DInfo
}

export function snapshotLoad3dState(load3d: Load3d): Load3dSerializedBase {
  const camera_info = load3d.getCameraState() ?? null

  load3d.stopRecording()

  const modelInfo = load3d.getModelInfo()
  const model_3d_info: Model3DInfo = modelInfo ? [modelInfo] : []

  return {
    camera_info,
    model_3d_info
  }
}
