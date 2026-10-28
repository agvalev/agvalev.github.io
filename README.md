# Anatoli Valev — Portfolio

Static one-page portfolio (HTML + CSS + vanilla JS, no build step). English / Bulgarian toggle, dark / light theme, project filters.

## Run locally

```bash
python -m http.server 5500
```

Open http://localhost:5500

## Files

| File | What |
|------|------|
| `index.html` | All content. Every text exists twice: `<span lang="en">` and `<span lang="bg">`. |
| `styles.css` | Design tokens (colours on `:root`), layout, responsive rules |
| `script.js` | Language/theme toggle, mobile menu, project filters, scroll reveal, copy email |
| `assets/img/` | Project screenshots (WebP) |

## Add a project

Copy one `<article class="card">` block in `index.html`. `data-tags` controls the filters
(`backend`, `automation`, `desktop`, `web`, `games`). Add `card--wide` for a full-width card.

## Publish on GitHub Pages

1. Create a repo named `agvalev.github.io` and push these files.
2. The site is live at https://agvalev.github.io
