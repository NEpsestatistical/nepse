# Phase 12 — Drawing Placement Reliability Fix

## Status
Completed.

## Problem
Drawing tool placement (especially Fibonacci) relied on a generic DOM click listener on the chart container. Lightweight Charts owns the chart canvas interaction, so click delivery could be inconsistent and make tools appear unresponsive.

## Fix
`js/chart/drawings.js` now uses Lightweight Charts' native `chart.subscribeClick()` event for drawing placement. This provides chart-library coordinates directly and avoids dependency on DOM event bubbling through the chart canvas.

The existing drawing interaction layer remains intact:
- Cursor selection
- Drag/move
- Individual delete
- Escape deselection
- Lock protection
- Persistence

## Validation
- `node --check js/chart/drawings.js` passed.
- Confirmed Fib/Trend/Ray/etc. use the same native placement path.
- Existing drawing tools, storage model, data feeds, and multi-chart architecture were not changed.

## Remaining limitation
Individual endpoint/anchor editing (rather than moving the whole drawing) is still not implemented.
