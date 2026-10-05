export function selectModelShard<T>(
  models: readonly T[],
  index: number,
  total: number,
  maxCases: number
): T[] {
  if (
    ![index, total, maxCases].every(Number.isSafeInteger) ||
    index < 0 ||
    total < 1 ||
    index >= total ||
    maxCases < 1
  )
    throw new Error('Invalid model shard bounds')
  const selected = models.filter((_, position) => position % total === index)
  if (!selected.length) throw new Error('Selected model shard is empty')
  if (selected.length > maxCases)
    throw new Error(
      'Model shard exceeds its paid-job budget; increase shard count'
    )
  return selected
}
