package com.shivtej.chartmitra;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;

/** Plays the phone's alarm tone on the alarm volume, like a clock alarm. */
public class Ringer {
    private static MediaPlayer player;
    private static Vibrator vib;
    private static final Handler h = new Handler(Looper.getMainLooper());

    static synchronized void start(Context ctx) {
        stop();
        try {
            Uri uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (uri == null) uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            if (uri == null) uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            player = new MediaPlayer();
            player.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
            player.setDataSource(ctx.getApplicationContext(), uri);
            player.setLooping(true);
            player.prepare();
            player.start();
        } catch (Exception ignored) { }
        try {
            vib = (Vibrator) ctx.getApplicationContext().getSystemService(Context.VIBRATOR_SERVICE);
            if (vib != null) vib.vibrate(VibrationEffect.createWaveform(new long[]{0, 800, 600}, 0));
        } catch (Exception ignored) { }
        h.removeCallbacksAndMessages(null);
        h.postDelayed(Ringer::stop, 60_000); // ring for 1 minute at most
    }

    static synchronized void stop() {
        try { if (player != null) { player.stop(); player.release(); } } catch (Exception ignored) { }
        player = null;
        try { if (vib != null) vib.cancel(); } catch (Exception ignored) { }
        vib = null;
    }
}
