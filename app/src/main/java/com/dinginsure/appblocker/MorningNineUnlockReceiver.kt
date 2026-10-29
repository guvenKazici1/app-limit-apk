package com.dinginsure.appblocker

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import com.dinginsure.appblocker.security.BlindPasswordVault

class MorningNineUnlockReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent?) {
        BlindPasswordVault.unlockAllForMorning(context)
        scheduleNextMorningNineAm(context)
    }

    companion object {
        fun scheduleNextMorningNineAm(context: Context) {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val intent = Intent(context, MorningNineUnlockReceiver::class.java).apply {
                action = "com.dinginsure.ACTION_MORNING_0900_UNLOCK"
            }
            val pendingIntent = PendingIntent.getBroadcast(
                context,
                900,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val triggerAtMillis = BlindPasswordVault.calculateNextMorningNineAmMillis()
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !alarmManager.canScheduleExactAlarms()) {
                    alarmManager.setAndAllowWhileIdle(
                        AlarmManager.RTC_WAKEUP,
                        triggerAtMillis,
                        pendingIntent
                    )
                } else {
                    alarmManager.setExactAndAllowWhileIdle(
                        AlarmManager.RTC_WAKEUP,
                        triggerAtMillis,
                        pendingIntent
                    )
                }
            } catch (e: SecurityException) {
                alarmManager.set(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent)
            }
        }
    }
}
