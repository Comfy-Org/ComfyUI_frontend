import { ComfyMetadata, ComfyMetadataTags } from '@/types/metadataTypes'

// @ts-expect-error fixme ts strict error
export function parseExifData(exifData) {
  // Check for the correct TIFF header (0x4949 for little-endian or 0x4D4D for big-endian)
  const isLittleEndian = String.fromCharCode(...exifData.slice(0, 2)) === 'II'

  // Function to read 16-bit and 32-bit integers from binary data
  // @ts-expect-error fixme ts strict error
  function readInt(offset, isLittleEndian, length) {
    let arr = exifData.slice(offset, offset + length)
    if (length === 2) {
      return new DataView(arr.buffer, arr.byteOffset, arr.byteLength).getUint16(
        0,
        isLittleEndian
      )
    } else if (length === 4) {
      return new DataView(arr.buffer, arr.byteOffset, arr.byteLength).getUint32(
        0,
        isLittleEndian
      )
    }
  }

  // Read the offset to the first IFD (Image File Directory)
  const ifdOffset = readInt(4, isLittleEndian, 4)

  // @ts-expect-error fixme ts strict error
  function parseIFD(offset) {
    const numEntries = readInt(offset, isLittleEndian, 2)
    const result = {}

    // @ts-expect-error fixme ts strict error
    for (let i = 0; i < numEntries; i++) {
      const entryOffset = offset + 2 + i * 12
      const tag = readInt(entryOffset, isLittleEndian, 2)
      const type = readInt(entryOffset + 2, isLittleEndian, 2)
      const numValues = readInt(entryOffset + 4, isLittleEndian, 4)
      const valueOffset = readInt(entryOffset + 8, isLittleEndian, 4)

      // Read the value(s) based on the data type
      let value
      if (type === 2) {
        // ASCII string
        value = new TextDecoder('utf-8').decode(
          // @ts-expect-error fixme ts strict error
          exifData.subarray(valueOffset, valueOffset + numValues - 1)
        )
      }

      // @ts-expect-error fixme ts strict error
      result[tag] = value
    }

    return result
  }

  // Parse the first IFD
  const ifdData = parseIFD(ifdOffset)
  return ifdData
}

function findBox(
  dataView: DataView,
  start: number,
  end: number,
  type: string
): { start: number; end: number } | null {
  let offset = start
  while (offset < end) {
    if (offset + 8 > end) break
    const boxLength = dataView.getUint32(offset)
    const boxType = String.fromCharCode(
      dataView.getUint8(offset + 4),
      dataView.getUint8(offset + 5),
      dataView.getUint8(offset + 6),
      dataView.getUint8(offset + 7)
    )

    if (boxLength === 0) break

    if (boxType === type) {
      return { start: offset + 8, end: offset + boxLength } // The box start is right after the box type fourcc. Easier to navigate around.
    }
    if (offset + boxLength > end) break
    offset += boxLength
  }
  return null
}

function parseAvifMetadata(buffer: ArrayBuffer): ComfyMetadata {
  const metadata: ComfyMetadata = {}
  const dataView = new DataView(buffer)
  const avif = new Uint8Array(buffer)

  // Check for ftyp box and 'avif' brand
  if (
    dataView.getUint32(4) !== 0x66747970 || // ftyp
    dataView.getUint32(8) !== 0x61766966 // avif
  ) {
    console.error('Not a valid AVIF file')
    return {}
  }

  const metaBox = findBox(dataView, 0, dataView.byteLength, 'meta')
  if (!metaBox) {
    console.error('meta box not found')
    return {}
  }

  const metaBoxContentStart = metaBox.start + 4 // Skip version and flags

  const iinfBox = findBox(dataView, metaBoxContentStart, metaBox.end, 'iinf')
  if (!iinfBox) {
    console.error('iinf box not found')
    return {}
  }

  const iinfVersion = dataView.getUint8(iinfBox.start) // We start exactly at the end of the 'iinf' fourcc. The next byte always is the version. AVIF usually uses 0x00.
  let entryCount
  let currentOffset
  if (iinfVersion === 0) {
    entryCount = dataView.getUint16(iinfBox.start + 4)
    currentOffset = iinfBox.start + 6
  } else {
    entryCount = dataView.getUint32(iinfBox.start + 4)
    currentOffset = iinfBox.start + 8
  }

  let exifItemId = -1
  for (let i = 0; i < entryCount; i++) {
    if (currentOffset + 8 > iinfBox.end) break
    const infeSize = dataView.getUint32(currentOffset)
    const infeType = String.fromCharCode(
      ...new Uint8Array(buffer, currentOffset + 4, 4)
    )

    if (infeType === 'infe') {
      const infeVersion = dataView.getUint8(currentOffset + 8)
      const infeContentStart = currentOffset + 12

      if (infeVersion >= 2) {
        let itemId
        let itemTypeStr = ''
        if (infeVersion === 2) {
          itemId = dataView.getUint16(infeContentStart)
          itemTypeStr = String.fromCharCode(
            ...new Uint8Array(buffer, infeContentStart + 4, 4)
          )
        } else {
          // version 3
          itemId = dataView.getUint32(infeContentStart)
          itemTypeStr = String.fromCharCode(
            ...new Uint8Array(buffer, infeContentStart + 6, 4)
          )
        }

        if (itemTypeStr === 'Exif') {
          exifItemId = itemId
          break
        }
      }
    }
    if (infeSize === 0) break
    currentOffset += infeSize
  }

  if (exifItemId === -1) {
    console.error('Exif item not found')
    return {}
  }

  const ilocBox = findBox(dataView, metaBoxContentStart, metaBox.end, 'iloc')
  if (!ilocBox) {
    console.error('iloc box not found')
    return {}
  }

  const ilocVersion = dataView.getUint8(ilocBox.start)
  const sizes = dataView.getUint16(ilocBox.start + 4) // Version + flags are 4 bytes large. They usually are all 0x00.
  const offsetSize = (sizes >> 12) & 0x0f
  const lengthSize = (sizes >> 8) & 0x0f
  const baseOffsetSize = (sizes >> 4) & 0x0f
  const indexSize = ilocVersion === 1 || ilocVersion === 2 ? sizes & 0x0f : 0

  let ilocParseOffset = ilocBox.start + 6
  let ilocItemCount
  if (ilocVersion < 2) {
    ilocItemCount = dataView.getUint16(ilocParseOffset)
    ilocParseOffset += 2
  } else {
    ilocItemCount = dataView.getUint32(ilocParseOffset)
    ilocParseOffset += 4
  }

  let exifOffset = -1
  let exifLength = -1

  for (let i = 0; i < ilocItemCount; i++) {
    let currentItemId
    if (ilocVersion < 2) {
      currentItemId = dataView.getUint16(ilocParseOffset)
      ilocParseOffset += 2
    } else {
      currentItemId = dataView.getUint32(ilocParseOffset)
      ilocParseOffset += 4
    }

    if (ilocVersion === 1 || ilocVersion === 2) {
      ilocParseOffset += 2 // construction_method
    }

    ilocParseOffset += 2 // data_reference_index

    let baseOffset = 0
    if (baseOffsetSize > 0) {
      ilocParseOffset += baseOffsetSize
    }

    const extentCount = dataView.getUint16(ilocParseOffset)
    ilocParseOffset += 2

    const extentsStartOffset = ilocParseOffset

    if (currentItemId === exifItemId) {
      for (let j = 0; j < extentCount; j++) {
        if ((ilocVersion === 1 || ilocVersion === 2) && indexSize > 0) {
          ilocParseOffset += indexSize
        }

        let currentExtentOffset = 0
        switch (offsetSize) {
          case 1:
            currentExtentOffset = dataView.getUint8(ilocParseOffset)
            break
          case 2:
            currentExtentOffset = dataView.getUint16(ilocParseOffset)
            break
          case 4:
            currentExtentOffset = dataView.getUint32(ilocParseOffset)
            break
          case 8:
            currentExtentOffset = Number(dataView.getBigUint64(ilocParseOffset))
            break
        }
        ilocParseOffset += offsetSize

        let currentExtentLength = 0
        switch (lengthSize) {
          case 1:
            currentExtentLength = dataView.getUint8(ilocParseOffset)
            break
          case 2:
            currentExtentLength = dataView.getUint16(ilocParseOffset)
            break
          case 4:
            currentExtentLength = dataView.getUint32(ilocParseOffset)
            break
          case 8:
            currentExtentLength = Number(dataView.getBigUint64(ilocParseOffset))
            break
        }
        ilocParseOffset += lengthSize

        exifOffset = baseOffset + currentExtentOffset
        exifLength = currentExtentLength
        break
      }
      break
    }
    ilocParseOffset =
      extentsStartOffset + extentCount * (indexSize + offsetSize + lengthSize)
  }

  if (exifOffset !== -1 && exifLength !== -1) {
    const itemData = avif.subarray(exifOffset, exifOffset + exifLength)
    let tiffHeaderOffset = -1
    for (let i = 0; i < itemData.length - 4; i++) {
      if (
        (itemData[i] === 0x4d &&
          itemData[i + 1] === 0x4d &&
          itemData[i + 2] === 0x00 &&
          itemData[i + 3] === 0x2a) || // MM*
        (itemData[i] === 0x49 &&
          itemData[i + 1] === 0x49 &&
          itemData[i + 2] === 0x2a &&
          itemData[i + 3] === 0x00) // II*
      ) {
        tiffHeaderOffset = i
        break
      }
    }

    if (tiffHeaderOffset !== -1) {
      const exifData = itemData.subarray(tiffHeaderOffset)
      const data: Record<string, any> = parseExifData(exifData)
      for (const key in data) {
        const value = data[key]
        if (typeof value === 'string') {
          if (key === 'usercomment') {
            try {
              const metadataJson = JSON.parse(value)
              if (metadataJson.prompt) {
                metadata[ComfyMetadataTags.PROMPT] = metadataJson.prompt
              }
              if (metadataJson.workflow) {
                metadata[ComfyMetadataTags.WORKFLOW] = metadataJson.workflow
              }
            } catch (e) {
              console.error('Failed to parse usercomment JSON', e)
            }
          } else {
            const [metadataKey, ...metadataValueParts] = value.split(':')
            const metadataValue = metadataValueParts.join(':').trim()
            if (
              metadataKey.toLowerCase() ===
                ComfyMetadataTags.PROMPT.toLowerCase() ||
              metadataKey.toLowerCase() ===
                ComfyMetadataTags.WORKFLOW.toLowerCase()
            ) {
              try {
                const jsonValue = JSON.parse(metadataValue)
                metadata[metadataKey.toLowerCase() as keyof ComfyMetadata] =
                  jsonValue
              } catch (e) {
                console.error(`Failed to parse JSON for ${metadataKey}`, e)
              }
            }
          }
        }
      }
    } else {
      console.log('Warning: TIFF header not found in EXIF data.')
    }
  }
  return metadata
}

export function getFromAvifFile(file: File): Promise<Record<string, string>> {
  return new Promise<Record<string, string>>((resolve) => {
    const reader = new FileReader()
    reader.onload = (event) => {
      const buffer = event.target?.result as ArrayBuffer
      if (!buffer) {
        resolve({})
        return
      }

      try {
        const comfyMetadata = parseAvifMetadata(buffer)
        const result: Record<string, string> = {}
        if (comfyMetadata.prompt) {
          result['Prompt'] = JSON.stringify(comfyMetadata.prompt)
        }
        if (comfyMetadata.workflow) {
          result['Workflow'] = JSON.stringify(comfyMetadata.workflow)
        }
        resolve(result)
      } catch (e) {
        console.error('Parser: Error parsing AVIF metadata:', e)
        resolve({})
      }
    }
    reader.onerror = (err) => {
      console.error('FileReader: Error reading AVIF file:', err)
      resolve({})
    }
    reader.readAsArrayBuffer(file)
  })
}
