function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// POST /api/marketplace/templates/:id/media
export async function uploadMedia(
  _templateId: string,
  file: File
): Promise<{ url: string; type: string }> {
  // Mock: convert to base64 data URL so it persists in localStorage.
  // Real implementation: POST FormData to server, return persisted URL.
  const url = await fileToDataUrl(file)
  return { url, type: file.type }
}
