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

## Managed account creation

ADMIN and OWNER can open Members and create WORKER accounts with assigned skills.
Only ADMIN can change roles afterward. The server-only SUPABASE_SECRET_KEY is
required. Apply migration 202611020003_provision_workers.sql before use. New Auth
accounts remain banned until the service-only provisioning transaction validates
the active actor and assigns WORKER. A failed setup remains locked for administrator
repair; it is never silently activated. No passwords enter audit payloads.
Disable public signup in hosted Supabase Auth settings as well as local config.
The application does not offer registration. No email is sent by account creation.

## Username login

Usernames are normalized lowercase, unique, 3–32 ASCII letters/digits/dot/underscore/hyphen.
Login accepts username or email; username-to-current-Auth-email resolution is
server-only using the secret client. There is no public lookup endpoint. New worker
creation requires a username and stays locked if assignment fails. Migration 005
assigns dangduyminh109 to the initial administrator without changing the password.
Password recovery continues to require email.

## Deletion policy update

Only ADMIN may delete records. OWNER and WORKER never receive delete_records.
Migration 010 restores deletion of unused mat catalog entries to ADMIN only.
Historical foreign keys and transactional auditing remain enforced. No financial,
stock movement, work-log or payment deletion endpoint is exposed.

## Role selection at account creation

Migration 011 allows ADMIN to choose one or more OWNER/WORKER/ADMIN roles when
creating an account. OWNER is restricted to WORKER regardless of form inputs.
Assignments are transactionally audited by a service-only RPC that revalidates
the actor. Skills apply only when WORKER is selected.

## Member editing

Migration 012 adds an atomic update of name, username, phone, roles, skills, status
and zero-wage policy. ADMIN may edit other accounts. OWNER may edit ordinary
workers only, without altering roles or zero-wage arrangements. Email/password
are not changed by this operation. Self-profile editing remains separate.

## Password policy

Application forms/actions accept 5–128 characters without character-class rules.
Hosted Supabase Auth additionally enforces its configured password policy; the
platform minimum may be higher than five. Do not claim the provider setting was
changed by changing app validation. Demo accounts use the user-specified password;
no password is stored in source, migrations or seed data.
