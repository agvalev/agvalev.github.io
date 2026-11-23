# Anatoli Valev — Portfolio

Static one-page portfolio (HTML + CSS + vanilla JS, no build step). English / Bulgarian toggle, premium dark theme,
scroll-driven 3D laptop intro, smooth scrolling ([Lenis](https://github.com/darkroomengineering/lenis) from a CDN, optional).

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
| `motion.css` | Preloader, custom cursor, grain, 3D laptop intro, split-text reveals, marquee |
| `script.js` | Preloader, smooth scroll, laptop sequence, manifesto, stacking case studies, cursor preview, reveals, clock |
| `assets/img/` | Project screenshots (WebP) |

## Add a project

- Featured: copy one `<article class="case">` block in `index.html` (they stack while scrolling).
- Smaller: copy one `<li>` in `#rows`; `data-preview` points to the id of the image shown next to the cursor.

## Publish on GitHub Pages

1. Create a repo named `agvalev.github.io` and push these files.
2. The site is live at https://agvalev.github.io
