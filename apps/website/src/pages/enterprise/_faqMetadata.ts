import { faqAnswerPlainText } from '../../utils/faqAnswer'
import { faqPageNode } from '../../utils/jsonLd'

interface FaqMetadataItem {
  question: string
  answer: string
}

export function buildFaqPageNode(
  pageUrl: string,
  items: readonly FaqMetadataItem[]
) {
  return faqPageNode(
    pageUrl,
    items.map((item) => ({
      question: item.question,
      answer: faqAnswerPlainText(item.answer)
    }))
  )
}
