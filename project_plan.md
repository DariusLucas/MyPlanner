# MyPlanner — Personal Progress System

## Product Direction

MyPlanner is a private, local-first personal planning application.

It is **not** a general-purpose productivity suite.

It is not intended to compete with Notion, Todoist, Linear, Trello, Habitica, or any other productivity product.

It exists for one person and one purpose:

> **Help me consistently take actions that move my life forward, and make that progress visible over time.**

The application should be extremely easy to understand and extremely quick to use.

The core product loop is:

```text
PLAN
  ↓
DO
  ↓
COMPLETE
  ↓
SEE PROGRESS
```

This is a hard product constraint.

Before adding any feature, ask:

> Does this feature directly help me plan what I need to do, execute it, complete it, or understand the progress I have made?

If the answer is no, do not add the feature.

---

# 1. IMPORTANT CONTEXT: EXISTING PROJECT

The project already exists.

Phase 1 and Phase 2 from the previous implementation plan have already been implemented.

The existing application currently includes:

- Next.js application foundation
- TypeScript
- Tailwind CSS
- existing design system
- existing application shell
- existing sidebar
- dark/light theme support
- SQLite persistence
- Drizzle ORM
- task functionality
- Dashboard
- Today functionality
- several placeholders for future pages/features

The project must **NOT be rebuilt from scratch**.

Before making changes:

1. inspect the entire current repository
2. inspect the existing database schema
3. inspect existing task logic
4. inspect existing routes
5. inspect reusable UI components
6. understand existing styling tokens
7. determine what can be reused
8. determine what should be removed
9. determine whether database migrations are required

Refactor incrementally.

Do not destroy working functionality unnecessarily.

---

# 2. DESIGN MUST BE PRESERVED

The current visual design is approved.

Do **not** redesign the application.

Preserve the existing:

- color palette
- orange accent color
- dark theme
- light theme
- typography
- page shell
- sidebar appearance
- sidebar sizing
- card appearance
- border styling
- rounded corners
- button styling
- spacing philosophy
- icon style
- subtle shadows
- general visual identity

The goal of this refactor is to simplify the **contents and product functionality**, not the visual design.

Do not turn the application into a generic white SaaS dashboard.

Do not introduce:

- new gradient-heavy styling
- glassmorphism
- huge metric cards
- excessive colors
- excessive animation
- XP
- levels
- coins
- badges for meaningless actions
- motivational quote systems

Reuse existing components wherever practical.

---

# 3. NEW APPLICATION STRUCTURE

The sidebar should become:

```text
Dashboard

This Week

Career

Content

Progress

----------------

Settings
```

Remove the existing sidebar pages:

```text
Today
Goals
Plan
Review
```

The Dashboard replaces the need for a separate Today page.

Do not create a dedicated Personal page yet.

Personal is a task category, not a separate application section.

---

# 4. CORE DATA PHILOSOPHY

There should be one universal task system.

A task can belong to one of three categories:

```text
Career
Content
Personal
```

Career and Content have dedicated pages because they represent the two primary goals currently being worked toward.

Personal tasks still:

- appear on Dashboard when relevant today
- appear in This Week
- count toward daily progress
- count toward streaks
- appear in Progress analytics

Personal does not need a dedicated page in the sidebar yet.

---

# 5. TASK MODEL

Every task should support approximately:

```text
id

title

description?        // optional

category
  career
  content
  personal

scheduledDate?      // null means "Anytime this week"

workflowStatus
  upcoming
  doing
  on_hold
  done

completedAt?

overdueFromDate?

recurrenceRuleId?

createdAt

updatedAt
```

Exact schema naming may differ if there is a strong architectural reason.

Avoid unnecessary fields.

There is deliberately:

- no priority
- no difficulty
- no XP value
- no estimated impact
- no arbitrary percentage
- no nested task hierarchy

Tasks should remain quick to create.

---

# 6. TASK COMPLETION IS DIFFERENT FROM KANBAN STATUS

This distinction is important.

`workflowStatus = done` does NOT necessarily mean the task has been permanently completed.

A task is actually completed only when:

```text
completedAt != null
```

This allows the Kanban workflow to work correctly.

Example:

```text
Upcoming
↓
Doing
↓
Done
↓
user confirms completion
↓
completedAt is set
```

---

# 7. COMPLETION SAFETY DELAY

Accidentally clicking a checkbox should not make a task instantly disappear.

When the user completes a task:

1. visually mark it completed immediately
2. keep it visible for approximately 4 seconds
3. allow the user to undo/uncheck during those 4 seconds
4. visually indicate that the task has been completed
5. after the delay, move it into completed history

The persistence strategy should be reliable.

Preferred implementation:

- save completion immediately
- keep the completed task temporarily visible in the UI
- provide Undo during the grace period
- if Undo is clicked, revert completion
- after approximately 4 seconds, remove it from the active list

This avoids losing completion if the user closes the app during the delay.

Do not implement a fragile client-only delayed database write.

---

# 8. THIS WEEK PAGE

This Week is the main planning page.

It must answer:

> What do I intend to accomplish this week?

The page should be extremely easy to scan.

---

# 9. WEEKLY CHECKLIST VIEW

The default view is Checklist.

Tasks should be grouped by day.

Example:

```text
THIS WEEK

Monday
✓ Load football dataset
✓ Apply for internship

Tuesday
□ Learn pandas groupby
□ Record football video

Wednesday
□ Build rolling form feature

Thursday
□ Apply to 2 jobs

Friday
□ Edit football video

Saturday
□ Publish video

Sunday
No tasks planned

ANYTIME THIS WEEK
□ Review MatchMind architecture
□ Find 5 job opportunities
```

Each day must be visually clear without creating giant containers.

---

# 10. "ANYTIME THIS WEEK"

This is a first-class scheduling option.

When adding a task, the user can select:

```text
Anytime this week
```

This means:

- the task belongs to the current week
- it does not have a specific scheduled day
- it should not appear on Dashboard automatically
- it appears in the clearly labelled `Anytime this week` section
- the user may later assign it to a particular day
- it remains active until completed, rescheduled, or deleted

Make the meaning visually obvious.

Do not use vague labels such as:

```text
Unscheduled
Backlog
Someday
```

Use:

```text
Anytime this week
```

because it clearly communicates its purpose.

---

# 11. WEEK VIEW TOGGLE

This Week supports two ways to look at the exact same tasks:

```text
Checklist
Kanban
```

Use a clean segmented toggle/button.

The toggle changes only the presentation.

It must NOT duplicate tasks or create separate task systems.

Task state persists when switching views.

---

# 12. KANBAN VIEW

Kanban columns:

```text
Upcoming

Doing

On Hold

Done
```

Tasks should be draggable between columns.

Persist the selected workflow status in the database.

Example:

```text
Upcoming
  Analyze dataset
  Apply to internship

Doing
  Learn pandas

On Hold
  Record TikTok

Done
  Build project setup       ✓
```

---

# 13. KANBAN DONE BEHAVIOR

Moving a card into `Done` does NOT instantly complete the task.

Once a task enters the Done column:

- show a clear check/confirm button on the card
- keep the task in Done until that button is pressed

After the confirmation button is pressed:

1. set `completedAt`
2. visually mark the card completed
3. start the approximately 4-second undo window
4. allow completion to be reversed
5. after the window expires, remove it from the active Kanban

This provides an intentional final completion action.

---

# 14. CHECKLIST MODE BEHAVIOR

Checklist mode is faster.

Each task has a normal checkbox.

When checked:

1. task becomes completed
2. completion is persisted immediately
3. task remains visible for approximately 4 seconds
4. user can uncheck/undo
5. after the grace period, it leaves the active list

Checklist and Kanban use the same underlying completion system.

---

# 15. KANBAN STATUS IN CHECKLIST MODE

Task workflow status must survive switching views.

If a task is currently:

```text
Doing
```

and the user returns to Checklist mode, optionally show a very subtle:

```text
Doing
```

label.

Likewise for:

```text
On Hold
```

Do not make these badges visually dominant.

Checklist mode should still feel like a checklist.

---

# 16. ADD TASK UX

Adding a task must be extremely quick.

Use the application's existing visual style.

Clicking:

```text
+ Add Task
```

should open a clean modal, sheet, or popover depending on which provides the best responsive UX.

Fields:

```text
Task

Category
  Career
  Content
  Personal

When
  Monday
  Tuesday
  Wednesday
  Thursday
  Friday
  Saturday
  Sunday
  Anytime this week

Description
  optional
```

Advanced options can contain:

```text
Repeat
```

Do not show unnecessary fields by default.

There is NO priority field.

---

# 17. EDITING TASKS

Tasks should support:

- edit title
- edit description
- change category
- change scheduled day
- move to Anytime this week
- change Kanban state
- delete
- complete
- undo completion

Keep editing lightweight.

---

# 18. RECURRING WEEKLY TASKS

Recurring tasks are required.

However, recurrence must NOT force specific weekdays.

The useful mental model is:

```text
Do this X times during the week.
```

Examples:

```text
Publish content
3 times per week

Apply for jobs
3 times per week

LeetCode
3 times per week
```

Do NOT require:

```text
Monday
Wednesday
Friday
```

---

# 19. RECURRING TASK UX

When creating/editing a task, allow:

```text
Repeat

[ ] No repeat
[ ] Times per week
```

If `Times per week` is selected:

```text
Times:
3
```

Keep the interaction simple.

---

# 20. RECURRING TASK IMPLEMENTATION

Use a recurrence rule such as:

```text
RecurringTaskRule

id
title
description?
category
timesPerWeek
enabled
createdAt
updatedAt
```

At the beginning of each new week, create the required task occurrences.

Example:

```text
Publish content
3 times per week
```

creates three task instances:

```text
Publish content
Publish content
Publish content
```

All three initially appear under:

```text
Anytime this week
```

The user can:

- leave them there
- assign one to Monday
- assign another to Tuesday
- assign another to Saturday
- complete them on any combination of days

The recurrence system must never decide the weekdays for the user.

---

# 21. WEEKLY RECURRENCE BOUNDARY

Recurring task instances belong to their generated week.

At the beginning of the next week, the next set of instances is generated.

Do not automatically carry unfinished recurring occurrences into the next recurrence cycle.

Otherwise this could produce:

```text
3 old tasks
+
3 new tasks
+
3 newer tasks
```

and create clutter.

Instead:

- preserve unfinished historical occurrences for analytics if needed
- mark them as expired/missed where appropriate
- do not include them in the next week's active planning view
- generate the fresh weekly set

Manual non-recurring tasks behave differently and can become overdue.

---

# 22. OVERDUE TASKS

Manual scheduled tasks automatically roll forward when missed.

Example:

Thursday:

```text
□ Record TikTok
```

If Thursday ends without completion, on Friday it becomes:

```text
Friday

□ Record TikTok
  Overdue from Thu
```

If still incomplete on Saturday:

```text
Saturday

□ Record TikTok
  Overdue from Thu
```

The original overdue date is preserved.

Do NOT change the badge to:

```text
Overdue from Fri
```

because Thursday was the original missed date.

---

# 23. OVERDUE DATA

Use something conceptually equivalent to:

```text
scheduledDate
overdueFromDate
```

When an incomplete scheduled task passes its due day:

```text
overdueFromDate = original scheduledDate
scheduledDate = current day
```

If already overdue:

```text
scheduledDate = current day
overdueFromDate remains unchanged
```

Implement this deterministically.

The application does not need a constantly running background process.

An overdue rollover function can safely run:

- when the application initializes
- when Dashboard loads
- when This Week loads
- once per detected local date

Make it idempotent.

---

# 24. COMPLETING OVERDUE TASKS

When an overdue task is completed:

- behave exactly like normal completion
- count it toward the actual day it was completed
- remove the overdue state from active views
- preserve historical scheduling information if useful for analytics

Example:

Task originally planned Thursday.

Completed Saturday.

For progress analytics:

```text
Planned: Thursday
Completed: Saturday
```

This allows future planned-vs-completed analysis.

---

# 25. DASHBOARD PURPOSE

The Dashboard has one job:

> Show me what matters today.

Remove the existing unnecessary conceptual separation between:

```text
Today
Daily Focus
```

There should be one unified Today experience.

Do not fill empty dashboard space with placeholder cards just because there is room.

Whitespace is acceptable.

---

# 26. DASHBOARD STRUCTURE

Approximate structure:

```text
Good morning · Thursday, August 13

What matters today?

🔥 14 productive days
Streak: Hot

TODAY
3 of 6 complete

□ Learn pandas groupby
□ Apply to one internship
□ Record football video

COMPLETED TODAY
✓ Load dataset
✓ Find five jobs
✓ Write video hook

QUICK THOUGHT
[ Dump an idea or thought... ]

This Week
3 completed today
3 remaining today
```

Do not copy this layout literally if the existing components suggest a cleaner arrangement.

Preserve the existing design system.

---

# 27. TODAY TASKS

Dashboard shows:

- tasks explicitly scheduled for today
- overdue tasks that have rolled into today

It does not automatically show:

```text
Anytime this week
```

tasks.

Those belong to This Week unless the user explicitly assigns them to today.

---

# 28. COMPLETED TODAY

Dashboard must display work already completed today.

Do not make completed tasks disappear entirely.

Have a clean:

```text
Completed today
```

section.

It may be collapsible if many tasks accumulate.

Show:

- task name
- category
- completion time if useful

Do not visually overpower remaining tasks.

Remaining work remains the primary focus.

---

# 29. TODAY SUMMARY

The Dashboard should make these obvious:

```text
Completed today
Remaining today
Total planned today
```

Do not create three giant statistic cards.

Integrate this compactly into the Today interface.

Example:

```text
3 of 6 complete
3 remaining
```

---

# 30. DAILY STREAK

Dashboard should prominently but tastefully display the current daily progress streak.

The streak represents:

> Number of productive days accumulated in the current valid streak.

A productive day is any day where at least ONE task is actually completed.

Task category does not matter.

Therefore:

```text
Career completion = productive
Content completion = productive
Personal completion = productive
```

---

# 31. WHAT DOES NOT COUNT TOWARD THE STREAK

These actions do NOT count:

```text
opening the application

creating a task

moving a task to Doing

moving a task to Done without confirming completion

writing a Quick Thought

editing a task

planning the next week

viewing progress
```

Only actual completed tasks count.

---

# 32. STREAK GRACE SYSTEM

The streak should intentionally allow real life to happen.

Missing one or two days does NOT reset the streak.

The user has a maximum of two consecutive grace days.

Example:

```text
Sunday
productive

Monday
no tasks completed
grace day 1

Tuesday
no tasks completed
grace day 2

Wednesday
LAST redemption day
```

If at least one task is completed on Wednesday:

```text
streak survives
streak increases by 1
```

If nothing is completed before Wednesday ends:

```text
streak resets
```

Technically:

A streak resets after **three consecutive nonproductive calendar days**.

---

# 33. STREAK COUNTING

Grace days do NOT increase the streak number.

Example:

```text
Current streak:
14 productive days

Monday missed
14

Tuesday missed
14

Wednesday completed task
15
```

NOT:

```text
17
```

The number represents productive days, not elapsed calendar days.

---

# 34. STREAK VISUAL STATES

Use visual states to communicate risk without creating anxiety.

Suggested states:

## Hot

No current missed days.

```text
🔥 15 productive days
```

## Cooling

One consecutive missed day.

Example copy:

```text
🔥 15 productive days
1 grace day used
```

## Cold / At Risk

Two consecutive missed days.

Example:

```text
15 productive days
Last redemption day
```

The styling can visually cool slightly while remaining consistent with the existing color palette.

Do not add aggressive red warnings or guilt-inducing language.

If the user completes something on the redemption day:

```text
Hot
16 productive days
```

---

# 35. STREAK RESET

At the end of the third consecutive nonproductive day:

```text
current streak = 0
```

On the next productive day:

```text
current streak = 1
```

Track:

```text
current productive-day streak
best productive-day streak
```

Best streak should remain historically visible.

---

# 36. QUICK THOUGHTS

Dashboard should provide a very fast brain-dump system.

This is NOT a notes application.

A thought contains only:

```text
id
text
createdAt
updatedAt
```

No:

- title
- category
- tags
- folder
- markdown editor
- rich text
- priority
- status

---

# 37. QUICK THOUGHT UX

Dashboard should contain a compact:

```text
Quick Thought
```

entry point.

Interaction:

```text
What's on your mind?

[ text area ]

Save
```

Saving should require almost no friction.

Automatically record timestamp.

Example:

```text
"What if MatchMind compared prediction confidence to betting odds?"

Aug 13 · 22:41
```

---

# 38. RECENT THOUGHTS

Dashboard should show approximately the latest 3 thoughts.

Include:

```text
View all
```

Clicking View all opens a modal, drawer, or similarly lightweight interface.

Do NOT create another sidebar page.

Old thoughts should support only:

```text
edit
delete
timestamp
```

Nothing more.

Quick Thoughts do NOT count toward progress or streaks.

---

# 39. CAREER PAGE

The Career page is intentionally simple.

It is NOT:

- a job CRM
- a learning tracker
- an AI curriculum
- a networking database
- a portfolio manager

For now it exists primarily as a filtered view of the universal task system.

---

# 40. CAREER PAGE CONTENT

Show:

```text
Career

Active
Completed
```

## Active

Display every incomplete task where:

```text
category = career
```

Useful grouping may include:

```text
Today
This Week
Anytime this week
Overdue
```

or another clean structure consistent with the rest of the application.

## Completed

Display historical Career tasks.

Allow reasonable date grouping/filtering later.

For V1:

```text
Today
This Week
Earlier
```

is sufficient.

---

# 41. CONTENT PAGE

Content uses the same task philosophy.

Show:

```text
Content

Active
Completed
```

Active contains incomplete:

```text
category = content
```

Completed contains completed Content tasks.

Do not reintroduce the previous complex:

```text
Ideas
Scripted
Filmed
Editing
Ready
Posted
```

pipeline yet.

If that becomes useful later it can be added intentionally.

---

# 42. CAREER + CONTENT MILESTONES

Career and Content should each contain one additional lightweight feature:

```text
Milestones
```

These are NOT tasks.

These represent achievements/outcomes I want to reach.

Content examples:

```text
1,000 views

10,000 views

1,000 likes

10,000 likes

1,000 followers

2,000 followers
```

Career examples include applications sent, interviews reached, offers received,
or a custom professional outcome. The exact meaning is intentionally flexible.

For example:

```text
1,000 views
```

could mean reaching 1,000 views on a piece of content.

Do not hardcode complex analytics semantics.

---

# 43. MILESTONE MODEL

Use something conceptually like:

```text
FocusMilestone

id

category
  career
  content

label

type
  views
  likes
  followers
  custom

targetValue?

achievedAt?

createdAt
updatedAt
```

Allow custom milestones.

Example:

```text
First video over 100k views
```

---

# 44. MILESTONE UX

Display milestones in a compact, visually pleasing section on both Career and
Content.

Example:

```text
MILESTONES

✓ First 1K views
○ 10K views
○ 1K followers
○ 2K followers

+ Add milestone
```

Marking one achieved:

- saves `achievedAt`
- keeps it historically visible
- can optionally show the achievement date

Milestones do not count as task completions and do not affect daily streaks.

They represent outcomes, not actions.

---

# 45. COMPLETED TASK HISTORY

Completed tasks must remain accessible.

Tasks should never simply disappear from existence.

Career and Content each provide:

```text
Active
Completed
```

This allows:

- seeing previous work
- recovering from accidental completion
- understanding progress over time

Task completion data is also necessary for Progress analytics.

---

# 46. PROGRESS PAGE PHILOSOPHY

Progress is the ONE page where detailed information is encouraged.

Dashboard should remain minimal.

Career and Content should remain minimal.

Progress can become rich and historical.

The goal is:

> In one year, I should be able to open Progress and clearly see the story of how consistently I worked toward my goals.

Progress must be based on real persisted data.

Do not generate fake metrics.

---

# 47. PROGRESS PAGE — TOP SUMMARY

Include a compact summary such as:

```text
Current streak
15 productive days

Best streak
34 productive days

Tasks completed
482

Productive days
193

This week
14 completed
```

Do not necessarily use giant cards.

Maintain visual balance.

---

# 48. GITHUB-STYLE ACTIVITY HEATMAP

Include a major GitHub-style contribution heatmap.

Each calendar day is represented by a square.

Intensity is based on tasks completed that day.

Example intensity:

```text
0 tasks
no activity

1 task
low intensity

2 tasks
medium-low

3 tasks
medium

4+ tasks
high
```

Every task counts equally.

Do NOT weight Career above Personal or Content.

Hovering a day should show:

```text
August 13

5 tasks completed

Career: 3
Content: 1
Personal: 1
```

Support long historical time ranges.

Ideally:

```text
3 months
6 months
1 year
All
```

For large histories, choose a practical visualization.

---

# 49. TASKS COMPLETED OVER TIME

Create a historical graph showing completed tasks.

Useful ranges:

```text
4 weeks
3 months
6 months
1 year
All time
```

Allow grouping by:

```text
Day
Week
Month
```

depending on selected range.

---

# 50. CAREER VS CONTENT VS PERSONAL

Create a comparison visualization showing task completions by category.

Possible visualization:

- stacked bar chart
- line chart
- area chart

User should easily understand:

```text
Career
Content
Personal
```

over time.

---

# 51. CATEGORY DISTRIBUTION

Include a pie/donut chart showing completed task distribution.

Example:

```text
Career 54%
Content 31%
Personal 15%
```

Use the existing design color philosophy.

Do not create a rainbow interface.

Use subtle differentiated tones consistent with the theme.

---

# 52. PRODUCTIVE DAYS GRAPH

Show productive days over time.

Example:

```text
Week 1
5 / 7 productive

Week 2
6 / 7

Week 3
4 / 7
```

Useful for seeing consistency independently from raw task count.

---

# 53. PLANNED VS COMPLETED

This is an important metric.

For a chosen time range calculate:

```text
Tasks planned
Tasks completed
Completion rate
```

Example:

```text
This week

Planned: 18
Completed: 14
Completion rate: 77.8%
```

This should help identify overplanning.

---

# 54. PLANNED VS COMPLETED GRAPH

Show historical completion rate.

Example:

```text
Week 1   82%
Week 2   73%
Week 3   91%
Week 4   68%
```

Allow category filtering:

```text
All
Career
Content
Personal
```

---

# 55. DAY-OF-WEEK ANALYTICS

Because the Progress page is intentionally detailed, include useful long-term insights such as:

```text
Tasks completed by weekday
```

Example:

```text
Monday      81
Tuesday     74
Wednesday   93
Thursday    64
Friday      59
Saturday    43
Sunday      27
```

This can be a bar chart.

It may reveal which days are naturally strongest/weakest.

---

# 56. COMPLETIONS BY TIME

If completion timestamps are reliable, optionally show:

```text
Morning
Afternoon
Evening
Night
```

or hourly completion distribution.

Do this only if it remains understandable.

Progress can be detailed, but charts must still have a reason to exist.

---

# 57. MONTHLY SUMMARY

Create a useful monthly historical view.

Example:

```text
August 2026

87 tasks completed

Career
49

Content
25

Personal
13

Productive days
23 / 31

Best streak during month
14

Completion rate
81%
```

This will become increasingly valuable after months/years of data.

---

# 58. YEARLY SUMMARY

Eventually Progress should support:

```text
Year: 2026
```

with:

- total tasks completed
- productive days
- category breakdown
- best streak
- average completions/week
- monthly completion graph
- monthly productive days
- strongest month
- heatmap

This does not need to be implemented before the core workflow is stable, but the data architecture must not prevent it.

---

# 59. PROGRESS FILTERS

Useful filters:

```text
Time range

Category
  All
  Career
  Content
  Personal
```

Avoid dozens of filter controls.

Use progressive disclosure where appropriate.

---

# 60. ANALYTICS SOURCE OF TRUTH

Progress calculations should derive from actual persisted task data.

Important historical fields include:

```text
createdAt
scheduledDate
overdueFromDate
completedAt
category
```

Do not store unnecessary duplicated counters such as:

```text
tasksCompletedThisMonth = 37
```

if they can reliably be calculated from task history.

Derived analytics are preferable.

---

# 61. DELETION AND HISTORICAL DATA

Be careful with completed-task deletion.

The application needs reliable historical analytics.

Prefer soft deletion or archival for completed tasks.

Possible field:

```text
deletedAt?
```

Active deleted tasks may be excluded completely.

Completed deleted tasks should not accidentally destroy years of analytics unless the user intentionally chooses to permanently remove their history.

Keep implementation understandable.

Do not build an enterprise audit-log system.

---

# 62. WEEK PLANNING FLOW

The application should make planning a new week extremely fast.

Do NOT reintroduce the old Plan page.

Planning happens directly inside:

```text
This Week
```

---

# 63. PLAN NEXT WEEK

Near the end of a week, provide:

```text
Plan next week
```

This opens a clean planning view.

Example:

```text
NEXT WEEK

MONDAY
+ Add

TUESDAY
+ Add

WEDNESDAY
+ Add

THURSDAY
+ Add

FRIDAY
+ Add

SATURDAY
+ Add

SUNDAY
+ Add

ANYTIME THIS WEEK
+ Add
```

Tasks should be quickly creatable without repeatedly opening a large form.

Possible interaction:

```text
+ Add
↓
inline task title input
↓
Enter
```

Category can default to the last category used or be quickly selected.

Allow opening full task options if needed.

---

# 64. WEEK NAVIGATION

This Week page should support navigating between weeks.

Something like:

```text
← Previous Week

Aug 10 – Aug 16

Next Week →
```

Clearly indicate:

```text
This Week
Next Week
Past Week
```

depending on context.

Past weeks are primarily historical.

---

# 65. PAST WEEKS

Past weeks should remain viewable.

Show:

- what was planned
- what was completed
- what was missed
- completion rate

Do not allow historical pages to become confusingly editable unless explicitly intended.

Simple editing may be disabled for sufficiently old weeks.

---

# 66. DASHBOARD DAILY STREAK + QUICK THOUGHT PLACEMENT

Both should be easily accessible but should not compete with Today's checklist.

Hierarchy should approximately be:

```text
1. Today's active tasks

2. Today's progress / streak

3. Completed today

4. Quick Thought

5. anything added later
```

Today's actions remain the central experience.

---

# 67. RESPONSIVENESS

The application must work well on:

- 1920×1080 desktop
- standard laptops
- tablets
- modern Android phones

Desktop retains the current sidebar.

Mobile can translate the navigation into a drawer/bottom navigation later if necessary, while retaining visual identity.

Particularly important mobile experiences:

- Dashboard checklist
- completing tasks
- This Week
- adding tasks
- Quick Thought
- Kanban

Kanban must remain usable on narrow screens.

Possible mobile implementation:

- horizontally scrollable columns
- one-column status switcher

Choose based on usability.

---

# 68. PWA / ANDROID FUTURE

The application is currently browser-first.

Do not build a native Android application yet.

Maintain architecture compatible with a future:

```text
PWA
```

and possibly:

```text
Capacitor
```

Do not add cloud sync yet.

Do not add authentication yet.

Do not add multi-user support.

---

# 69. LOCAL-FIRST

The application is private.

Data should remain local.

Use the existing local SQLite architecture.

No:

- telemetry
- third-party analytics
- advertising SDKs
- external authentication
- unnecessary cloud requests

---

# 70. SETTINGS

Keep Settings.

Do not dramatically expand it.

Relevant settings may eventually include:

```text
Theme

Week start day

App timezone

Streak grace period
```

However the current streak grace rule should default to:

```text
2 grace days
reset after 3 consecutive missed days
```

Do not turn Settings into a configuration dashboard.

---

# 71. SEARCH

Global search is NOT a current priority.

Remove/defer it if already planned but not implemented.

It can be added later if historical task volume makes it genuinely necessary.

---

# 72. FEATURES EXPLICITLY REMOVED FROM THE OLD PLAN

Do not implement these unless explicitly requested later:

```text
Goals page

Sprint system

Sprint weeks

Daily Focus separate from Today

Weekly Review

Daily Reflection

Review history

Networking tracker

Dedicated job application tracker

Learning topic tracker

Content Kanban pipeline
Ideas → Scripted → Filmed → Editing → Ready → Posted

XP

Levels

Achievements unrelated to real outcomes

Complex priority system

Complex task scoring

Separate Notes system

Large search system

Generic milestones system

Generic habit system
```

Career and Content milestones are the intentional exception because they
represent real outcomes rather than actions.

---

# 73. PHASE STATUS

Old implementation:

```text
Phase 1 — Foundation
COMPLETED

Phase 2 — Task System
COMPLETED / currently implemented
```

The project is NOT starting over.

The next step is a refactor phase.

Phase 2R — Product Simplification Refactor
COMPLETED

Phase 3 — This Week + Complete Task Workflow
COMPLETED

Phase 3B — Weekly Recurrence
COMPLETED

Phase 4 — Dashboard
COMPLETED

Phase 5 — Career + Content
COMPLETED

Phase 6 — Progress Foundation
COMPLETED

Phase 6B — Progress Visualizations
COMPLETED

---

# 74. NEW PHASE 2R — PRODUCT SIMPLIFICATION REFACTOR

This phase must happen before implementing new features.

Goal:

> Remove the complexity introduced by the old plan while preserving working infrastructure and visual design.

Tasks:

- inspect entire repository
- identify old-plan concepts
- identify placeholder UI
- identify schema that is no longer needed
- preserve working task CRUD
- preserve existing persistence
- preserve global styling
- preserve application shell
- preserve approved sidebar design
- preserve reusable components
- simplify routes
- simplify dashboard
- simplify sidebar
- remove/deactivate unnecessary pages

Remove navigation entries:

```text
Today
Goals
Plan
Review
```

Sidebar becomes:

```text
Dashboard
This Week
Career
Content
Progress

Settings
```

Do not implement the entire new plan during Phase 2R.

The result should be a clean foundation for the new direction.

---

# 75. PHASE 2R — DATABASE AUDIT

Before modifying schema:

1. inspect current Drizzle schema
2. list existing tables
3. determine which tables still serve the new product
4. determine whether data migration is needed
5. preserve existing user tasks where practical
6. create explicit migrations

Do not casually delete the local SQLite database.

If destructive changes are genuinely required:

- explain why
- backup/migrate useful existing data
- then modify schema

---

# 76. PHASE 2R COMPLETION CRITERIA

Phase 2R is complete when:

- existing application still starts normally
- approved visual design remains intact
- sidebar contains only desired destinations
- obsolete placeholder content is removed
- Dashboard is no longer cluttered by old future-system placeholders
- existing tasks still work
- database migrations succeed
- typecheck passes
- lint passes
- existing relevant tests pass

STOP after validating Phase 2R.

Do not automatically continue into later phases unless instructed.

---

# 77. PHASE 3 — THIS WEEK + COMPLETE TASK WORKFLOW

Build the main planning system.

Implement:

- This Week route
- grouped-by-day checklist
- Anytime this week
- Add Task UX
- categories
- editing
- deletion
- day assignment
- checklist completion grace period
- active/completed separation
- week navigation

Then implement:

- Checklist/Kanban toggle
- Upcoming
- Doing
- On Hold
- Done
- drag/drop
- status persistence
- final completion confirmation in Done

Then implement:

- overdue rollover
- Overdue from X badge

Do NOT implement Progress analytics yet.

---

# 78. PHASE 3B — WEEKLY RECURRENCE

After normal tasks are stable, implement:

```text
X times per week
```

recurrence.

Requirements:

- no forced weekdays
- instances generated into Anytime this week
- recurrence status survives reload
- recurrence does not duplicate incorrectly
- new week creates exactly the intended number of occurrences
- missed previous recurring occurrences do not endlessly accumulate

Test week-boundary behavior thoroughly.

---

# 79. PHASE 4 — DASHBOARD

Refactor Dashboard around one unified Today system.

Implement:

- Today's active tasks
- overdue tasks carried into Today
- completed today
- completed / remaining counts
- task completion directly from Dashboard
- approximately 4-second Undo window
- daily streak
- streak visual temperature/state
- Quick Thought
- latest thoughts
- View All thoughts
- edit/delete thoughts

Do not fill remaining screen space with filler.

---

# 80. PHASE 5 — CAREER + CONTENT

Implement Career:

```text
Active
Completed
Career Milestones
```

Implement Content:

```text
Active
Completed
Content Milestones
```

Implement milestone CRUD for Career and Content:

- create
- edit
- mark achieved
- undo achieved
- delete

Seed optional milestone examples if appropriate, but make them editable.

Do not add additional career/content management systems.

---

# 81. PHASE 6 — PROGRESS FOUNDATION

First ensure historical data is reliable.

Implement calculation utilities for:

- completed tasks
- productive days
- current streak
- best streak
- completion rate
- category counts
- tasks planned
- overdue completion
- weekday distribution

Write tests BEFORE building every graph.

Analytics correctness matters more than visualization.

---

# 82. PHASE 6B — PROGRESS VISUALIZATIONS

Build the detailed Progress page.

Initial visualizations:

1. summary
2. GitHub-style heatmap
3. tasks completed over time
4. Career vs Content vs Personal
5. category pie/donut
6. productive days
7. planned vs completed
8. historical completion rate
9. weekday completion distribution
10. monthly summaries

Then, if the data genuinely supports them:

- time-of-day analysis
- yearly summary
- additional useful historical views

The Progress page may be information-rich.

The rest of the application should remain minimal.

---

# 83. PHASE 7 — NEXT-WEEK PLANNING UX

Improve planning directly inside This Week.

Implement:

- Plan next week
- fast inline task creation
- day-by-day planning
- Anytime this week
- quick category selection
- week navigation
- past week viewing

Do not create a separate Plan route.

---

# 84. PHASE 8 — MOBILE / RESPONSIVE POLISH

Audit every screen on:

- desktop
- laptop
- tablet
- mobile

Focus especially on:

- Dashboard
- task checkboxes
- Add Task
- This Week
- Kanban
- Progress charts
- Quick Thought

Fix:

- overflow
- touch target sizes
- wrapping
- tiny controls
- awkward tables
- horizontal layout problems

Do not change the approved design language.

---

# 85. PHASE 9 — BACKUP + STABILITY

Because this application will eventually contain months/years of personal progress data, provide local backup.

Implement:

```text
Export Data
Import Data
```

JSON is sufficient.

Validate imports before modifying the database.

Never silently overwrite valid data with malformed imports.

---

# 86. PHASE 10 — TEST + STABILIZE

Perform a complete behavioral audit.

Critical scenarios:

## Completion

- complete task
- undo within 4 seconds
- completion persists after reload
- completed task appears in history

## Kanban

- move Upcoming → Doing
- Doing → On Hold
- On Hold → Done
- Done does not count until confirmed
- confirmed completion works
- view switching preserves status

## Overdue

- Thursday task missed
- Friday shows Overdue from Thu
- Saturday still says Overdue from Thu
- completion counts Saturday

## Recurrence

- 3/week generates exactly 3
- no weekdays forced
- next week gets fresh 3
- old incomplete occurrences do not multiply forever

## Streak

- productive day increments streak
- 1 missed day preserves streak
- 2 missed days preserves streak
- productive redemption day preserves + increments streak
- 3 full missed days resets streak
- grace days do not increment streak
- Career/Content/Personal all count
- Quick Thoughts do not count

## Analytics

- completion counts match database
- category totals match
- heatmap dates match
- planned vs completed is correct
- historical dates respect app timezone

---

# 87. DATE AND TIME SAFETY

Date logic is critical for this application.

Use a consistent application timezone.

Avoid naive UTC/calendar conversions that cause:

```text
Thursday task appearing on Friday
```

or streak resets at incorrect local times.

Clearly distinguish:

```text
calendar date
timestamp
```

Store timestamps safely.

Calculate day/week boundaries using the configured local app timezone.

Test daylight-saving transitions where relevant.

---

# 88. PERFORMANCE

This application may eventually contain years of task history.

Avoid architecture that requires loading every task ever created just to render Dashboard.

Use sensible database queries:

```text
Today
Current Week
Completed Today
Progress range
```

Progress page may query larger historical ranges when needed.

Add indexes where useful, especially around:

```text
scheduledDate
completedAt
category
createdAt
```

Do not prematurely optimize beyond realistic requirements.

---

# 89. ACCESSIBILITY

Maintain:

- keyboard navigation
- visible focus states
- semantic controls
- accessible dialogs
- accessible checkbox labels
- appropriate contrast
- proper drag/drop alternatives where practical

Kanban must not become mouse-only if reasonable keyboard support can be provided.

---

# 90. ERROR HANDLING

Never silently fail important actions.

Handle:

- failed task creation
- failed completion
- failed recurrence generation
- failed drag/drop persistence
- failed Quick Thought save
- failed data import
- database errors

Use restrained toast/inline feedback consistent with existing UI.

---

# 91. CORE PRODUCT TEST

At the end of every phase, manually answer:

### PLAN

Can I quickly decide what I want to accomplish?

### DO

Can I immediately see what I should work on?

### COMPLETE

Can I complete work without friction or accidental loss?

### SEE PROGRESS

Can I clearly see evidence that I am moving forward?

If a feature makes these harder, simplify it.

---

# 92. ANTI-FEATURE-CREEP RULE

This rule is extremely important.

Do not interpret unused screen space as a reason to add features.

Do not interpret the existence of Career and Content pages as a reason to turn them into complex subsystems.

Do not add:

```text
AI suggestions
productivity scores
mood tracking
journaling
daily reviews
goal trees
subgoals
nested projects
project management
time tracking
Pomodoro
calendar integrations
social media integrations
job scraping
automatic content analytics
habits
XP
levels
badges
rewards
```

unless explicitly requested later.

The current product is intentionally small.

---

# 93. FINAL PRODUCT MENTAL MODEL

The application should ultimately feel this simple:

## Dashboard

```text
What do I need to do today?

What have I already done?

How much is left?

Is my streak alive?

I had a random thought — save it quickly.
```

## This Week

```text
What am I doing this week?

Which day?

What can happen anytime?

What am I currently doing/on hold?

What have I finished?
```

## Career

```text
What Career work is still active?

What Career work have I completed?
```

## Content

```text
What Content work is still active?

What Content work have I completed?

Which creator milestones am I chasing?
```

## Progress

```text
Have I actually been showing up?

How consistent am I?

What have I done over weeks, months, and years?
```

That is the application.

Do not complicate it.

---

# 94. NEXT IMPLEMENTATION COMMAND

The next development task is:

```text
PHASE 2R — PRODUCT SIMPLIFICATION REFACTOR
```

Before writing code:

1. read this entire PROJECT_PLAN.md
2. inspect the current repository
3. inspect the current database schema
4. compare existing implementation to this new direction
5. produce a concise refactor plan
6. identify files/components/routes/schema that:
   - stay
   - change
   - are removed
7. identify migration risks

Then implement **Phase 2R only**.

Do not start Phase 3.

After Phase 2R:

- run the application
- run typecheck
- run lint
- run tests
- verify persistence
- verify existing tasks
- verify sidebar
- verify design preservation

Then report what changed and stop.
