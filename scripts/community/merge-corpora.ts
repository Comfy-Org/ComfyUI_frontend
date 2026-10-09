import { mergeCorpora } from './corpusAssets'

const [preferred, additional, output] = process.argv.slice(2)
if (!preferred || !additional || !output)
  throw new Error(
    'Usage: pnpm exec tsx scripts/community/merge-corpora.ts <preferred-assets> <additional-assets> <new-output>'
  )
const result = await mergeCorpora(preferred, additional, output)
console.log(
  `Merged ${result.count} original workflows; preserved preferred metadata for ${result.preservedOverlap} overlapping graphs`
)
