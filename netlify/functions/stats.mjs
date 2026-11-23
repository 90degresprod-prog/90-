// 90° — Tableau de bord privé du QR : 90degres.net/live-stats?k=TA_CLE
// La clé se définit dans Netlify : Site configuration > Environment variables > STATS_KEY.
import { getStore } from "@netlify/blobs";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const valide = (iso) => !isNaN(new Date(iso).getTime());
const heureGeneve = (iso) => valide(iso) ? new Intl.DateTimeFormat("fr-CH", { timeZone: "Europe/Zurich", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : "—";
const hGeneve = (iso) => valide(iso) ? +new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Zurich", hour: "2-digit", hourCycle: "h23" }).format(new Date(iso)) : null;
const page = (body, status = 200) => new Response(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>90° — Stats QR</title>
<link href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@300;400;600;700&display=swap" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Chakra Petch',sans-serif;background:#0A0A0A;color:#F2F2F2;padding:24px 18px 60px;max-width:560px;margin:0 auto}
a{color:inherit}.k{font-size:11px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:#8A8A8A}h1{font-size:26px;letter-spacing:1px;text-transform:uppercase;margin:8px 0 24px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:2px;margin-bottom:28px}.box{border:1px solid rgba(255,255,255,.14);padding:16px}.box b{display:block;font-size:40px;line-height:1.1}
.sec{border-top:1px solid rgba(255,255,255,.14);padding-top:16px;margin:28px 0 12px}.bar{display:grid;grid-template-columns:40px 1fr 34px;gap:8px;align-items:center;font-size:12px;margin:5px 0}
.bar i{display:block;height:10px;background:#F2F2F2}.bar span{color:#8A8A8A}table{width:100%;border-collapse:collapse;font-size:14px}td{padding:9px 4px;border-bottom:1px solid rgba(255,255,255,.08)}
td.m{color:#8A8A8A;font-size:12px;white-space:nowrap}.btn{display:inline-block;font-family:inherit;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding:11px 14px;border:1px solid #F2F2F2;background:none;color:#F2F2F2;cursor:pointer;text-decoration:none;margin:4px 6px 4px 0}
.nights a{display:inline-block;margin:0 8px 8px 0;font-size:12px;padding:6px 10px;border:1px solid rgba(255,255,255,.14);text-decoration:none}.nights a.on{border-color:#F2F2F2}.note{font-size:12px;color:#8A8A8A;line-height:1.55;margin-top:10px}</style></head><body>${body}</body></html>`,
  { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });

const NUIT = /^\d{4}-\d{2}-\d{2}$/;
// On déduit les nuits des clés elles-mêmes (« 2026-11-28/… »), quel que soit le format renvoyé par Netlify.
async function nuits(store) {
  const { blobs } = await store.list();
  return [...new Set((blobs || []).map((b) => String(b.key).split("/")[0]).filter((n) => NUIT.test(n)))];
}

export default async (req) => {
  const url = new URL(req.url);
  const CLE = (globalThis.Netlify && Netlify.env.get("STATS_KEY")) || process.env.STATS_KEY;
  if (!CLE) return page(`<p class="k">90° · Stats QR</p><h1>Clé manquante</h1><p class="note">Ajoute une variable d'environnement STATS_KEY dans Netlify (Site configuration › Environment variables), puis redéploie.</p>`, 503);
  const k = url.searchParams.get("k") || "";
  if (k !== CLE) return page(`<p class="k">90°</p><h1>Accès privé</h1>`, 403);

  const scans = getStore("scans");
  const tags = getStore({ name: "tags", consistency: "strong" });
  const toutes = [...new Set([...(await nuits(scans)), ...(await nuits(tags))])].sort().reverse();
  const demandee = url.searchParams.get("nuit") || "";
  const nuit = NUIT.test(demandee) ? demandee : toutes[0];
  const base = `?k=${encodeURIComponent(k)}`;

  if (!nuit) return page(`<p class="k">90° · Stats QR</p><h1>Aucun scan pour l'instant</h1><p class="note">Le compteur démarre au premier scan de 90degres.net/live.</p>`);

  // Effacement des @ d'une nuit (sauf ceux qui veulent être prévenus des prochaines dates)
  if (req.method === "POST" && url.searchParams.get("action") === "effacer") {
    const { blobs } = await tags.list({ prefix: `${nuit}/` });
    let n = 0;
    for (const b of blobs) {
      const v = await tags.get(b.key, { type: "json" });
      if (!v || !v.prochaines_dates) { await tags.delete(b.key); n++; }
    }
    return Response.redirect(new URL(`${base}&nuit=${nuit}&efface=${n}`, url).toString(), 303);
  }

  const lireTout = async (store) => {
    const { blobs } = await store.list({ prefix: `${nuit}/` });
    return (await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })))).filter(Boolean);
  };
  const S = await lireTout(scans);
  const T = (await lireTout(tags)).sort((a, b) => a.n - b.n);

  if (url.searchParams.get("format") === "csv") {
    const csv = "numero,instagram,heure,prochaines_dates\n" + T.map((t) => `${t.n},@${t.handle},${heureGeneve(t.t)},${t.prochaines_dates ? "oui" : "non"}`).join("\n");
    return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="tags-90-${nuit}.csv"` } });
  }

  const personnes = S.filter((s) => s.nouveau).length;
  const parHeure = {};
  S.forEach((s) => { const h = hGeneve(s.t); if (h !== null) parHeure[h] = (parHeure[h] || 0) + 1; });
  const ordre = Object.keys(parHeure).map(Number).sort((a, b) => ((a + 16) % 24) - ((b + 16) % 24));
  const max = Math.max(1, ...Object.values(parHeure));
  const barres = ordre.map((h) => `<div class="bar"><span>${String(h).padStart(2, "0")}h</span><i style="width:${(parHeure[h] / max) * 100}%"></i><span>${parHeure[h]}</span></div>`).join("");
  const suite = T.filter((t) => t.prochaines_dates).length;
  const efface = url.searchParams.get("efface");
  const nuitLisible = new Intl.DateTimeFormat("fr-CH", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(nuit + "T12:00:00Z"));

  return page(`
<p class="k">90° · Stats QR</p><h1>${esc(nuitLisible)}</h1>
${toutes.length > 1 ? `<div class="nights">${toutes.map((n) => `<a class="${n === nuit ? "on" : ""}" href="${base}&nuit=${n}">${n}</a>`).join("")}</div>` : ""}
<div class="grid">
  <div class="box"><span class="k">Scans</span><b>${S.length}</b></div>
  <div class="box"><span class="k">Personnes</span><b>${personnes}</b></div>
  <div class="box"><span class="k">@ laissés</span><b>${T.length}</b></div>
  <div class="box"><span class="k">Prochaines dates</span><b>${suite}</b></div>
</div>
<p class="note">« Personnes » = téléphones différents (un même téléphone qui rescanne n'est compté qu'une fois). Un scan en navigation privée peut compter double.</p>
<div class="sec"><span class="k">Scans par heure</span></div>${barres || '<p class="note">Aucun scan.</p>'}
<div class="sec"><span class="k">@ à taguer (${T.length})</span></div>
${efface !== null ? `<p class="note">${esc(efface)} @ effacés. Ceux qui veulent les prochaines dates sont conservés.</p>` : ""}
${T.length ? `<table>${T.map((t) => `<tr><td class="m">N°${String(t.n).padStart(3, "0")}</td><td><a href="https://instagram.com/${esc(t.handle)}" target="_blank" rel="noopener">@${esc(t.handle)}</a></td><td class="m">${heureGeneve(t.t)}${t.prochaines_dates ? " · dates" : ""}</td></tr>`).join("")}</table>
<p style="margin-top:16px"><button class="btn" onclick="navigator.clipboard.writeText(${esc(JSON.stringify(T.map((t) => "@" + t.handle).join(" ")))}).then(()=>this.textContent='Copié')">Copier tous les @</button><a class="btn" href="${base}&nuit=${nuit}&format=csv">Télécharger CSV</a></p>
<form method="POST" action="${base}&nuit=${nuit}&action=effacer" onsubmit="return confirm('Effacer les @ de cette nuit (sauf prochaines dates) ?')"><button class="btn" type="submit">Photos publiées : effacer les @</button></form>
<p class="note">À faire une fois le carrousel publié et tagué, comme promis sur la page.</p>` : '<p class="note">Aucun @ pour cette nuit.</p>'}
`);
};

export const config = { path: "/live-stats" };
