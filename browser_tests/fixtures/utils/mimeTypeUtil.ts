export function getMimeType(fileName: string): string {
  const name = fileName.toLowerCase()
  if (name.endsWith('.png')) return 'image/png'
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg'
  if (name.endsWith('.webp')) return 'image/webp'
  if (name.endsWith('.svg')) return 'image/svg+xml'
  if (name.endsWith('.avif')) return 'image/avif'
  if (name.endsWith('.webm')) return 'video/webm'
  if (name.endsWith('.mp4')) return 'video/mp4'
  if (name.endsWith('.json')) return 'application/json'
  if (name.endsWith('.glb')) return 'model/gltf-binary'
  return 'application/octet-stream'
}
