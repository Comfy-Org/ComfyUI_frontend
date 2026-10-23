/** A picked image's natural size, or undefined when it does not decode. */
export function imageSize(
  url: string
): Promise<{ width: number; height: number } | undefined> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () =>
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => resolve(undefined)
    img.src = url
  })
}
