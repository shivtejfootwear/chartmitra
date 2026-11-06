package com.shivtej.chartmitra;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Login + cloud save with the user's own free Supabase project.
 * In the APK only this class refreshes the login token, so the app and the
 * background alarm watcher never fight over it.
 */
public class Sync {
    static final String PREF = "sync";

    static SharedPreferences p(Context c) { return c.getSharedPreferences(PREF, 0); }

    static String url(Context c) { return p(c).getString("url", ""); }
    static String key(Context c) { return p(c).getString("key", ""); }
    static boolean ready(Context c) { return !url(c).isEmpty() && !key(c).isEmpty() && !p(c).getString("refresh", "").isEmpty(); }

    static void setProject(Context c, String url, String key) {
        p(c).edit().putString("url", url.replaceAll("/+$", "")).putString("key", key.trim()).apply();
    }

    static void logout(Context c) {
        p(c).edit().remove("refresh").remove("access").remove("exp").remove("email").apply();
    }

    static String req(String method, String url, String key, String bearer, String body, String prefer) throws Exception {
        HttpURLConnection h = (HttpURLConnection) new URL(url).openConnection();
        h.setConnectTimeout(10000);
        h.setReadTimeout(15000);
        h.setRequestMethod(method);
        h.setRequestProperty("apikey", key);
        h.setRequestProperty("Content-Type", "application/json");
        if (bearer != null) h.setRequestProperty("Authorization", "Bearer " + bearer);
        if (prefer != null) h.setRequestProperty("Prefer", prefer);
        if (body != null) {
            h.setDoOutput(true);
            OutputStream o = h.getOutputStream();
            o.write(body.getBytes("UTF-8"));
            o.close();
        }
        int code = h.getResponseCode();
        InputStream in = code >= 400 ? h.getErrorStream() : h.getInputStream();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        if (in != null) { byte[] b = new byte[8192]; int n; while ((n = in.read(b)) > 0) out.write(b, 0, n); in.close(); }
        String s = out.toString("UTF-8");
        if (code >= 400) throw new Exception(s.isEmpty() ? ("HTTP " + code) : s);
        return s;
    }

    private static void saveSession(Context c, JSONObject j) throws Exception {
        long exp = System.currentTimeMillis() / 1000 + j.optLong("expires_in", 3600);
        SharedPreferences.Editor e = p(c).edit()
                .putString("access", j.getString("access_token"))
                .putString("refresh", j.getString("refresh_token"))
                .putLong("exp", exp);
        JSONObject u = j.optJSONObject("user");
        if (u != null) e.putString("email", u.optString("email"));
        e.apply();
    }

    static synchronized String login(Context c, String email, String pass) throws Exception {
        JSONObject b = new JSONObject().put("email", email).put("password", pass);
        String r = req("POST", url(c) + "/auth/v1/token?grant_type=password", key(c), null, b.toString(), null);
        saveSession(c, new JSONObject(r));
        return email;
    }

    /** A valid access token, refreshed when near expiry. Empty string when not logged in. */
    static synchronized String token(Context c) {
        try {
            if (!ready(c)) return "";
            long exp = p(c).getLong("exp", 0);
            if (exp - System.currentTimeMillis() / 1000 > 120) return p(c).getString("access", "");
            JSONObject b = new JSONObject().put("refresh_token", p(c).getString("refresh", ""));
            String r = req("POST", url(c) + "/auth/v1/token?grant_type=refresh_token", key(c), null, b.toString(), null);
            saveSession(c, new JSONObject(r));
            return p(c).getString("access", "");
        } catch (Exception e) {
            String m = String.valueOf(e.getMessage());
            if (m.contains("invalid") || m.contains("Invalid") || m.contains("revoked")) logout(c);
            return "";
        }
    }

    /** Reads one saved value: returns {"v":..., "updated_at":"..."} or null. */
    static JSONObject pull(Context c, String k) throws Exception {
        String t = token(c);
        if (t.isEmpty()) return null;
        String r = req("GET", url(c) + "/rest/v1/cm_state?select=v,updated_at&k=eq." + java.net.URLEncoder.encode(k, "UTF-8"),
                key(c), t, null, null);
        JSONArray a = new JSONArray(r);
        return a.length() == 0 ? null : a.getJSONObject(0);
    }

    static void push(Context c, String k, Object v, String isoTime) throws Exception {
        String t = token(c);
        if (t.isEmpty()) return;
        JSONObject row = new JSONObject().put("k", k).put("v", v).put("updated_at", isoTime);
        req("POST", url(c) + "/rest/v1/cm_state?on_conflict=user_id,k", key(c), t,
                new JSONArray().put(row).toString(), "resolution=merge-duplicates,return=minimal");
    }

    static String iso(long ms) {
        java.text.SimpleDateFormat f = new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US);
        f.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
        return f.format(new java.util.Date(ms));
    }

    static long parseIso(String s) {
        try {
            String x = s.replace("Z", "+00:00");
            int dot = x.indexOf('.');
            int plus = Math.max(x.lastIndexOf('+'), x.lastIndexOf('-'));
            String base = dot > 0 ? x.substring(0, dot) : x.substring(0, plus);
            String frac = dot > 0 ? x.substring(dot + 1, plus) : "0";
            String tz = x.substring(plus);
            java.text.SimpleDateFormat f = new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX", java.util.Locale.US);
            long ms = f.parse(base + tz).getTime();
            ms += Long.parseLong((frac + "000").substring(0, 3));
            return ms;
        } catch (Exception e) { return 0; }
    }
}
