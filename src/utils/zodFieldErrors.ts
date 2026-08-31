import type { ZodError } from 'zod'

export function getZodFieldErrors(error: ZodError): Record<string, string> {
  const { fieldErrors } = error.flatten()

  return Object.fromEntries(
    Object.entries(fieldErrors).flatMap(([field, messages]) =>
      messages?.[0] ? [[field, messages[0]]] : []
    )
  )
}
