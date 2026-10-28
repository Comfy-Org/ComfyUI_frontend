import type { Vector3Tuple as Vec3 } from '@comfyorg/shared-frontend-utils/geometry'

interface CameraFromMatricesResult {
  position: Vec3
  target: Vec3
  fovYDegrees: number
}

export function computeCameraFromMatrices(
  extrinsics: readonly (readonly number[])[],
  intrinsics: readonly (readonly number[])[]
): CameraFromMatricesResult {
  assertMatrixShape(extrinsics, 4, 4, 'extrinsics')
  assertMatrixShape(intrinsics, 3, 3, 'intrinsics')

  const r00 = extrinsics[0][0]
  const r01 = extrinsics[0][1]
  const r02 = extrinsics[0][2]
  const r10 = extrinsics[1][0]
  const r11 = extrinsics[1][1]
  const r12 = extrinsics[1][2]
  const r20 = extrinsics[2][0]
  const r21 = extrinsics[2][1]
  const r22 = extrinsics[2][2]

  const tx = extrinsics[0][3]
  const ty = extrinsics[1][3]
  const tz = extrinsics[2][3]

  const posX = -(r00 * tx + r10 * ty + r20 * tz)
  const posY = -(r01 * tx + r11 * ty + r21 * tz)
  const posZ = -(r02 * tx + r12 * ty + r22 * tz)

  const targetX = posX + r20
  const targetY = posY + r21
  const targetZ = posZ + r22

  const fy = intrinsics[1][1]
  const cy = intrinsics[1][2]
  if (!Number.isFinite(fy) || fy === 0) {
    throw new Error(
      `intrinsics[1][1] (fy) must be a non-zero finite number, got ${fy}`
    )
  }
  const fovYRad = 2 * Math.atan(cy / fy)
  const fovYDegrees = (fovYRad * 180) / Math.PI

  return {
    position: [posX, -posY, -posZ],
    target: [targetX, -targetY, -targetZ],
    fovYDegrees
  }
}

function assertMatrixShape(
  matrix: readonly (readonly number[])[],
  rows: number,
  cols: number,
  name: string
): void {
  if (matrix.length !== rows) {
    throw new Error(
      `${name} must be ${rows}x${cols}, got ${matrix.length} rows`
    )
  }
  for (let i = 0; i < rows; i++) {
    if (matrix[i].length !== cols) {
      throw new Error(
        `${name} row ${i} must have ${cols} columns, got ${matrix[i].length}`
      )
    }
  }
}
