# AFTER

> **Software that doesn't age alone.**

AFTER is an AI-native software intelligence platform that connects to real software repositories, understands their code, architecture, history, dependencies, and evolution, and continuously builds a living model of the software.

AFTER is not just a GitHub clone.

AFTER is not just an AI coding assistant.

AFTER is the intelligence layer that sits **on top of software and understands what happens to it over time.**

---

## The Core Idea

GitHub stores software.

Cursor helps developers write software.

Lovable and Base44 help developers create applications.

**AFTER understands software after it exists.**

AFTER connects to real repositories and builds a persistent understanding of:

- what exists
- how it is connected
- what changed
- why it changed
- what it affects
- what depends on it
- how the architecture evolved
- what is becoming more complex
- what deserves investigation
- what happened over time

The goal is simple:

> **Make software understandable, observable, and continuously remembered by AI.**

---

## Product Architecture

```text
                              REAL SOFTWARE
                                    │
                  ┌─────────────────┼─────────────────┐
                  │                 │                 │
               GitHub             GitLab          ZIP Upload
                  │                 │                 │
                  └─────────────────┼─────────────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │   AFTER INGESTION   │
                         └──────────┬──────────┘
                                    │
             ┌──────────────────────┼──────────────────────┐
             │                      │                      │
             ▼                      ▼                      ▼
       CODE ANALYSIS           GIT HISTORY          DEPENDENCIES
             │                      │                      │
             └──────────────────────┼──────────────────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │   PRODUCT GRAPH     │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │  SOFTWARE MEMORY    │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │ AFTER INTELLIGENCE  │
                         └──────────┬──────────┘
                                    │
             ┌──────────────────────┼──────────────────────┐
             │                      │                      │
             ▼                      ▼                      ▼
           WHY?                   IMPACT                 WATCH
             │                      │                      │
             └──────────────────────┼──────────────────────┘
                                    │
                                    ▼
                         CONTINUOUS OBSERVATION
````

---

# Product Philosophy

AFTER should feel like:

> **The place where your software lives and is understood.**

Not:

> "Another GitHub analytics dashboard."

The Git provider is the source of the software.

AFTER is the intelligence layer that creates a deeper representation of the software.

---

# Core Questions

AFTER should help answer questions that normally require manually exploring many files, commits, pull requests, issues, and dependencies.

Examples:

```text
What changed?

Why did it change?

What does this affect?

What depends on this?

What could be affected?

Why does this exist?

Why was this dependency introduced?

What happened after this change?

What's becoming more complex?

What's different from 30 days ago?

What should I investigate?

Explain this architecture.

Explain this repository.

What changed this week?

What could break if I change this?

What is connected to this component?
```

Every answer should be based on real evidence whenever possible.

---

# The Most Important Rule

## AFTER MUST NEVER INVENT DATA

AFTER must never present fictional information as real information.

Never invent:

* repositories
* files
* folders
* commits
* branches
* pull requests
* issues
* releases
* dependencies
* architecture nodes
* metrics
* telemetry
* insights
* events
* users
* experiments
* history
* causal relationships
* code
* repository statistics

If there is not enough information, explicitly say so.

Examples:

```text
Not enough evidence.
```

```text
No data available yet.
```

```text
No explicit rationale was found.
```

A truthful empty state is always better than fabricated data.

---

# Known, Inferred, Unknown

AI-generated information must distinguish between different levels of certainty.

## KNOWN

Directly supported by repository data.

Example:

```text
KNOWN

src/auth/session.ts imports firebase-admin.
```

## INFERRED

A reasonable inference based on available evidence.

Example:

```text
INFERRED

This module appears to exist to centralize session handling.
```

## UNKNOWN

Information that cannot be established from the available evidence.

Example:

```text
UNKNOWN

No explicit architectural rationale was found.
```

The AI must never turn an inference into a fact.

---

# Product Areas

AFTER consists of two major layers.

## Software Platform

The platform layer provides functionality expected from a modern software development platform:

* repositories
* code browser
* files
* folders
* branches
* commits
* pull requests
* issues
* releases
* tags
* contributors
* activity
* code search
* repository settings
* access control

## AFTER Intelligence

The intelligence layer provides:

* Product Graph
* Software Memory
* Why Engine
* Impact Analysis
* Change Analysis
* Insights
* Watch
* Experiments
* Continuous Observation
* AI investigation
* Causal Timeline

The platform allows users to navigate their software.

The intelligence layer allows users to **understand their software**.

---

# GitHub Integration

GitHub integration must be real.

The system should support:

```text
Google Login
      ↓
Connect GitHub
      ↓
GitHub OAuth
      ↓
Backend
      ↓
Discover accessible repositories
      ↓
Repository selection
      ↓
Real ingestion
      ↓
Analysis
```

The GitHub access token must remain on the backend.

Never expose it to the frontend.

Never store it in:

* localStorage
* frontend state
* public Firestore documents
* client-accessible configuration

The backend is responsible for authenticated GitHub operations.

---

# Repository Discovery

After connecting GitHub, AFTER must discover **all repositories actually accessible to the user**, respecting GitHub permissions.

Do not only fetch the first page.

Implement complete pagination.

The repository list should support:

* all repositories
* private repositories
* public repositories
* owned repositories
* collaborative repositories
* organization repositories when authorized

The frontend should allow:

* search
* filtering
* selecting individual repositories
* select all
* select none

Example:

```text
247 repositories found

Search repositories...

☑ Select all

○ owner/project-a
○ owner/project-b
○ owner/private-api
○ organization/backend
```

The number must always come from real backend data.

Never hardcode repository counts.

---

# Repository Ingestion

AFTER must ingest real repositories.

Preferred flow:

```text
GitHub
   ↓
Authenticated Git
   ↓
Clone / Fetch
   ↓
Temporary isolated workspace
   ↓
Analysis
```

If Git clone is not possible in the execution environment, use GitHub APIs to retrieve the real repository tree and content.

Do not pretend that an API-based ingestion was a Git clone.

The system should know internally which ingestion method was used.

Possible values:

```text
Git clone
GitHub API
ZIP upload
```

---

# Repository Security

Repositories may contain sensitive information.

The system must:

* protect OAuth tokens
* validate authorization server-side
* isolate repositories
* avoid logging secrets
* detect credentials
* avoid sending `.env` files to AI
* avoid exposing private code to other users
* use temporary workspaces
* clean temporary data
* enforce repository access boundaries

Code from one user's repository must never become available to another user.

---

# Code Analysis

After ingestion, AFTER analyzes the actual repository.

When technically possible, detect:

* programming languages
* frameworks
* package managers
* dependencies
* directories
* source files
* imports
* exports
* functions
* classes
* components
* APIs
* routes
* database references
* services
* configuration
* architecture

The result should become a structured internal representation of the project.

---

# Repository Structure

AFTER should understand real repository structures.

Example:

```text
src/
├── auth/
│   ├── session.ts
│   └── permissions.ts
├── components/
│   ├── Dashboard.tsx
│   └── Payment.tsx
├── services/
│   ├── payment.ts
│   └── database.ts
└── utils/
    └── validation.ts
```

The interface must display actual repository contents.

Never replace missing data with example files.

---

# Code Browser

AFTER should provide a high-quality code browser.

Features:

* file tree
* breadcrumbs
* syntax highlighting
* line numbers
* code search
* symbol navigation
* copy
* file history
* blame
* related files
* dependencies
* dependents

Example:

```text
src/services/payment.ts
```

Possible contextual actions:

```text
Why does this exist?

Who uses this?

What does this affect?

Show dependency path

Explain

Investigate
```

---

# Product Graph

Product Graph is one of the central AFTER features.

It represents real relationships inside the software.

Possible node types:

* repository
* directory
* file
* function
* class
* component
* API
* database
* service
* dependency

Example:

```text
             CHECKOUT
                 │
          ┌──────┴──────┐
          ▼             ▼
       PAYMENT         ORDER
          │             │
          ▼             ▼
       STRIPE        DATABASE
```

Relationships must be derived from real data.

Each node should contain, when available:

* repository
* branch
* path
* symbol
* line
* type
* dependencies
* dependents
* history

The graph should support:

* zoom
* pan
* selection
* focus
* expand
* collapse
* relationship highlighting
* contextual panels

---

# Software Memory

AFTER builds persistent memory about the evolution of software.

Memory may contain:

* architectural decisions
* important changes
* historical context
* dependency changes
* important commits
* pull request context
* known risks
* resolved issues
* relationships
* rationales

Example:

```text
Authentication was moved from X to Y.

Evidence:
commit abc123
PR #42
src/auth/*
```

If no rationale exists:

```text
No explicit rationale was found.
```

Never invent the reason behind a change.

---

# Why Engine

Any important software element can be investigated.

Examples:

```text
Why does this exist?

Why was this changed?

Why does this dependency exist?

Why does this component depend on that one?

Why did the architecture change?
```

The Why Engine should investigate available evidence from:

* commits
* diffs
* pull requests
* issues
* documentation
* code relationships
* dependency relationships
* timeline

Responses must distinguish:

```text
KNOWN
INFERRED
UNKNOWN
```

---

# Impact Analysis

Users should be able to select a software element and ask:

```text
What happens if I change this?
```

AFTER should build an impact chain:

```text
SELECTED ELEMENT
       ↓
DIRECT DEPENDENTS
       ↓
INDIRECT DEPENDENTS
       ↓
POTENTIAL IMPACT
```

The system must not claim that something will definitely break unless there is strong evidence.

Prefer:

```text
Potentially affected:
X

Evidence:
A imports B.
B depends on C.
```

---

# Change Analysis

AFTER should understand changes, not merely display them.

For a commit, PR, or file change, analyze:

* what changed
* which files changed
* which components changed
* dependencies affected
* graph relationships affected
* historical context
* potential impact

Example:

```text
CHANGE

src/payment.ts modified.

AFFECTED

4 components depend on this module.

DEPENDENCIES

1 dependency path changed.

HISTORY

The file was previously modified by commit abc123.

CONFIDENCE

High
```

All information must come from real evidence.

---

# Timeline

Timeline should combine real software events.

Possible events:

* commits
* pull requests
* issues
* releases
* dependency changes
* architecture changes
* AFTER observations

Example:

```text
MAR 12
Authentication added

        ↓

MAR 18
Session architecture changed

        ↓

MAR 21
3 related components changed

        ↓

MAR 23
Dependency updated
```

Do not invent relationships between events.

When a relationship is uncertain, label it as an inference.

---

# Watch

Users can watch specific software elements.

Possible watch targets:

* repository
* branch
* file
* component
* dependency
* architecture node

Example:

```text
WATCHING

checkout/payment.ts

✓ architecture
✓ dependencies
✓ changes
✓ history
```

When a real relevant event occurs:

```text
CHECKOUT CHANGED

2 files modified
1 dependency affected

[Investigate]
```

No fake alerts.

---

# Continuous Observation

AFTER should eventually observe repositories continuously.

Conceptual flow:

```text
Repository
    ↓
GitHub Webhook
    ↓
New Commit
    ↓
AFTER detects change
    ↓
Incremental Analysis
    ↓
Graph Updated
    ↓
Memory Updated
    ↓
Potential Insight
    ↓
Notification
```

The goal is for AFTER to continue working even when the user is not actively viewing the application.

---

# Insights

Insights are observations derived from real data.

Categories may include:

* Architecture
* Security
* Performance
* Dependency
* Cost
* Reliability
* Maintainability
* UX

Each insight should contain:

* title
* category
* severity
* confidence
* evidence
* affected files
* affected components
* createdAt

Example:

```text
Dependency changed

Severity:
Medium

Confidence:
High

Evidence:
package.json

Affected:
src/payment.ts
```

Never generate an insight simply because the interface needs something to display.

---

# Experiments

AFTER may provide an experiment system for controlled software changes.

Possible fields:

* hypothesis
* control
* variant
* metric
* expected result
* risk
* duration

AFTER should never modify production automatically without explicit authorization.

---

# Ask AFTER

Ask AFTER is not a generic chatbot.

It is a **contextual software intelligence interface**.

When a user selects:

```text
src/auth/session.ts
```

and asks:

```text
Why does this exist?
```

the system already knows the selected context.

The AI should receive relevant information about:

* the file
* symbols
* dependencies
* dependents
* commits
* PRs
* issues
* graph relationships
* documentation

Possible questions:

```text
Explain this repository.

What changed this week?

Why was this commit made?

What depends on this function?

What could this change affect?

Explain this architecture.

Why does this dependency exist?
```

---

# AI Architecture

Gemini should be orchestrated through the backend.

Never expose AI API keys in the frontend.

Conceptual flow:

```text
User Question
      ↓
Context Resolver
      ↓
Repository Model
      ↓
Relevant Files
      ↓
History
      ↓
Graph
      ↓
Gemini
      ↓
Evidence-Aware Answer
```

The AI should not blindly receive the entire repository.

The system should retrieve relevant context first.

---

# AI Evidence Model

AI responses should contain evidence whenever possible.

Example:

```text
WHY DOES THIS EXIST?

KNOWN

The function was introduced in commit abc123.

EVIDENCE

src/auth/session.ts
commit abc123

INFERRED

It appears to centralize session creation.

UNKNOWN

No explicit architectural rationale was found.
```

This is a fundamental part of AFTER's identity.

---

# Repository Platform

AFTER should provide a complete repository experience.

Repository areas may include:

```text
Code
Issues
Pull Requests
Branches
Commits
Releases
Insights
Activity
Settings
```

The interface should feel cohesive and premium.

AFTER should not visually copy GitHub.

The goal is:

> **GitHub-level software platform + AFTER-level software intelligence.**

---

# Branches

Branches should come from the actual repository.

Support:

* listing branches
* switching branches
* creating branches where authorized
* comparing branches
* deleting branches where authorized

Do not assume the default branch is `main`.

Use the repository's real default branch.

---

# Commits

Commit pages should display real information:

* author
* date
* message
* SHA
* files changed
* additions
* deletions
* diff

Users should be able to ask AFTER about a commit.

Example:

```text
What changed?

Why might this matter?

What components are affected?

Could this introduce a regression?
```

The AI should provide analysis, not pretend certainty.

---

# Pull Requests

AFTER should support real pull request workflows.

PR pages may contain:

* title
* description
* author
* reviewers
* branches
* commits
* changed files
* conversation
* status

Add an:

## AFTER Review

Possible sections:

```text
ARCHITECTURE

Potential concern

DEPENDENCIES

2 affected modules

IMPACT

3 potentially affected components

RATIONALE

No explicit rationale found.
```

AFTER should provide evidence and analysis.

It must not silently approve or reject code on behalf of users.

---

# Issues

AFTER should support:

* create issue
* edit issue
* close issue
* reopen issue
* labels
* assignees
* comments
* milestones

Issues should be connected to software evidence where possible.

Example:

```text
Issue:
Checkout sometimes fails.

Related code:
payment.ts
checkout.ts
order.ts

Related commits:
abc123
def456

Potentially related changes:
...
```

---

# Releases

Support real releases and tags.

Show:

* version
* tag
* date
* changes
* contributors

AFTER may generate an evidence-based summary:

```text
What changed

Architecture changes

Dependency changes

Potential impact
```

---

# Contributors

Contributor pages may show real repository activity:

* avatar
* username
* commits
* pull requests
* issues
* recent activity

Never fabricate contributor information.

---

# Global Search

Create powerful global search.

Shortcut:

```text
Ctrl/Cmd + K
```

Search across:

* repositories
* files
* code
* commits
* issues
* pull requests
* users
* insights

Natural language queries should eventually be supported.

Example:

```text
Where is authentication handled?
```

Results should point to real files and symbols.

---

# Command Palette

Command palette should allow quick actions:

```text
Open repository
Search code
Create issue
Create branch
Ask AFTER
Open Product Graph
View recent changes
Open settings
```

It should support keyboard navigation:

* Arrow Up
* Arrow Down
* Enter
* Escape

---

# Notifications

The notification system should be real.

Possible notifications:

* pull request activity
* issue activity
* repository changes
* AFTER insights
* watched item changes

Unread state must be persisted.

---

# Authentication

Authentication should support:

* Google
* email/password

User profile:

* display name
* username
* email
* avatar
* bio
* preferences

Username must be unique.

Authentication and authorization must be handled securely.

---

# Settings

Settings should include:

## Account

* Profile
* Username
* Email
* Avatar

## Appearance

* Light
* Dark
* System

## Notifications

* Insights
* Repository activity
* Watch alerts
* Summaries

## Security

* Authentication methods
* Sessions

## Integrations

* GitHub
* GitLab
* Bitbucket

## AI

* AI preferences
* analysis settings

## Data

* Export
* Delete account

---

# Backend

AFTER is a full-stack product.

The backend is fundamental.

Responsibilities include:

* authentication
* authorization
* GitHub integration
* repository discovery
* repository ingestion
* analysis jobs
* code analysis
* Git history
* Product Graph
* AI orchestration
* Software Memory
* insights
* notifications
* persistence

Do not replace backend functionality with frontend-only state when persistence is required.

---

# Data Model

Conceptual entities:

```text
users
githubConnections
repositories
repositoryAccess
analysisJobs
files
symbols
dependencies
commits
branches
pullRequests
issues
releases
graphNodes
graphEdges
memoryEntries
insights
watchTargets
timelineEvents
experiments
notifications
```

Relationships must be based on real IDs.

---

# Analysis Pipeline

```text
REPOSITORY
     ↓
INGESTION
     ↓
FILE TREE
     ↓
LANGUAGE DETECTION
     ↓
DEPENDENCY ANALYSIS
     ↓
SYMBOL ANALYSIS
     ↓
CODE RELATIONSHIPS
     ↓
GIT HISTORY
     ↓
ARCHITECTURE MODEL
     ↓
PRODUCT GRAPH
     ↓
SOFTWARE MEMORY
     ↓
AI ANALYSIS
     ↓
INSIGHTS
```

---

# Incremental Analysis

AFTER should avoid reprocessing entire repositories unnecessarily.

After initial analysis:

```text
Last Analysis
      ↓
New Commits
      ↓
Changed Files
      ↓
Affected Graph Nodes
      ↓
Incremental Analysis
```

The system should minimize:

* processing
* API requests
* AI costs
* analysis time

---

# Analysis Jobs

Large analysis operations should run as jobs.

Example:

```text
Repository Analysis

✓ Repository fetched

✓ File tree analyzed

✓ Dependencies analyzed

● Architecture analysis

○ Product Graph

○ Insights
```

The frontend must reflect actual backend state.

Do not fake progress animations.

Possible states:

```text
queued
fetching
analyzing
building_graph
generating_insights
completed
failed
```

---

# Large Repositories

Do not blindly load an entire repository into memory or send it entirely to an AI model.

Use:

* lazy loading
* pagination
* caching
* incremental analysis
* file filtering
* symbol extraction
* contextual retrieval

Common generated directories can be excluded when appropriate:

```text
node_modules/
.git/
dist/
build/
coverage/
.cache/
venv/
__pycache__/
```

Do not exclude legitimate source code.

---

# Rate Limits

GitHub API limits must be respected.

Use where appropriate:

* pagination
* batching
* caching
* conditional requests
* incremental synchronization

The system should monitor API limits and handle rate-limit errors gracefully.

---

# Webhooks

The architecture should support GitHub webhooks.

Potential events:

* push
* pull request
* issue
* release

Example:

```text
GitHub
   ↓
Webhook
   ↓
AFTER
   ↓
Change Detection
   ↓
Incremental Analysis
```

Never create fake webhook events.

---

# User Experience

AFTER should feel:

* fast
* calm
* precise
* premium
* responsive
* intelligent
* native
* minimal

The interface should feel closer to high-quality native software than a generic AI SaaS dashboard.

---

# Apple-Like Design Principles

AFTER should use an Apple-inspired design philosophy without copying Apple's interfaces.

Characteristics:

* generous spacing
* refined typography
* clear hierarchy
* subtle borders
* restrained surfaces
* excellent dark mode
* excellent light mode
* consistent icons
* subtle shadows
* meaningful motion
* excellent empty states

Avoid:

* excessive neon
* excessive gradients
* excessive glassmorphism
* generic AI startup aesthetics
* cluttered dashboards
* excessive cards
* unnecessary decoration

---

# Motion System

Every important interaction should provide feedback.

Examples:

```text
Sidebar
→ smooth selection transition

Dropdown
→ fade + scale

Modal
→ fade + scale

Sheet
→ slide

Cards
→ subtle hover

Buttons
→ press feedback

Tabs
→ sliding indicator

Navigation
→ short page transition

Graph
→ smooth transitions

Loading
→ skeleton

Async operations
→ real progress
```

Prefer:

```text
opacity
transform
```

for performant animations.

Respect:

```text
prefers-reduced-motion
```

---

# UI States

Every important feature should support:

```text
Loading
Empty
Success
Error
Disabled
Permission Denied
```

Example:

```text
No repositories connected.

Connect a repository to begin.
```

is better than an empty interface with no explanation.

---

# Empty States

Empty states should feel intentional.

Examples:

```text
Your software starts here.

Connect a repository to begin.
```

```text
No insights yet.

AFTER will surface observations once your software is analyzed.
```

```text
No pull requests yet.
```

```text
No issues yet.
```

Never populate empty states with fake content.

---

# Error Handling

Errors should provide useful context.

Avoid:

```text
Something went wrong.
```

Prefer:

```text
GitHub connection failed.

Authorization was cancelled.

[Try again]
```

Handle:

* authentication failures
* authorization failures
* GitHub rate limits
* repository access errors
* clone failures
* API failures
* timeouts
* analysis failures
* invalid branches
* oversized repositories

---

# Responsive Design

Desktop should provide the complete experience.

Tablet should adapt the layout.

Mobile should support:

* navigation drawer
* touch-friendly controls
* responsive code browser
* responsive Product Graph
* mobile-friendly actions

---

# Performance

Prioritize:

* lazy loading
* pagination
* caching
* incremental analysis
* virtualized large lists
* efficient graph rendering
* optimized code viewing

Avoid unnecessary full-repository processing.

---

# Architecture

Keep responsibilities modular.

Conceptual structure:

```text
frontend/
├── components/
├── pages/
├── hooks/
├── services/
├── lib/
└── types/

backend/
├── api/
├── auth/
├── github/
├── ingestion/
├── analysis/
├── graph/
├── ai/
├── memory/
├── insights/
├── notifications/
└── workers/
```

The exact structure may evolve.

Responsibilities should remain clearly separated.

---

# AI Agent Rules

Any AI agent working on AFTER must read this README before making changes.

Agents must:

1. Understand the existing architecture before rewriting it.
2. Preserve working functionality.
3. Avoid unnecessary rewrites.
4. Never invent production data.
5. Never create fake repositories.
6. Never create fake commits.
7. Never create fake insights.
8. Never create fake metrics.
9. Never create fake telemetry.
10. Never create fake GitHub connections.
11. Never expose secrets.
12. Never place API keys in frontend code.
13. Use backend services for sensitive operations.
14. Validate authorization server-side.
15. Use real data whenever available.
16. Create loading states.
17. Create empty states.
18. Create error states.
19. Maintain accessibility.
20. Maintain the design system.
21. Respect reduced-motion preferences.
22. Keep TypeScript strict.
23. Avoid unnecessary dependencies.
24. Avoid monolithic components.
25. Test important flows.
26. Fix TypeScript errors.
27. Never hide incomplete functionality behind mock data.
28. Explain technical limitations rather than pretending functionality exists.

---

# Anti-Mock Policy

Before implementing a feature, determine whether it depends on real data.

If it does, implement:

```text
REAL BACKEND
+
REAL DATA
+
REAL PERSISTENCE
```

not:

```text
mockData
fakeData
sampleData
demoData
seedData
hardcodedData
```

Development fixtures may exist in isolated development/test environments, but they must never appear as real user data in production.

---

# Definition of Done

A feature is not complete merely because its UI exists.

A production feature should include, when applicable:

```text
UI
+
STATE
+
BACKEND
+
PERSISTENCE
+
ERROR HANDLING
+
LOADING
+
EMPTY STATE
+
SECURITY
```

For AI-powered functionality:

```text
REAL DATA
+
REAL CONTEXT
+
EVIDENCE
+
APPROPRIATE UNCERTAINTY
```

---

# Development Priorities

## P0 — Core Infrastructure

* Authentication
* Google login
* GitHub OAuth
* Repository discovery
* Complete repository pagination
* Repository ingestion
* Real code analysis
* Git history
* Persistence

## P1 — Software Understanding

* Product Graph
* Dependency Graph
* Why Engine
* Impact Analysis
* Software Memory
* Ask AFTER
* Change Analysis

## P2 — Software Platform

* Code browser
* Branches
* Commits
* Pull Requests
* Issues
* Releases
* Search
* Contributors
* Activity

## P3 — Continuous Intelligence

* Watch
* Webhooks
* Incremental analysis
* Notifications
* Continuous Observation

## P4 — Advanced

* Experiments
* Advanced insights
* GitLab
* Bitbucket
* Organization workspaces
* Team collaboration
* Additional integrations

---

# Future Integrations

AFTER should eventually connect to more than source-control providers.

Potential integrations:

```text
GitHub
GitLab
Bitbucket
Docker
Vercel
Cloudflare
AWS
Google Cloud
Firebase
Databases
CI/CD
Observability platforms
```

The long-term goal is to create a software intelligence layer independent of where the software is hosted.

---

# Product Identity

AFTER should not compete by being another generic AI coding assistant.

The product identity is:

```text
CREATE
      ↓
CODE
      ↓
SHIP
      ↓
CHANGE
      ↓
EVOLVE
      ↓
UNDERSTAND
```

Most developer tools focus heavily on the first stages.

AFTER focuses on what happens as software continues to evolve.

---

# The Difference

```text
GitHub
    ↓
stores and coordinates software

Cursor
    ↓
helps developers write software

Lovable / Base44
    ↓
help create applications

AFTER
    ↓
understands software and its evolution
```

AFTER combines the depth of a software platform with an intelligence layer capable of reasoning over the history and structure of the software.

---

# The Long-Term Vision

AFTER should eventually become a persistent intelligence layer for software.

A developer should be able to ask:

```text
What changed?

Why?

What does it affect?

Why was it built this way?

What became more complex?

What should I investigate?

What happened over the last month?

What architecture decisions were made?

Which dependencies are becoming problematic?

Explain the entire system.
```

And AFTER should answer using the accumulated evidence of the software itself.

---

# The Ultimate Mental Model

```text
                  ┌──────────────────────┐
                  │       SOFTWARE       │
                  └──────────┬───────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │        AFTER         │
                  │                      │
                  │  Understand          │
                  │  Remember            │
                  │  Observe             │
                  │  Explain             │
                  │  Connect             │
                  └──────────┬───────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
            ▼                ▼                ▼
           WHY?            IMPACT            WATCH
            │                │                │
            └────────────────┼────────────────┘
                             │
                             ▼
                      BETTER DECISIONS
```

---

# One Sentence

> **GitHub tells you what exists. AFTER helps you understand why it exists, what changed, what it affects, and what may happen next.**

---

# Final Principle

AFTER should never try to *appear* intelligent.

**AFTER should be useful because it has evidence.**

If the system knows something:

```text
KNOWN
```

If the system can reasonably infer something:

```text
INFERRED
```

If the system cannot determine something:

```text
UNKNOWN
```

Truthful uncertainty is a feature.

Evidence is the foundation.

---

# AFTER

## Software that doesn't age alone.

```
```
