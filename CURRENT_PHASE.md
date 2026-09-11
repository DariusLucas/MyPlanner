# Phase A1 — Email/Password and Google Authentication

## Status

Application implementation, local verification, hosted provider setup, and the
live Google account check are complete. The user-controlled password recovery
check remains before the phase can be closed.

## Objective

Replace the user-facing email magic-link/one-time-code flow with email/password
and Google sign-in on web and Android without changing planner ownership or
losing existing Supabase data.

## Required Behavior

- Existing passwordless users can set a password through recovery email.
- New users can create an email/password account and confirm it when required.
- Returning users can sign in with email/password.
- Users can continue with Google on web and Android.
- Google OAuth returns to the web PKCE callback or Android deep link.
- Google identities with the same verified email resolve to the existing
  Supabase user and planner data.
- Password recovery supports web and Android callbacks.
- Android sessions remain encrypted with the Android Keystore.

## Implementation Checklist

- [x] Add shared password, recovery, update-password, and Google OAuth helpers.
- [x] Replace the web OTP form with sign-in, sign-up, Google, and recovery UI.
- [x] Add the web OAuth/email callback and guarded password-update page.
- [x] Replace the Android OTP form with matching authentication options.
- [x] Add Android external-browser OAuth and recovery deep-link handling.
- [x] Preserve automatic planner initialization for newly authenticated users.
- [x] Update setup documentation and auth contract tests.
- [x] Verify lint, types, web build, mobile build, Capacitor sync, and Android APK.
- [x] Configure Google Auth Platform branding/audience/contact details.
- [x] Create the Google OAuth client and securely add it to Supabase.
- [x] Add exact hosted web and Android callback URLs to both Supabase projects.
- [x] Complete live Google sign-in and verify existing planner data is preserved.
- [ ] Complete live email/password and password-recovery checks.

## Explicitly Out of Scope

- Do not add unrelated providers, MFA, teams, sharing, or account administration.
- Do not change planner schema, RLS ownership, historical data, or visual language.
- Do not remove any existing Supabase user or create a replacement planner owner.

## Completion Criteria

- Email/password, password recovery, and Google work end-to-end on web and Android.
- Existing passwordless users retain the same Supabase user ID and planner data.
- All automated checks and native builds pass.
- No OAuth client secret is committed, bundled, logged, or copied into chat.

## Relevant Dependencies

- Supabase development project: `uychwbumaseqbjkcyiyd`.
- Supabase production project: `iicwadngdwxgjodxkdnb`.
- Google Cloud project selected for this integration: `planner-508311`.
- Google Auth Platform remains private in external testing mode, with the
  intended Google account registered as its sole test user.
