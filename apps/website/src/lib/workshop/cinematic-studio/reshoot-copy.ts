import type { MessageKey } from '../../../i18n/translations'
import { createTranslator } from '../../../i18n/translations'
import en from '../../../locales/en/reshoot.json' with { type: 'json' }
import ja from '../../../locales/ja/reshoot.json' with { type: 'json' }
import zhCN from '../../../locales/zh-CN/reshoot.json' with { type: 'json' }

export const { t: rc } = createTranslator({ en, 'zh-CN': zhCN, ja })

export type ReshootCopyKey = MessageKey<typeof en>
