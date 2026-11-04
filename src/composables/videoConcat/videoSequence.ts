interface SequencePosition {
  index: number
  offset: number
}

export function sequenceStarts(durations: readonly number[]): number[] {
  let elapsed = 0
  return durations.map((duration) => {
    const start = elapsed
    elapsed += duration
    return start
  })
}

export function locateSequenceTime(
  durations: readonly number[],
  time: number
): SequencePosition {
  const starts = sequenceStarts(durations)
  const lastIndex = durations.length - 1
  if (lastIndex < 0) return { index: 0, offset: 0 }
  const index = starts.findLastIndex(
    (start, i) => start <= time && (i === lastIndex || durations[i] > 0)
  )
  if (index < 0) return { index: 0, offset: 0 }
  return {
    index,
    offset: Math.min(Math.max(time - starts[index], 0), durations[index])
  }
}
