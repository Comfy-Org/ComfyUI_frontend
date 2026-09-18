export function workshopUploadOrigin(value: string): URL {
  const origin = new URL(value)
  const loopback =
    origin.hostname === 'localhost' ||
    origin.hostname.endsWith('.localhost') ||
    origin.hostname === '[::1]' ||
    /^127\.\d+\.\d+\.\d+$/.test(origin.hostname)
  if (
    !(
      origin.protocol === 'https:' ||
      (origin.protocol === 'http:' && loopback)
    ) ||
    origin.username ||
    origin.password
  )
    throw new Error('Expected HTTPS or loopback HTTP, without credentials')
  return origin
}
