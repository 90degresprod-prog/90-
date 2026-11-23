// 90° — Enregistre le @Instagram laissé sur la page live (bouton « Tague-moi »).
// Un même @ n'est enregistré qu'une fois par nuit ; on renvoie son numéro de pass.
import { getStore } from "@netlify/blobs";

function nuitDe(date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" })
      .formatToParts(date).map((x) => [x.type, x.value])
  );
  const d = new Date(Date.UTC(+p.year, +p.month - 1, +p.day));
  if (+p.hour < 8) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export default async (req) => {
  if (req.method !== "POST") return json(405, { ok: false, erreur: "Méthode non autorisée" });

  let data;
  try {
    const txt = await req.text();
    if (txt.length > 2000) return json(413, { ok: false, erreur: "Trop long" });
    data = JSON.parse(txt);
  } catch {
    return json(400, { ok: false, erreur: "Requête illisible" });
  }

  const handle = String(data.instagram || "").trim().replace(/^@+/, "");
  if (!/^[A-Za-z0-9._]{1,30}$/.test(handle)) return json(400, { ok: false, erreur: "Ce @ ne ressemble pas à un compte Instagram." });
  if (data.accord_tag !== true) return json(400, { ok: false, erreur: "L'accord pour être tagué·e est nécessaire." });

  const now = new Date();
  const nuit = nuitDe(now);
  const soiree = String(data.soiree || "").slice(0, 60).replace(/[^A-Za-z0-9._-]/g, "");
  const store = getStore({ name: "tags", consistency: "strong" });
  const cle = `${nuit}/${handle.toLowerCase()}`;

  try {
    const existant = await store.get(cle, { type: "json" });
    if (existant) {
      if (data.prochaines_dates === true && !existant.prochaines_dates) {
        await store.setJSON(cle, { ...existant, prochaines_dates: true });
      }
      return json(200, { ok: true, handle: existant.handle, n: existant.n, deja: true });
    }
    const { blobs } = await store.list({ prefix: `${nuit}/` });
    const n = blobs.length + 1;
    await store.setJSON(cle, { handle, n, t: now.toISOString(), soiree, accord_tag: true, prochaines_dates: data.prochaines_dates === true });
    return json(200, { ok: true, handle, n });
  } catch (e) {
    console.error("tag non enregistré", e);
    return json(500, { ok: false, erreur: "Petit souci de notre côté. Réessaie dans un instant." });
  }
};

export const config = { path: "/api/tag" };
