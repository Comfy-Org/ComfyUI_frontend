import path from 'node:path'

import { ignorePatterns } from '../.oxlintrc.json'
import { runChangedLineLint } from './changed-line-lint'

runChangedLineLint({
  name: 'null-types',
  config: path.resolve(
    import.meta.dirname,
    '../tools/oxlint-plugins/nullTypes.oxlintrc.json'
  ),
  isGatedPath: (file) =>
    /\.(?:[cm]?tsx?|vue)$/.test(file) &&
    !ignorePatterns.some((pattern) => path.matchesGlob(file, pattern))
})
