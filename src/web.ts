import HTTP from 'node:http';
import { getAllStats } from "./state.ts";

const PORT = +(process.env.PORT || 5500);

const JSON_HEADERS = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } as const;

const dashboard = (): string => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AterBot — Multi-Server Dashboard</title>
<style>
  :root { color-scheme: dark; --bg:#0f1117; --card:#171b26; --text:#e6e9f0; --dim:#8b93a7; --accent:#4f8cff; --online:#2ea86b; --offline:#e05656; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; background:var(--bg); color:var(--text); padding:24px; }
  h1 { font-size:22px; margin:0 0 4px; }
  .sub { color:var(--dim); font-size:13px; margin-bottom:24px; }
  .grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap:18px; }
  .card { background:var(--card); border:1px solid #232936; border-radius:14px; padding:20px; }
  .card-title { font-size:16px; font-weight:700; margin:0 0 2px; }
  .card-host { color:var(--dim); font-size:12px; margin-bottom:14px; }
  .badge { display:inline-flex; align-items:center; gap:7px; font-size:13px; font-weight:600; padding:5px 12px; border-radius:999px; margin-bottom:14px; }
  .badge::before { content:""; width:8px; height:8px; border-radius:50%; background:var(--b); box-shadow:0 0 8px var(--b); animation: pulse 2s infinite; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
  .online  { --b:var(--online);  background:#123527; color:#7fe0ae; }
  .offline { --b:var(--offline); background:#392026; color:#ff9b9b; }
  .connecting { --b:#f0b429; background:#3a3012; color:#ffd57a; }
  .stats-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:12px; }
  .stat-box { background:#0f1117; border-radius:8px; padding:10px 12px; }
  .stat-label { color:var(--dim); font-size:10px; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px; }
  .stat-val { font-size:18px; font-weight:700; font-variant-numeric:tabular-nums; }
  .kv { display:flex; justify-content:space-between; font-size:12.5px; padding:5px 0; border-bottom:1px solid #232936; }
  .kv:last-child { border-bottom:0; }
  .kv span:first-child { color:var(--dim); }
  #summary { color:var(--dim); font-size:12px; margin-bottom:20px; }
</style>
</head>
<body>
<h1>AterBot Dashboard</h1>
<div class="sub">Multi-server AFK bot — all servers running simultaneously</div>
<div id="summary">Loading…</div>
<div class="grid" id="grid"></div>

<script>
const fmt = ms => {
  if (!ms || ms < 0) return "0s";
  const s=Math.floor(ms/1000), d=Math.floor(s/86400), h=Math.floor(s%86400/3600), m=Math.floor(s%3600/60), sec=s%60;
  return (d?d+"d ":"")+(h?h+"h ":"")+(m?m+"m ":"")+sec+"s";
};

const makeCard = (s, existing) => {
  const card = existing || document.createElement("div");
  card.className = "card";
  card.dataset.label = s.label;
  card.innerHTML = \`
    <div class="card-title">\${s.label}</div>
    <div class="card-host">\${s.host}:\${s.port} &nbsp;·&nbsp; <b>\${s.username}</b></div>
    <div class="badge \${s.status}">\${s.status.toUpperCase()}</div>
    <div class="stats-grid">
      <div class="stat-box"><div class="stat-label">Session online</div><div class="stat-val" id="session-\${s.label}">\${fmt(s.sessionOnlineMs)}</div></div>
      <div class="stat-box"><div class="stat-label">Total online</div><div class="stat-val" id="total-\${s.label}">\${fmt(s.totalOnlineMs)}</div></div>
      <div class="stat-box"><div class="stat-label">Logins</div><div class="stat-val">\${s.logins}</div></div>
      <div class="stat-box"><div class="stat-label">Reconnects</div><div class="stat-val">\${s.reconnects}</div></div>
    </div>
    <div class="kv"><span>Last login</span><span>\${s.lastLoginAt ? new Date(s.lastLoginAt).toLocaleTimeString() : "—"}</span></div>
    <div class="kv"><span>Last logout</span><span>\${s.lastLogoutAt ? new Date(s.lastLogoutAt).toLocaleTimeString() : "—"}</span></div>
    <div class="kv"><span>Process uptime</span><span>\${fmt(s.processUptimeMs)}</span></div>
  \`;
  return card;
};

const tick = async () => {
  try {
    const servers = await (await fetch("/api/stats")).json();
    const grid = document.getElementById("grid");
    const online = servers.filter(s => s.status === "online").length;
    document.getElementById("summary").textContent =
      \`\${online} / \${servers.length} bots online  ·  process uptime: \${fmt(servers[0]?.processUptimeMs)}\`;

    servers.forEach(s => {
      let card = grid.querySelector(\`[data-label="\${s.label}"]\`);
      const newCard = makeCard(s, card);
      if (!card) grid.appendChild(newCard);
    });
  } catch {}
  setTimeout(tick, 1000);
};
tick();
</script>
</body>
</html>`;

const server = HTTP.createServer((request, response) => {
	const url = (request.url || "/").split("?")[0];

	if (url === "/api/stats") {
		response.writeHead(200, JSON_HEADERS);
		response.end(JSON.stringify(getAllStats()));
		return;
	}

	response.writeHead(200, {
		"Content-Type": "text/html",
		"Cache-Control": "no-store"
	} as const);
	response.end(dashboard());
});

export default (): void => {
	server.listen(PORT, () => console.log(`Dashboard ready → http://localhost:${PORT}`));
};
