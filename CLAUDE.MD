# Slidev Presentation — A2UI / AngularDay Talk

## Project
This is a Slidev presentation project for the talk:
"Your AI Should Not Generate HTML: Structured Generative UI with Angular and A2UI"
by Giorgio Galassi, for AngularDay 2026.

## Stack
- Slidev (latest)
- Vue 3
- UnoCSS / Windi CSS (Slidev default)
- Shiki for code highlighting

## Source
The slide content lives in `slides.md` at the project root.
Do not split slides across multiple files unless explicitly asked.

## Theme
Use the default Slidev theme unless instructed otherwise.
Keep the visual style clean, minimal, and professional.
No decorative elements that are not in the slide content.

## Conventions
- Slide content is in `slides.md`
- Speaker notes are inside `<!-- -->` comment blocks at the bottom of each slide
- Do not modify speaker notes unless explicitly asked
- Do not add slides, remove slides, or reorder slides unless explicitly asked
- Frontmatter is at the top of `slides.md` and controls global settings

## Commands
- `npm run dev` — start local dev server
- `npm run build` — build for production
- `npm run export` — export to PDF

## Tasks Claude Code may be asked to do
- Adjust theme or layout of specific slides
- Add or change layout frontmatter on individual slides (e.g. `layout: center`)
- Add custom CSS in `style.css` or inline via `<style>` blocks
- Add transitions or animations
- Fix rendering issues
- Export the presentation
- Add demo screenshots/diagrams to `src/` as the enterprise dashboard demo is built
- Keep `QA.md` and `IMPLEMENTATION-PLAN.md` updated whenever an architecture,
  scope, or production decision for the demo project (client + agent) is
  made, changed, or invalidated — both are living documents, not one-time
  snapshots. `QA.md` is audience-facing (anticipated questions + the "why"
  behind decisions); `IMPLEMENTATION-PLAN.md` is build-facing (scope, build
  order, risks, changelog). When in doubt, update rather than let either
  drift out of sync with what's actually being built.

## Rules
- Never modify slide text content unless explicitly asked
- Never modify speaker notes unless explicitly asked
- Always preserve the `---` slide separators exactly as they are
- If a layout change breaks a slide visually, report it before applying
- Keep all work in the project root unless Slidev convention requires otherwise
