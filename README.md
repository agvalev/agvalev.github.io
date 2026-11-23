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
| `motion.css` | Preloader, grain, 3D laptop intro, websites showcase (MacBook + iPhone), split-text reveals, marquee |
| `script.js` | Preloader, smooth scroll, laptop sequence, manifesto, case studies, trading chart, websites showcase, reveals, clock |
| `assets/img/` | App screenshot (WebP) |
| `assets/sites/` | Full-page screenshots of each website: `<name>-d.webp` (desktop, 1200px) and `<name>-m.webp` (mobile, 520px) |
| `assets/og.jpg` | Share image (1200×630) |

## Add a project

- Featured: copy one `<article class="case">` block in `index.html` (they stack while scrolling).
- Website: add a `<button data-i>` to `#siteList`, a matching `.sd` detail block, and one `.shot` image in both
  the laptop and the phone `.shots` (same order). Add its glow colour to `glows` in `script.js`.

## Publish on GitHub Pages

1. Create a repo named `agvalev.github.io` and push these files.
2. The site is live at https://agvalev.github.io
