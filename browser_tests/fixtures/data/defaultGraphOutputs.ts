export const defaultGraphNodeIds = {
  kSampler: '3',
  saveImage: '9'
} as const

export function savedImageOutput(filename: string) {
  return { images: [{ filename, subfolder: '', type: 'output' }] }
}
