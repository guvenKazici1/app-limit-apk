package com.dinginsure.appblocker

import android.accessibilityservice.AccessibilityService
import android.graphics.PixelFormat
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.Gravity
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import com.dinginsure.appblocker.security.AppRuleConfig
import com.dinginsure.appblocker.security.BlindPasswordVault
import java.util.Calendar

class AppInterceptorAccessibilityService : AccessibilityService() {

    private val mainHandler = Handler(Looper.getMainLooper())
    private var currentForegroundPkg: String? = null
    private var overlayView: LinearLayout? = null

    private val backgroundTicker = object : Runnable {
        override fun run() {
            val fgPkg = currentForegroundPkg
            if (fgPkg != null) {
                val rules = BlindPasswordVault.loadRules(this@AppInterceptorAccessibilityService)
                val rule = rules.find { it.packageName == fgPkg && it.isTracked }
                if (rule != null) {
                    BlindPasswordVault.incrementUsedSeconds(this@AppInterceptorAccessibilityService, rule.packageName)
                    checkAndInterceptImmediately(rule)
                }
            }
            mainHandler.postDelayed(this, 1000L)
        }
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        MorningNineUnlockReceiver.scheduleNextMorningNineAm(this)
        mainHandler.post(backgroundTicker)
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event?.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            val pkgName = event.packageName?.toString() ?: return
            if (pkgName == packageName || pkgName.contains("launcher") || pkgName == "com.android.systemui") {
                currentForegroundPkg = null
                return
            }
            currentForegroundPkg = pkgName

            val rules = BlindPasswordVault.loadRules(this)
            val rule = rules.find { it.packageName == pkgName && it.isTracked } ?: return
            checkAndInterceptImmediately(rule)
        }
    }

    private fun checkAndInterceptImmediately(rule: AppRuleConfig) {
        val usedSeconds = BlindPasswordVault.getUsedSecondsToday(this, rule.packageName)
        val isPastCutoff = isCurrentTimePastCutoff(rule.cutoffHour)
        val isQuotaExceeded = usedSeconds >= (rule.dailyLimitMinutes * 60L)

        if (BlindPasswordVault.isAppCurrentlyLocked(this, rule.packageName) || isQuotaExceeded || isPastCutoff) {
            BlindPasswordVault.generateUnknowableLockForApp(this, rule.packageName)
            showPoliteEmojiOverlayAndCloseApp(rule)
        }
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

    private fun showPoliteEmojiOverlayAndCloseApp(rule: AppRuleConfig) {
        performGlobalAction(GLOBAL_ACTION_HOME)

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
            textSize = 64f
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

    override fun onInterrupt() {}

    override fun onDestroy() {
        super.onDestroy()
        mainHandler.removeCallbacks(backgroundTicker)
    }
}
