package com.dinginsure.appblocker

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings
import android.view.Gravity
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import com.dinginsure.appblocker.security.AppRuleConfig
import com.dinginsure.appblocker.security.BlindPasswordVault
import java.util.Calendar

class UsageTrackerForegroundService : Service() {

    private val mainHandler = Handler(Looper.getMainLooper())
    private var overlayView: LinearLayout? = null
    private var lastInterceptTimeMillis = 0L

    private val tickerRunnable = object : Runnable {
        override fun run() {
            try {
                tickSecond()
            } catch (_: Exception) {
            }
            mainHandler.postDelayed(this, 1000L)
        }
    }

    override fun onCreate() {
        super.onCreate()
        startAsForegroundNotification()
        MorningNineUnlockReceiver.scheduleNextMorningNineAm(this)
        mainHandler.post(tickerRunnable)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startAsForegroundNotification()
        return START_STICKY
    }

    private fun tickSecond() {
        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        if (!powerManager.isInteractive) return

        val usagePkg = BlindPasswordVault.detectForegroundAppFromUsageStats(this)
        val accPkg = BlindPasswordVault.getLastDetectedForegroundApp(this)
        val activePkg = usagePkg ?: accPkg ?: return

        if (activePkg == packageName || isSystemOrLauncherPackage(activePkg)) {
            return
        }

        // Hangi uygulama açılırsa açılsın otomatik olarak tespit et ve kuralını getir/oluştur
        val rule = BlindPasswordVault.getOrCreateAutoRuleForPackage(this, activePkg)
        if (!rule.isTracked) return

        val usedSeconds = BlindPasswordVault.incrementUsedSeconds(this, rule.packageName)
        val limitSeconds = rule.dailyLimitMinutes * 60L
        val isPastCutoff = isCurrentTimePastCutoff(rule.cutoffHour)
        val isQuotaExceeded = usedSeconds >= limitSeconds

        updateNotificationText(
            "${rule.emoji} ${rule.appName} açık: ${usedSeconds / 60}dk ${usedSeconds % 60}sn / ${rule.dailyLimitMinutes}dk"
        )

        if (BlindPasswordVault.isAppCurrentlyLocked(this, rule.packageName) || isQuotaExceeded || isPastCutoff) {
            BlindPasswordVault.generateUnknowableLockForApp(this, rule.packageName)
            interceptAndCloseApp(rule)
        }
    }

    private fun isSystemOrLauncherPackage(pkg: String): Boolean {
        val lower = pkg.lowercase()
        return lower == "com.android.systemui" ||
            lower == "com.android.settings" ||
            lower.contains("launcher") ||
            lower.contains("nexuslauncher") ||
            lower.contains("trebuchet") ||
            lower.contains("miui.home") ||
            lower.contains("sec.android.app.launcher") ||
            lower.contains("packageinstaller") ||
            lower.contains("permissioncontroller") ||
            lower == "android"
    }

    private fun isCurrentTimePastCutoff(cutoff: String?): Boolean {
        if (cutoff.isNullOrBlank()) return false
        val parts = cutoff.split(":")
        if (parts.size != 2) return false
        val cutoffHour = parts[0].toIntOrNull() ?: return false
        val cutoffMin = parts[1].toIntOrNull() ?: return false

        val cal = Calendar.getInstance()
        val nowHour = cal.get(Calendar.HOUR_OF_DAY)
        val nowMin = cal.get(Calendar.MINUTE)

        if (nowHour < 9) return true
        return (nowHour > cutoffHour) || (nowHour == cutoffHour && nowMin >= cutoffMin)
    }

    private fun interceptAndCloseApp(rule: AppRuleConfig) {
        val now = System.currentTimeMillis()
        if (now - lastInterceptTimeMillis < 2500L) return
        lastInterceptTimeMillis = now

        AppInterceptorAccessibilityService.instance?.performHomeAction() ?: run {
            val homeIntent = Intent(Intent.ACTION_MAIN).apply {
                addCategory(Intent.CATEGORY_HOME)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            startActivity(homeIntent)
        }

        if (!Settings.canDrawOverlays(this)) {
            Toast.makeText(
                this,
                "${rule.emoji} ${rule.appName}: ${rule.politeMessage} (Sabah 09:00'da açılacak)",
                Toast.LENGTH_LONG
            ).show()
            return
        }

        if (overlayView != null) return
        val wm = getSystemService(WINDOW_SERVICE) as WindowManager

        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(0xF50F172A.toInt())
            setPadding(72, 96, 72, 96)
        }

        val emojiText = TextView(this).apply {
            text = rule.emoji
            textSize = 68f
            gravity = Gravity.CENTER
        }

        val titleText = TextView(this).apply {
            text = "${rule.appName} Dinlenme Modunda"
            textSize = 22f
            setTextColor(0xFFFFFFFF.toInt())
            gravity = Gravity.CENTER
            setPadding(0, 32, 0, 16)
        }

        val messageText = TextView(this).apply {
            text = rule.politeMessage
            textSize = 16f
            setTextColor(0xFFE2E8F0.toInt())
            gravity = Gravity.CENTER
        }

        val subText = TextView(this).apply {
            text = "Kör şifre oluşturuldu (Kimse bilmiyor) • Sabah 09:00'da otomatik açılacak"
            textSize = 12f
            setTextColor(0xFF94A3B8.toInt())
            gravity = Gravity.CENTER
            setPadding(0, 40, 0, 0)
        }

        layout.addView(emojiText)
        layout.addView(titleText)
        layout.addView(messageText)
        layout.addView(subText)

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        )

        wm.addView(layout, params)
        overlayView = layout

        mainHandler.postDelayed({
            overlayView?.let {
                try {
                    wm.removeView(it)
                } catch (_: Exception) {
                }
                overlayView = null
            }
        }, 4000L)
    }

    private fun startAsForegroundNotification() {
        val channelId = "dinginsure_tracker_channel"
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "DinginSüre Arka Plan Sayacı",
                NotificationManager.IMPORTANCE_LOW
            )
            nm.createNotificationChannel(channel)
        }

        val notification = buildNotification(channelId, "Otomatik uygulama algılama ve süre sayacı aktif 🌿")
        startForeground(1001, notification)
    }

    private fun updateNotificationText(content: String) {
        val channelId = "dinginsure_tracker_channel"
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(1001, buildNotification(channelId, content))
    }

    private fun buildNotification(channelId: String, text: String): Notification {
        val openIntent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, channelId)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }

        return builder
            .setContentTitle("DinginSüre Dijital Denge")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build()
    }

    override fun onDestroy() {
        super.onDestroy()
        mainHandler.removeCallbacks(tickerRunnable)
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
