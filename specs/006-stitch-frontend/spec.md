# Feature Specification: Stitch Frontend Refactor for Escalona Labs Agents Factory

**Feature Branch**: `006-stitch-frontend`  
**Created**: 2026-04-15  
**Status**: Draft  
**Input**: User description: "Integrate latest Stitch Agent Factory design into frontend while keeping the guided question-based methodology and AGENTS.md-first flow."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Build Agent from Guided Chat (Priority: P1)

A founder lands on the Create experience and can describe an agent idea in one message. The UI keeps the guided methodology and produces a saved agent card once character JSON is generated.

**Why this priority**: This is the primary product value and must remain intact after visual redesign.

**Independent Test**: Can be fully tested by opening Create view, sending a prompt, receiving assistant output, and confirming a new agent appears in local list.

**Acceptance Scenarios**:

1. **Given** the user opens the app on the Create view, **When** no messages exist, **Then** the user sees a modern glassmorphism hero state with prompt suggestions and clear CTA to start.
2. **Given** the user sends an agent request, **When** the assistant returns a valid character JSON block, **Then** the app creates a new agent record and shows success feedback.
3. **Given** the assistant is streaming output, **When** tokens are arriving, **Then** the chat area updates progressively and keeps auto-scroll behavior.

---

### User Story 2 - Review and Manage Agents in Dashboard (Priority: P2)

A user opens My Agents and can quickly scan, rename, open, and delete agents from a card-based dashboard styled like the Stitch references.

**Why this priority**: Users need reliable management of generated agents; visual refactor cannot break CRUD operations.

**Independent Test**: Can be fully tested by creating two agents and performing rename/open/delete operations from dashboard cards.

**Acceptance Scenarios**:

1. **Given** the user has one or more agents, **When** they open My Agents, **Then** cards render in responsive grid with status, domain, plugin summary, and timestamps.
2. **Given** the user renames an agent from a card, **When** rename is confirmed, **Then** card title and related character metadata update consistently.
3. **Given** the user deletes an agent, **When** confirmation is accepted, **Then** the card is removed and selection state is safely reset if needed.

---

### User Story 3 - Use Agent Detail Tabs with Instruction Files Focus (Priority: P3)

A user opens a specific agent and can switch between Chat, Character, and Instruction Files tabs in a polished, consistent UI aligned to the new design language.

**Why this priority**: This is the conversion path from idea to runnable repo files.

**Independent Test**: Can be fully tested by opening an agent detail page, switching tabs, generating instruction files, and copying outputs.

**Acceptance Scenarios**:

1. **Given** a selected agent, **When** user enters detail view, **Then** the profile header, tabs, and tab panels render with visual consistency and no layout breaks.
2. **Given** instruction files do not exist, **When** user clicks Generate Instruction Files, **Then** AGENTS.md-first artifacts are generated and displayed in copyable code panels.
3. **Given** instruction files exist, **When** user opens Instruction Files tab, **Then** they can read and copy each file and view integration commands.

---

### User Story 4 - Consistent Shell and Navigation (Priority: P4)

A user can navigate Create, My Agents, and Detail flows from a persistent shell (sidebar + main content) with improved visual hierarchy and dark glass styling.

**Why this priority**: Navigation consistency reduces friction and supports long sessions.

**Independent Test**: Can be fully tested by switching across all views in desktop and reduced-width viewport.

**Acceptance Scenarios**:

1. **Given** the app is loaded, **When** user toggles between main sections, **Then** transitions are smooth and stateful data remains intact.
2. **Given** the viewport width is reduced, **When** sidebar collapses, **Then** core navigation stays usable and content remains readable.

---

## Edge Cases

- What happens when Stitch visual assets are unavailable at runtime? The UI must gracefully fall back to code-defined tokens and local styles.
- What happens when assistant output lacks a valid JSON block? The app must not create partial agents or crash.
- What happens when localStorage contains malformed data? The app must recover to an empty safe state.
- What happens when backend sync endpoints are unavailable? The UI must keep local-first behavior and avoid blocking core interactions.
- What happens when domain/status fields are unknown? UI should render safe default badges/colors.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The frontend MUST adopt a dark glassmorphism visual system aligned with Stitch theme tokens (primary purple accent, rounded surfaces, soft borders, depth layers).
- **FR-002**: The frontend MUST preserve existing product flows: Create chat, My Agents dashboard, Agent Detail tabs, and onboarding.
- **FR-003**: The Create view MUST keep guided prompt methodology with suggestion chips and clearly visible primary input action.
- **FR-004**: The My Agents view MUST support list/read/update/delete actions already available before the redesign.
- **FR-005**: The Agent Detail view MUST keep tabs for Chat, Character, and Instruction Files with no regression in behaviors.
- **FR-006**: Instruction file generation MUST remain AGENTS.md-first and include copy-ready outputs.
- **FR-007**: The app MUST continue local persistence (`localStorage`) and optional backend sync without requiring authentication changes.
- **FR-008**: The redesign MUST be implemented in the current static React-in-HTML architecture (`public/index.html`) without introducing framework migration.
- **FR-009**: The styling system MUST centralize design tokens to reduce hard-coded color duplication.
- **FR-010**: The app MUST remain usable on desktop and medium/smaller widths with responsive layout fallbacks.

### Key Entities *(include if feature involves data)*

- **Agent Design**: User-created agent artifact containing identity (name/username), domain, description, plugins, env vars, character JSON, status, and timestamps.
- **Instruction Files Bundle**: Generated AGENTS.md-first files (`agentsMd`, `claudeMd`, `copilotInstructions`, `questionnaireMd`) attached to one Agent Design.
- **View State**: UI state controlling active section (`create`, `agents`, `detail`), selected agent, onboarding visibility, and transient notifications.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of existing critical user flows (create, list, open detail, generate instruction files, copy content) work after redesign with no runtime errors in manual smoke test.
- **SC-002**: TypeScript check (`pnpm exec tsc --noEmit`) completes successfully with exit code 0 after frontend refactor.
- **SC-003**: At least one full end-to-end flow (create agent → open detail → generate instruction files) can be completed in under 2 minutes by a test user.
- **SC-004**: Legacy green-accent style usage in main shell/components is replaced by centralized Stitch-aligned tokens in the updated UI areas.
- **SC-005**: No loss of persisted agent data when reloading the page after redesign changes.
