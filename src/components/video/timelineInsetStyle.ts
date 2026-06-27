export function timelineInsetLeftStyle(normalized: number) {
  return {
    left: `calc(${normalized} * (100% - 2rem) + 1rem)`
  }
}
