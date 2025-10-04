### `/docs/SECURITY.md`
```markdown
# Security Guidelines

## Overview

This document outlines security best practices and measures implemented in the Baccarat Strategy Advisor application.

---

## Authentication Security

### Supabase Auth

**Implementation:**
- Google OAuth via Supabase Auth
- Server-side session validation
- Secure token storage in httpOnly cookies

**Best Practices:**
- ✅ Use service role key only on server-side
- ✅ Validate user sessions on sensitive operations
- ✅ Implement proper redirect URL whitelist
- ✅ Monitor failed authentication attempts

**Security Measures:**
```javascript
// Server-side user validation
const { data: { user }, error } = await supabase.auth.getUser();
if (!user) {
  return res.status(401).json({ error: 'Unauthorized' });
}