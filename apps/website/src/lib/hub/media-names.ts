const NAMES: Record<string, string> = {
  image: 'Image',
  video: 'Video',
  audio: 'Audio',
  '3d': '3D',
  text: 'Text'
}

export const mediaName = (value: string) => NAMES[value] ?? value
