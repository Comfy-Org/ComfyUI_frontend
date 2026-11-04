import { useI18n } from 'vue-i18n'

import type { StatusLine } from './nodeView'

export function useStatusText() {
  const { t } = useI18n()
  return (line: StatusLine | null): string => {
    if (!line) return ''
    if (line.text !== undefined) return line.text
    if (line.key === undefined) return ''
    const params = line.params ?? {}
    return line.count === undefined
      ? t(line.key, params)
      : t(line.key, params, line.count)
  }
}
