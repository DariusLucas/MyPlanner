# Phase U4 — Planning and Routine Clarity

## Objective

Make weekly planning feel simpler and make recurring weekly targets immediately
understandable without expanding MyPlanner into a general habit system.

## Required Behavior

- Keep Checklist as the default This Week view and Kanban as an optional view.
- Reduce duplicate Add task affordances in empty weekly states so each context
  has one clear primary action.
- Keep quick-add fast for one-off tasks, with the minimum choices needed to
  place an action on a day or keep it flexible for the week.
- Replace ambiguous “Repeat this week” language with clear weekly routine or
  weekly target language throughout composers, task cards, and supporting copy.
- Explain that a weekly target resets on Monday and represents a number of
  check-ins for the week.
- Preserve task completion, Reopen, Undo, dialog accessibility, reduced motion,
  Supabase revisions, Realtime refresh, and web/Android parity from Phase U3.
- Preserve the approved visual design and the Plan → Do → Complete → See
  Progress loop.

## Implementation Checklist

- [ ] Inventory weekly empty states, Add task affordances, default-view logic,
      quick-add fields, and recurring-task language across web and Android.
- [ ] Remove or demote duplicate Add task actions while retaining one obvious
      action in each weekly planning context.
- [ ] Verify Checklist remains the default and Kanban remains an optional,
      explicitly selected view.
- [ ] Simplify one-off task creation without removing required placement,
      category, estimate, or revision behavior.
- [ ] Rename “Repeat this week” and related ambiguous copy to weekly routine or
      weekly target language.
- [ ] Add concise reset and check-in guidance where recurring targets are
      created and displayed.
- [ ] Verify the revised planning flow at narrow mobile widths and on Android.
- [ ] Add source, interaction, responsive, and mobile tests for the clarified
      defaults, actions, and language.
- [ ] Run dashboard, week, focus-area, mobile, responsive, interaction,
      typecheck, lint, web build, and Android build checks.
- [ ] Update the UI/UX audit and roadmap status documentation.

## Explicitly Out of Scope

- Do not add a generic habit tracker, streak system, rewards, scoring, or new
  recurrence semantics.
- Do not change the database schema, recurrence ownership, Monday reset rules,
  Supabase conflict handling, or task history.
- Do not redesign the orange palette, sidebar, typography, spacing, themes,
  rounded component language, or established task/dialog interactions.
- Do not perform the final full-product usability and polish pass; that is
  Phase U5.

## Completion Criteria

Phase U4 is complete when weekly planning presents one clear Add task path per
context; Checklist is the default and Kanban is an optional choice; one-off
task creation remains fast; weekly routines clearly communicate their target,
check-ins, and Monday reset; the clarified behavior is consistent on web and
Android; existing task data and concurrency behavior remain correct; and all
relevant checks pass.

## Relevant Dependencies from Previous Phases

- U1 establishes Today as the primary landing experience and action hierarchy.
- U2 provides daily completion feedback that weekly planning must continue to
  feed accurately.
- U3 provides shared completion controls, dialog accessibility, semantic
  tokens, short-viewport behavior, and reduced-motion coverage.
- Existing weekly recurrence behavior already supplies count-per-week targets,
  Monday reset semantics, completion history, and optimistic revisions; U4
  clarifies that behavior rather than replacing it.
