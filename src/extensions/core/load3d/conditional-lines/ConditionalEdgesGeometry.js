/*
Taken from: https://github.com/gkjohnson/threejs-sandbox/tree/master/conditional-lines
under MIT license
 */
import { BufferAttribute, BufferGeometry, Triangle, Vector3 } from 'three'

const vec0 = new Vector3()
const vec1 = new Vector3()
const vec2 = new Vector3()
const vec3 = new Vector3()
const vec4 = new Vector3()

const triangle0 = new Triangle()
const triangle1 = new Triangle()
const normal0 = new Vector3()
const normal1 = new Vector3()
export class ConditionalEdgesGeometry extends BufferGeometry {
  constructor(geometry) {
    super()

    const edgeInfo = {}

    const position = geometry.attributes.position
    let index
    if (geometry.index) {
      index = geometry.index
    } else {
      const arr = new Array(position.count / 3).fill().map((_, i) => i)
      index = new BufferAttribute(new Uint32Array(arr), 1, false)
    }

    for (let i = 0, l = index.count; i < l; i += 3) {
      const indices = [index.getX(i + 0), index.getX(i + 1), index.getX(i + 2)]

      for (let j = 0; j < 3; j++) {
        const index0 = indices[j]
        const index1 = indices[(j + 1) % 3]

        const hash = `${index0}_${index1}`
        const reverseHash = `${index1}_${index0}`
        if (reverseHash in edgeInfo) {
          edgeInfo[reverseHash].controlIndex1 = indices[(j + 2) % 3]
          edgeInfo[reverseHash].tri1 = i / 3
        } else {
          edgeInfo[hash] = {
            index0,
            index1,

            controlIndex0: indices[(j + 2) % 3],
            controlIndex1: null,

            tri0: i / 3,
            tri1: null
          }
        }
      }
    }

    const edgePositions = []
    const edgeDirections = []
    const edgeControl0 = []
    const edgeControl1 = []
    for (const key in edgeInfo) {
      const { index0, index1, controlIndex0, controlIndex1, tri0, tri1 } =
        edgeInfo[key]

      if (controlIndex1 === null) {
        continue
      }

      triangle0.a.fromBufferAttribute(position, index.getX(tri0 * 3 + 0))
      triangle0.b.fromBufferAttribute(position, index.getX(tri0 * 3 + 1))
      triangle0.c.fromBufferAttribute(position, index.getX(tri0 * 3 + 2))

      triangle1.a.fromBufferAttribute(position, index.getX(tri1 * 3 + 0))
      triangle1.b.fromBufferAttribute(position, index.getX(tri1 * 3 + 1))
      triangle1.c.fromBufferAttribute(position, index.getX(tri1 * 3 + 2))

      triangle0.getNormal(normal0).normalize()
      triangle1.getNormal(normal1).normalize()

      if (normal0.dot(normal1) < 0.01) {
        continue
      }

      // positions
      vec0.fromBufferAttribute(position, index0)
      vec1.fromBufferAttribute(position, index1)

      // direction
      vec2.subVectors(vec0, vec1)

      // control positions
      vec3.fromBufferAttribute(position, controlIndex0)
      vec4.fromBufferAttribute(position, controlIndex1)

      // create arrays
      edgePositions.push(vec0.x, vec0.y, vec0.z)
      edgeDirections.push(vec2.x, vec2.y, vec2.z)
      edgeControl0.push(vec3.x, vec3.y, vec3.z)
      edgeControl1.push(vec4.x, vec4.y, vec4.z)

      edgePositions.push(vec1.x, vec1.y, vec1.z)
      edgeDirections.push(vec2.x, vec2.y, vec2.z)
      edgeControl0.push(vec3.x, vec3.y, vec3.z)
      edgeControl1.push(vec4.x, vec4.y, vec4.z)
    }

    this.setAttribute(
      'position',
      new BufferAttribute(new Float32Array(edgePositions), 3, false)
    )
    this.setAttribute(
      'direction',
      new BufferAttribute(new Float32Array(edgeDirections), 3, false)
    )
    this.setAttribute(
      'control0',
      new BufferAttribute(new Float32Array(edgeControl0), 3, false)
    )
    this.setAttribute(
      'control1',
      new BufferAttribute(new Float32Array(edgeControl1), 3, false)
    )
  }
}
