/*
Taken from: https://github.com/gkjohnson/threejs-sandbox/tree/master/conditional-lines
under MIT license
 */
import { BufferAttribute, BufferGeometry, Vector3 } from 'three'

const vec = new Vector3()
export class OutsideEdgesGeometry extends BufferGeometry {
  constructor(geometry) {
    super()

    const edgeInfo = {}
    const index = geometry.index
    const position = geometry.attributes.position
    for (let i = 0, l = index.count; i < l; i += 3) {
      const indices = [index.getX(i + 0), index.getX(i + 1), index.getX(i + 2)]

      for (let j = 0; j < 3; j++) {
        const index0 = indices[j]
        const index1 = indices[(j + 1) % 3]

        const hash = `${index0}_${index1}`
        const reverseHash = `${index1}_${index0}`
        if (reverseHash in edgeInfo) {
          delete edgeInfo[reverseHash]
        } else {
          edgeInfo[hash] = [index0, index1]
        }
      }
    }

    const edgePositions = []
    for (const key in edgeInfo) {
      const [i0, i1] = edgeInfo[key]

      vec.fromBufferAttribute(position, i0)
      edgePositions.push(vec.x, vec.y, vec.z)

      vec.fromBufferAttribute(position, i1)
      edgePositions.push(vec.x, vec.y, vec.z)
    }

    this.setAttribute(
      'position',
      new BufferAttribute(new Float32Array(edgePositions), 3, false)
    )
  }
}
