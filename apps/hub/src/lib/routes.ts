import { tagSlug } from './tag-aliases'

export const categoryPath = (type: string) => `/workflows/category/${type}/`
export const modelPath = (name: string) => `/workflows/model/${name}/`
export const tagPath = (tag: string) => `/workflows/tag/${tagSlug(tag)}/`
export const thumbnailPath = (asset: string) =>
  asset.startsWith('http://') || asset.startsWith('https://')
    ? asset
    : `/workflows/thumbnails/${asset}`
