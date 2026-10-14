import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFrontMatter, readingMinutes, renderMarkdown } from "./blog.js";

test("parses front matter and body", () => {
  const p = parseFrontMatter('---\ntitle: "A: title"\ndate: 2026-10-14\ndescription: d\n---\n\nHello');
  assert.equal(p.title, "A: title");
  assert.equal(p.date, "2026-10-14");
  assert.equal(p.body.trim(), "Hello");
});

test("reads YAML the CMS writes: quoted, folded, extra keys", () => {
  const p = parseFrontMatter(
    "---\ntitle: 'It''s: quoted'\ndate: 2026-10-14\ndescription: >-\n  A long line folded\n  over two lines.\ntranslationKey: abc\n---\nBody",
  );
  assert.equal(p.title, "It's: quoted");
  assert.equal(p.description, "A long line folded over two lines.");
  assert.equal(p.date, "2026-10-14");
});

test("rejects broken YAML with the file name", () => {
  assert.throws(() => parseFrontMatter("---\ntitle: [unclosed\ndate: 2026-10-14\ndescription: d\n---\n", "posts/x/index.ja.md"), /posts\/x\/index\.ja\.md: invalid front matter/);
});

test("handles CRLF line endings", () => {
  assert.equal(parseFrontMatter("---\r\ntitle: t\r\ndate: 2026-01-02\r\ndescription: d\r\n---\r\nx").title, "t");
});

test("rejects missing fields and bad dates", () => {
  assert.throws(() => parseFrontMatter("no front matter"), /missing front matter/);
  assert.throws(() => parseFrontMatter("---\ntitle: t\ndate: 2026-10-14\n---\n"), /needs "description"/);
  assert.throws(() => parseFrontMatter("---\ntitle: t\ndate: 14/10/2026\ndescription: d\n---\n"), /YYYY-MM-DD/);
  assert.throws(() => parseFrontMatter("---\ntitle: t\ndate: 2026-02-31\ndescription: d\n---\n"), /YYYY-MM-DD/);
});

test("CMS image paths become relative to /blog/", () => {
  assert.match(renderMarkdown("![Room](/media/room.jpg)"), /src="\.\.\/media\/room\.jpg"/);
  assert.match(renderMarkdown("![Ext](https://example.com/a.jpg)"), /src="https:\/\/example\.com\/a\.jpg"/);
});

test("reading time: ~200 EN words/min, ~500 JA chars/min, at least 1", () => {
  assert.equal(readingMinutes("word ".repeat(700), "en"), 4);
  assert.equal(readingMinutes("あ".repeat(1500), "ja"), 3);
  assert.equal(readingMinutes("", "en"), 1);
});
