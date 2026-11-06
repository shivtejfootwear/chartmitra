package com.shivtej.chartmitra;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Restarts the alarm watcher after the phone restarts or the app updates. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        AlarmStore.sync(c);
    }
}
