package com.shivtej.chartmitra;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONObject;

public class MainActivity extends Activity {
    private WebView web;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().setStatusBarColor(Color.WHITE);
        getWindow().setNavigationBarColor(Color.WHITE);
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);

        AlarmService.makeChannels(this);
        web = new WebView(this);
        web.setBackgroundColor(Color.WHITE);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setTextZoom(100);
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, android.webkit.WebResourceRequest r) {
                Uri u = r.getUrl();
                if ("file".equals(u.getScheme())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient());
        web.addJavascriptInterface(new Bridge(), "Android");
        setContentView(web);
        web.loadUrl("file:///android_asset/index.html");

        if (Build.VERSION.SDK_INT >= 33 &&
                checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1);
        }
        AlarmStore.sync(this);
        handleIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent i) {
        super.onNewIntent(i);
        handleIntent(i);
    }

    private void handleIntent(Intent i) {
        if (i != null && i.getBooleanExtra("stopRing", false)) {
            Ringer.stop();
            final String sym = i.getStringExtra("sym");
            if (sym != null) web.postDelayed(() ->
                    web.evaluateJavascript("window.openFromAlarm&&openFromAlarm(" + JSONObject.quote(sym) + ")", null), 1200);
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.evaluateJavascript("window.onAppResume&&onAppResume()", null);
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("window.onBack?onBack():false", v -> {
            if (!"true".equals(v)) MainActivity.super.onBackPressed();
        });
    }

    private void js(String code) {
        runOnUiThread(() -> web.evaluateJavascript(code, null));
    }

    class Bridge {
        /** Async GET done natively (no CORS limits). Result comes back in window.__res(id, ok, body). */
        @JavascriptInterface
        public void fetch(final String id, final String url) {
            new Thread(() -> {
                String body;
                boolean ok;
                try { body = Http.get(url); ok = true; } catch (Exception e) { body = String.valueOf(e.getMessage()); ok = false; }
                js("window.__res(" + JSONObject.quote(id) + "," + ok + "," + JSONObject.quote(body) + ")");
            }).start();
        }

        @JavascriptInterface
        public String getAlarms() { return AlarmStore.getJson(MainActivity.this); }

        @JavascriptInterface
        public void saveAlarms(String json) {
            final long now = System.currentTimeMillis();
            synchronized (AlarmStore.class) { AlarmStore.saveJson(MainActivity.this, json, now); }
            AlarmStore.sync(MainActivity.this);
            askBatteryOnce();
            new Thread(() -> {
                try { Sync.push(MainActivity.this, "alerts", new org.json.JSONArray(json), Sync.iso(now)); } catch (Exception ignored) { }
            }).start();
        }

        @JavascriptInterface
        public long alarmsTs() { return AlarmStore.ts(MainActivity.this); }

        /** Gets the newest alerts list from the cloud, then calls window.__res(id, ok, json). */
        @JavascriptInterface
        public void pullAlerts(final String id) {
            new Thread(() -> {
                boolean ok = false;
                try {
                    org.json.JSONObject row = Sync.pull(MainActivity.this, "alerts");
                    if (row != null) {
                        long rts = Sync.parseIso(row.optString("updated_at"));
                        synchronized (AlarmStore.class) {
                            if (rts > AlarmStore.ts(MainActivity.this) && row.optJSONArray("v") != null)
                                AlarmStore.saveJson(MainActivity.this, row.optJSONArray("v").toString(), rts);
                        }
                    }
                    ok = true;
                } catch (Exception ignored) { }
                AlarmStore.sync(MainActivity.this);
                js("window.__res(" + JSONObject.quote(id) + "," + ok + "," + JSONObject.quote(AlarmStore.getJson(MainActivity.this)) + ")");
            }).start();
        }

        @JavascriptInterface
        public String syncInfo() {
            try {
                return new JSONObject().put("url", Sync.url(MainActivity.this)).put("key", Sync.key(MainActivity.this))
                        .put("email", Sync.p(MainActivity.this).getString("email", ""))
                        .put("ready", Sync.ready(MainActivity.this)).toString();
            } catch (Exception e) { return "{}"; }
        }

        @JavascriptInterface
        public void syncLogin(final String id, final String url, final String key, final String email, final String pass) {
            new Thread(() -> {
                boolean ok; String msg;
                try {
                    Sync.setProject(MainActivity.this, url, key);
                    msg = Sync.login(MainActivity.this, email, pass); ok = true;
                } catch (Exception e) { ok = false; msg = String.valueOf(e.getMessage()); }
                AlarmStore.sync(MainActivity.this);
                js("window.__res(" + JSONObject.quote(id) + "," + ok + "," + JSONObject.quote(msg) + ")");
            }).start();
        }

        @JavascriptInterface
        public void syncLogout() { Sync.logout(MainActivity.this); AlarmStore.sync(MainActivity.this); }

        /** Valid login token for cloud save (may refresh it). Empty when not logged in. */
        @JavascriptInterface
        public String syncToken() { return Sync.token(MainActivity.this); }

        @JavascriptInterface
        public void share(String text) {
            runOnUiThread(() -> {
                Intent i = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text);
                startActivity(Intent.createChooser(i, "Share"));
            });
        }

        @JavascriptInterface
        public void stopRing() { Ringer.stop(); }

        @JavascriptInterface
        public void testRing() {
            Ringer.start(MainActivity.this);
        }

        @JavascriptInterface
        public void toast(String t) {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, t, Toast.LENGTH_SHORT).show());
        }

        @JavascriptInterface
        public String version() {
            try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionName; }
            catch (Exception e) { return ""; }
        }

        @JavascriptInterface
        public boolean batteryFree() {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            return pm.isIgnoringBatteryOptimizations(getPackageName());
        }

        @JavascriptInterface
        public void openBattery() { runOnUiThread(() -> askBattery()); }

        @JavascriptInterface
        public void keepScreenOn(boolean on) {
            runOnUiThread(() -> {
                if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            });
        }
    }

    private void askBatteryOnce() {
        SharedPreferences p = getSharedPreferences("app", 0);
        if (p.getBoolean("askedBattery", false)) return;
        p.edit().putBoolean("askedBattery", true).apply();
        runOnUiThread(this::askBattery);
    }

    /** Lets alarms keep working when the phone is idle. */
    @SuppressLint("BatteryLife")
    private void askBattery() {
        try {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            if (pm.isIgnoringBatteryOptimizations(getPackageName())) return;
            Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            i.setData(Uri.parse("package:" + getPackageName()));
            startActivity(i);
        } catch (Exception e) {
            try { startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)); } catch (Exception ignored) { }
        }
    }
}
