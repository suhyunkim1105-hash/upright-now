# Campus verification and realtime battle design

## Goal

Make the campus territory game trustworthy and legible:

- only a student verified with that preset school's email domain can contribute or capture;
- tile attacks, defenses, contests, and captures are visible to everyone viewing the live map;
- each preset school retains a clearly distinguishable, non-official visual identity.

The feature remains a non-official game prototype. It does not claim university endorsement or use official logos or mascots.

## Scope and decisions

- Supported schools are the ten existing preset schools. Custom schools remain selectable as a personal theme but cannot join the territory game until an administrator adds an approved domain in a future SQL migration.
- Verification flow: choose a preset school, enter an email address at an allowed domain, receive a six-digit Supabase email OTP, enter the code, then receive a verified status for that school.
- A verified user may contribute only for the school in the verification record. Changing a school requires a new verification; the existing season and seven-day school-change limits still apply.
- The Supabase project uses Email OTP authentication for verification. The app never copies the email address into application tables; application data holds only user ID, school ID, normalized domain, and verified timestamp.
- Existing anonymous users can view the map. Beginning email verification establishes the email-authenticated identity used for future campus actions. Historic anonymous contributions are not migrated in this change.

## Data and authorization

A new migration creates:

- `campus_school_domains`: preset school ID to allowed email-domain mapping. Seeded rows are explicit and may be reviewed or extended by SQL only.
- `campus_verifications`: one current verification per `auth.uid()`, containing `school_id`, `email_domain`, `verified_at`, and `updated_at`; no raw email address.

The migration adds a security-definer `campus_verify_school` RPC that confirms the authenticated user's Supabase email has a permitted domain before writing the verification. It revokes direct writes to verification tables and enables RLS.

`campus_set_school` and `campus_record_contribution` are changed to require a current matching verification. The checks happen inside the RPCs, so a modified browser request cannot contribute or capture for another school. Read access exposes only what the map needs; it never exposes other users' email or verification records.

## Client flow

`SchoolPicker` becomes a two-stage interaction for preset schools:

1. Pick a school, then enter a school email.
2. Request and enter the six-digit code through Supabase Auth.
3. Call the verification RPC, refresh campus membership, and show a verified badge.

While unverified, the campus page still shows the live map, standings, and each school's visual theme, but the contribution CTA explains that email verification is required. A rejected domain, expired code, network failure, and a school/email mismatch all have recoverable messages and a retry action.

The existing color and pattern tokens remain intentionally labelled as prototype presets. The map, selected-school card, verified badge, and battle feed use the same color plus short school name and text/icon labels, so meaning is not conveyed by color alone. No official university logo, mascot, or character is introduced.

## Live battle visibility

The existing Realtime subscription receives tile and tile-event changes. The client will additionally retain a bounded recent-event feed and surface transient map feedback:

- attack/defense: flash the affected tile and append a "[school] is challenging/reinforcing [territory]" event;
- contest: visually distinguish challenger and owner with labeled progress;
- capture: flash the tile, announce the owner change in the feed, and update standing counts from the refreshed snapshot.

Events are derived from server-authoritative `campus_tile_events`; clients do not broadcast battle results. Reconnect retains the current full-reload behavior and then resumes event listening. Reduced-motion users receive text/feed updates without flashing animation.

## Privacy and security

- Camera video, frames, landmarks, posture coordinates, bad-posture state, and health information remain excluded from Supabase.
- The email stays in Supabase Auth. Application tables retain a domain only where it is required for server-side authorization and auditability.
- No service-role key or mail-provider secret goes to the browser.
- Supabase Dashboard must enable Email provider and configure the production redirect URL before release.

## Tests and acceptance criteria

- Unit tests cover allowed-domain matching, unverified/mismatched authorization states, verification UI states, and derived battle feed entries.
- SQL parity tests assert the migration contains RLS, revoked direct writes, matching-verification checks, and Realtime publication coverage.
- Component tests confirm an unverified user can view but cannot contribute, while a matching verified user can.
- Realtime repository tests confirm a tile event updates both the map snapshot and the recent battle feed.
- Final verification runs lint, typecheck, unit tests, build, and the focused campus E2E suite with a configured Supabase environment.

## Release and handoff

1. Create a new Supabase project and enable Anonymous Sign-Ins and Email OTP.
2. Run the existing six SQL files in the team-provided order.
3. Run the new migration produced by this work in SQL Editor.
4. Put the new project's URL and publishable/anon key in the first two lines of `.env.local`; enable the campus Supabase flags.
5. Add the same public values and flags to the intended Vercel environment, deploy, and verify with two browser sessions using two allowed school domains.

The final database change is delivered as a timestamped SQL file under `supabase/migrations/` for team review and application to the shared server.
