export async function extractFileFromDragEvent(
  event: DragEvent
): Promise<File | FileList | undefined> {
  if (!event.dataTransfer) return

  const { files } = event.dataTransfer
  // Dragging from Chrome->Firefox there is a file, but it's a bmp, so ignore it
  if (files.length === 1 && files[0].type !== 'image/bmp') {
    return files[0]
  } else if (files.length > 1 && Array.from(files).every(hasImageType)) {
    return files
  }

  // Try loading the first URI in the transfer list
  const validTypes = ['text/uri-list', 'text/x-moz-url']
  const match = [...event.dataTransfer.types].find((t) =>
    validTypes.includes(t)
  )
  if (!match) return

  const uri = event.dataTransfer.getData(match)?.split('\n')?.[0]
  if (!uri) return

  const response = await fetch(uri)
  const blob = await response.blob()
  return new File([blob], uri, { type: blob.type })
}

const hasImageType = ({ type }: File): Boolean => type.startsWith('image');
