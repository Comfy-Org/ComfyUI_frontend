export function formatCamelCase(str: string): string {
  // Check if the string is camel case
  const isCamelCase = /^([A-Z][a-z]*)+$/.test(str)

  if (!isCamelCase) {
    return str // Return original string if not camel case
  }

  // Split the string into words, keeping acronyms together
  const words = str.split(/(?=[A-Z][a-z])|\d+/)

  // Process each word
  const processedWords = words.map((word) => {
    // If the word is all uppercase and longer than one character, it's likely an acronym
    if (word.length > 1 && word === word.toUpperCase()) {
      return word // Keep acronyms as is
    }
    // For other words, ensure the first letter is capitalized
    return word.charAt(0).toUpperCase() + word.slice(1)
  })

  // Join the words with spaces
  return processedWords.join(' ')
}
