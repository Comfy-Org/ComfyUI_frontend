type SaveError = 'denied' | 'invalid' | 'conflict' | 'failed'
export type SaveResult = { ok: true } | { ok: false; error: SaveError }
