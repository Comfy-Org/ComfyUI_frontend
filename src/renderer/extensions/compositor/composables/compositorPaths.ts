export interface ImageFileRef {
  filename: string
  subfolder: string
  type: string
}

export function imageRefViewQuery(ref: ImageFileRef): string {
  const params = new URLSearchParams({ filename: ref.filename })
  if (ref.subfolder) params.set('subfolder', ref.subfolder)
  params.set('type', ref.type)
  return params.toString()
}
