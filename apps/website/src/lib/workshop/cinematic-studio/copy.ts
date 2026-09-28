import type { MessageKey } from '../../../i18n/translations'
import { createTranslator } from '../../../i18n/translations'
import en from '../../../locales/en/cinematic.json' with { type: 'json' }
import ja from '../../../locales/ja/cinematic.json' with { type: 'json' }
import zhCN from '../../../locales/zh-CN/cinematic.json' with { type: 'json' }

/**
 * Copy for the Cinematic Studio only. It has its own catalog, outside the
 * site-wide one, so the studio's strings ship with the studio and do not add
 * to every other page's script budget.
 */
export const { t: tc } = createTranslator({ en, 'zh-CN': zhCN, ja })

export type CinematicCopyKey = MessageKey<typeof en>
