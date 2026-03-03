// POST /api/marketplace/templates/:id/media
export async function uploadMedia(
  _templateId: string,
  file: File
): Promise<{ url: string; type: string }> {
  // Mock: create a local object URL.
  // Real implementation: POST FormData to server, return persisted URL.
  const url = URL.createObjectURL(file)
  return { url, type: file.type }
}
