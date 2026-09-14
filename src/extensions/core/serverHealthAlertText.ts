/**
 * Some deployments send `server_health_alert.message` in capitals
 * ("STAGING ENVIRONMENT"). Only an all-capitals message is recased, so one
 * that carries its own casing keeps its proper nouns and its punctuation.
 */
export function toTitleCase(text: string): string {
  if (text !== text.toUpperCase()) return text
  return text
    .toLowerCase()
    .replace(/(?<=^|\s)\p{L}/gu, (letter) => letter.toUpperCase())
}
