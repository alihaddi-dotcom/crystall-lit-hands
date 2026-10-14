// Static blog generator: posts/<slug>/index.{ja,en}.md → blog/index.html + blog/<slug>.html.
// The layout matches the CMS in public/admin/config.yml (i18n structure: multiple_files).
// Runs from vite.config.js on every dev start / build; blog/ is generated output.
import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";
import { parse as parseYaml } from "yaml";

const ROOT = path.resolve(import.meta.dirname, "..");
const POSTS = path.join(ROOT, "posts");
const OUT = path.join(ROOT, "blog");
const LANGS = ["en", "ja"];
const REQUIRED = ["title", "date", "description"];

const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// YAML front matter between --- fences (the CMS may quote or fold long values).
export function parseFrontMatter(src, file = "post") {
  const m = src.replace(/\r\n/g, "\n").match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error(`${file}: missing front matter (--- title/date/description ---)`);
  let data;
  try {
    data = parseYaml(m[1]) ?? {};
  } catch (err) {
    throw new Error(`${file}: invalid front matter: ${err.message}`);
  }
  const meta = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v == null ? "" : String(v).trim()]));
  for (const k of REQUIRED) if (!meta[k]) throw new Error(`${file}: front matter needs "${k}"`);
  // Round-trip so impossible dates (2026-02-31) fail instead of rolling over.
  const d = new Date(`${meta.date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.date) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== meta.date)
    throw new Error(`${file}: date must be YYYY-MM-DD, got "${meta.date}"`);
  return { ...meta, body: m[2] };
}

// The CMS links uploads as /media/…; posts live in /blog/, so make it relative
// (the site may be served from a sub-path such as GitHub Pages /<repo>/).
marked.use({
  walkTokens(token) {
    if (token.type === "image" && token.href.startsWith("/media/")) token.href = `..${token.href}`;
  },
});
export const renderMarkdown = (md) => marked.parse(md);

// English ~200 words/min; Japanese ~500 characters/min.
export function readingMinutes(text, lang) {
  const n = lang === "ja" ? text.replace(/\s/g, "").length / 500 : text.split(/\s+/).filter(Boolean).length / 200;
  return Math.max(1, Math.round(n));
}

const fmtDate = (date, lang) =>
  new Intl.DateTimeFormat(lang === "ja" ? "ja-JP" : "en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })
    .format(new Date(`${date}T00:00:00Z`));
const fmtMinutes = (n, lang) => (lang === "ja" ? `約${n}分で読めます` : `${n} min read`);

function loadPosts() {
  if (!fs.existsSync(POSTS)) return [];
  return fs.readdirSync(POSTS, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map(({ name: slug }) => {
      if (!/^[a-z0-9-]+$/.test(slug)) throw new Error(`posts/${slug}: folder name must be lowercase a-z, 0-9 and -`);
      const langs = {};
      for (const lang of LANGS) {
        const file = path.join(POSTS, slug, `index.${lang}.md`);
        if (fs.existsSync(file)) langs[lang] = parseFrontMatter(fs.readFileSync(file, "utf8"), `posts/${slug}/index.${lang}.md`);
      }
      if (!Object.keys(langs).length) throw new Error(`posts/${slug}: add index.ja.md and/or index.en.md`);
      const date = (langs.en ?? langs.ja).date;
      return { slug, date, langs };
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
}

// One block per language; a missing translation falls back to the other one.
function perLang(post, render) {
  return LANGS.map((lang) => {
    const own = post.langs[lang];
    const src = own ?? post.langs[LANGS.find((l) => post.langs[l])];
    const srcLang = own ? lang : LANGS.find((l) => post.langs[l]);
    return `<div data-lang-block="${lang}" lang="${srcLang}">${render(src, srcLang, !own)}</div>`;
  }).join("\n");
}

const NAV = `
    <header class="nav">
      <a class="brand" href="../">HAKU</a>
      <nav aria-label="Main">
        <a href="../#about" data-i18n="s.nav.about">About</a>
        <a href="../#menu" data-i18n="s.nav.menu">Menu</a>
        <a href="./" data-i18n="s.nav.blog">Blog</a>
        <a href="../#access" data-i18n="s.nav.access">Access</a>
      </nav>
      <button class="lang-toggle" type="button" data-lang-toggle data-i18n="lang.switch">日本語</button>
      <a class="btn btn--solid btn--small" href="../#book" data-i18n="s.nav.book">Book</a>
    </header>`;

function page({ title, titleAttrs, desc, descAttrs, body }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#ffffff" />
    <title ${titleAttrs}>${esc(title)}</title>
    <meta name="description" content="${esc(desc)}" ${descAttrs} />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500&family=Shippori+Mincho:wght@400;500&family=Playfair+Display:ital,wght@0,400;1,400&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body class="light plain">${NAV}
    <main>
${body}
    </main>
    <footer class="footer" data-i18n-html="blog.footer">HAKU is a fictional salon for a design prototype</footer>
    <script type="module" src="/i18n.js"></script>
  </body>
</html>
`;
}

// Attributes the i18n script swaps per language (data-text-xx / data-content-xx).
const langAttrs = (name, post, pick) =>
  LANGS.map((l) => `data-${name}-${l}="${esc(pick(post.langs[l] ?? post.langs.en ?? post.langs.ja))}"`).join(" ");

function postPage(post) {
  const fallback = (srcLang) => (srcLang === "ja" ? "This post is only available in Japanese." : "この記事は英語版のみです。");
  const body = `      <article class="post">
        <a class="back" href="./" data-i18n="blog.back">← All posts</a>
${perLang(post, (p, lang, isFallback) => `        <header class="post-head">
          <p class="eyebrow">${fmtDate(p.date, lang)} · ${fmtMinutes(readingMinutes(p.body, lang), lang)}</p>
          <h1>${esc(p.title)}</h1>
          ${isFallback ? `<p class="note">${fallback(lang)}</p>` : ""}
        </header>
        <div class="prose">${renderMarkdown(p.body)}</div>`)}
      </article>`;
  const fullTitle = (p) => `${p.title} — HAKU`;
  const main = post.langs.en ?? post.langs.ja;
  return page({
    title: fullTitle(main),
    titleAttrs: langAttrs("text", post, fullTitle),
    desc: main.description,
    descAttrs: langAttrs("content", post, (p) => p.description),
    body,
  });
}

function indexPage(posts) {
  const list = posts.length
    ? posts.map((post) => `        <li>
          <a href="./${post.slug}.html">
${perLang(post, (p, lang) => `            <p class="eyebrow">${fmtDate(p.date, lang)} · ${fmtMinutes(readingMinutes(p.body, lang), lang)}</p>
            <h2>${esc(p.title)}</h2>
            <p>${esc(p.description)}</p>`)}
          </a>
        </li>`).join("\n")
    : `        <li class="note" data-i18n="blog.empty">No posts yet.</li>`;
  return page({
    title: "Journal — HAKU",
    titleAttrs: `data-i18n="blog.title"`,
    desc: "Notes from HAKU, an energy healing salon in Kamakura.",
    descAttrs: `data-i18n-content="blog.desc"`,
    body: `      <section class="section blog-index">
        <p class="eyebrow" data-i18n="blog.eyebrow">Journal</p>
        <h1 data-i18n-html="blog.h1">Notes on rest<br /><em>and light.</em></h1>
        <ul class="post-list">
${list}
        </ul>
      </section>`,
  });
}

// Writes blog/ and returns the generated HTML paths (for Vite's build input).
export function buildBlog() {
  const posts = loadPosts();
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const files = [path.join(OUT, "index.html"), ...posts.map((p) => path.join(OUT, `${p.slug}.html`))];
  fs.writeFileSync(files[0], indexPage(posts));
  posts.forEach((p, i) => fs.writeFileSync(files[i + 1], postPage(p)));
  return files;
}
