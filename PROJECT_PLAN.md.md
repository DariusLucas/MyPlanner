# PERSONAL LIFE PROGRESS SYSTEM — IMPLEMENTATION BRIEF

I want you to build a private personal productivity web application for me.

This is **not a SaaS**, not a public product, and not something intended for multiple users.

It is strictly a personal application that I will run locally on my computer at first.

Later I may want to use it on my Android phone, so the architecture and UI should be responsive and PWA-friendly, but **do not build a native Android application in the initial version**.

---

# 1. PRODUCT PURPOSE

The application exists to help me structure my life around meaningful long-term goals instead of doing whatever I feel like doing each day.

My current two major priorities are:

1. **Career**
   - Become employable for SWE / backend / AI / data roles.
   - Learn practical AI/ML.
   - Build meaningful technical projects.
   - Improve MatchMind, my football analytics application.
   - Prepare for interviews.
   - Apply consistently for jobs.
   - Network with relevant people.

2. **Content Creation**
   - Become consistent at creating content.
   - Stop endlessly planning and actually publish.
   - Become comfortable talking on camera.
   - Create football content.
   - Experiment with personality/lifestyle/food/couple content.
   - Improve filming, storytelling, editing, hooks, and delivery.
   - Eventually build a personal brand.

The app should turn these broad goals into:

```text
Long-term Goal
      ↓
Sprint / Plan
      ↓
Weekly Objectives
      ↓
Daily Tasks
      ↓
Completed Actions
      ↓
Progress Data
      ↓
Reflection + Adjustment
```

The central philosophy is:

**Goals are useless unless they become executable actions.**

Never encourage vague tasks such as:

```text
Learn AI
Work on content
Work on MatchMind
Find a job
Be productive
```

Instead, the system should encourage concrete tasks such as:

```text
Learn what supervised learning means and explain it in my own words.

Load the Premier League dataset with pandas and calculate home-win percentage.

Implement rolling five-match form as a model feature.

Find five relevant internships and apply to the best two.

Write five football video hooks.

Record one complete talking-to-camera video.

Edit and publish the football video.
```

---

# 2. PRODUCT PRINCIPLES

Keep these principles throughout implementation.

## Minimal

Do not create a giant productivity suite.

Avoid unnecessary features.

The interface should feel calm and extremely clear.

## Action-oriented

The dashboard should emphasize:

**What do I need to do today?**

not:

**Here are 38 productivity statistics.**

## Progress should be visible

I want visual evidence that I am consistently moving forward.

Use:

- streaks
- completion rates
- weekly progress
- consistency graphs
- simple charts
- contribution-style activity visualization
- goal progress
- number of outputs produced

Do NOT use:

- XP
- coins
- levels
- loot boxes
- fake achievements
- childish gamification

## Flexible, not obsessive

Missing a day should not destroy everything.

Do not build systems that punish the user harshly for breaking streaks.

Progress over time matters more than perfection.

---

# 3. TECH STACK

Use:

## Application

- Next.js
- TypeScript
- React
- App Router

## Styling

- Tailwind CSS
- shadcn/ui where useful
- Lucide icons

## Database

- SQLite

Use:

- Drizzle ORM

The database should live locally.

No external database provider.

No Supabase.

No Firebase.

No authentication system is necessary because this is currently a single-user local application.

## Charts

Use a lightweight React chart library such as Recharts.

## Validation

Use Zod.

## Forms

Use React Hook Form where appropriate.

## Dates

Use date-fns.

## Future compatibility

Structure the project so that later we could:

1. turn it into a PWA
2. optionally wrap it using Capacitor for Android
3. optionally introduce synchronization/cloud storage

Do NOT implement cloud sync now.

---

# 4. VISUAL DESIGN

The application should have a minimal modern productivity aesthetic.

Think:

- Linear
- Notion
- Raycast
- GitHub contribution graph
- clean modern dashboards

But do not directly clone any of them.

## Design characteristics

Use:

- generous whitespace
- rounded borders
- rounded cards
- subtle shadows where appropriate
- thin neutral borders
- clear typography hierarchy
- muted secondary text
- simple icons
- restrained use of accent colors
- smooth subtle interactions

Avoid:

- excessive gradients
- glassmorphism
- giant colorful cards
- excessive animations
- gamer-style interfaces
- huge hero sections
- marketing website styling

This is a **personal tool**, not a landing page.

---

# 5. APPLICATION STRUCTURE

Main navigation:

```text
Dashboard
Today
Goals
Plan
Career
Content
Progress
Review
Settings
```

Desktop:

Use a clean collapsible left sidebar.

Mobile:

Use either:

- bottom navigation for major screens

or

- compact drawer navigation

Choose whichever creates the cleaner UX.

---

# 6. DASHBOARD

The dashboard should answer immediately:

> What matters right now?

The first thing visible should be:

# TODAY

Show today's most important tasks.

Example:

```text
TODAY

Career

□ Understand supervised learning
□ Analyze football dataset
□ Submit one job application

Content

□ Write five video ideas
□ Choose one video
□ Record one complete take
```

Tasks should have large enough checkboxes that checking things off feels satisfying.

When checked:

- subtle completion animation
- strikethrough or visually reduced appearance
- progress counters update immediately

Do NOT overanimate.

---

# 7. TODAY PAGE

This should probably become the most-used page.

Structure:

```text
Thursday, August 13

Today's Focus

CAREER
3 / 5 completed

□ Task
□ Task
✓ Task

CONTENT
1 / 3 completed

□ Task
✓ Task
□ Task

OTHER
optional tasks
```

Allow:

- create task
- edit task
- delete task
- mark completed
- reorder tasks
- change category
- change priority
- move unfinished task to tomorrow

Task fields:

```text
title
description
category
goal
sprint
week
date
priority
estimatedMinutes
status
completedAt
```

Priority options:

```text
High
Normal
Low
```

Do not create ten priority levels.

---

# 8. DAILY FOCUS

Each day should optionally have:

## Main Career Mission

Example:

> Understand the basic supervised ML workflow and work with real football data.

## Main Content Mission

Example:

> Record one complete piece of content.

These are different from individual tasks.

Show them prominently above the checklist.

---

# 9. GOALS SYSTEM

Create a Goals page.

A goal represents a meaningful outcome rather than a task.

Initial goals:

## Career

```text
Get my first strong SWE / AI / backend / data opportunity.
```

## Content

```text
Become someone who consistently creates and publishes content.
```

A goal should contain:

```text
id
title
description
category
startDate
targetDate
status
createdAt
```

Statuses:

```text
Active
Paused
Completed
Archived
```

Each goal can have:

- sprints
- milestones
- metrics
- tasks

Show progress based on actual underlying completed work.

---

# 10. SPRINT SYSTEM

The core planning unit should be a **Sprint**.

The first sprint will last five weeks.

Example:

```text
5-Week Career + Content Sprint

August 14 → September 17
```

Display:

```text
Week 1
Week 2
Week 3
Week 4
Week 5
```

Each week has:

- theme
- outcome
- tasks
- targets
- progress

---

# 11. INITIAL CAREER SPRINT

Seed the application with this five-week career plan.

## WEEK 1 — DATA

Outcome:

Learn practical pandas/data-analysis fundamentals using football data.

Objectives:

- understand ML workflow basics
- understand features and targets
- understand classification vs regression
- understand training/testing data
- load football match dataset
- inspect dataset
- use pandas for basic analysis
- build rolling football statistics
- create basic visualizations
- push first analysis to GitHub

Suggested output:

```text
Football Data Analysis
```

---

## WEEK 2 — FIRST ML MODEL

Outcome:

Build the first football match prediction model.

Learn:

- train/test split
- X and y
- Logistic Regression
- accuracy
- confusion matrix
- precision
- recall
- F1 score

Build and compare:

- baseline
- Logistic Regression
- Decision Tree
- Random Forest

Create:

```text
Home Win probability
Draw probability
Away Win probability
```

---

## WEEK 3 — MAKE THE MODEL LEGITIMATE

Outcome:

Improve the quality of the ML experiment.

Learn:

- overfitting
- underfitting
- data leakage
- cross-validation
- temporal validation
- feature engineering
- calibration

Experiment with:

- recent form
- rolling goals scored
- rolling goals conceded
- home advantage
- Elo/team strength
- opponent strength

Important:

Football prediction evaluation must respect time.

Older seasons should train the model.

Future seasons should evaluate it.

Do not randomly leak future information.

---

## WEEK 4 — MATCHMIND INTEGRATION

Outcome:

Turn the model into an actual software feature.

Architecture:

```text
MatchMind frontend
        ↓
FastAPI backend
        ↓
Prediction Service
        ↓
Feature Pipeline
        ↓
ML Model
        ↓
Prediction Response
```

Build:

- prediction endpoint
- feature pipeline
- model inference
- frontend match predictor
- probability visualization
- error handling
- tests

---

## WEEK 5 — POLISH

Outcome:

Turn the project into something useful for getting hired.

Tasks:

- refactor
- testing
- deploy
- README
- architecture diagram
- ML evaluation documentation
- screenshots
- CV entry
- portfolio entry
- prepare interview explanation

---

# 12. JOB SEARCH TRACKER

Career should contain a Job Applications section.

Fields:

```text
Company
Role
Location
URL
Date Applied
Status
Follow-Up Date
Notes
```

Statuses:

```text
Saved
Applied
OA
Interview
Final Round
Offer
Rejected
Withdrawn
```

Show:

```text
Applications this week
Applications this month
Interviews
Response rate
```

Do not overwhelm the dashboard with recruiting analytics.

Weekly target should initially be:

```text
10–15 applications
```

Allow each week's target to be edited.

---

# 13. NETWORKING TRACKER

Simple tracker:

```text
Person
Company
Role
Platform
Date Contacted
Status
Notes
```

Statuses:

```text
To Contact
Contacted
Replied
Conversation
Closed
```

Initial weekly target:

```text
3 meaningful outreaches
```

Keep this very lightweight.

---

# 14. TECHNICAL LEARNING TRACKER

Career should also contain learning objectives.

Example:

```text
Supervised Learning
Pandas
Feature Engineering
Logistic Regression
Model Evaluation
FastAPI ML Inference
```

Each topic may have:

```text
Not Started
Learning
Can Explain
Used in Project
```

This is better than arbitrary percentage progress.

The most valuable state is:

```text
Used in Project
```

because I want learning connected to building.

---

# 15. CONTENT SYSTEM

Create a dedicated Content section.

The main concept should be a content pipeline:

```text
IDEAS
   ↓
SCRIPTED
   ↓
FILMED
   ↓
EDITING
   ↓
READY
   ↓
POSTED
```

Display this either as a clean Kanban-style board or another minimal workflow interface.

Each content item has:

```text
title
idea
hook
talkingPoints
contentType
status
platform
recordedDate
publishedDate
notes
```

Content types:

```text
Football
Personality
Lifestyle
Food
Couple
Experiment
Other
```

Platforms:

```text
TikTok
Instagram Reels
YouTube Shorts
Other
```

Allow multiple platforms.

---

# 16. CONTENT WEEKLY TARGETS

Initial target:

Week 1:

```text
2 published videos
1 talking-to-camera video
```

Weeks 2–5:

```text
3 published videos
at least 1 talking-to-camera video
```

Visualize:

```text
Videos this week: 2 / 3
Talking-to-camera: 1 / 1
```

---

# 17. CONTENT METRICS

Do NOT turn this into obsessive social media analytics.

Track output first.

Primary metrics:

```text
Videos published
Videos recorded
Talking-to-camera videos
Publishing consistency
```

Optional manual performance fields:

```text
views
likes
comments
shares
```

These should be secondary.

The application should reward:

**publishing**

rather than obsessing over views.

---

# 18. WEEKLY PLAN

Create a Plan page.

Allow me to select a week and define:

```text
Career Main Outcome
Content Main Outcome
```

Then set weekly targets.

Example:

```text
CAREER

Deep work sessions: 5
Job applications: 12
Networking messages: 3
LeetCode problems: 3

CONTENT

Videos published: 3
Talking-to-camera videos: 1
```

Below this, show scheduled tasks.

---

# 19. WEEKLY REVIEW

Every Sunday I want to conduct a short review.

Create a Review page.

Questions:

## Career

```text
What did I build this week?

What did I learn?

What technical concept can I now explain that I could not explain last week?

How many jobs did I apply to?

Did I move MatchMind forward?
```

## Content

```text
How many videos did I publish?

Did I talk to the camera?

What content felt easiest to create?

What performed well?

What did I learn from publishing?
```

## General

```text
What went well?

What got in the way?

What should I change next week?

What is the single most important outcome next week?
```

Save reviews historically.

---

# 20. PROGRESS PAGE

This is where the application becomes motivating.

I want to visually see accumulated evidence that I am moving forward.

Include:

## Consistency heatmap

GitHub-style activity heatmap.

Each day should reflect meaningful completed actions.

Do not simply count every tiny checkbox equally if avoidable.

Possible weighting:

```text
Normal task = 1
High priority task = 2
Major output = 3
```

Keep implementation simple.

---

# 21. STREAKS

Track meaningful streaks.

Examples:

```text
Career Progress Streak
Content Creation Streak
Publishing Streak
Weekly Goal Streak
```

Important:

Do not define Career Progress Streak as requiring career work literally every single day forever.

Allow configurable schedules.

Example:

```text
Career target days:
Monday–Saturday

Content target:
3 outputs per week
```

The system should promote consistency without making Sunday rest destroy a streak.

---

# 22. WEEKLY COMPLETION GRAPH

Create a graph showing:

```text
Week 1   78%
Week 2   84%
Week 3   71%
Week 4   89%
Week 5   92%
```

Allow breakdown:

```text
Overall
Career
Content
```

---

# 23. OUTPUT GRAPH

Create a simple historical graph for meaningful outputs.

Career examples:

```text
Applications sent
Learning sessions completed
Project sessions completed
LeetCode completed
```

Content:

```text
Videos recorded
Videos published
Talking-to-camera videos
```

Allow time ranges:

```text
4 weeks
12 weeks
All time
```

---

# 24. MILESTONES

Allow milestones without gamified points.

Examples:

```text
First ML model built
First MatchMind prediction working
50 job applications sent
First interview
First published talking-to-camera video
10 videos published
25 videos published
```

Milestones should feel like meaningful historical events.

Display them on a simple timeline.

---

# 25. DASHBOARD PROGRESS SUMMARY

The dashboard should include a restrained progress area.

Example:

```text
5-WEEK SPRINT

Week 1 of 5

Career        ██████░░░░  61%
Content       ████░░░░░░  42%

This week

Applications     4 / 12
Videos           1 / 3
Camera videos    1 / 1
Deep work        3 / 5
```

Keep it compact.

The task list should remain the most prominent UI.

---

# 26. DAILY REFLECTION

At the end of each day allow an optional lightweight reflection.

Fields:

```text
What did I accomplish?

What did I learn?

What blocked me?

One sentence about today.
```

This should take approximately two minutes.

Do not require it.

---

# 27. QUICK CAPTURE

I frequently get ideas while doing something else.

Create a global quick-add button.

Allow creating:

```text
Task
Content Idea
Job Opportunity
Note
```

with minimal friction.

Keyboard shortcut on desktop would be useful.

Example:

```text
Ctrl + K
```

opens a command palette / quick capture interface.

---

# 28. SEARCH

Simple global search across:

- tasks
- goals
- content ideas
- job applications
- learning topics
- reviews

Do not overengineer full-text search initially.

---

# 29. DATA MODEL

Create a sensible normalized SQLite schema.

Likely entities:

```text
Goal
Sprint
SprintWeek
Task
Metric
WeeklyTarget
DailyFocus
JobApplication
NetworkingContact
LearningTopic
ContentItem
DailyReflection
WeeklyReview
Milestone
AppSetting
```

You are responsible for designing the exact relationships.

Avoid unnecessary abstraction.

Keep the schema easy to understand.

---

# 30. IMPORTANT TASK BEHAVIOR

Tasks should support:

```text
Not Started
In Progress
Completed
Skipped
```

When completed:

save `completedAt`.

Allow undoing completion.

If unfinished:

offer:

```text
Move to tomorrow
Move to another date
Keep overdue
Skip
```

Never silently move tasks.

---

# 31. RECURRING TASKS

Support basic recurring tasks eventually.

Examples:

```text
Sunday Weekly Review
Monday Job Search
3 LeetCode problems/week
```

However:

do not prioritize complex recurrence logic in the first implementation.

Basic weekly recurrence is sufficient.

---

# 32. DEFAULT HOME EXPERIENCE

When opening the app in the morning, I want something approximately like:

```text
Good morning.

Thursday, August 13

WEEK 1 — DATA

Today's Career Mission
Understand the foundations of supervised ML and start working with real football data.

Today's Content Mission
Record one complete piece of content.

CAREER                        0 / 6

□ Understand supervised learning
□ Understand features and targets
□ Understand classification vs regression
□ Load football dataset
□ Inspect the dataset
□ Submit one job application

CONTENT                       0 / 4

□ Write five video ideas
□ Choose one
□ Write the hook
□ Record one complete take

──────────────────────────

Week Progress

Career       0 / 5 sessions
Applications 0 / 10
Videos       0 / 2
Camera       0 / 1
```

Simple.

Useful.

Nothing unnecessary.

---

# 33. SEED DAY 1

Seed the database with my first real day.

Career mission:

```text
Understand the basic idea behind machine learning and get my first football dataset running locally.
```

Career tasks:

```text
Learn what supervised learning means.

Learn what a feature is.

Learn what a target/label is.

Understand classification vs regression.

Understand training data.

Understand test data.

Understand:
data → features → model → prediction.

Explain supervised learning in my own words.

Give one football example of a feature.

Give one football example of a target.

Explain why Home/Draw/Away prediction is classification.

Explain why evaluating on training matches is misleading.

Create football-ml project.

Create Python virtual environment.

Install pandas, numpy, matplotlib, scikit-learn and Jupyter.

Download historical football match data.

Load dataset using pandas.

Display first 10 rows.

Inspect rows and columns.

Inspect column names.

Inspect data types.

Inspect missing values.

Calculate number of matches.

Find seasons represented.

Count unique teams.

Calculate home-win percentage.

Calculate draw percentage.

Calculate away-win percentage.

Calculate average goals per match.

Write 10 pieces of information known before kickoff.

Choose first 5 candidate ML features.

Define prediction target.

Explain an example of football data leakage.
```

Job tasks:

```text
Create job application tracker.

Find five realistic SWE / backend / data / AI positions.

Save all five.

Choose best two.

Apply to at least one.
```

Content mission:

```text
Record one complete piece of content.
```

Content tasks:

```text
Write five video ideas.

Choose one.

Write one-sentence hook.

Write 3–5 talking points.

Choose filming location.

Set up microphone and camera.

Record one complete take.
```

---

# 34. RESPONSIVE DESIGN

The app must work extremely well at:

```text
1920x1080 desktop
common laptop resolutions
tablet sizes
modern Android phone sizes
```

Never rely on fixed desktop widths.

Cards should stack intelligently.

Tables should become mobile-friendly lists/cards where necessary.

The Today page should be particularly good on mobile because eventually I want to check tasks from my phone.

---

# 35. PWA PREPARATION

Do not spend significant time implementing PWA functionality during the first phase.

However:

- avoid architecture that prevents it
- create responsive layouts
- keep browser APIs compatible
- avoid desktop-only assumptions

Eventually we may add:

```text
manifest
service worker
installable app
offline support
```

Later we may use Capacitor for Android.

---

# 36. LOCAL-FIRST DATA

The application is personal.

Data privacy matters.

For V1:

```text
Next.js server
↓
SQLite database
↓
local computer
```

Nothing should automatically leave my machine.

No analytics.

No tracking.

No telemetry.

No third-party auth.

---

# 37. BACKUPS

Eventually provide a simple:

```text
Export Data
Import Data
```

feature.

JSON export is sufficient initially.

I should be able to make a backup of my personal progress.

Do not implement an unnecessarily complicated backup system.

---

# 38. SETTINGS

Simple settings page.

Potential settings:

```text
Name
Week starts on
Theme
Default career target days
Default weekly application goal
Default weekly content goal
```

Support:

```text
Light
Dark
System
```

No giant customization engine.

---

# 39. EMPTY STATES

Design useful empty states.

Example:

Instead of:

```text
No tasks.
```

Use:

```text
Nothing planned for today.

Add a task or pull something from this week's plan.
```

Keep writing concise.

Do not add cringe motivational quotes.

---

# 40. ERROR STATES

Handle errors gracefully.

Examples:

- database failure
- invalid form input
- failed task update
- missing entity
- corrupt import
- invalid date

Do not allow obvious silent failures.

---

# 41. ACCESSIBILITY

Use:

- semantic HTML
- accessible buttons
- proper labels
- keyboard navigation
- reasonable contrast
- visible focus states

Do not sacrifice usability for visual design.

---

# 42. TESTING

Add meaningful tests.

Focus on:

- task completion
- weekly progress calculations
- streak calculations
- target calculations
- job statistics
- content statistics
- date boundaries
- moving tasks
- sprint progress

Do not spend large amounts of time testing trivial presentational details.

---

# 43. PROJECT STRUCTURE

Use a clean domain-oriented project structure.

Something approximately like:

```text
src/
    app/
    components/
        ui/
        dashboard/
        tasks/
        goals/
        career/
        content/
        progress/
        reviews/

    features/
        tasks/
        goals/
        sprints/
        jobs/
        learning/
        content/
        progress/
        reviews/

    db/
        schema/
        migrations/
        seed/

    lib/
    hooks/
    types/
```

You may improve this structure if you have a better architectural reason.

Do not create enterprise-level abstractions for a single-user app.

---

# 44. ENGINEERING QUALITY

I want this application to work reliably.

Prioritize:

1. correct data model
2. reliable persistence
3. clean business logic
4. simple architecture
5. good UX
6. visual polish

Do not prioritize fancy animations over functionality.

Avoid:

- huge components
- duplicated logic
- `any` everywhere
- business logic embedded throughout UI components
- giant global state stores
- unnecessary APIs
- unnecessary dependencies

---

# 45. STATE MANAGEMENT

Prefer:

- server components where appropriate
- server actions / route handlers
- normal React state for local UI state

Do not immediately introduce Redux/Zustand unless there is a clear need.

This application does not require complicated global client state initially.

---

# 46. DERIVED METRICS

Do not store statistics that can easily and reliably be calculated from source data unless caching is justified.

For example:

```text
tasksCompletedThisWeek
```

should normally be derived from Task records.

Likewise:

```text
videosPublished
applicationsSubmitted
```

should be derived from their corresponding entities.

Keep the database as the source of truth.

---

# 47. DEVELOPMENT PHASES

DO NOT build everything at once.

Work incrementally.

---

## PHASE 1 — FOUNDATION

Build:

- Next.js project
- styling system
- database
- Drizzle schema
- migrations
- seed system
- root layout
- navigation
- light/dark theme

Verify database persistence before continuing.

---

## PHASE 2 — TASK SYSTEM

Build:

- Today page
- task CRUD
- checkbox completion
- categories
- priorities
- dates
- daily missions
- task reordering if practical
- progress counters

At the end of Phase 2 I should already be able to use the app tomorrow as a checklist.

This is the first truly usable milestone.

---

## PHASE 3 — GOALS + SPRINTS

Build:

- Goals
- Sprint
- Sprint weeks
- weekly outcomes
- weekly targets
- connection between tasks and sprint/week

Seed the five-week sprint.

---

## PHASE 4 — CAREER

Build:

- Job Tracker
- Networking Tracker
- Learning Topics
- career weekly metrics

---

## PHASE 5 — CONTENT

Build:

- Content Pipeline
- content items
- hooks
- talking points
- stages
- publishing records
- weekly publishing target

---

## PHASE 6 — PROGRESS

Build:

- streaks
- heatmap
- weekly completion graph
- output graphs
- sprint progress
- milestones

---

## PHASE 7 — REVIEWS

Build:

- daily reflections
- weekly reviews
- review history

---

## PHASE 8 — POLISH

Improve:

- mobile UI
- accessibility
- empty states
- errors
- loading states
- responsive tables
- keyboard interactions
- quick capture
- search

---

## PHASE 9 — BACKUP

Implement:

- JSON export
- JSON import
- validation before import

---

## PHASE 10 — TEST + STABILIZE

Test the full system.

Fix:

- date bugs
- completion bugs
- progress calculation bugs
- responsive issues
- database problems
- navigation issues

---

# 48. IMPORTANT DEVELOPMENT RULE

Do not silently implement later phases while working on an earlier phase.

Finish and validate each major layer first.

At the end of each phase:

1. explain what was implemented
2. list relevant files
3. explain important architectural decisions
4. run type checking
5. run linting
6. run relevant tests
7. verify the application manually
8. identify remaining limitations

Then continue.

Do not repeatedly ask me unnecessary implementation questions.

Make sensible engineering decisions from this specification.

---

# 49. INITIAL MVP DEFINITION

The FIRST usable MVP does NOT require every feature above.

The minimum version I want working as soon as possible is:

```text
Dashboard
Today
Goals
5-week sprint
Tasks/checklists
Career vs Content categories
Weekly targets
Task completion
Basic progress visualization
SQLite persistence
Responsive design
```

Then expand from there.

The core interaction must be excellent before adding secondary features.

---

# 50. THE MAIN TEST

At any point during development, ask:

> Does this feature make it easier for me to know what I need to do next and see whether I'm actually moving toward my goals?

If no:

Do not prioritize it.

This app exists to convert ambition into daily execution.

Build accordingly.