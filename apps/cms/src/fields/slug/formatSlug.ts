export const formatSlug = (value: string): string =>
  value
    .replace(/ /g, '-')
    .replace(/[^\w-]+/g, '')
    .toLowerCase()
