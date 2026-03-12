# Frontend

The frontend is a React 18 + TypeScript single-page application built with Vite. It uses Tailwind CSS 4 for styling, shadcn/ui (Radix + CVA) for UI primitives, React Flow for DAG visualization, and Framer Motion for animations.

## Application State Machine

The app is a three-state machine managed in `src/app/App.tsx`:

```
  +-------+   submit    +--------------+   complete   +---------+
  | INPUT +------------>| RESEARCHING  +------------->| RESULTS |
  +---^---+             +--------------+              +----+----+
      |                                                    |
      +----------------------------------------------------+
                        "New Query" reset
```

| State | Screen | Description |
|---|---|---|
| `INPUT` | `InputScreen` | User enters a historical question and optional config |
| `RESEARCHING` | `StatusScreen` | Real-time SSE feed showing agent progress |
| `RESULTS` | `ResultsScreen` | Interactive DAG timeline and narrative summary |

## Screens

### InputScreen

**File:** `src/app/components/InputScreen.tsx`

Full-width search interface with:
- Large text input with placeholder suggestions (clickable).
- **Investigate** submit button with `Sparkles` icon.
- Collapsible **Advanced config** panel with:
  - Max Causal Depth slider (1-5, default 3)
  - Max Research Cycles slider (1-10, default 5)
  - Focus Threads text input (comma-separated)
- Error display banner (shown when session creation fails).
- Informational note about the agentic loop.

**Props:**
- `onSubmit(query: string, config: any)` -- Called when the user submits.
- `error?: string | null` -- Error message to display.

### StatusScreen

**File:** `src/app/components/StatusScreen.tsx`

Real-time monitoring interface connected to the backend via SSE:

- **Header:** Session status indicator (green pulse dot), query text, research cycle counter, source count.
- **Pipeline visualization:** 5-phase progress bar (Planning, Researching, Evaluating, Adapting, Finalizing) with animated phase icons.
- **Active Threads panel** (left 1/3): Dynamically rendered thread cards with color-coded borders, status indicators (pulse for active, check for complete), and descriptions.
- **Reasoning Trace log** (right 2/3): Dark terminal-style scrollable log showing all agent reasoning entries. Color-coded by agent (Planner=blue, Research=green, Critic=amber, Renderer=purple). Auto-scrolls. Includes "Skip to Results" button.

**Props:**
- `query: string` -- The user's question (displayed in header).
- `sessionId: string` -- Session ID for SSE connection.
- `onComplete(data: DAGData)` -- Called when the session completes. Fetches timeline data from the API.

**SSE Integration:** On mount, connects to `/api/sessions/{id}/stream` and maps events:
- `phase_change` --> updates pipeline position and cycle counter
- `thread_update` --> adds/updates thread cards dynamically
- `reasoning` --> appends to trace log
- `complete` --> triggers `getTimeline()` fetch, then calls `onComplete`

### ResultsScreen

**File:** `src/app/components/ResultsScreen.tsx`

Split-pane results interface with:

- **Header:** "Analysis Complete" badge, target event name, Timeline/Narrative tab toggle, "New Query" button.
- **Main area:** Either `TimelineView` or `NarrativeView` depending on active tab.
- **Detail side panel** (slides in from right): Shows either event detail or edge detail when a node/edge is clicked.

**Event Detail Panel:**
- Thread badge, event title, date, full description.
- Supporting sources list with quality badges, titles, excerpts, and external links.

**Edge Detail Panel:**
- Cause/effect event titles with directional arrow.
- Agent's causal reasoning text.
- Confidence score bar with percentage.

**Props:**
- `data: DAGData` -- The complete DAG data.
- `onReset()` -- Returns to input screen.

### TimelineView

**File:** `src/app/components/TimelineView.tsx`

Interactive DAG visualization built on React Flow (`@xyflow/react`):

- **Node layout:** Events are positioned with:
  - X-axis: chronological (timestamp mapped to pixel position across 1500px).
  - Y-axis: thread lanes (160px per lane, stacked vertically).
- **Custom event nodes:** Cards showing date, title, description (2-line clamp), and optional "Target" badge. Border color matches thread color.
- **Edges:** Animated arrows with thickness proportional to confidence score (1.5 + confidence * 2 px). Hover transitions to indigo.
- **Thread lane backgrounds:** Subtle labeled swim lanes behind the graph.
- **Target event:** Centered vertically across all lanes, with red border and "Target" badge.
- **Controls:** React Flow zoom/pan controls. Fits view on load with 0.1 padding.

**Props:**
- `data: DAGData` -- Events, edges, threads.
- `onNodeClick(node: EventNode)` -- Opens event detail panel.
- `onEdgeClick(edge: CausalEdge)` -- Opens edge detail panel.

### NarrativeView

**File:** `src/app/components/NarrativeView.tsx`

Prose reading experience:

- Centered card layout with decorative corner accent.
- Large title: "Causal Summary: {target event name}".
- Date badge and "Auto-generated by Renderer Agent" label.
- Paragraphs with drop-cap first letters.
- Confidence note footer with average score and event count.

## Service Layers

### API Client

**File:** `src/app/services/api.ts`

Typed wrapper around `fetch` for all REST endpoints:

| Function | Method | Path | Returns |
|---|---|---|---|
| `createSession(query, config)` | POST | `/api/sessions` | `{ session_id }` |
| `getSession(id)` | GET | `/api/sessions/{id}` | Session object |
| `getTimeline(id)` | GET | `/api/sessions/{id}/timeline` | `DAGData` |
| `getNarrative(id)` | GET | `/api/sessions/{id}/narrative` | `{ narrative }` |
| `deepenThread(id, threadId)` | POST | `/api/sessions/{id}/deepen` | Status object |
| `listSessions()` | GET | `/api/sessions` | Session array |

Base URL is read from `VITE_API_URL` environment variable (defaults to empty string for relative paths via Vite proxy).

### SSE Manager

**File:** `src/app/services/sse.ts`

Typed SSE connection manager:

```typescript
const disconnect = connectSSE(sessionId, {
  onPhaseChange: (data) => { ... },
  onThreadUpdate: (data) => { ... },
  onReasoning: (data) => { ... },
  onCritique: (data) => { ... },
  onComplete: (data) => { ... },
  onError: (data) => { ... },
});

// Later:
disconnect(); // Closes the EventSource
```

Returns a cleanup function that closes the `EventSource`. The connection auto-closes on `complete` events.

## TypeScript Interfaces

**File:** `src/app/types.ts`

| Interface | Description |
|---|---|
| `EventNode` | `{ id, date, timestamp, title, description, thread_id, sources[], is_target? }` |
| `CausalEdge` | `{ id, from_event_id, to_event_id, reasoning, confidence }` |
| `Thread` | `{ id, name, description, color }` |
| `Source` | `{ url, title, quality, excerpt }` |
| `DAGData` | `{ target_event, threads[], events[], edges[], narrative }` |

## UI Component Library

The `src/app/components/ui/` directory contains shadcn/ui primitives built on Radix UI. These are pre-configured with the project's design tokens (defined in `src/styles/theme.css`). Available components include:

accordion, alert, alert-dialog, aspect-ratio, avatar, badge, breadcrumb, button, calendar, card, carousel, chart, checkbox, collapsible, command, context-menu, dialog, drawer, dropdown-menu, form, hover-card, input, input-otp, label, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner, switch, table, tabs, textarea, toggle, toggle-group, tooltip.

All use the `cn()` utility from `src/app/components/ui/utils.ts` for className composition (clsx + tailwind-merge).

## Styling

- **Tailwind CSS 4** with `tw-animate-css` for animation utilities.
- **CSS custom properties** in `src/styles/theme.css` for design tokens (colors, radius, fonts).
- **Dark mode** support via `.dark` class variant (not currently toggled in the app).
- Base typography styles for `h1`-`h4`, `p`, `label`, `button`, `input` in the `@layer base`.
