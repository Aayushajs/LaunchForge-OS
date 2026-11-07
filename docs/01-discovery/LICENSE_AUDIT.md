# License Audit

> Baseline: Dokploy `canary` @ `d73650694` · Date: 2026-11-07
> **This is an engineering reading of the licence files, not legal advice.** Items in §5 need confirmation from Dokploy or a lawyer before any commercial use.

## 1. Licence files in the repository

| File | Applies to | Summary |
|---|---|---|
| `LICENSE.MD` | Everything **outside** `/proprietary` directories | Apache License 2.0, © 2026-present Dokploy Technology, Inc. |
| `LICENSE_PROPRIETARY.md` | Everything **inside** any `/proprietary` directory | Dokploy Source Available License (DSAL) 1.0 |
| `TERMS_AND_CONDITIONS.md` | "Dokploy core" (the product/service) | Free to install, modify and operate for personal or business use; **"any commercial resale or redistribution of Dokploy as a service is strictly forbidden without explicit consent"** |
| `apps/monitoring/LICENSE.md` | Go monitoring agent | MIT, © 2025 Mauricio Siu |
| `apps/dokploy/package.json` | `dokploy` package | `"license": "Apache-2.0"` |

No `NOTICE` file exists at the repository root.

## 2. What each licence allows

### Apache-2.0 (most of the codebase)
- ✅ Use, modify, distribute, sublicense, use commercially.
- ✅ Distribute modified versions under Apache-2.0 or other terms for your own changes.
- Obligations: keep the licence text and copyright notices; mark modified files as changed; include any `NOTICE` content.
- ❌ No trademark rights. The **"Dokploy" name and logo can't be used for LaunchForge**, so rebranding is required anyway, not just cosmetic.

### DSAL 1.0 (`/proprietary` only)
- ✅ Copy and modify **for development and testing** without a subscription.
- ❌ **Production use requires a valid commercial agreement with Dokploy.**
- ❌ Modifications become Dokploy's property and may only be used under the DSAL.
- ❌ Copying, publishing, distributing, sublicensing or selling is otherwise forbidden.

### MIT (`apps/monitoring`)
- ✅ Permissive; keep the copyright and permission notice.

## 3. Proprietary code inventory

| Location | Contents |
|---|---|
| `packages/server/src/services/proprietary/` | `license-key.ts` (`hasValidLicense`, `resolveOrganizationDefaultRole`), `audit-log.ts`, `sso.ts`, `whitelabeling.ts`, `forward-auth.ts` |
| `apps/dokploy/server/api/routers/proprietary/` | `audit-log.ts`, `custom-role.ts`, `forward-auth.ts`, `license-key.ts`, `scim.ts`, `sso.ts`, `whitelabeling.ts` |
| `apps/dokploy/components/proprietary/` | audit-log UI, GitHub/Google sign-in buttons, signup showcase, enterprise gate, licence key UI, custom roles UI, SSO/SCIM/forward-auth UI, white-labeling UI |

**Not proprietary (Apache-2.0)**, even though they serve those features: the DB schemas `audit-log.ts`, `sso.ts`, `scim.ts`, `forward-auth.ts` under `packages/server/src/db/schema/`, `packages/server/src/lib/access-control.ts`, `apps/dokploy/server/utils/enterprise.ts`, `packages/server/src/utils/crons/enterprise.ts`.

### Coupling into Apache-2.0 code

Proprietary modules are imported by core code, so a LaunchForge production build would execute DSAL code even with every enterprise feature switched off:

- `packages/server/src/lib/auth.ts` — `createAuditLog`, `resolveOrganizationDefaultRole` (runs on every login/logout and signup)
- `packages/server/src/services/permission.ts` — `hasValidLicense` (runs on permission checks)
- `apps/dokploy/server/api/trpc.ts` — `hasValidLicense` (`enterpriseProcedure`)
- `apps/dokploy/server/api/utils/audit.ts` — wraps `createAuditLog`; imported by ~47 router files
- `packages/server/src/services/{server,git-provider}.ts`, routers `git-provider`, `server`, `user`, `organization`
- `apps/dokploy/server/api/root.ts` — mounts all 7 proprietary routers
- `apps/dokploy/server/utils/billing.ts`, `pages/_document.tsx`, `pages/index.tsx`, `pages/register.tsx`, several settings pages

## 4. Assessment for LaunchForge

| Scenario | Apache-2.0 core | DSAL `/proprietary` | Dokploy T&C | Verdict |
|---|---|---|---|---|
| Develop and test locally | ✅ | ✅ (dev/test allowed) | ✅ | **OK** |
| Phase A: self-host for own portfolio/projects | ✅ | ❌ production use without agreement | ✅ personal/business operation allowed | **OK only after removing `/proprietary`** |
| Phase A: publish LaunchForge source on GitHub (portfolio) | ✅ with attribution | ❌ can't republish DSAL code | ✅ not a service | **OK after removing `/proprietary`**, keep licence notices |
| Phase A: others install LaunchForge on their own servers | ✅ | ❌ | Likely ✅ (they operate it themselves) | **OK after removal**, confirm wording of "redistribution" |
| Phase B: sell LaunchForge hosting as a paid service | ✅ under Apache-2.0 alone | ❌ | ❌ "commercial resale … as a service … forbidden without explicit consent" | **Blocked** until consent obtained or legal advice says the T&C does not bind Apache-2.0 code |

### Recommendations

1. **Remove all `/proprietary` directories and their imports** (GAP A2). Re-implement what LaunchForge needs (audit log, custom roles, default role resolution, social login buttons) as new, original Apache-2.0 code. Add a CI check that fails if a `proprietary/` path reappears via an upstream merge.
2. **Write the replacements from the Apache-2.0 schemas and our own design, not by copying DSAL code.** The DSAL claims ownership of modifications, so copy-and-edit would not produce clean code.
3. **Rebrand fully** (name, logo, image names, email templates, domains). Keep a clear attribution: "LaunchForge is based on Dokploy (Apache-2.0)".
4. **Keep `LICENSE.MD`** (Apache-2.0 text and Dokploy copyright) and add a `NOTICE` file crediting Dokploy and the MIT-licensed monitoring agent. Mark modified files per Apache-2.0 §4(b), e.g. via the commit history plus a statement in `NOTICE`.
5. **Don't offer a paid hosted service (Phase B) until §5 is resolved.**

## 5. Open questions to resolve before Phase B

1. Does the "commercial resale or redistribution as a service" clause in `TERMS_AND_CONDITIONS.md` restrict code licensed under Apache-2.0, or only the use of the Dokploy product and brand? (The two documents conflict on their face.)
2. Would Dokploy grant explicit consent for a hosted LaunchForge service, and on what terms?
3. Does "redistribution" in the T&C cover publishing a renamed, modified fork that others self-host?
4. Is the external `install.sh` (not in the repo) under the same Apache-2.0 licence, if any part of it is reused?
5. Are any bundled assets (logos, icons, email templates) under separate terms?
