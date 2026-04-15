# Implementation Plan: Stitch Frontend Refactor for Escalona Labs Agents Factory

**Branch**: `006-stitch-frontend` | **Date**: 2026-04-15 | **Spec**: `/home/escalona/nosship/specs/006-stitch-frontend/spec.md`  
**Input**: Feature specification from `/specs/006-stitch-frontend/spec.md`

## Summary

Refactor the existing single-file frontend (`public/index.html`) to match the latest Stitch visual direction (dark glassmorphism, purple accent, Plus Jakarta Sans, rounded-12 geometry) while preserving current product behavior: guided creation chat, agent dashboard CRUD, and AGENTS.md-first instruction-file generation.

## Technical Context

**Language/Version**: HTML + React 18 UMD + Babel (in-browser JSX), TypeScript backend (Bun/Node runtime)  
**Primary Dependencies**: `react@18` UMD, `react-dom@18` UMD, `tailwindcss` CDN config, Socket.IO client  
**Storage**: Browser `localStorage` + optional HTTP sync to backend plugin routes  
**Testing**: TypeScript compile check (`pnpm exec tsc --noEmit`) + local smoke via running dev server and HTTP checks  
**Target Platform**: Desktop-first web UI (responsive on smaller widths)  
**Project Type**: Web app with static frontend shell and TS backend APIs  
**Performance Goals**: UI remains interactive during chat streaming and view switches; no perceptible lag in agent list with typical local volumes  
**Constraints**: Keep current architecture (no framework migration), avoid breaking existing data shape, preserve AGENTS.md-first workflow  
**Scale/Scope**: Visual system refactor and key component updates inside one frontend file (`public/index.html`)

## Constitution Check

- Constitution file is currently template-only (no enforceable project-specific gates declared).
- Operational gates for this feature:
  1. Preserve existing business behavior (create/manage/detail/instruction generation).
  2. Keep backward-compatible data shape for existing saved agents.
  3. No destructive file operations; scope limited to feature files.

Status: PASS (proceed)

## Project Structure

### Documentation (this feature)

```text
specs/006-stitch-frontend/
├── plan.md
└── spec.md
```

### Source Code (repository root)

```text
public/
└── index.html                      # Main frontend shell and React components

designs/stitch/agent-factory-clean-futuristic/
├── 01-configuraci-n-de-personas.jpg
├── 02-chat-con-agente-solana-monitor.jpg
├── 03-agent-factory-modern-glassmorphism.jpg
├── 04-mis-agentes-dashboard.jpg
├── manifest.json
├── project.json
└── screens.json
```

**Structure Decision**: Keep single-file frontend architecture for speed and compatibility. Apply token/theme + component-level style/layout refactor directly in `public/index.html`, using Stitch assets as visual references.

## Execution Phases

### Phase 0 — Spec/Design Alignment (done)

1. Capture Stitch metadata and downloaded screen assets.
2. Define user stories and acceptance criteria in `spec.md`.
3. Confirm non-regression scope for create/manage/detail flows.

### Phase 1 — UI Token Refactor

1. Replace green-heavy theme tokens with Stitch-aligned tokens (purple primary `#6e30e8`, glass surfaces, subtle borders, glow accents).
2. Update global typography to Plus Jakarta Sans fallback chain.
3. Add reusable utility classes for glass cards, gradient backgrounds, and elevated states.

### Phase 2 — Shell + Core Views Refactor

1. Update sidebar shell to glassmorphism layout with improved spacing and hierarchy.
2. Refactor Create view empty state, suggestion chips, and input container to new design language.
3. Refactor My Agents dashboard cards/grid to match modern card system.
4. Refactor Detail header/tabs and instruction section containers for visual consistency.

### Phase 3 — Validation

1. Run typecheck: `pnpm -C /home/escalona/nosship exec tsc --noEmit`.
2. Run dev server smoke check and basic endpoint/UI verification.
3. Validate one full flow: create agent → open detail → generate instruction files.

## File-Level Change Plan

1. **Modify** `public/index.html`
   - Theme tokens (`tailwind.config.extend.colors`, fonts, custom CSS).
   - Sidebar, CreateView, AgentCard, AgentsView, DetailView visual/layout classes.
   - Preserve all existing logic/state/event handlers unless explicitly required for UI behavior.

2. **No backend logic changes required** for this feature unless smoke tests reveal regression.

## Risks & Mitigations

1. **Risk**: Large single-file edit can break JSX structure.
   - **Mitigation**: Use incremental patches and run type/smoke checks immediately.

2. **Risk**: Styling-only changes accidentally alter behavior.
   - **Mitigation**: Keep JS logic untouched; patch classNames/markup wrappers only.

3. **Risk**: Existing localStorage data has old statuses/domains.
   - **Mitigation**: Keep fallback badge/domain mappings and default-safe rendering.

## Complexity Tracking

No constitution violations requiring exception tracking.