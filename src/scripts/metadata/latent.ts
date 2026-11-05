export function getFromLatentFile(
  file: File
): Promise<Record<string, string> | undefined> {
  return new Promise((r) => {
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const safetensorsData = new Uint8Array(
          event.target?.result as ArrayBuffer
        )
        const dataView = new DataView(safetensorsData.buffer)
        const headerSize = dataView.getUint32(0, true)
        const offset = 8
        const header = JSON.parse(
          new TextDecoder().decode(
            safetensorsData.slice(offset, offset + headerSize)
          )
        )
        r(header.__metadata__)
      } catch {
        r(undefined)
      }
    }
    reader.onerror = () => r(undefined)
    reader.onabort = () => r(undefined)
    const slice = file.slice(0, 1024 * 1024 * 4)
    reader.readAsArrayBuffer(slice)
  })
}
