function fileToDataUrl(
  file: File,
  onProgress?: (percent: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    if (onProgress) {
      reader.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress(Math.round((event.loaded / event.total) * 100))
        }
      }
    }
    reader.readAsDataURL(file)
  })
}

// POST /api/marketplace/templates/:id/media
export async function uploadMedia(
  _templateId: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<{ url: string; type: string }> {
  // Mock: convert to base64 data URL so it persists in localStorage.
  // Real implementation: POST FormData to server, return persisted URL.
  const url = await fileToDataUrl(file, onProgress)
  return { url, type: file.type }
}
