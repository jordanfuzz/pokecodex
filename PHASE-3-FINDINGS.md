# Phase 3 — open findings for Jordan

Three items surfaced during phase 3's final review and verification that need
a human decision before (or as part of) phase 4. Prioritize or descope, then
delete this file — the durable copies live in [docs/BACKLOG.md](docs/BACKLOG.md)
once triaged.

## 1. Authenticated cross-user writes (security, pre-existing)

Phase 3's auth hardening closed the unauthenticated hole, but a *logged-in*
user who obtains another user's `users_pokemon` uuid can still write to it:
`updateUsersPokemon`, `updateNoteForUsersPokemon`, `deleteUsersPokemon`, and
`evolveUsersPokemon` (all in
[api/src/users-pokemon/users-pokemon-repository.js](api/src/users-pokemon/users-pokemon-repository.js))
key off the row id from the request body with no ownership predicate.
`updateUsersPokemon` is the sharp one — it sets `user_id` to the session user,
so it reassigns the catch (a takeover, not just an edit).

Fix is small: add `and user_id = $n` to each `where` clause (and drop
`user_id` from the update's set-list), mirroring how the new
source-override/box-data code already scopes writes. Risk is low today
(small, Discord-gated user base), which is why it was left as your call.

User note: Yes, fix this immediately.

## 2. Box view vs. globally-required non-standard source types (design)

The spec and plan quietly disagreed, and the plan's version shipped: box view
creates rows only for gender/variant/regional types plus *individually
forced* (pill-override) sources. If you ever enable a rule like **shiny
globally**, the list view will demand a shiny for every pokemon while the box
view renders no shiny rows — the two v1 outcomes ("completion correct" and
"box viewer works") contradict for that user.

Decide: (a) every required source earns a box row (a global shiny rule then
roughly doubles the box), or (b) box view is deliberately form-only and the
spec line gets struck. The gate is `entryMakesBoxRow` in
[app/src/components/box-view/box-view.jsx](app/src/components/box-view/box-view.jsx).
Related minor: box sprite, read-mode checklist, and edit-mode checkbox
disagree about whether `isCaught` gates the checked display — reachable by
checking a record in a gen-1 game and viewing it from gen 3.

User note: For the major decision - option (b) for now. Keep the box view form-only. 
Most games will not have room in PC boxes for more than this anyway. 
For the related minor note: This is actually probably more significant than it seems 
and may need some brainstorming. For "box completion", many games will require trading up
from previous generations. So in the box view, whether a pokemon "is caught" might 
actually mean "is traded up". The difference here is that you cannot trade pokemon 
directly from gens 1-2 to gen 3, so all gen 3 pokemon have to be caught in gen 3 games in
order to appear in the boxes. The rules for what counts as "is caught" might differ from
generation to generation. If this is not clear, let's brainstorm this.


## 3. Admin /sources page unverified (smoke gap)

The end-to-end smoke could not exercise the admin source-editor page: the
dev-login user in the current dev dump is not an admin, and flipping
`is_admin` wasn't something I'd do without asking. Everything the page
depends on (auth, `/api/sources` routes, `addSourceForPokemon` admin check)
passed at the API level, but the page itself hasn't been clicked through
since the auth change. One manual pass as your real admin account (or a
temporary `is_admin` flip in dev) closes it.

I'll check this manually in production once phase 3 is deployed. For our purposes here, 
mark it as done. Nothing else for agents to do here yet. Anything flagged from
the sources page testing will get added to BACKLOG.md.

---

Also on your plate, from [docs/phase-3-deploy.md](docs/phase-3-deploy.md):
the deploy ordering is load-bearing (DDL before code, then the records
migration with `--dry-run` first — its suffix-matching path has never run
against real production data).
