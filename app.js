/**
 * Mega Arcade — project auto-discovery
 * ------------------------------------
 * On load, this asks the GitHub API "what folders live inside /projects?",
 * then fetches each folder's meta.json (if present) straight from this same
 * site, and renders a card per folder. Add a folder, push, done.
 *
 * If your site uses a CUSTOM DOMAIN (not <name>.github.io), auto-detection
 * can't work — set owner/repo below by hand.
 */
const CONFIG = {
  owner: null,   // e.g. "octocat" — leave null to auto-detect
  repo: null,    // e.g. "octocat.github.io" — leave null to auto-detect
  branch: "main" // change to "master" if that's your default branch
};

const ACCENTS = ["#E8A33D", "#4C9C8C", "#C1502E", "#7A8FB0", "#B08BC9"];

const grid = document.getElementById("grid");
const emptyState = document.getElementById("emptyState");
const errorState = document.getElementById("errorState");
const errorHeading = document.getElementById("errorHeading");
const errorDetail = document.getElementById("errorDetail");
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");

function setStatus(mode, text) {
  statusDot.className = "status-dot" + (mode === "loading" ? " is-loading" : mode === "error" ? " is-error" : "");
  statusText.textContent = text;
}

function detectOwnerRepoCandidates() {
  if (CONFIG.owner && CONFIG.repo) {
    return [{ owner: CONFIG.owner, repo: CONFIG.repo }];
  }
  const host = location.hostname;
  if (!host.endsWith("github.io")) {
    return []; // custom domain, can't guess
  }
  const owner = host.split(".")[0];
  const pathParts = location.pathname.split("/").filter(Boolean);
  const candidates = [];
  if (pathParts.length > 0) {
    // Likely a project page: https://owner.github.io/repo/
    candidates.push({ owner, repo: pathParts[0] });
  }
  // Always also try the user/org site repo as a fallback
  candidates.push({ owner, repo: `${owner}.github.io` });
  return candidates;
}

async function fetchProjectFolders() {
  const candidates = detectOwnerRepoCandidates();
  if (candidates.length === 0) {
    throw { kind: "config" };
  }
  let lastStatus = null;
  for (const { owner, repo } of candidates) {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/projects?ref=${CONFIG.branch}`;
    const res = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
    if (res.status === 404) {
      lastStatus = 404;
      continue; // try next candidate, or treat as "no projects yet"
    }
    if (res.status === 403) {
      throw { kind: "rate-limit" };
    }
    if (!res.ok) {
      lastStatus = res.status;
      continue;
    }
    const items = await res.json();
    return items.filter((item) => item.type === "dir").map((item) => item.name);
  }
  if (lastStatus === 404) return []; // repo exists, /projects just doesn't yet
  throw { kind: "unknown", status: lastStatus };
}

async function fetchMeta(slug) {
  try {
    const res = await fetch(`projects/${slug}/meta.json`, { cache: "no-store" });
    if (!res.ok) throw new Error("no meta.json");
    const data = await res.json();
    return {
      title: data.title || titleCase(slug),
      description: data.description || "",
      tags: Array.isArray(data.tags) ? data.tags : []
    };
  } catch {
    return { title: titleCase(slug), description: "", tags: [] };
  }
}

function titleCase(slug) {
  return slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function renderCard(slug, meta, index) {
  const card = document.createElement("article");
  card.className = "card";

  const band = document.createElement("div");
  band.className = "card-band";
  band.style.background = ACCENTS[index % ACCENTS.length];
  card.appendChild(band);

  const body = document.createElement("div");
  body.className = "card-body";

  const title = document.createElement("h3");
  title.className = "card-title";
  title.textContent = meta.title;
  body.appendChild(title);

  if (meta.description) {
    const desc = document.createElement("p");
    desc.className = "card-desc";
    desc.textContent = meta.description;
    body.appendChild(desc);
  }

  if (meta.tags.length) {
    const tagWrap = document.createElement("div");
    tagWrap.className = "card-tags";
    meta.tags.forEach((t) => {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = t;
      tagWrap.appendChild(tag);
    });
    body.appendChild(tagWrap);
  }

  const btn = document.createElement("button");
  btn.className = "play-btn";
  btn.textContent = "Play ▸";
  btn.addEventListener("click", () => openPlayer(slug, meta.title));
  body.appendChild(btn);

  card.appendChild(body);
  return card;
}

// ---------- Player overlay ----------

const player = document.getElementById("player");
const playerFrame = document.getElementById("playerFrame");
const playerTitle = document.getElementById("playerTitle");
const playerOpenNew = document.getElementById("playerOpenNew");
const playerClose = document.getElementById("playerClose");

function openPlayer(slug, title) {
  const src = `projects/${slug}/index.html`;
  playerTitle.textContent = title;
  playerOpenNew.href = src;
  playerFrame.src = src;
  player.hidden = false;
  document.body.style.overflow = "hidden";
  playerClose.focus();
}

function closePlayer() {
  player.hidden = true;
  playerFrame.src = "about:blank";
  document.body.style.overflow = "";
}

playerClose.addEventListener("click", closePlayer);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !player.hidden) closePlayer();
});

// ---------- Boot ----------

async function boot() {
  setStatus("loading", "Reading the shelf…");
  let slugs;
  try {
    slugs = await fetchProjectFolders();
  } catch (err) {
    errorState.hidden = false;
    setStatus("error", "Setup needed");
    if (err && err.kind === "config") {
      errorHeading.textContent = "Custom domain detected";
      errorDetail.innerHTML = `This looks like a custom domain, so the owner/repo can't be guessed. Open <code>app.js</code> and set <code>CONFIG.owner</code> and <code>CONFIG.repo</code> near the top.`;
    } else if (err && err.kind === "rate-limit") {
      errorHeading.textContent = "GitHub API rate limit hit";
      errorDetail.innerHTML = `Unauthenticated requests are capped at 60/hour per visitor IP. This is rare for a personal page — try again shortly, or see <code>README.md</code> for a caching option.`;
    } else {
      errorHeading.textContent = "Couldn't reach the GitHub API";
      errorDetail.innerHTML = `Check your connection, or confirm the repo is public. See <code>README.md</code> for troubleshooting.`;
    }
    return;
  }

  if (slugs.length === 0) {
    emptyState.hidden = false;
    setStatus("ready", "0 cartridges loaded");
    return;
  }

  slugs.sort((a, b) => a.localeCompare(b));
  const metas = await Promise.all(slugs.map(fetchMeta));
  metas.forEach((meta, i) => grid.appendChild(renderCard(slugs[i], meta, i)));
  setStatus("ready", `${slugs.length} cartridge${slugs.length === 1 ? "" : "s"} loaded · live`);
}

boot();
