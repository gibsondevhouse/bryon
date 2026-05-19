# Bryon Design System Blueprint

=============================
Styling target: DeepSeek Chat (chat.deepseek.com) in a Bryon-first, chat-focused product.

Design philosophy

-----------------
DeepSeek’s interface is optimized for *thinking and reading* (long text, headings, bullet lists, code) rather than novelty chat bubbles. Bryon should follow this: stability, clarity, and low friction.

Core system decisions

---------------------
- **Text-first chat UI**: message “cards” instead of left/right bubbles.
- **Always-ready action**: sticky input bar with primary CTA visible at all times.
- **Context breadcrumb**: keep model/mode visible (e.g., “Instant”) without clutter.
- **Minimal chrome**: borders and background tone do the separation, not heavy shadows.

1) App shell layout

-------------------

### Structure
- Two panes:
  - Sidebar: navigation, chat list, footer identity/actions.
  - Main: conversation view, top context, bottom input bar.
- Main pane scrolls independently from sidebar.
- Input bar fixed below the conversation scroll area.

### Dimensions (approx)
- Max content width: 1200px.
- Sidebar: 280–320px, column layout.
- Chat list item height: 44–52px.
- Conversation message card max width: ~900px (comfortable reading line length).

### Responsive behavior
- Breakpoints (Tailwind-like defaults are fine, or define explicitly):
  - sm: 640
  - md: 768
  - lg: 1024
  - xl: 1280
- Below md:
  - Sidebar collapses into top-level nav or modal drawer.
  - Input bar stays sticky at bottom with full width.

2) Design tokens (Bryon native)
-------------------------------
### Spacing (base-8 system)
- space-2: 8px
- space-3: 12px
- space-4: 16px
- space-6: 24px
- space-8: 32px

### Radii
- radius-sm: 10px
- radius-md: 12px
- radius-lg: 16px
- radius-pill: 9999px

### Typography
- Font: system stack + Inter-like fallback.
- Body: 15–16px, line-height 1.5.
- Meta: 12–13px.
- Sidebar titles: 16–18px.

### Colors (approx)
These are chosen to match the “cool gray + blue accent” vibe.
- bg-shell: #F4F5F7 to #F8FAFC
- bg-card: #FFFFFF
- border: #E5E7EB
- text: #0F172A
- text-muted: #6B7280
- text-muted-2: #9CA3AF
- primary: #2563EB
- amber: #F59E0B (optional notices)
- badge-bg: #F3F4F6, badge-text: #6B7280

3) Component specs (all major parts)
------------------------------------
### Sidebar (must-have)
- “New chat” button:
  - Full width
  - Padding: 10px vertical / 14px horizontal
  - Radius: 12px
  - State: hover tint + focus ring with primary

- Chat list:
  - Item layout: title + metadata (timestamp, short preview)
  - Density: allow line wrap on title for longer names
  - Selected row: background tint, border-left accent (2–3px) or subtle shadow
  - Group header: month/year tag with lighter text

- Sidebar footer identity block:
  - User name + avatar/initials
  - Right-side ellipsis button
  - Sticky to bottom, separated by space or divider

### Main conversation
- Context header strip:
  - Mode label pill (Instant/Expert/Vision)
  - Optional model dropdown
  - Height: 36–40px
  - Spacing: padding-x 14, padding-y 10

- Message cards:
  - Padding: 16–20
  - Radius: 12–16
  - Meta line:
    - “Thought for N seconds”
    - Small muted text
  - Content:
    - Headings, lists, code blocks treated as “document section”
  - Utility actions:
    - Icon buttons with 36–40px hit area
    - 18–20px icons
    - Show on hover/focus, keep hidden otherwise to reduce clutter

- Expand/collapse control:
  - Inline button at end of “preview”
  - Text-only button style:
    - No heavy border
    - Primary text color with underline on hover

### Input/action bar
- Layout:
  - Row: Textarea | DeepThink | Search
  - Gap: 12–16
  - Align vertically center
- Textarea:
  - Height: 44–52 default, expand up to 150
  - Border: 1px solid border token
  - Radius: 14–16
- Buttons:
  - Primary Search:
    - Height: 40
    - Padding-x: 14
    - Radius: 12
    - Primary fill color
  - Secondary DeepThink:
    - Ghost/outline style
    - Same height/shape as primary

4) States, motion, accessibility
--------------------------------
### States
- Hover: +2–4% brightness, no large motion.
- Active: slightly darker, maintain contrast.
- Focus: primary colored ring (2px) with outer spread for visibility.
- Disabled: reduced opacity and “not-allowed” cursor.

### Motion
- Use a single global transition token:
  - duration: 150–200ms
  - easing: cubic-bezier(0.2, 0, 0, 1) or similar

### Accessibility & ergonomics
- Contrast:
  - Ensure primary CTA meets 4.5:1 for text
  - Muted text acceptable for metadata if still readable
- Keyboard:
  - Tab order: sidebar nav → chat list → context header → conversation actions → input bar
  - Esc closes sidebar drawer on mobile
- Reduced motion:
  - Respect prefers-reduced-motion and remove transitions/elevations

5) Implementation starter (Tailwind-style pseudo config)
--------------------------------------------------------
- Container:
  - padding: 16
  - center
- Extend colors with tokens above
- Add component classes:
  - `message-card`
  - `sidebar-footer`
  - `segmented-control`
  - `icon-button`

6) What “comprehensive and complete” means (checklist)
------------------------------------------------------
Before you ship Bryon, ensure:
- Sidebar supports folders or at least search + pinning
- Message cards support code blocks and inline actions
- Input bar remains pinned, never scrolls away
- Mobile drawer exists and is keyboard-friendly
- Theme tokens centralized (colors, spacing, radii, typography)
- A11y tested for focus rings and contrast

Outcome
-------
This document is designed to let you build Bryon in the styling of DeepSeek Chat without guessing the product shape during implementation. It balances enough specificity to be buildable with the flexibility to adapt to your stack (Svelte, React, etc.).
