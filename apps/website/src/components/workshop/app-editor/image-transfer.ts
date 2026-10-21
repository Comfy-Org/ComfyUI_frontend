/** The first image a drop or a paste carries, if it carries one. */
export function imageFileOf(data: DataTransfer | null): File | undefined {
  return Array.from(data?.files ?? []).find((file) =>
    file.type.startsWith('image/')
  )
}
