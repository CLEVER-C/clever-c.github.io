# Mega Arcade

A GitHub Pages hub that turns every folder in `/projects` into a playable
card, automatically. No build step, no manifest to hand-edit — add a folder,
push, refresh.

## How it works

`index.html` loads `app.js`, which:

1. Asks the GitHub API "what folders exist under `/projects`?" (one request).
2. For each folder, fetches `projects/<name>/meta.json` directly from your
   own site (not the API — so this step never hits a rate limit).
3. Renders a card per folder with a **Play** button that opens
   `projects/<name>/index.html` in an in-page player (plus an "open in new
   tab" link for anything that needs its own window, like pointer-lock games).

Because discovery happens in the visitor's browser at page-load time, there
is nothing to rebuild or regenerate when you add a project — it just shows
up.

## Setting it up

1. Create a repo named exactly `<your-username>.github.io` (a **user site**),
   or use any repo name for a **project site** — both work, the page
   auto-detects which one it's running as.
2. Push these files to the repo's default branch.
3. In the repo's Settings → Pages, set the source to "Deploy from a branch"
   and pick that branch, root folder.
4. Visit `https://<your-username>.github.io/` (or
   `https://<your-username>.github.io/<repo-name>/` for a project site).

If your default branch is `master` instead of `main`, open `app.js` and
change `CONFIG.branch`.

If you're using a **custom domain**, auto-detection can't guess your
username/repo from the URL — set `CONFIG.owner` and `CONFIG.repo` by hand at
the top of `app.js`.

## Adding a project

```
projects/
  your-project-name/
    index.html      ← required — this is what plays
    meta.json        ← optional — title, description, tags
    (anything else your project needs: css, js, assets…)
```

`meta.json` looks like:

```json
{
  "title": "Your Project Name",
  "description": "One or two sentences about what it does.",
  "tags": ["game", "canvas"]
}
```

Skip `meta.json` entirely and the card still works — it falls back to a
title-cased version of the folder name with no description or tags.

Commit that folder, push, and it appears on the hub on the next page load.
Delete the folder to remove the card.

### What kind of projects work here

Anything that runs entirely in the browser: HTML/CSS/JS, canvas or WebGL
games, small tools, data visualizations, compiled WASM, etc. **GitHub Pages
only serves static files** — there's no server, database, or backend code
execution. If a project needs a real backend (persistent multiplayer state,
a database, server-side auth), it needs to call out to an external API you
host elsewhere; it can't run that logic in this repo.

A few practical notes for project authors:

- Keep all paths **relative** inside your project (`./style.css`, not
  `/style.css`) — your project needs to work whether it's opened directly
  or embedded in the player's iframe.
- The player iframe is sandboxed with
  `allow-scripts allow-same-origin allow-forms allow-modals allow-pointer-lock allow-popups`.
  If your project needs fullscreen or webcam/mic access, those aren't
  granted — use the "open in new tab" link instead for those cases, or the
  in-page player for everything else.
- `localStorage` works per-project and is scoped to your whole site's
  origin, so unrelated projects share the same storage bucket. Prefix your
  keys (e.g. `myproject_highscore`) to avoid collisions.

## Removing the demo

`projects/demo-reaction-test/` is a small working example (a click-based
reaction-time test) so you can confirm the whole pipeline works before
adding your own projects. Delete that folder whenever you want — the hub
handles zero projects gracefully with an empty-state message.

## Limitations, honestly

- **GitHub API rate limit:** listing `/projects` uses one unauthenticated
  GitHub API call per visitor, capped at 60/hour per IP by GitHub. For a
  personal page this is very unlikely to matter. If you ever expect heavy
  traffic, swap that one call for a small GitHub Action that writes a
  `projects/manifest.json` on every push, and have `app.js` fetch that
  static file instead of the API — happy to help set that up if you get
  there.
- **Static hosting only:** no servers, no databases, no persistent
  multiplayer — see "what kind of projects work here" above.
- **First load per visitor makes N+1 requests** (one to list folders, one
  per project for `meta.json`). Fine for dozens of projects; if you get into
  the hundreds, the manifest approach above is worth doing.
