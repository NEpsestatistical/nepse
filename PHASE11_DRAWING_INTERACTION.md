# Phase 11 — Drawing Interaction Upgrade

## Goal
Upgrade the existing NEPSE chart drawings from create-only interaction to TradingView-style select/move/delete behavior without rewriting the chart architecture.

## Implemented
- Cursor mode can select existing drawings.
- Selected drawings show anchor handles.
- Selected drawings can be dragged/moved.
- Delete/Backspace removes the selected drawing.
- Escape clears selection.
- Locked drawings cannot be moved or deleted.
- Existing hide/show, undo, lock/unlock and clear-all behavior remains.
- Drawings continue to persist through the existing symbol-scoped localStorage model.
- Drawings continue to use time/price anchors, so zoom/pan does not change their logical position.
- Multi-chart instances retain independent drawing engines.

## Supported interaction
- Trend / Ray: move the whole drawing.
- Horizontal line: move vertically.
- Vertical line: move horizontally.
- Rectangle: move the whole rectangle.
- Fibonacci: move the whole drawing.
- Text: move the text anchor.
- Measure: move the whole drawing and recompute its displayed delta after movement.

## Files changed
- `js/chart/drawings.js`
- `js/chart/app.js`
- `css/chart/drawings.css`
- `PHASE11_DRAWING_INTERACTION.md`
- `PROJECT_HANDOFF.md`

## Validation
- `node --check` passed for modified chart JavaScript.
- Existing Phase 10 fixes in `engine.js` and `transforms.js` were not modified.
- No TMS/broker code was changed.
- No market-data feed was changed.

## Remaining limitations
- Anchor-by-anchor editing is not yet implemented; dragging moves a drawing as a unit.
- Fibonacci levels are selectable/movable as one drawing, but individual anchor handles are not separately draggable.
- Hit testing is geometry-based and intentionally lightweight; future refinement could add more precise handles/context menus.
- Final click-through browser QA should still be performed in a real browser.
