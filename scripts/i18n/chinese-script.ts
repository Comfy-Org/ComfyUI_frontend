import type { LocaleObject, LocaleValue } from './locale-tree'
import { collectLeaves } from './locale-tree'

const scriptVariants = [
  ['节点', '節點'],
  ['画布', '畫布'],
  ['图像', '圖像'],
  ['选择', '選擇'],
  ['减小', '減小'],
  ['关闭', '關閉'],
  ['删除', '刪除'],
  ['复制', '複製'],
  ['制作', '製作'],
  ['输入', '輸入'],
  ['后端', '後端'],
  ['侧边栏', '側邊欄'],
  ['队列', '佇列'],
  ['旧版', '舊版'],
  ['标准', '標準'],
  ['菜单', '選單'],
  ['设备', '裝置'],
  ['显示', '顯示']
] as const

function collectStrings(value: LocaleValue): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(collectStrings)
  if (value && typeof value === 'object') {
    return Object.values(value).flatMap(collectStrings)
  }
  return []
}

export function auditChineseScript(
  localeCode: string,
  locale: LocaleObject,
  skipKeys: ReadonlySet<string> = new Set()
): string[] {
  const forbiddenTerms =
    localeCode === 'zh'
      ? scriptVariants.map(([, traditional]) => traditional)
      : localeCode === 'zh-TW'
        ? scriptVariants.map(([simplified]) => simplified)
        : []
  if (forbiddenTerms.length === 0) return []

  return [...collectLeaves(locale)].flatMap(([key, leaf]) => {
    if (skipKeys.has(key)) return []
    const value = collectStrings(leaf.value).join('\n')
    const matches = forbiddenTerms.filter((term) => value.includes(term))
    return matches.length > 0
      ? [
          `${leaf.path.join('.')}: contains cross-script terms ${matches.join(', ')}`
        ]
      : []
  })
}
