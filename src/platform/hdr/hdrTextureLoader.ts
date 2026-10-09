import * as THREE from 'three'
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader'

import type { ChromaticityCoords, GamutName } from '@/platform/hdr/colorGamut'
import { detectGamutFromChromaticities } from '@/platform/hdr/colorGamut'
import { getImageFilenameFromUrl } from '@/utils/hdrFormatUtil'

interface ExrTexData {
  header?: { chromaticities?: ChromaticityCoords }
}

function createLoader(filename: string | undefined) {
  if (filename?.toLowerCase().endsWith('.hdr')) return new RGBELoader()
  const loader = new EXRLoader()
  loader.setDataType(THREE.FloatType)
  return loader
}

export function makeReader(
  data: ArrayLike<number>,
  type: THREE.TextureDataType
): (index: number) => number {
  if (type === THREE.HalfFloatType) {
    return (index) => THREE.DataUtils.fromHalfFloat(data[index])
  }
  return (index) => data[index]
}

export function loadHdrTexture(
  url: string,
  filename = getImageFilenameFromUrl(url)
): Promise<{ texture: THREE.DataTexture; gamut: GamutName }> {
  return new Promise((resolve, reject) => {
    createLoader(filename).load(
      url,
      (texture, texData) => {
        const chromaticities = (texData as ExrTexData).header?.chromaticities
        resolve({
          texture,
          gamut: detectGamutFromChromaticities(chromaticities)
        })
      },
      undefined,
      reject
    )
  })
}
