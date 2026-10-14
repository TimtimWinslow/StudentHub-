# StudentHub v1.0.0 Release Gate

This checklist separates automated repository checks from checks that require the live Supabase project, a signed-in browser, or a physical device. A green CI run does not by itself certify live application behavior.

## Automated checks
- [ ] JavaScript syntax checks pass.
- [ ] Inline scripts in `index.html` parse.
- [ ] `manifest.json` parses and its icon files exist.
- [ ] Local assets referenced by `index.html` exist.
- [ ] Every service-worker app-shell asset exists.
- [ ] Core feature entry points and academic report handlers are present.
- [ ] Required privacy and combined-chapter migration files are tracked.

## Live release checks
- [ ] Confirm the current Supabase schema matches the app's expected tables and columns.
- [ ] Apply reviewed SQL migrations in Supabase; confirm they succeed before inviting classmates.
- [ ] Test signup, email confirmation (if enabled), login, password reset, logout, and session restoration.
- [ ] Use two student accounts to test data isolation, direct messages, Care Team chat, notifications, and privacy preferences.
- [ ] Verify admin-only actions are rejected by the database/server for a non-admin, not merely hidden in the UI.
- [ ] Verify scores, GPA, letter grades, chapter 9/10, class filters, and pending chapters against known examples.
- [ ] Test academic CSV export and print report on iPhone Safari and desktop.
- [ ] Test profile editing, avatar upload, settings persistence, and data export.
- [ ] Test responsive layout and PWA installation on intended platforms.
- [ ] Confirm the deployed Vercel build is the reviewed commit and the service worker updates cleanly.
- [ ] Review browser console and Supabase logs for errors.
- [ ] Resolve all critical/high-priority findings and record any accepted minor limitations.
- [ ] Publish the GitHub v1.0.0 release only after the live release checks pass.

## Security migration
- [ ] Review and apply `supabase/v1_0_release_security_hardening.sql` after the Care Team and admin migrations.
- [ ] Test that a student cannot read another student's direct messages or private-conversation membership.
- [ ] Test that a student cannot join a private conversation without being invited by its creator.
