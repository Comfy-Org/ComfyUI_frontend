// 'cancel' defers the decision (the next turn re-asks); the other three act on
// the pending draft, per DES-502.
export type ConflictChoice = 'agent' | 'mine' | 'newtab' | 'cancel'
