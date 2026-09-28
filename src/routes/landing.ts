/**
 * Browser landing page for GET / (Accept: text/html), from the AI Kit LLC branding.
 * API clients (curl, fetch) keep getting the JSON health document.
 */

export interface LandingInfo {
  readonly colo: string;
  readonly country: string;
  readonly dataVersion: string | null;
  readonly healthy: boolean;
}

const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] ?? ch);

const GITHUB_ICON =
  '<svg height="18" width="18" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/></svg>';

export function renderLanding(info: LandingInfo): string {
  const colo = escapeHtml(info.colo);
  const country = escapeHtml(info.country);
  const data = escapeHtml(info.dataVersion ?? "unavailable");
  const status = info.healthy
    ? '<span class="badge badge-status">● Operational</span>'
    : '<span class="badge" style="background: rgba(248, 113, 113, 0.15); color: #f87171; border: 1px solid rgba(248, 113, 113, 0.3);">● Degraded</span>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NHTSA Edge API | AI Kit LLC</title>
  <style>
    :root {
      --bg: #0b0f19;
      --card: rgba(22, 30, 49, 0.75);
      --border: rgba(255, 255, 255, 0.1);
      --accent: #38bdf8;
      --accent-glow: rgba(56, 189, 248, 0.25);
      --text: #f1f5f9;
      --muted: #94a3b8;
      --green: #4ade80;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background-image: radial-gradient(circle at 50% 0%, rgba(56, 189, 248, 0.15) 0%, transparent 60%);
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 20px;
      backdrop-filter: blur(16px);
      max-width: 760px;
      width: 100%;
      padding: 40px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
    }
    .badge-bar {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }
    .badge {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 4px 10px;
      border-radius: 12px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .badge-status { background: rgba(74, 222, 128, 0.15); color: var(--green); border: 1px solid rgba(74, 222, 128, 0.3); }
    .badge-edge { background: rgba(56, 189, 248, 0.15); color: var(--accent); border: 1px solid rgba(56, 189, 248, 0.3); }
    h1 {
      font-size: 32px;
      font-weight: 800;
      letter-spacing: -0.02em;
      margin-bottom: 12px;
      background: linear-gradient(to right, #ffffff, #94a3b8);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    p.desc {
      color: var(--muted);
      font-size: 16px;
      line-height: 1.6;
      margin-bottom: 28px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 28px;
    }
    .metric-box {
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid var(--border);
      padding: 16px;
      border-radius: 12px;
    }
    .metric-label { font-size: 12px; color: var(--muted); margin-bottom: 4px; }
    .metric-val { font-size: 18px; font-weight: 700; color: var(--accent); }
    .actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 24px;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 18px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.2s ease;
    }
    .btn-github {
      background: #24292f;
      color: #fff;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
    .btn-github:hover {
      background: #323842;
      border-color: var(--accent);
      transform: translateY(-1px);
    }
    .btn-primary {
      background: var(--accent);
      color: #0b0f19;
    }
    .btn-primary:hover {
      background: #7dd3fc;
      transform: translateY(-1px);
    }
    .api-preview {
      background: rgba(2, 6, 23, 0.8);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 16px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 13px;
      overflow-x: auto;
      color: #cbd5e1;
    }
    .api-preview a { color: var(--accent); text-decoration: none; }
    .api-preview a:hover { text-decoration: underline; }
    .footer {
      margin-top: 24px;
      font-size: 13px;
      color: var(--muted);
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid var(--border);
      padding-top: 16px;
    }
    .footer a { color: var(--accent); text-decoration: none; }
  </style>

</head>
<body>
  <div class="card">
    <div class="badge-bar">
      ${status}
      <span class="badge badge-edge">Edge PoP: ${colo} (${country})</span>
      <span class="badge" style="background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3);">Cloudflare Workers</span>
    </div>

    <h1>NHTSA Edge API</h1>
    <p class="desc">
      Vehicle data & VIN decoding at the edge, developed by <strong>AI Kit LLC</strong>. Full NHTSA vPIC decoding runs
      offline inside the worker (a port of NHTSA's own <code>spVinDecode</code>, verified against the reference SQL and the
      live API), with optional US EPA and EU RDW enrichment.
    </p>

    <div class="grid">
      <div class="metric-box">
        <div class="metric-label">Offline decode (p50 / p95)</div>
        <div class="metric-val">1.4 ms / 6.2 ms</div>
      </div>
      <div class="metric-box">
        <div class="metric-label">vPIC data</div>
        <div class="metric-val">${data}</div>
      </div>
      <div class="metric-box">
        <div class="metric-label">Sources</div>
        <div class="metric-val">NHTSA + EPA + RDW</div>
      </div>
    </div>

    <div class="actions">
      <a class="btn btn-github" href="https://github.com/AIKitLLC/nhtsa-edge-api" target="_blank" rel="noopener">
        ${GITHUB_ICON}
        GitHub Repository
      </a>
      <a class="btn btn-primary" href="/api/v1/vin/1HGCM82633A004352" target="_blank">
        ⚡ Live Decode Test
      </a>
    </div>

    <div class="api-preview">
      <div><span style="color:#64748b">// Quick Interactive Endpoints:</span></div>
      <div>• <a href="/api/v1/vin/1HGCM82633A004352" target="_blank">GET /api/v1/vin/1HGCM82633A004352</a> (offline decode, clean JSON)</div>
      <div>• <a href="/api/v1/vin/5YJ3E1EB8NF000001/unified" target="_blank">GET /api/v1/vin/5YJ3E1EB8NF000001/unified</a> (decode + EPA + RDW)</div>
      <div>• <a href="/vehicles/DecodeVinValues/1HGCM82633A004352?format=json&amp;clean=true" target="_blank">GET /vehicles/DecodeVinValues/...&amp;clean=true</a> (vPIC drop-in)</div>
      <div>• <a href="/api/v1/models?make=tesla" target="_blank">GET /api/v1/models?make=tesla</a> (catalog)</div>
    </div>

    <div class="footer">
      <div>Created & Maintained by <a href="https://github.com/AIKitLLC" target="_blank"><strong>AI Kit LLC</strong></a></div>
      <div><a href="https://github.com/AIKitLLC/nhtsa-edge-api#readme" target="_blank">View Full Documentation →</a></div>
    </div>
  </div>
</body>
</html>`;
}
