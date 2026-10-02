/** The first image among dropped, pasted or picked files. */
export function firstImage(
  files: FileList | readonly File[] | null | undefined
): File | undefined {
  return Array.from(files ?? []).find((file) => file.type.startsWith('image/'))
}
