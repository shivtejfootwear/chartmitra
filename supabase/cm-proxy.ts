// ChartMitra website data proxy (Supabase Edge Function named "cm-proxy", keep "Verify JWT" ON).
// Only logged-in users can use it, and only for these market-data / news hosts.
const ALLOW = new Set([
  "query1.finance.yahoo.com", "query2.finance.yahoo.com", "nfs.faireconomy.media",
  "economictimes.indiatimes.com", "www.moneycontrol.com", "www.cnbc.com",
  "www.coindesk.com", "cointelegraph.com",
]);
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  let target: URL;
  try { target = new URL(new URL(req.url).searchParams.get("u") ?? ""); } catch { return new Response("bad url", { status: 400, headers: CORS }); }
  if (target.protocol !== "https:" || !ALLOW.has(target.hostname)) return new Response("host not allowed", { status: 403, headers: CORS });
  const r = await fetch(target, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36", "Accept": "*/*" } });
  return new Response(await r.text(), { status: r.status, headers: { ...CORS, "Content-Type": r.headers.get("content-type") ?? "text/plain", "Cache-Control": "no-store" } });
});
