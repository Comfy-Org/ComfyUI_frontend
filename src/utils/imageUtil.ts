export const is_all_same_aspect_ratio = (imgs: HTMLImageElement[]): boolean => {
  if (!imgs.length || imgs.length === 1) return true

  const ratio = imgs[0].naturalWidth / imgs[0].naturalHeight

  for (let i = 1; i < imgs.length; i++) {
    const this_ratio = imgs[i].naturalWidth / imgs[i].naturalHeight
    if (ratio != this_ratio) return false
  }

  return true
}
