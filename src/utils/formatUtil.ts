export function formatCamelCase(str: string): string {
  // Check if the string is camel case
  const isCamelCase = /^([A-Z][a-z]*)+$/.test(str)

  if (!isCamelCase) {
    return str // Return original string if not camel case
  }

  // Add space before capital letters and trim any leading space
  return str.replace(/([A-Z])/g, ' $1').trim()
}
