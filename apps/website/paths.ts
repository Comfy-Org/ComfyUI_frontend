import { dirname } from 'node:path'

export const websiteRoot = import.meta.dirname
export const repoRoot = dirname(dirname(websiteRoot))
