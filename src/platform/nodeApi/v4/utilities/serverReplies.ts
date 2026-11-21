/** `key` of each object in a list a server answered, or `undefined` if one has no string there. */
export function textFieldOfEach(
  reply: unknown,
  key: string
): string[] | undefined {
  if (!Array.isArray(reply)) return undefined
  const fields = reply.map((entry: unknown) =>
    typeof entry === 'object' && entry !== null
      ? Reflect.get(entry, key)
      : undefined
  )
  return fields.every((field) => typeof field === 'string') ? fields : undefined
}
