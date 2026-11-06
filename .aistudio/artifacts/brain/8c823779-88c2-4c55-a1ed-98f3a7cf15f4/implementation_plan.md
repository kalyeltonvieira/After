# AFTER UI/UX Overhaul & Premium Engineering Architecture

Transform AFTER into a Swiss-minimalist, high-performance software intelligence console inspired by Linear and Vercel. Fix the broken theme switcher, implement fluid Motion transitions, and add key architectural features: Visual Architecture Comparator, Executive Integrity Report Export, and Advanced Public Repository Filters.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following directions have been confirmed based on user feedback:
> - **Visual Direction**: Clean Swiss minimalist (Linear / Vercel design system), featuring crisp monochromatic typography, 1px subtle hairline borders, and zero-pill metadata discipline.
> - **Motion Experience**: Fluid page transitions (`AnimatePresence` with custom spring curves), layout animations on tab switches, and hover micro-interactions.
> - **Theme Mode Fix**: Configure Tailwind v4 `@custom-variant dark (&:where(.dark, .dark *));` to ensure immediate and accurate dark/light/system mode switching without split-brain contrast issues.
> - **Key Priority Features**:
>   1. Visual Architecture Comparator between branches or tags (`/api/repository/compare-architecture`).
>   2. Executive Software Integrity & Rationale Report Export (printable/PDF view + JSON download).
>   3. Advanced Filters for GitHub Public Discovery (stars threshold, language, and license).

---

## 1. Overview & Core Concept

- **What It Does**: Elevates AFTER from a functional Git tool into an executive-grade software intelligence command center. Users can inspect repository drift, observe real-time AST graphs, compare component evolutions between branches, and export architectural audit reports.
- **Target Audience**: Software architects, principal engineers, tech leads, and development teams requiring auditable institutional rationale and architecture tracking.
- **Key Value**: Instant clarity on software drift, why architectural decisions were made, and zero-confusion theme consistency across all views.

---

## 2. User Experience & Visual Design

### Visual Identity & Theme
- **Aesthetic Direction**: Minimalist Swiss precision (Linear & Vercel). High-density information design with generous whitespace rhythm. No neon clutter, no arbitrary scoreboards, no pill badge clutter.
- **Color System (60-30-10)**:
  - *Light Mode*: Canvas `#FAFAFA` (zinc-50), surfaces `#FFFFFF` with `border-zinc-200/80`, text `zinc-950` / `zinc-600`.
  - *Dark Mode*: Canvas `#09090B` (zinc-950), surfaces `#121215` with `border-zinc-800/80`, text `zinc-50` / `zinc-400`.
  - *Accents (10%)*: Monochromatic high-contrast buttons (`bg-zinc-900 text-white` / `dark:bg-zinc-100 dark:text-zinc-900`) with emerald (`#10B981`) for nominal/known status and amber (`#F59E0B`) for warnings.
- **Typography & Tabular Numerals**:
  - Headings: Crisp semi-bold sans with balanced measure (`text-wrap: balance`).
  - Numbers & Metrics: Strictly monospace tabular figures (`font-mono tabular-nums`).
  - Metadata: Unboxed text separated by quiet interpuncts (`·`).

### Motion & Interactions
- **Page & View Transitions**: Custom easing curve `cubic-bezier(0.16, 1, 0.3, 1)` with subtle vertical drift (`y: 6px → 0px`, duration `180ms`).
- **Interactive State Feedback**: Active tabs use Motion `layoutId="activeTabPill"` for seamless sliding highlights.
- **Skeleton Shimmer**: Replaces static loading spinners with geometry-matched skeleton placeholders.

---

## 3. Key Product Decisions & Trade-Offs

1. **Tailwind v4 Theme Engine Fix**:
   - *Chosen Approach*: Add `@custom-variant dark (&:where(.dark, .dark *));` to `src/index.css` and audit all top-level wrappers to ensure `dark:*` pairs are active.
   - *Why*: In Tailwind v4, dark variants default to media queries unless the class selector variant is explicitly registered.
2. **Architecture Comparator**:
   - *Chosen Approach*: Compare AST nodes, exported symbols, and dependency edges between two candidate refs (e.g. `main` vs `feat/branch`), highlighting added, removed, and modified architectural components.
   - *Why*: Allows teams to see structural drift before merging PRs.
3. **Executive Software Health & Integrity Report**:
   - *Chosen Approach*: Client-rendered, print-optimized document view with standard browser print dialog (`window.print()`) plus structured `.json` audit ledger download.
   - *Why*: Zero external heavy PDF libraries, instantaneous generation, and pristine typography for executive sharing.
4. **Advanced Discovery Filters**:
   - *Chosen Approach*: Expand `searchPublicRepositories` to accept language dropdown (`TypeScript`, `Python`, `Go`, `Rust`), minimum stars filter (`1k+`, `5k+`, `10k+`), and license filter.
   - *Why*: Turns repository discovery into an intentional research workflow.

---

## 4. Technical Architecture & Component Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Top Navigation Bar                       │
│  [AFTER Brand] — [Breadcrumbs] — [Theme Toggle | Profile]   │
└──────────────────────────────┬──────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
 ┌──────────────────────┐             ┌──────────────────────┐
 │    Sidebar Nav       │             │   Main Content Area  │
 │  - Overview          │             │  (Motion Transition) │
 │  - Projects / Search │             └──────────┬───────────┘
 │  - Repository (Tree) │                        │
 │  - Architecture Graph│       ┌────────────────┼────────────────┐
 │  - Comparator (New)  │       ▼                ▼                ▼
 │  - Executive Report  │  ┌──────────┐    ┌───────────┐    ┌───────────┐
 │  - Software Memory   │  │ Projects │    │ Compare   │    │ Executive │
 └──────────────────────┘  │ Discovery│    │ Branches  │    │ Report    │
                           └──────────┘    └───────────┘    └───────────┘
                                │                │                │
                                └────────────────┼────────────────┘
                                                 │
                                                 ▼
                                   ┌───────────────────────────┐
                                   │   Express Backend Routes  │
                                   │  - /github-search (params)│
                                   │  - /compare-architecture  │
                                   │  - /impact-analysis       │
                                   └───────────────────────────┘
```

---

## 5. Step-by-Step Implementation Plan

### Step 1: Fix Dark / Light / System Theme Architecture
- In `src/index.css`: Add `@custom-variant dark (&:where(.dark, .dark *));` below `@import "tailwindcss";`.
- Audit `src/context/ThemeContext.tsx` and verify `document.documentElement.classList.add/remove("dark")` applies instantly across all components.
- In `Navbar.tsx` and `SettingsPage.tsx`: Ensure theme toggle triggers smooth view transitions and displays current state accurately.

### Step 2: Implement Advanced Discovery Filters in `ProjectsSearchBar.tsx`
- Add filter controls: Star thresholds (`All`, `>1,000`, `>5,000`, `>20,000`), Languages (`All`, `TypeScript`, `JavaScript`, `Python`, `Go`, `Rust`), and sorting (`stars`, `forks`, `updated`).
- Pass filters to `/api/projects/github-search` and display refined metadata cards.

### Step 3: Implement Visual Architecture Comparator View (`ArchitectureCompareModal.tsx` & endpoint)
- Create backend endpoint `POST /api/repository/compare-architecture`: Compares AST nodes, file changes, and exported components between `base` ref and `head` ref.
- Create UI modal/view with side-by-side diff highlighting added nodes, removed exports, and dependency graph divergence.

### Step 4: Implement Executive Software Health Report Modal (`ExecutiveReportModal.tsx`)
- Generates an executive summary of the repository: total AST components, dependency edges, security posture, author breakdown, and known vs inferred rationale ledger.
- Provides one-click Print / Save as PDF and Export JSON.

### Step 5: Premium Motion & Polish Across Views
- Enhance `AnimatePresence` and spring transitions on tab switches.
- Replace remaining spinners with subtle shimmer skeleton lines.
- Validate via `compile_applet`, `lint_applet`, and test runner.
