/**
 * Stylesheet of the landing page. System fonts only (no external requests), light and
 * dark from prefers-color-scheme, 16 px side gutters on phones.
 */

export const LANDING_CSS = `
:root {
  color-scheme: light dark;
  --bg: #f6f8fb;
  --surface: #ffffff;
  --surface-2: #eef2f7;
  --border: #d8e0ea;
  --text: #0f172a;
  --muted: #526075;
  --accent: #0369a1;
  --accent-ink: #ffffff;
  --ok: #15803d;
  --warn: #b45309;
  --bad: #b91c1c;
  --code-bg: #0f172a;
  --code-text: #e2e8f0;
  --shadow: 0 1px 2px rgba(15, 23, 42, 0.06), 0 12px 32px rgba(15, 23, 42, 0.07);
  --glow: rgba(3, 105, 161, 0.1);
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0a0f1a;
    --surface: #111a2b;
    --surface-2: #172238;
    --border: #25324a;
    --text: #e8eef7;
    --muted: #93a3bb;
    --accent: #38bdf8;
    --accent-ink: #04121f;
    --ok: #4ade80;
    --warn: #fbbf24;
    --bad: #f87171;
    --code-bg: #070b14;
    --code-text: #dbe5f3;
    --shadow: none;
    --glow: rgba(56, 189, 248, 0.12);
  }
}
*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; scroll-behavior: smooth; }
body {
  margin: 0;
  background: var(--bg);
  background-image: radial-gradient(60rem 26rem at 50% -8rem, var(--glow), transparent 70%);
  background-repeat: no-repeat;
  color: var(--text);
  font: 16px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
}
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 4px; }
code, pre, .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace; }
.wrap { max-width: 1080px; margin: 0 auto; padding: 0 20px; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.skip { position: absolute; left: 12px; top: -48px; background: var(--accent); color: var(--accent-ink); padding: 8px 14px; border-radius: 8px; z-index: 10; }
.skip:focus { top: 12px; text-decoration: none; }

/* header */
.top { display: flex; align-items: center; justify-content: space-between; gap: 12px 20px; padding: 18px 0; flex-wrap: wrap; }
.brand { display: flex; align-items: center; gap: 10px; font-weight: 700; letter-spacing: -0.01em; color: var(--text); }
.brand:hover { text-decoration: none; }
.brand svg { color: var(--accent); }
.nav { display: flex; align-items: center; gap: 8px 22px; flex-wrap: wrap; }
.nav a.link { color: var(--muted); font-size: 0.95rem; }
.nav a.link:hover { color: var(--text); text-decoration: none; }
.pill { display: inline-flex; align-items: center; gap: 7px; font-size: 0.8rem; font-weight: 600; padding: 4px 11px; border-radius: 999px; border: 1px solid var(--border); background: var(--surface); }
.pill i { width: 8px; height: 8px; border-radius: 50%; background: var(--ok); }
.pill.bad i { background: var(--bad); }
.gh { display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 10px; border: 1px solid var(--border); background: var(--surface); color: var(--text) !important; font-size: 0.9rem; font-weight: 600; }
.gh:hover { border-color: var(--accent); text-decoration: none !important; }

/* hero */
.hero { padding: 36px 0 12px; }
.eyebrow { font-size: 0.78rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent); }
h1 { font-size: clamp(2.1rem, 5.6vw, 3.5rem); line-height: 1.06; letter-spacing: -0.035em; margin: 0.35em 0 0.4em; font-weight: 800; }
.lead { max-width: 64ch; color: var(--muted); font-size: 1.1rem; margin: 0 0 26px; }
.lead code { color: var(--text); font-size: 0.92em; }
.banner { margin: 0 0 18px; padding: 12px 16px; border-radius: 12px; border: 1px solid color-mix(in srgb, var(--bad) 45%, transparent); background: color-mix(in srgb, var(--bad) 10%, transparent); }

/* decoder */
.decoder { background: var(--surface); border: 1px solid var(--border); border-radius: 18px; padding: 20px; box-shadow: var(--shadow); }
.row { display: flex; gap: 10px; flex-wrap: wrap; }
.field { flex: 1 1 260px; }
.vin {
  width: 100%; height: 54px; padding: 0 16px; border-radius: 12px; border: 1px solid var(--border);
  background: var(--bg); color: var(--text); text-transform: uppercase;
  font: 600 1.15rem/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; letter-spacing: 0.08em;
}
.vin::placeholder { color: var(--muted); font-weight: 400; letter-spacing: 0.04em; }
.vin:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 28%, transparent); }
.btn {
  height: 54px; padding: 0 26px; border-radius: 12px; border: 0; background: var(--accent); color: var(--accent-ink);
  font: 700 1rem system-ui, sans-serif; cursor: pointer; min-width: 120px;
}
.btn:hover { filter: brightness(1.08); }
.btn:disabled { opacity: 0.6; cursor: progress; }
.hint { color: var(--muted); font-size: 0.85rem; margin: 10px 2px 0; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; align-items: center; }
.chips span { color: var(--muted); font-size: 0.85rem; margin-right: 2px; }
.chip {
  border: 1px solid var(--border); background: var(--surface-2); color: var(--text); border-radius: 999px;
  padding: 6px 14px; font-size: 0.88rem; font-weight: 600; cursor: pointer;
}
.chip:hover { border-color: var(--accent); }

/* result */
.result { margin-top: 18px; padding-top: 18px; border-top: 1px solid var(--border); }
.result[hidden] { display: none; }
.headline { font-size: clamp(1.25rem, 3.2vw, 1.7rem); font-weight: 750; letter-spacing: -0.015em; margin: 0; line-height: 1.25; }
.sub { color: var(--muted); margin: 2px 0 12px; }
.badges { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 14px; }
.badge { font-size: 0.8rem; font-weight: 650; padding: 3px 11px; border-radius: 999px; border: 1px solid; }
.badge.ok { color: var(--ok); border-color: color-mix(in srgb, var(--ok) 45%, transparent); background: color-mix(in srgb, var(--ok) 10%, transparent); }
.badge.warn { color: var(--warn); border-color: color-mix(in srgb, var(--warn) 45%, transparent); background: color-mix(in srgb, var(--warn) 10%, transparent); }
.note { margin: 0 0 14px; color: var(--muted); font-size: 0.92rem; }
.error { color: var(--bad); font-weight: 600; margin: 0; }
.facts { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 10px; margin: 0; }
.fact { background: var(--surface-2); border-radius: 12px; padding: 10px 14px; min-width: 0; }
.fact dt { font-size: 0.72rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; font-weight: 650; }
.fact dd { margin: 2px 0 0; font-weight: 600; overflow-wrap: break-word; }
.meta { color: var(--muted); font-size: 0.85rem; margin: 14px 0 0; }
.all { margin-top: 12px; }
.all summary { cursor: pointer; color: var(--accent); font-weight: 650; }
.scroll { max-height: 340px; overflow: auto; margin-top: 10px; border: 1px solid var(--border); border-radius: 12px; }
.attrs { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
.attrs td { padding: 6px 12px; border-bottom: 1px solid var(--border); vertical-align: top; }
.attrs tr:last-child td { border-bottom: 0; }
.attrs td:first-child { color: var(--muted); white-space: nowrap; }
.attrs td:last-child { overflow-wrap: anywhere; }
.spin { display: inline-block; width: 1em; height: 1em; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; vertical-align: -0.15em; animation: spin 0.7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .spin { animation-duration: 2s; } html { scroll-behavior: auto; } }

/* code */
.code { position: relative; background: var(--code-bg); color: var(--code-text); border-radius: 12px; padding: 14px 84px 14px 16px; overflow: auto; font-size: 0.88rem; line-height: 1.6; margin: 0; }
.code code { white-space: pre; }
.copy {
  position: absolute; top: 8px; right: 8px; border: 1px solid rgba(255, 255, 255, 0.18); background: rgba(255, 255, 255, 0.08);
  color: #e8eef7; border-radius: 8px; padding: 4px 10px; font-size: 0.78rem; cursor: pointer;
}
.copy:hover { background: rgba(255, 255, 255, 0.16); }
.curl { margin-top: 16px; }
.curl .hint { margin: 0 0 6px 2px; }

/* sections */
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin: 30px 0 8px; }
.stat { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 16px 18px; min-width: 0; }
.stat b { display: block; font-size: clamp(1.25rem, 3vw, 1.65rem); letter-spacing: -0.02em; overflow-wrap: anywhere; }
.stat span { color: var(--muted); font-size: 0.85rem; }
.stat b.sm { font-size: 0.98rem; letter-spacing: 0; line-height: 1.5; padding-top: 0.42rem; overflow-wrap: normal; }
section.block { padding: 44px 0 0; }
h2 { font-size: clamp(1.4rem, 3.4vw, 1.9rem); letter-spacing: -0.025em; line-height: 1.2; margin: 0 0 8px; }
.sec-lead { color: var(--muted); margin: 0 0 22px; max-width: 66ch; }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 20px; }
.card h3 { margin: 0 0 6px; font-size: 1.05rem; letter-spacing: -0.01em; }
.card p { margin: 0; color: var(--muted); font-size: 0.95rem; }
.ico { width: 38px; height: 38px; border-radius: 10px; display: grid; place-items: center; margin-bottom: 12px; background: color-mix(in srgb, var(--accent) 14%, transparent); color: var(--accent); }
.ep { list-style: none; margin: 0 0 20px; padding: 0; border: 1px solid var(--border); border-radius: 16px; background: var(--surface); overflow: hidden; }
.ep li { display: grid; grid-template-columns: 64px minmax(0, 1.4fr) minmax(0, 1fr); gap: 4px 14px; padding: 12px 18px; border-bottom: 1px solid var(--border); align-items: baseline; }
.ep li:last-child { border-bottom: 0; }
.verb { font-size: 0.72rem; font-weight: 800; letter-spacing: 0.05em; color: var(--accent); }
.ep code { font-size: 0.88rem; overflow-wrap: anywhere; }
.ep span.d { color: var(--muted); font-size: 0.92rem; }
.steps { counter-reset: s; list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
.steps li { counter-increment: s; position: relative; background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 14px 18px 14px 58px; }
.steps li::before {
  content: counter(s); position: absolute; left: 16px; top: 14px; width: 28px; height: 28px; border-radius: 50%;
  display: grid; place-items: center; font-weight: 800; font-size: 0.85rem; background: var(--accent); color: var(--accent-ink);
}
.steps b { display: block; }
.steps span { color: var(--muted); font-size: 0.95rem; }
.links { display: flex; flex-wrap: wrap; gap: 8px 22px; margin-top: 18px; }
footer.foot { margin-top: 56px; padding: 26px 0 40px; border-top: 1px solid var(--border); color: var(--muted); font-size: 0.85rem; }
footer.foot p { margin: 0 0 6px; }

/* hub */
.cta { display: flex; flex-wrap: wrap; gap: 10px; }
.btn-link { display: inline-flex; align-items: center; height: 48px; padding: 0 22px; border-radius: 12px; background: var(--accent); color: var(--accent-ink); font-weight: 700; }
.btn-link:hover { text-decoration: none; filter: brightness(1.08); }
.btn-link.ghost { background: transparent; color: var(--text); border: 1px solid var(--border); }
.btn-link.ghost:hover { border-color: var(--accent); }
.ds-grid { grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); }
.ds { display: flex; flex-direction: column; background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 20px; min-width: 0; }
.ds h3 { margin: 10px 0 6px; font-size: 1.1rem; letter-spacing: -0.01em; }
.ds p { margin: 0; color: var(--muted); font-size: 0.95rem; }
.ds-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.agency { font-size: 0.75rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); }
.status { font-size: 0.75rem; font-weight: 700; padding: 2px 10px; border-radius: 999px; border: 1px solid; }
.status.live { color: var(--ok); border-color: color-mix(in srgb, var(--ok) 45%, transparent); background: color-mix(in srgb, var(--ok) 10%, transparent); }
.status.partial { color: var(--warn); border-color: color-mix(in srgb, var(--warn) 45%, transparent); background: color-mix(in srgb, var(--warn) 10%, transparent); }
.status.planned { color: var(--muted); border-color: var(--border); background: var(--surface-2); }
.ds-facts { margin-top: 10px !important; font-size: 0.85rem !important; }
.ds-facts code { font-size: 0.85em; color: var(--text); overflow-wrap: anywhere; }
.ds-links { display: flex; flex-wrap: wrap; gap: 6px 18px; margin-top: auto; padding-top: 14px; font-weight: 600; font-size: 0.95rem; }
.ds-add { border-style: dashed; background: transparent; }

@media (max-width: 720px) {
  .wrap { padding: 0 16px; }
  .ep li { grid-template-columns: 1fr; padding: 12px 16px; }
  .btn { flex: 1 1 100%; }
  .decoder { padding: 16px; }
  .nav a.link.hide-sm { display: none; }
}
`;
