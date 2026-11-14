package com.shivtej.chartmitra;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class Http {
    static final String UA = "Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36";

    public static String get(String url) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(10000);
        c.setReadTimeout(15000);
        c.setRequestProperty("User-Agent", UA);
        c.setRequestProperty("Accept", "application/json,text/plain,*/*");
        int code = c.getResponseCode();
        InputStream in = code >= 400 ? c.getErrorStream() : c.getInputStream();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        if (in != null) {
            byte[] buf = new byte[16384];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            in.close();
        }
        c.disconnect();
        if (code >= 400) throw new Exception("HTTP " + code);
        return out.toString("UTF-8");
    }

    /** Latest price for a symbol. src = "bn" (Binance crypto) or "yf" (Yahoo: NSE/BSE/gold). */
    public static double price(String src, String sym) throws Exception {
        if ("bf".equals(src)) { // Binance futures: gold XAUUSDT, silver XAGUSDT
            return new org.json.JSONObject(get("https://fapi.binance.com/fapi/v1/ticker/price?symbol=" + sym)).getDouble("price");
        }
        if ("bn".equals(src)) {
            String body;
            try {
                body = get("https://api.binance.com/api/v3/ticker/price?symbol=" + sym);
            } catch (Exception e) {
                body = get("https://data-api.binance.vision/api/v3/ticker/price?symbol=" + sym);
            }
            return new org.json.JSONObject(body).getDouble("price");
        }
        String enc = java.net.URLEncoder.encode(sym, "UTF-8");
        String body;
        try {
            body = get("https://query1.finance.yahoo.com/v8/finance/chart/" + enc + "?interval=1m&range=1d");
        } catch (Exception e) {
            body = get("https://query2.finance.yahoo.com/v8/finance/chart/" + enc + "?interval=1m&range=1d");
        }
        org.json.JSONObject meta = new org.json.JSONObject(body).getJSONObject("chart")
                .getJSONArray("result").getJSONObject(0).getJSONObject("meta");
        return meta.getDouble("regularMarketPrice");
    }
}
