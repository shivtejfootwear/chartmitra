package com.shivtej.chartmitra;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.DecimalFormat;
import java.util.HashMap;
import java.util.Map;

/**
 * Runs in the background (even when the app is closed) and checks prices every few
 * seconds. When a price alarm or trend-line alarm hits, it rings the alarm tone.
 */
public class AlarmService extends Service {
    static final String CH_SERVICE = "watcher";
    static final String CH_ALARM = "price_alarm_v1";
    static final int FG_ID = 1;
    private volatile boolean running = false;
    private Thread worker;
    private PowerManager.WakeLock wl;

    @Override
    public IBinder onBind(Intent i) { return null; }

    @Override
    public void onCreate() {
        super.onCreate();
        makeChannels(this);
    }

    static void makeChannels(Context c) {
        NotificationManager nm = (NotificationManager) c.getSystemService(NOTIFICATION_SERVICE);
        NotificationChannel s = new NotificationChannel(CH_SERVICE, "Alert watcher", NotificationManager.IMPORTANCE_LOW);
        s.setShowBadge(false);
        nm.createNotificationChannel(s);
        NotificationChannel a = new NotificationChannel(CH_ALARM, "Price alerts", NotificationManager.IMPORTANCE_HIGH);
        a.setSound(null, null); // the Ringer plays the alarm tone itself
        a.enableVibration(false);
        a.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(a);
    }

    private Notification fgNotification(String text) {
        PendingIntent open = PendingIntent.getActivity(this, 0,
                new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        return new Notification.Builder(this, CH_SERVICE)
                .setSmallIcon(R.drawable.ic_notif)
                .setContentTitle("ChartMitra")
                .setContentText(text)
                .setContentIntent(open)
                .setOngoing(true)
                .build();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Notification n = fgNotification("Watching the market");
        try {
            if (Build.VERSION.SDK_INT >= 34) startForeground(FG_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
            else startForeground(FG_ID, n);
        } catch (Exception e) {
            stopSelf();
            return START_NOT_STICKY;
        }
        if (!running) {
            running = true;
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            wl = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "chartmitra:watch");
            wl.setReferenceCounted(false);
            worker = new Thread(this::loop, "alarm-watch");
            worker.start();
        }
        return START_STICKY;
    }

    private long lastPull = 0;

    private void loop() {
        while (running) {
            long now = System.currentTimeMillis();
            boolean active = AlarmStore.hasActive(this);
            if (Sync.ready(this) && now - lastPull > (active ? 45_000 : 90_000)) {
                lastPull = now;
                try { pullRemote(); } catch (Exception ignored) { }
                active = AlarmStore.hasActive(this);
            }
            if (active) {
                try { if (!wl.isHeld()) wl.acquire(); } catch (Exception ignored) { }
                try { checkOnce(); } catch (Exception ignored) { }
            } else {
                try { if (wl.isHeld()) wl.release(); } catch (Exception ignored) { }
                NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
                nm.notify(FG_ID, fgNotification("Cloud sync on · no active alerts"));
            }
            if (!AlarmStore.hasActive(this) && !Sync.ready(this)) { running = false; stopSelf(); break; }
            try { Thread.sleep(AlarmStore.hasActive(this) ? 5000 : 30000); } catch (InterruptedException e) { break; }
        }
    }

    /** Alerts made on the website reach the phone even when the app is closed. */
    private void pullRemote() throws Exception {
        JSONObject row = Sync.pull(this, "alerts");
        if (row == null) return;
        long rts = Sync.parseIso(row.optString("updated_at"));
        synchronized (AlarmStore.class) {
            if (rts <= AlarmStore.ts(this)) return;
            JSONArray remote = row.optJSONArray("v");
            if (remote == null) return;
            JSONArray local = AlarmStore.get(this);
            Map<String, JSONObject> byId = new HashMap<>();
            for (int i = 0; i < local.length(); i++) byId.put(local.getJSONObject(i).optString("id"), local.getJSONObject(i));
            for (int i = 0; i < remote.length(); i++) {
                JSONObject o = remote.getJSONObject(i);
                JSONObject l = byId.get(o.optString("id"));
                if (l != null) { if (l.has("ref")) o.put("ref", l.opt("ref")); if (l.has("armed")) o.put("armed", l.opt("armed")); }
            }
            AlarmStore.saveJson(this, remote.toString(), rts);
        }
    }

    private void checkOnce() throws Exception {
        long now = System.currentTimeMillis();
        JSONArray list = AlarmStore.get(this);
        Map<String, Double> prices = new HashMap<>();
        int activeCount = 0;
        for (int i = 0; i < list.length(); i++) {
            JSONObject o = list.getJSONObject(i);
            if (!o.optBoolean("active")) continue;
            long until = o.optLong("until", 0);
            if (until != 0 && until < now) continue;
            activeCount++;
            String key = o.getString("src") + "|" + o.getString("sym");
            if (!prices.containsKey(key)) {
                try { prices.put(key, Http.price(o.getString("src"), o.getString("sym"))); }
                catch (Exception e) { prices.put(key, Double.NaN); }
            }
        }
        if (activeCount == 0) {
            expireOld(now);
            return;
        }

        // Work out hits, then merge only the changed fields back (the app may have edited the list meanwhile).
        Map<String, JSONObject> changes = new HashMap<>();
        boolean anyHit = false;
        StringBuilder status = new StringBuilder();
        for (int i = 0; i < list.length(); i++) {
            JSONObject o = list.getJSONObject(i);
            if (!o.optBoolean("active")) continue;
            long until = o.optLong("until", 0);
            if (until != 0 && until < now) continue;
            Double pObj = prices.get(o.getString("src") + "|" + o.getString("sym"));
            if (pObj == null || pObj.isNaN()) continue;
            double p = pObj;
            double target = target(o, now);
            double last = o.optDouble("ref", Double.NaN);
            boolean armed = o.optBoolean("armed", true);
            String cond = o.optString("cond", "cross");
            boolean hit = false;
            if ("above".equals(cond)) {
                if (!armed && p < target) armed = true;
                if (armed && p >= target) hit = true;
            } else if ("below".equals(cond)) {
                if (!armed && p > target) armed = true;
                if (armed && p <= target) hit = true;
            } else {
                if (!Double.isNaN(last) && ((last < target && p >= target) || (last > target && p <= target))) hit = true;
            }
            JSONObject ch = new JSONObject();
            ch.put("ref", p);
            ch.put("last", p);
            if (hit) {
                ch.put("lastHit", now);
                ch.put("hitPrice", p);
                if (o.optBoolean("repeat", false)) armed = false;
                else ch.put("active", false);
                notifyHit(o, p, target);
                anyHit = true;
            }
            ch.put("armed", armed);
            changes.put(o.getString("id"), ch);
            if (status.length() < 60) status.append(o.optString("name")).append(" ").append(fmt(p)).append("  ");
        }
        merge(changes, anyHit ? now : -1);
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        nm.notify(FG_ID, fgNotification(activeCount + " alerts active · " + status.toString().trim()));
    }

    static double target(JSONObject o, long now) {
        if ("line".equals(o.optString("type"))) {
            double t1 = o.optDouble("t1"), p1 = o.optDouble("p1"), t2 = o.optDouble("t2"), p2 = o.optDouble("p2");
            if (t2 == t1) return p1;
            return p1 + (p2 - p1) * (now - t1) / (t2 - t1);
        }
        return o.optDouble("price");
    }

    /** bumpTs: new change-time when an alert fired (then sent to the cloud), -1 keeps the old one */
    private void merge(Map<String, JSONObject> changes, long bumpTs) throws Exception {
        String pushed = null;
        synchronized (AlarmStore.class) {
            JSONArray cur = AlarmStore.get(this);
            for (int i = 0; i < cur.length(); i++) {
                JSONObject o = cur.getJSONObject(i);
                JSONObject ch = changes.get(o.optString("id"));
                if (ch == null) continue;
                java.util.Iterator<String> it = ch.keys();
                while (it.hasNext()) { String k = it.next(); o.put(k, ch.get(k)); }
            }
            long ts = bumpTs > 0 ? bumpTs : AlarmStore.ts(this);
            AlarmStore.saveJson(this, cur.toString(), ts);
            if (bumpTs > 0) pushed = cur.toString();
        }
        if (pushed != null && Sync.ready(this)) {
            try { Sync.push(this, "alerts", new JSONArray(pushed), Sync.iso(bumpTs)); } catch (Exception ignored) { }
        }
    }

    private void expireOld(long now) {
        synchronized (AlarmStore.class) {
            try {
                JSONArray cur = AlarmStore.get(this);
                boolean changed = false;
                for (int i = 0; i < cur.length(); i++) {
                    JSONObject o = cur.getJSONObject(i);
                    long until = o.optLong("until", 0);
                    if (o.optBoolean("active") && until != 0 && until < now) { o.put("active", false); changed = true; }
                }
                if (changed) AlarmStore.saveJson(this, cur.toString(), AlarmStore.ts(this));
            } catch (Exception ignored) { }
        }
    }

    static String fmt(double v) {
        return new DecimalFormat(v < 1 ? "0.######" : v < 100 ? "0.####" : "#,##0.00").format(v);
    }

    private void notifyHit(JSONObject o, double p, double target) {
        int nid = (int) (Math.abs(o.optString("id").hashCode()) % 100000) + 100;
        Intent openI = new Intent(this, MainActivity.class);
        openI.putExtra("stopRing", true);
        openI.putExtra("sym", o.optString("sym"));
        openI.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent open = PendingIntent.getActivity(this, nid, openI,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Intent stopI = new Intent(this, StopReceiver.class).putExtra("nid", nid);
        PendingIntent stop = PendingIntent.getBroadcast(this, nid, stopI,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        String what;
        String cond = o.optString("cond");
        if ("line".equals(o.optString("type"))) what = "touched your trendline";
        else if ("above".equals(cond)) what = "moved above " + fmt(target);
        else if ("below".equals(cond)) what = "moved below " + fmt(target);
        else what = "crossed " + fmt(target);
        String title = o.optString("name") + " " + what;
        String text = "Price now: " + fmt(p) + (o.optString("note").isEmpty() ? "" : " · " + o.optString("note"));

        Notification n = new Notification.Builder(this, CH_ALARM)
                .setSmallIcon(R.drawable.ic_notif)
                .setContentTitle(title)
                .setContentText(text)
                .setCategory(Notification.CATEGORY_ALARM)
                .setContentIntent(open)
                .setFullScreenIntent(open, true)
                .setDeleteIntent(stop)
                .addAction(new Notification.Action.Builder(null, "Stop alarm", stop).build())
                .setAutoCancel(true)
                .build();
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        nm.notify(nid, n);
        Ringer.start(this);
    }

    @Override
    public void onDestroy() {
        running = false;
        if (worker != null) worker.interrupt();
        try { if (wl != null && wl.isHeld()) wl.release(); } catch (Exception ignored) { }
        super.onDestroy();
    }
}
