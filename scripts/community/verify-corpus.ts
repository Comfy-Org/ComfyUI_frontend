import { readCorpus } from './corpusAssets'

const directory = process.argv[2]
if (!directory)
  throw new Error(
    'Usage: pnpm exec tsx scripts/community/verify-corpus.ts <directory>'
  )
const { index } = await readCorpus(directory)
console.log(
  `Verified ${index.entries.length} QA assets, original byte hashes, and any adapted graph digests/change ledgers`
)
