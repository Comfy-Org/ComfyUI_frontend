export function failureSummary(
  label: string,
  failures: string[],
  attachment: string
): string {
  if (failures.length === 0) return label
  const preview = failures
    .slice(0, 10)
    .map((failure, index) => `  ${index + 1}. ${failure.split('\n')[0]}`)
    .join('\n')
  return `${label}: ${failures.length} failure(s); first ${Math.min(10, failures.length)} below, full list in ${attachment}:\n${preview}`
}
