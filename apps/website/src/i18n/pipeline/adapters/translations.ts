import { catalogEntries } from '../catalogs'
import type { SourceAdapter } from '../types'

export const translationsAdapter: SourceAdapter = {
  name: 'translations',
  read: () => catalogEntries('main.json')
}
