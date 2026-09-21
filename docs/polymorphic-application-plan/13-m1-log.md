# 13. M1 log

| Date | Item | Status | Evidence |
|---|---|---|---|
| 2026-09-20 | PB-010 JWT verification (jose 5, RS256, issuer+audience bound, JWKS cached per Lambda) | done | `graph-server/src/auth/jwt.ts`, tests `src/__tests__/auth.js` |
| 2026-09-20 | PB-011 REST Lambda REQUEST authorizer on every non-OPTIONS method | done, deployed to dev | `serverless.yaml` `custom.jwtAuthorizer`; live: `GET /toc.json` without token → 401, bad token → 401, OPTIONS → 200 |
| 2026-09-20 | PB-012 WebSocket `$connect` authorizer (token as `Sec-WebSocket-Protocol: access_token, <jwt>`), principal stored on the connection record, every later message attributed through `withPrincipal` in `handler.ts`; client-supplied identity fields ignored | done, deployed | `src/auth/principal.ts`, `broadcastService.connect`; live: handshake without/with bad token → 401. **Positive path (real token, subprotocol echo through API Gateway) pending the browser test.** |
| 2026-09-20 | PB-013 policy module | skeleton | `src/policy/decide.ts` (reference-instance owner policy, OWNER_SUBS, agent scopes); the matrix arrives with admission |
| 2026-09-20 | PB-014 editor sends the token (audience = server URL, mandatory login in server mode, subprotocol handshake, bearer on CRDT HTTP routes, refresh before reconnect with backoff) | done, pushed | `graph-editor` commit 4df455d; ratchet 505 = baseline; tests 61 + 16 pass; build ok |
| 2026-09-20 | PB-015 route hardening | done earlier (task 1); the interim API key is now removed in favour of the token | `serverless.yaml` |
| 2026-09-20 | Decision | Auth0 API created by the owner with identifier `https://rmeu8g85f4.execute-api.us-west-1.amazonaws.com/dev`; scopes/M2M/organizations deferred (single principal) | §12.2 |

Next in M1: PB-020 (`MutationEnvelope` v2 + acks) → PB-021/022/023 (staged admission, policy on the diff, audit chain) → PB-024 (editor SyncStatus + reject recovery, spike S-2) → PB-060/061 (scheduler 2.1).
