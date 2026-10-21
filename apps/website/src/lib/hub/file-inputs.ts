/** The loader nodes that take a file from the reader, by node type. */
export const FILE_INPUTS: Record<
  string,
  { accept: 'image' | 'video' | 'audio'; label: string } | undefined
> = {
  LoadImage: { accept: 'image', label: 'Image' },
  LoadVideo: { accept: 'video', label: 'Video' },
  VHS_LoadVideo: { accept: 'video', label: 'Video' },
  LoadAudio: { accept: 'audio', label: 'Audio' }
}
