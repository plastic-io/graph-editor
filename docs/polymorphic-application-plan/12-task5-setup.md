# 12. Task 5 setup: the three credentialed steps, prepared to one command each

Nothing below has been executed; each needs an account the plan's author does not hold. Everything else (templates, workflows, scope names) is committed and validated.

## 12.1 Publish `@plastic-io/graph-crdt` (PB-120)
The package already ships its TypeScript sources (`packages/GraphCrdt/package.json`: `main: ./main.ts`, `files` = the seven `.ts` files, `private: false`, peer deps `yjs ^13.6.0`, `lib0 ^0.2.99`), and the server already compiles TS from `node_modules` (`allowTsInNodeModules`, `tsconfig.json` include). Publishing as-is is therefore the least disruptive step; a compiled `dist/` can follow later.
1. In `graph-editor/packages/GraphCrdt`: bump `version` to `1.1.0` (the `file:` consumer has no version history to respect).
2. `npm login` as the `@plastic-io` scope owner, then `npm publish --access public` from that directory (the `files` list keeps tests out of the tarball).
3. In `graph-server/package.json`: replace `"@plastic-io/graph-crdt": "file:../graph-editor/packages/GraphCrdt"` with `"^1.1.0"`, `npm install`, run `npx jest` and `npx serverless package`; the `resolve.symlinks:false` (webpack) and `moduleNameMapper` (jest) settings stay — they still guarantee a single `yjs` copy.
4. Delete the second `actions/checkout` step from `graph-server/.github/workflows/{test,deploy}.yml` (it exists only for the `file:` link).

## 12.2 Auth0 configuration (PB-010, PB-014, PB-080, PB-086)
Tenant in use by the editor's remote `appConfig`: `dev-7q-g69up.us.auth0.com`, SPA client `VCDSy72k7efF46kRfsJyizaXOl1gtUKl` (registry `package.json`, GE-30). In the Auth0 dashboard (or with the Management API):
1. **API (resource server)** "Plastic-IO Graph Server": identifier = the MCP endpoint URL, e.g. `https://rmeu8g85f4.execute-api.us-west-1.amazonaws.com/dev/mcp` (RFC 8707 audience, plan §5.0); signing RS256; token lifetime 1 h; enable **RBAC** and **Add Permissions in the Access Token**.
2. **Permissions (scopes)** on that API — exactly the authority names of §4.4.5: `graph:read`, `graph:inspect-internals`, `graph:inspect-payloads`, `graph:observe`, `graph:propose`, `graph:approve`, `graph:commit`, `graph:activate`, `graph:rollback`, `graph:execute`, `graph:simulate`, `graph:test`, `graph:connect-privileged`, `component:publish`, `registry:read`, `iac:propose`, `iac:approve`, `iac:read-status`, `policy:admin`.
3. **SPA client** (existing): add the API as an allowed audience; add the server-backed editor's origin(s) to Allowed Callback/Logout/Web Origins (never the GitHub Pages demo origin, Q-8).
4. **Machine-to-machine application** "pio-agent-dev" authorised for the API with the read/propose/commit scopes only (Q-1: commit allowed); its `client_id` is the agent `sub` that delegation records reference (§5.0).
5. **Organizations**: enable; an Action on login adds `https://plastic-io/tenant` = `org_id` (or `personal:<sub>` when no org, Q-2) and the `permissions` claim.
6. Record in `policy/` after M1: the tenant mapping and the first delegation record for `pio-agent-dev`.
The server's authorizer (PB-011/012) needs three values as environment variables: `AUTH0_DOMAIN`, `AUTH0_AUDIENCE`, `AUTH0_JWKS_URL` (`https://<domain>/.well-known/jwks.json`).

## 12.3 GitHub OIDC deploy role (PB-125)
Template: `graph-server/infra/github-oidc-deploy-role.yaml` (validated with `aws cloudformation validate-template`). Deploy once with an administrator profile:
```
aws cloudformation deploy --profile tony --region us-west-1 \
  --stack-name plastic-io-github-deploy --capabilities CAPABILITY_NAMED_IAM \
  --template-file graph-server/infra/github-oidc-deploy-role.yaml \
  --parameter-overrides GitHubOrg=plastic-io GitHubRepo=graph-server AllowedRef='refs/tags/v*' CreateProvider=true
aws cloudformation describe-stacks --profile tony --region us-west-1 --stack-name plastic-io-github-deploy --query 'Stacks[0].Outputs'
```
Then set the repository variable `AWS_DEPLOY_ROLE_ARN` (GitHub → Settings → Secrets and variables → Actions → Variables) and create a `dev` environment; the workflow `graph-server/.github/workflows/deploy.yml` deploys on `v*` tags, packages before deploying, and re-snapshots both API Gateway stages (task 1 lesson). Set `CreateProvider=false` if the account already has the GitHub OIDC provider.

## 12.4 Staging stage and isolated test environment (before M3)
- `npx serverless deploy --stage staging` creates a second, fully separate stack (`plastic-io-graph-server-staging`, its own bucket and APIs); the editor's server-backed build points at it through its `appConfig`.
- `pio-test-` environment for IaC tests (PB-105): a dedicated AWS account or, at minimum, an IAM user/role restricted to `arn:aws:cloudformation:*:*:stack/pio-test-*/*` with the same denies as A8.3; used only by the nightly job.

## 12.5 Push the branches
Nothing from this session has been pushed. Order: `graph-editor` `docs/polymorphic-application-plan` then `m0-baseline` (stacked); `graph-server` `harden-dev-surface` then `m0-baseline` (stacked, the hardening is already live on `dev`). Pushing `m0-baseline` triggers the new test workflows for the first time.
