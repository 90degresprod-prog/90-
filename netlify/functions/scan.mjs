// 90° — Compteur de scans du QR (90degres.net/live)
// Chaque scan est enregistré (date, heure, premier scan ou non), puis la personne
// est renvoyée vers /go. La destination finale se règle dans le fichier _redirects
// (ligne /go). Aucune donnée personnelle n'est stockée : ni IP, ni appareil.
import { getStore } from "@netlify/blobs";

const ROBOTS = /bot|crawl|spider|preview|facebookexternalhit|whatsapp|telegram|slack|discord|twitter|linkedin|embedly|pinterest|skype|headless/i;

// Une « nuit » va de 8h à 8h (heure de Genève) : un scan à 1h du matin compte pour la veille.
export function nuitDe(date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" })
      .formatToParts(date).map((x) => [x.type, x.value])
  );
  const d = new Date(Date.UTC(+p.year, +p.month - 1, +p.day));
  if (+p.hour < 8) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export default async (req) => {
  const url = new URL(req.url);
  const dest = new URL("/go", url);
  dest.search = url.search;
  const headers = new Headers({ Location: dest.toString(), "Cache-Control": "no-store" });

  const ua = req.headers.get("user-agent") || "";
  if (req.method !== "GET" || ROBOTS.test(ua)) return new Response(null, { status: 302, headers });

  const now = new Date();
  const nuit = nuitDe(now);
  const dejaVenu = (req.headers.get("cookie") || "").includes(`s90=${nuit}`);

  try {
    const store = getStore("scans");
    const cle = `${nuit}/${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`;
    await store.setJSON(cle, { t: now.toISOString(), nouveau: !dejaVenu, src: url.searchParams.get("src") || "" });
  } catch (e) {
    console.error("scan non enregistré", e); // la redirection passe quand même
  }

  if (!dejaVenu) headers.append("Set-Cookie", `s90=${nuit}; Path=/; Max-Age=172800; SameSite=Lax; Secure; HttpOnly`);
  return new Response(null, { status: 302, headers });
};

export const config = { path: "/live" };
