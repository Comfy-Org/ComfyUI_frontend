type NodeLedger<T> = Record<string, T>

function matchingEntries<T>(
  ledger: Record<string, NodeLedger<T>>,
  pack: string
): Array<[string, NodeLedger<T>]> {
  const folded = pack.toLowerCase()
  return Object.entries(ledger).filter(
    ([ledgered]) => ledgered.toLowerCase() === folded
  )
}

export function packLedgerFor<T>(
  ledger: Record<string, NodeLedger<T>>,
  pack: string
): NodeLedger<T> {
  const matches = matchingEntries(ledger, pack)
  if (matches.length > 1)
    throw new Error(
      `pack ledger has duplicate case-insensitive keys for ${pack}: ${matches.map(([key]) => key).join(', ')}`
    )
  return matches[0]?.[1] ?? {}
}

export function assertPackLedgerKeys<T>(
  name: string,
  ledger: Record<string, NodeLedger<T>>,
  manifestPacks: string[]
): void {
  const foldedManifest = new Set(
    manifestPacks.map((pack) => pack.toLowerCase())
  )
  const unmatched = Object.keys(ledger).filter(
    (pack) => !foldedManifest.has(pack.toLowerCase())
  )
  const duplicates = Object.keys(ledger).filter(
    (pack, index, packs) =>
      packs.findIndex(
        (candidate) => candidate.toLowerCase() === pack.toLowerCase()
      ) !== index
  )
  if (unmatched.length > 0 || duplicates.length > 0)
    throw new Error(
      `${name} has invalid pack keys: ${[
        unmatched.length > 0 ? `not in manifest: ${unmatched.join(', ')}` : '',
        duplicates.length > 0
          ? `case-insensitive duplicates: ${duplicates.join(', ')}`
          : ''
      ]
        .filter(Boolean)
        .join('; ')}`
    )
}
