/*
Taken from: https://github.com/gkjohnson/threejs-sandbox/tree/master/conditional-lines
under MIT license
 */
import * as THREE from 'three'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'

export class ConditionalLineSegmentsGeometry extends LineSegmentsGeometry {
  fromConditionalEdgesGeometry(geometry) {
    super.fromEdgesGeometry(geometry)

    const { direction, control0, control1 } = geometry.attributes

    this.setAttribute(
      'direction',
      new THREE.InterleavedBufferAttribute(
        new THREE.InstancedInterleavedBuffer(direction.array, 6, 1),
        3,
        0
      )
    )

    this.setAttribute(
      'control0',
      new THREE.InterleavedBufferAttribute(
        new THREE.InstancedInterleavedBuffer(control0.array, 6, 1),
        3,
        0
      )
    )

    this.setAttribute(
      'control1',
      new THREE.InterleavedBufferAttribute(
        new THREE.InstancedInterleavedBuffer(control1.array, 6, 1),
        3,
        0
      )
    )

    return this
  }
}
