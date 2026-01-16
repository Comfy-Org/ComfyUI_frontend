### 6. Dual-Auth State Consistency Risk

**Location:** Overall Architecture

**Issue:**
Firebase JWT + session cookie means two sources of truth. If session cookie fails to create/delete but Firebase state changes, user might see unexpected behavior.

**Impact:**

- Potential for auth state inconsistency
- Hard to debug issues where Firebase thinks user is logged in but session cookie is missing
- No way to detect or recover from mismatched states

**Suggested Fix:**
Document failure modes and recovery strategy. Consider adding:

- Health check endpoint to verify session cookie matches Firebase state
- Background reconciliation task
- Clear user feedback when session operations fail
- Retry logic with exponential backoff

---

## Testing Checklist

Before merging, verify:

- [ ] Login creates session cookie once (not twice)
- [ ] Token refresh updates session cookie
- [ ] Logout clears session cookie (or logs warning if it fails)
- [ ] Session creation failure doesn't prevent login
- [ ] Session deletion failure doesn't prevent logout
- [ ] App doesn't call DELETE on cold start when user is logged out
- [ ] Non-cloud builds don't call session endpoints
- [ ] Network failures are handled gracefully
