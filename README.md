# portfolio.html split — import notes for the `nepse` repo

Your `nepse` repo already has its own `js/` and `css/` folders used by
`dashboard.html`, `chart_2.html`, and `index.html`. To avoid overwriting
any of those files, everything from this split lives in its own
subfolder: `js/portfolio/` and `css/portfolio/`.

## What to upload

Upload these into the ROOT of the `nepse` repo, merging with what's
already there (GitHub's "Upload files" will create the new subfolders,
not touch your existing `js/*.js` or `css/*.css` files):

```
portfolio.html          <- REPLACES your existing portfolio.html
css/portfolio/          <- NEW subfolder, 3 files
js/portfolio/           <- NEW subfolder, 13 files
views/                  <- NEW, source partials (not loaded by the browser)
shell-top.html          <- NEW, source partial (not loaded by the browser)
shell-bottom.html       <- NEW, source partial (not loaded by the browser)
build.js                <- NEW, regenerates portfolio.html from the partials
```

`views/`, `shell-top.html`, `shell-bottom.html`, and `build.js` are your
editable *source* — the browser never loads them directly. `portfolio.html`
is the generated file the browser actually loads (same as before).

## Editing workflow going forward

1. Edit a file in `views/`, or `shell-top.html`/`shell-bottom.html`.
2. Run `node build.js` — regenerates `portfolio.html`.
3. Commit and push everything, including the regenerated `portfolio.html`.

Editing a file in `js/portfolio/` or `css/portfolio/` needs no build step —
the browser loads those directly.


## Standalone chart Phase 10

`chart.html` is the protected standalone TradingView-inspired terminal. Phase 10 adds production hardening, workspace backup/import and a generic `js/chart/broker.js` connector boundary. The connector does not pretend to be a live broker integration until a specific broker API contract is supplied. Session secrets are never persisted by this frontend.
