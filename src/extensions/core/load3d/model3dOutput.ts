import { z } from 'zod'

import type {
  CameraState,
  LoadFolder,
  Model3DInfo
} from '@/extensions/core/load3d/interfaces'
import { zResultItem } from '@/schemas/apiSchema'

export interface Model3DOutput {
  filePath: string
  folder?: LoadFolder
  cameraState?: CameraState
  modelTransform?: Model3DInfo[number]
}

const zVector3 = z.object({ x: z.number(), y: z.number(), z: z.number() })

const zQuaternion = zVector3.extend({ w: z.number() })

const zCameraShape = z.object({
  position: zVector3,
  target: zVector3,
  zoom: z.number(),
  cameraType: z.enum(['perspective', 'orthographic']),
  quaternion: zQuaternion.optional(),
  useCustomUp: z.boolean().optional(),
  customUp: zVector3.optional(),
  fov: z.number().optional(),
  aspect: z.number().optional(),
  near: z.number().optional(),
  far: z.number().optional(),
  frustum: z
    .object({
      left: z.number(),
      right: z.number(),
      top: z.number(),
      bottom: z.number()
    })
    .optional()
})

const zCameraState = z.custom<CameraState>(
  (value) => zCameraShape.safeParse(value).success
)

const zModelTransform = z.object({
  position: zVector3,
  quaternion: zQuaternion,
  scale: zVector3
})

const zLoadFolder = z.enum(['output', 'temp'])

const zModel3DNodeOutput = z.object({
  '3d': z.array(zResultItem).optional(),
  camera_info: z.array(z.unknown()).optional(),
  model_3d_info: z.array(z.unknown()).optional(),
  result: z.array(z.unknown()).optional()
})

function parseOptional<T>(schema: z.ZodType<T>, value: unknown): T | undefined {
  const parsed = schema.safeParse(value)
  return parsed.success ? parsed.data : undefined
}

export function readModel3DOutput(output: unknown): Model3DOutput | null {
  const parsed = zModel3DNodeOutput.safeParse(output)
  if (!parsed.success) return null
  const { '3d': items, camera_info, model_3d_info, result } = parsed.data

  const item = items?.[0]
  if (item?.filename) {
    return {
      filePath: item.subfolder
        ? `${item.subfolder}/${item.filename}`
        : item.filename,
      folder: parseOptional(zLoadFolder, item.type),
      cameraState: parseOptional(zCameraState, camera_info?.[0]),
      modelTransform: parseOptional(zModelTransform, model_3d_info?.[0])
    }
  }

  const [filePath, cameraInfo, modelInfo] = result ?? []
  if (typeof filePath !== 'string' || !filePath) return null
  return {
    filePath,
    cameraState: parseOptional(zCameraState, cameraInfo),
    modelTransform: parseOptional(
      zModelTransform,
      Array.isArray(modelInfo) ? modelInfo[0] : undefined
    )
  }
}
