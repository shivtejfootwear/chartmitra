# ChartMitra

Personal TradingView-style charting app: Android APK + website, same code, synced through your own free Supabase project.

- Live crypto and XAUUSD (Binance WebSocket), NSE/BSE/COMEX via Yahoo Finance
- 30+ drawing tools, 35+ indicators, Bar Replay with paper trading, alerts that ring even when the app is closed
- News (RSS) and economic calendar (Forex Factory)

APK: Releases → `latest` → `ChartMitra.apk`. Website: GitHub Pages of this repo.
Setup: run `supabase/chartmitra.sql`, create Edge Function `cm-proxy` from `supabase/cm-proxy.ts`.
