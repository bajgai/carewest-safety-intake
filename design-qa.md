# Design QA — Aramark-aligned Carewest Safety Intake

## Comparison target

- Source visual truth:
  - `/Users/home/.codex/visualizations/2026/07/13/019f5b79-f285-7971-9466-80f7e05ff2c9/aramark-ca-desktop-reference.jpg`
  - `/Users/home/.codex/visualizations/2026/07/13/019f5b79-f285-7971-9466-80f7e05ff2c9/aramark-ca-mobile-reference.jpg`
- Browser-rendered implementation:
  - URL: `http://127.0.0.1:4173/`
  - Desktop screenshot: `/Users/home/.codex/visualizations/2026/07/13/019f5b79-f285-7971-9466-80f7e05ff2c9/reporting-final-desktop.jpg`
  - Mobile screenshot: `/Users/home/.codex/visualizations/2026/07/13/019f5b79-f285-7971-9466-80f7e05ff2c9/reporting-final-mobile.jpg`
- Viewports:
  - Desktop: `1280 × 720`, device-independent pixels
  - Mobile: `390 × 844`, device-independent pixels
- State: Aramark.ca homepage at its initial hero/header state with the site's cookie notice visible; Carewest intake at its initial Site/Type landing state with no preselected site or category.
- Comparison scope: the corporate site's visual language—not a literal homepage clone—applied to an operational safety form while preserving its information architecture, content, fields, validation contract, and routing behavior.

## Evidence

### Final full-view comparisons

- Desktop: `/Users/home/.codex/visualizations/2026/07/13/019f5b79-f285-7971-9466-80f7e05ff2c9/design-qa-final-desktop.jpg`
- Mobile: `/Users/home/.codex/visualizations/2026/07/13/019f5b79-f285-7971-9466-80f7e05ff2c9/design-qa-final-mobile.jpg`

### Final focused comparisons

The top regions were compared separately because logo fidelity, header geometry, typography, progress navigation, and responsive wrapping are too small to judge reliably in the full-view images.

- Desktop header/hero: `/Users/home/.codex/visualizations/2026/07/13/019f5b79-f285-7971-9466-80f7e05ff2c9/design-qa-final-focus-desktop.jpg`
- Mobile header/hero: `/Users/home/.codex/visualizations/2026/07/13/019f5b79-f285-7971-9466-80f7e05ff2c9/design-qa-final-focus-mobile.jpg`

## Findings

No actionable P0, P1, or P2 findings remain.

- Fonts and typography: the final design reproduces the source's uppercase, tracked navigation treatment and editorial serif display hierarchy. `Avenir Next`/Helvetica and Georgia are intentional system-font substitutes for Aramark.ca's licensed Gotham SSm and Reckless Neue files; the licensed source fonts were not copied. Line height, weight, wrapping, and optical hierarchy remain readable at both target viewports.
- Spacing and layout rhythm: the navy utility strip, floating white pill brand bar, centered progress rail, rounded main surface, generous field rhythm, and mobile stacking match the source's proportions without crowding the form. No horizontal overflow was present at either viewport (`scrollWidth` equaled viewport width).
- Colors and tokens: the implementation now uses Aramark red `#EB002A`, deep navy `#0B1F33`, white, and soft neutral surfaces consistently. Red carries primary action, focus, active, and progress emphasis while green remains reserved for live/success semantics.
- Image quality and asset fidelity: the red Aramark mark is the exact vector asset captured from the official site. The paired Carewest logo is an official local brand asset, resized to an appropriate 2× display resolution. No source logo or photographic asset was replaced with CSS art, emoji, or an approximate drawing. The corporate homepage photography was intentionally not transplanted into this operational intake because it is not app-specific safety content and no approved safety hero was available.
- Copy and content: task-specific emergency, privacy, site, and reporting guidance remains coherent and unchanged in meaning. Corporate styling did not introduce homepage copy into the form.
- Icons and controls: existing functional pictograms remain aligned and consistent; form controls have clear red focus/selected states, practical tap targets, semantic labels, and responsive wrapping.
- Accessibility and responsiveness: labels and alt text are present for both brand marks; controls remain semantic and keyboard-addressable; reduced-motion handling remains; no clipping, overlap, or persistent-control obstruction was found at desktop or mobile sizes.

## Comparison history

### Iteration 0 — blocked

Initial combined evidence:

- Desktop: `/Users/home/.codex/visualizations/2026/07/13/019f5b79-f285-7971-9466-80f7e05ff2c9/design-qa-before-desktop.jpg`
- Mobile: `/Users/home/.codex/visualizations/2026/07/13/019f5b79-f285-7971-9466-80f7e05ff2c9/design-qa-before-mobile.jpg`

Earlier findings and fixes:

- [P1] Header geometry and brand hierarchy drifted from Aramark.ca. The flat facilities-management header was replaced with a deep-navy utility strip, rounded white pill brand bar, exact official red Aramark mark, and paired official Carewest logo.
- [P1] Typography lacked the corporate editorial hierarchy. The UI stack was changed to `Avenir Next`/Helvetica and the main/branch headings to a restrained Georgia serif fallback, with source-like tracking and optical weights.
- [P2] The original navy/yellow dominance did not map to current corporate tokens. Primary emphasis, progress, focus, active states, category bars, and actions were remapped to Aramark red; deep navy and neutral surfaces were retained for structure.
- [P2] The technical background grid and square internal-dashboard cards felt unlike the corporate site. The grid was removed; radii, surfaces, shadows, chips, and section spacing were rebuilt around the source's softer, pill-led language.

Post-fix comparison evidence:

- Desktop: `/Users/home/.codex/visualizations/2026/07/13/019f5b79-f285-7971-9466-80f7e05ff2c9/design-qa-pass1-desktop.jpg`
- Mobile: `/Users/home/.codex/visualizations/2026/07/13/019f5b79-f285-7971-9466-80f7e05ff2c9/design-qa-pass1-mobile.jpg`

### Iteration 1 — passed

The clean top-of-page captures at matching viewports confirmed the corporate header language, red/navy token mapping, editorial display type, responsive stacking, and form density. The final full-view and focused comparison evidence above showed no remaining actionable P0/P1/P2 mismatch.

## Primary interactions tested

- Selected `Colonel Belcher` from the site combobox.
- Entered a non-production QA name.
- Opened the `Cleaning` report branch.
- Selected a concern radio option; filled the description and location fields.
- Exercised repeat, severity, safety, and photo-state controls.
- Confirmed the completed details state and sticky `Send report` action.
- Used `Change what I'm reporting` and confirmed the landing state returned with the site and name preserved.
- Did not press `Send report`; no report or external side effect was created.

## Verification

- Desktop layout: `1280 × 720`, no horizontal overflow, page scrolled to `0,0` for capture.
- Mobile layout: `390 × 844`, no horizontal overflow, page scrolled to `0,0` for capture.
- Browser console errors: none on final desktop and mobile captures.
- API regression suite: 11 tests passed, 0 failed.

## Open questions

- None blocking. If licensed brand webfonts become available to this project, Gotham SSm and Reckless Neue can replace the current system fallbacks as a P3 fidelity refinement.

## Implementation checklist

- [x] Use exact official Aramark and Carewest brand assets.
- [x] Map navigation, hero, progress, action, focus, and selected states to the corporate red/navy system.
- [x] Preserve all report fields and submission behavior.
- [x] Verify desktop and mobile layout, interactions, console, and API tests.
- [x] Compare source and implementation together at full-view and focused-region levels.

## Follow-up polish

- [P3] Replace the typography fallbacks only if the project's licensed Gotham SSm and Reckless Neue webfont files are made available with permission for this deployment.

final result: passed
