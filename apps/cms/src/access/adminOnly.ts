import type { Access, PayloadRequest } from 'payload'

export const isAdmin = (user: PayloadRequest['user']) => user?.role === 'admin'

// Content mutations and user administration are admin-only. The `website-preview`
// role exists solely to read drafts through an API key, so it must fail this
// check — otherwise a leaked preview key could edit or delete published content.
export const adminOnly: Access = ({ req: { user } }) => isAdmin(user)

// `access.admin` has its own signature (boolean only, no Where clause), so it
// can't reuse `adminOnly` directly.
export const adminPanel = ({ req }: { req: PayloadRequest }) => isAdmin(req.user)
