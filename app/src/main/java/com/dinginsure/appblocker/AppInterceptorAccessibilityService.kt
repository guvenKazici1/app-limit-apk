package com.dinginsure.appblocker

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.os.Build
import android.view.accessibility.AccessibilityEvent
import com.dinginsure.appblocker.security.BlindPasswordVault

class AppInterceptorAccessibilityService : AccessibilityService() {

    companion object {
        var instance: AppInterceptorAccessibilityService? = null
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        MorningNineUnlockReceiver.scheduleNextMorningNineAm(this)
        startTrackerService()
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        val pkgName = event?.packageName?.toString() ?: rootInActiveWindow?.packageName?.toString() ?: return
        if (pkgName == packageName || pkgName == "com.android.systemui" || pkgName.contains("launcher")) {
            BlindPasswordVault.setLastDetectedForegroundApp(this, "")
            return
        }
        BlindPasswordVault.setLastDetectedForegroundApp(this, pkgName)
    }

    fun performHomeAction() {
        performGlobalAction(GLOBAL_ACTION_HOME)
    }

    private fun startTrackerService() {
        val serviceIntent = Intent(this, UsageTrackerForegroundService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent)
        } else {
            startService(serviceIntent)
        }
    }

    override fun onInterrupt() {}

    override fun onDestroy() {
        super.onDestroy()
        if (instance === this) {
            instance = null
        }
    }
}
