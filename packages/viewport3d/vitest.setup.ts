import { vi } from 'vitest'

vi.mock('@sparkjsdev/spark', async () => {
  const three = await import('three')
  return {
    SplatMesh: class SplatMesh {},
    SparkRenderer: class SparkRenderer extends three.Object3D {}
  }
})
