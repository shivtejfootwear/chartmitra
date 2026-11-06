package com.shivtej.chartmitra;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class StopReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        Ringer.stop();
        int nid = i.getIntExtra("nid", 0);
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null && nid != 0) nm.cancel(nid);
    }
}
