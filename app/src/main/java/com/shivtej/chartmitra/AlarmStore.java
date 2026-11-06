package com.shivtej.chartmitra;

import android.content.Context;
import android.content.Intent;

import org.json.JSONArray;
import org.json.JSONObject;

/** Alerts list kept on the phone (so the alarm works with no internet login) plus its last-change time. */
public class AlarmStore {
    static final String PREF = "alarms";

    static synchronized String getJson(Context c) {
        return c.getSharedPreferences(PREF, 0).getString("list", "[]");
    }

    static synchronized long ts(Context c) {
        return c.getSharedPreferences(PREF, 0).getLong("ts", 0);
    }

    static synchronized void saveJson(Context c, String json, long ts) {
        c.getSharedPreferences(PREF, 0).edit().putString("list", json).putLong("ts", ts).apply();
    }

    static JSONArray get(Context c) {
        try { return new JSONArray(getJson(c)); } catch (Exception e) { return new JSONArray(); }
    }

    static boolean hasActive(Context c) {
        JSONArray a = get(c);
        long now = System.currentTimeMillis();
        for (int i = 0; i < a.length(); i++) {
            JSONObject o = a.optJSONObject(i);
            if (o == null) continue;
            long until = o.optLong("until", 0);
            if (o.optBoolean("active", false) && (until == 0 || until > now)) return true;
        }
        return false;
    }

    /** Start the background watcher when any alert is on (or cloud sync is on), stop it otherwise. */
    static void sync(Context c) {
        Intent i = new Intent(c, AlarmService.class);
        if (hasActive(c) || Sync.ready(c)) {
            try { c.startForegroundService(i); } catch (Exception ignored) { }
        } else {
            c.stopService(i);
        }
    }
}
