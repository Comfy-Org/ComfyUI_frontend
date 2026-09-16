export function isHttpImageSource(value: string): boolean {
  if (
    /[\s\\]/.test(value) ||
    !/^https?:\/\//i.test(value) ||
    !URL.canParse(value)
  )
    return false
  const url = new URL(value)
  return !!url.hostname && !url.username && !url.password
}
