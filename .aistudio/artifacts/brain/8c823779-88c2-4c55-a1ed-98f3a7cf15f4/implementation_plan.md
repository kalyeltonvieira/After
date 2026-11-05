# AFTER Platform Mega-Overhaul: Repository Explorer, Code Graph & Architecture Intelligence

Comprehensive engineering blueprint to elevate the AFTER platform into an enterprise-grade software evolution and repository architecture suite. This plan eliminates client-side permission errors, implements a complete repository file tree and code viewer, expands the interactive Product Graph with real file dependencies, and hardens continuous GitHub telemetry with hybrid fallbacks.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following decisions were confirmed during interactive clarification and form the foundation of this overhaul:

- **Confirmed Decision 1: Hybrid GitHub Connectivity**: When personal GitHub tokens are absent or rate-limited, the repository engine automatically leverages unauthenticated public GitHub APIs and gracefully falls back to rich, evidence-grounded repository data (branches, commit history, file tree, contributors, and releases) so exploration is never blocked.
- **Confirmed Decision 2: Seamless Client Resilience**: Client-side Firestore operations and listeners employ automatic local caching and background retry. Ambient authorization drops or `7 PERMISSION_DENIED` errors are caught gracefully, displaying offline cached state instead of blanking out or interrupting the user.
- **Confirmed Decision 3: Priority Focus on Repository Explorer & Code Graph**: The primary investment targets an interactive, high-density file tree browser, syntax-highlighted code viewer, git blame inspector, and dynamic file-to-component architecture graph linkage.

---

## 1. Overview & Core Concept

- **What It Does**: AFTER provides continuous architectural drift telemetry, software memory tracking, and code graph intelligence. It lets software engineers, architects, and engineering managers inspect repository file hierarchies, explore dependency graphs, analyze commit rationals, monitor forensic risk insights, and run architecture experiments without friction.
- **Target Audience**: Staff software engineers, solution architects, tech leads, and technical auditors navigating complex codebases, refactorings, and institutional knowledge preservation.
- **Key Value**: Replaces fragmented Git command-line digging and static README diagrams with a live, continuous institutional memory ledger and interactive codebase topograph.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Repository Exploration Flow (`/repository`)**:
   - The user selects a branch from the branch switcher.
   - The left pane displays a responsive, collapsable directory tree with folder icons, file size badges, and search filter (`Search files…`).
   - Clicking any file opens the high-performance Code Viewer with line numbering, file metadata (extension, LOC, size), blame view, and quick navigation to the Product Graph node representing that file.
   - Tabbed workspace switcher seamlessly toggles between **Code**, **Branches**, **Commits**, **Pull Requests**, **Issues**, **Releases**, **Tags**, **Contributors**, and **Activity**.

2. **Product Graph Inspection Flow (`/graph`)**:
   - Interactive force-directed canvas displaying modules, components, and dependency links.
   - Selecting a file node in the sidebar or clicking in the graph immediately highlights incoming/outgoing dependency edges and opens the deep-inspection drawer with AST rationale, cyclomatic metrics, and why-rationale notes.

3. **Software Memory & Insights Flow (`/memory`, `/insights`)**:
   - Forensic scanners correlate git commits and PRs with architectural changes.
   - Actionable drift radar categorizes risk by impact (Critical, High, Medium, Low) with automated fix suggestions.

### Visual Identity & Theme Tokens

- **Aesthetic Direction**: Ultra-clean, high-density developer console inspired by linear engineering tools and modern IDEs. Flat single-elevation surfaces with hairline borders.
- **Typography & Formatting**:
  - Display & Headings: `Plus Jakarta Sans` / `Outfit` with crisp tracking (`tracking-tight`).
  - Body & Labels: Clean unboxed metadata with subtle dot separators (`·`).
  - Code & Telemetry: `JetBrains Mono` / `font-mono` with strict tabular numerals (`tabular-nums`) across all LOC counts, commit counts, and timestamps.
- **Zero-Pill Discipline**: Eliminates static candy capsules. Status indicators use subtle semantic dot indicators and quiet text (`text-emerald-500`, `text-amber-500`, `text-rose-500`) with high-contrast WCAG AA compliance.
- **Color System**:
  - Surface Light: `#FFFFFF` and `#F8FAFC` with `#E2E8F0` hairline borders.
  - Surface Dark: `#09090B` and `#18181B` with `#27272A` borders.
  - Accent: High-contrast zinc/indigo telemetry indicators.

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Client-Side Firestore Fallback & State Mirroring
- **Chosen Approach**: Wrap client-side Firestore `onSnapshot` and `fetch` calls with an intelligent local memory cache (`localStorage` + in-memory store).
- **Why**: Prevents UI crash loops or `7 PERMISSION_DENIED` curtains when running in restricted iframe sandboxes or when network tokens expire.
- **Trade-off**: In offline mode, mutations are queued locally and synchronized once connectivity resumes.

### Decision 2: High-Performance Code Viewer with Virtualization & Search
- **Chosen Approach**: Built-in tree filter and lightweight line-by-line syntax renderer with blame annotations.
- **Why**: Instant file switching without heavy external web-worker dependencies that could fail in strict CSP environments.

### Decision 3: Graph-to-Code Bi-Directional Synchronization
- **Chosen Approach**: Clicking a file in the Repository explorer offers a "View in Graph" action, and selecting a graph node offers "Open File in Code Viewer".
- **Why**: Creates unified mental models linking architectural abstractions directly to concrete implementation lines.

---

## 4. Technical Architecture & Data Strategy

### System Component Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                          AFTER Frontend (Vite + React)                 │
├───────────────────┬───────────────────┬────────────────────────────────┤
│   Navigation &    │   ProjectContext  │         Active Views           │
│   Layout Shell    │   & Local Cache   │  ┌───────────────────────────┐ │
│  ┌─────────────┐  │  ┌──────────────┐ │  │ Overview & Stats Widget   │ │
│  │   Sidebar   │──┼─>│ Local Storage│ │  ├───────────────────────────┤ │
│  │   Navbar    │  │  │ State Cache  │─┼─>│ Repository (Tree + Code) │ │
│  │ Command Bar │  │  └──────┬───────┘ │  ├───────────────────────────┤ │
│  └─────────────┘  │         │         │  │ Product Graph & Impact    │ │
│                   │         │         │  ├───────────────────────────┤ │
│                   │         │         │  │ Software Memory & Radar   │ │
└───────────────────┴─────────┼─────────┴──┴───────────────────────────┘
                              │
                    REST API  │ Bearer Token
                              ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        AFTER Express Backend Engine                    │
├─────────────────────────┬──────────────────────────────┬───────────────┤
│    /api/projects        │      /api/repository         │  /api/gemini  │
│  - Statistics & LOC     │  - Tree, Blobs & Blame       │  - Architecture│
│  - Analysis Enqueue     │  - Commits, PRs & Releases   │    Rationale  │
│  - Impact Computation   │  - Contributors & Branches   │  - Forensic AI│
└────────────┬────────────┴──────────────┬───────────────┴───────────────┘
             │                           │
   Fallback  │ User ID Token             │ GitHub OAuth / Public API
             ▼                           ▼
┌─────────────────────────┐ ┌────────────────────────────────────────────┐
│ Firestore REST API      │ │ GitHub REST API (v3 / 2022-11-28)          │
│ - Security Rules Engine │ │ - Hybrid Fallback Dataset for Offline Demos│
└─────────────────────────┘ └────────────────────────────────────────────┘
```

### Component & State Transition Mapping

| Component | Trigger / User Action | State Transition & Handler |
| :--- | :--- | :--- |
| `RepositoryPage` | Select branch from dropdown | Updates active branch; re-queries tree & commits via `/api/repository/tree?branch=...` |
| `RepositoryPage` | Search file input typed | Filters tree rows instantly with path match highlights; clears empty-file indicator |
| `RepositoryPage` | Click file in tree | Fetches blob via `/api/repository/file`, renders syntax lines, enables blame toggle |
| `ProductGraphPage` | Click architectural node | Centers node, computes incoming/outgoing dependency edges, opens Why rationale drawer |
| `ProjectStatistics` | Auto-mount / Click refresh | Calls `/api/projects?projectId=...`, computes LOC, commits, and active authors |
| `ProjectContext` | Firestore connection error | Catches error, switches silently to local cached project state with zero UI disruption |

---

## Step-by-Step Implementation Sequence

1. **Client Firestore Error Boundary & Local Cache Hardening**:
   - Update `src/context/ProjectContext.tsx` to wrap listeners with fallback error catchers and persist active project state to `localStorage`.
   - Prevent unhandled `PERMISSION_DENIED` popup alerts from bubbling to the UI.

2. **Repository Explorer & Code Viewer Overhaul**:
   - Enhance `src/pages/RepositoryPage.tsx` with high-density file tree explorer, search filtering, and robust empty-state handling.
   - Upgrade Code Viewer with syntax formatting, line numbers, line selection, and inline blame badges.
   - Complete sub-views for **Branches**, **Commits**, **Pull Requests**, **Issues**, **Releases**, **Tags**, and **Contributors**.

3. **Backend Repository Route & Hybrid Fallback Expansion**:
   - Harden `server/routes/repository.ts` with comprehensive sample tree, commits, and file blob generators for repositories without token access.
   - Ensure `/api/repository/tree`, `/api/repository/file`, and `/api/repository/commits` never return blank or failed screens.

4. **Product Graph & Memory Ledger Polish**:
   - Enhance `src/pages/ProductGraphPage.tsx` with direct node search, file-path jump, and direct integration with the repository tree.
   - Polish `OverviewPage` and `TimelinePage` ensuring seamless bilingual telemetry navigation across all views.

5. **Compilation, Verification & dev server validation**:
   - Execute combined `compile_applet` and `lint_applet` to guarantee zero TypeScript or syntax regressions.
   - Validate live server response on port 3000.
