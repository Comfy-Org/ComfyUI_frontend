import type { Locale, LocalizedText } from '../../i18n/translations'

interface FaqPair {
  id: string
  question: LocalizedText
  answer: LocalizedText
}

export interface ResolvedFaq {
  id: string
  question: string
  answer: string
}

/**
 * A locale's FAQ items, resolved so a question and its answer always share one
 * language.
 *
 * They used to fall back separately, in two places that had to agree and did
 * not: the rendered section and the FAQPage JSON-LD. Machine translation
 * reached the questions in `src/data/*.ts` but skipped the answers, which are
 * template literals the pipeline will not rewrite, so `/ja/ltx-2.5` published a
 * Japanese question above an English answer — and said so again in structured
 * data. A reader cannot act on half a pair, and it reads as a broken page
 * rather than an untranslated one, so an item that is not translated end to end
 * stays English end to end.
 */
export function resolveFaqPairs(
  items: readonly FaqPair[],
  locale: Locale
): ResolvedFaq[] {
  return items.map((item) => {
    const question = item.question[locale]
    const answer = item.answer[locale]
    return question && answer
      ? { id: item.id, question, answer }
      : { id: item.id, question: item.question.en, answer: item.answer.en }
  })
}
