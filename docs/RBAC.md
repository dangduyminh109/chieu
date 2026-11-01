# Roles and authorization

| Capability                               | ADMIN            | OWNER       | WORKER                              |
| ---------------------------------------- | ---------------- | ----------- | ----------------------------------- |
| Workshop production overview             | Yes              | Yes         | Own records only                    |
| Mat and labor rate management            | Yes              | Yes         | Read catalog / own applicable rates |
| Submit own work                          | With WORKER      | With WORKER | Yes, assigned skills                |
| Profile name/phone/password              | Own              | Own         | Own                                 |
| Role/skill/status/zero-policy assignment | Other users only | No          | No                                  |
| Audit events                             | Yes              | No          | No                                  |
| Sales, inventory, payments               | Future           | Future      | No financial access                 |

Roles are additive, not a single enum column on the profile. ADMIN does not
implicitly become a worker. An OWNER+WORKER can run the business and enter their
own production. Skills authorize stage selection only and never financial access.
The `can` helper does not use skills as role evidence.

Server components and actions verify identity through Supabase Auth, then read
active profiles and database role assignments. Frontend visibility is convenience;
server checks, restricted SQL grants, RPC checks and RLS enforce the boundaries.
Unauthenticated users are redirected to login and cannot SELECT business tables.
Inactive profiles cannot read operational data or submit with an old valid token.

WORKER work-log SELECT is restricted to `worker_id = auth.uid()`. A manager can
read team logs. A worker cannot read another worker's individual rate, profile,
role membership or skill assignments. Default labor rates are visible to workers
for preview, but no sales/purchase/financial tables are exposed.

RLS policies call narrowly scoped security-definer helpers to avoid recursive
policy evaluation. Public/anon function execution is revoked. All application
writes call RPCs rather than direct table mutation. Do not add blanket service-role
clients as a shortcut: that would bypass RLS.

First ADMIN is bootstrapped in trusted SQL after verifying a real invited Auth
user. Public signup must be disabled in the Supabase project. There is no web
route that promotes arbitrary email addresses. Subsequent role management requires
ADMIN, an explicit reason, and cannot change the acting admin's own privileges.
OWNER-scoped invitations are planned; Phase 1 invitations require an administrator.

The browser uses only the publishable key. No service-role or Supabase Auth admin
API secret is required. Supabase Auth enforces password/session/rate-limit controls.
Configure HTTPS and auth redirect allowlists before using real accounts.
