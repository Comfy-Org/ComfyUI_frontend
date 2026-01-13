export async function extractFileFromDragEvent(
  event: DragEvent
): Promise<File | undefined> {
  if (!event.dataTransfer) return

  // Dragging from Chrome->Firefox there is a file but its a bmp, so ignore that
  if (
    event.dataTransfer.files.length &&
    event.dataTransfer.files[0].type !== 'image/bmp'
  ) {
    return event.dataTransfer.files[0]
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
