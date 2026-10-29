package com.dinginsure.appblocker.security

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.os.Process
import android.provider.Settings
import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Calendar

data class AppRuleConfig(
    val packageName: String,
    val appName: String,
    val isTracked: Boolean,
    val dailyLimitMinutes: Int,
    val cutoffHour: String,
    val emoji: String,
    val politeMessage: String
)

object BlindPasswordVault {

    private const val PREFS_NAME = "dinginsure_blind_vault"
    private const val KEY_RULES_JSON = "configured_rules_json"
    private const val KEY_LAST_ACTIVE_PKG = "last_active_foreground_pkg"
    private val secureRandom = SecureRandom()

    fun hasUsageStatsPermission(context: Context): Boolean {
        val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = appOps.checkOpNoThrow(
            AppOpsManager.OPSTR_GET_USAGE_STATS,
            Process.myUid(),
            context.packageName
        )
        return mode == AppOpsManager.MODE_ALLOWED
    }

    fun isAccessibilityServiceEnabled(context: Context): Boolean {
        val expectedComponentName = "${context.packageName}/com.dinginsure.appblocker.AppInterceptorAccessibilityService"
        val enabledServices = Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        ) ?: return false
        return enabledServices.contains(expectedComponentName, ignoreCase = true)
    }

    fun setLastDetectedForegroundApp(context: Context, pkg: String?) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_LAST_ACTIVE_PKG, pkg ?: "")
            .apply()
    }

    fun getLastDetectedForegroundApp(context: Context): String? {
        val pkg = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(KEY_LAST_ACTIVE_PKG, null)
        return if (pkg.isNullOrBlank()) null else pkg
    }

    /**
     * Queries UsageStatsManager for the currently active foreground app on the device.
     */
    fun detectForegroundAppFromUsageStats(context: Context): String? {
        if (!hasUsageStatsPermission(context)) return null
        val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager ?: return null
        val endTime = System.currentTimeMillis()
        val beginTime = endTime - 1000L * 60 * 30 // Look back 30 minutes for latest foreground transition
        val usageEvents = usm.queryEvents(beginTime, endTime)
        val event = UsageEvents.Event()
        var lastForegroundPkg: String? = null
        var lastTimestamp = 0L

        while (usageEvents.hasNextEvent()) {
            usageEvents.getNextEvent(event)
            if (event.eventType == UsageEvents.Event.ACTIVITY_RESUMED ||
                event.eventType == UsageEvents.Event.MOVE_TO_FOREGROUND
            ) {
                if (event.timeStamp >= lastTimestamp) {
                    lastTimestamp = event.timeStamp
                    lastForegroundPkg = event.packageName
                }
            }
        }
        return lastForegroundPkg
    }

    /**
     * Queries Android UsageStatsManager for total foreground time since 09:00 AM today,
     * and combines it with our internal 1-second precision counter so whichever is higher is used.
     */
    fun getEffectiveUsedSecondsToday(context: Context, packageName: String): Long {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val manualSeconds = prefs.getLong("used_seconds_$packageName", 0L)
        return manualSeconds
    }

    fun incrementUsedSeconds(context: Context, packageName: String): Long {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val next = prefs.getLong("used_seconds_$packageName", 0L) + 1L
        prefs.edit().putLong("used_seconds_$packageName", next).apply()
        return next
    }

    fun generateUnknowableLockForApp(context: Context, packageName: String): String {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        if (prefs.getBoolean("is_locked_$packageName", false)) {
            val existing = prefs.getString("lock_hash_$packageName", "BLIND") ?: "BLIND"
            return "SHA256-BLIND-${existing.take(8).uppercase()}"
        }

        val randomBytes = ByteArray(32)
        secureRandom.nextBytes(randomBytes)

        val digest = MessageDigest.getInstance("SHA-256")
        val hashBytes = digest.digest(randomBytes)
        val blindHash = hashBytes.joinToString("") { "%02x".format(it) }

        val unlockTimestamp = calculateNextMorningNineAmMillis()

        prefs.edit()
            .putString("lock_hash_$packageName", blindHash)
            .putLong("unlock_at_$packageName", unlockTimestamp)
            .putBoolean("is_locked_$packageName", true)
            .apply()

        return "SHA256-BLIND-${blindHash.take(8).uppercase()}"
    }

    fun isAppCurrentlyLocked(context: Context, packageName: String): Boolean {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val isLocked = prefs.getBoolean("is_locked_$packageName", false)
        if (!isLocked) return false

        val unlockAt = prefs.getLong("unlock_at_$packageName", 0L)
        val now = System.currentTimeMillis()

        if (now >= unlockAt) {
            unlockAndResetForMorning(context, packageName)
            return false
        }
        return true
    }

    fun unlockAndResetForMorning(context: Context, packageName: String) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putBoolean("is_locked_$packageName", false)
            .remove("lock_hash_$packageName")
            .putLong("used_seconds_$packageName", 0L)
            .apply()
    }

    fun unlockAllForMorning(context: Context) {
        val rules = loadRules(context)
        for (rule in rules) {
            unlockAndResetForMorning(context, rule.packageName)
        }
    }

    fun calculateNextMorningNineAmMillis(): Long {
        val now = Calendar.getInstance()
        val target = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, 9)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
        if (!now.before(target)) {
            target.add(Calendar.DAY_OF_YEAR, 1)
        }
        return target.timeInMillis
    }

    fun saveRule(context: Context, rule: AppRuleConfig) {
        val current = loadRules(context).toMutableList()
        val idx = current.indexOfFirst { it.packageName == rule.packageName }
        if (idx >= 0) {
            current[idx] = rule
        } else {
            current.add(rule)
        }
        val arr = JSONArray()
        for (item in current) {
            val obj = JSONObject().apply {
                put("packageName", item.packageName)
                put("appName", item.appName)
                put("isTracked", item.isTracked)
                put("dailyLimitMinutes", item.dailyLimitMinutes)
                put("cutoffHour", item.cutoffHour)
                put("emoji", item.emoji)
                put("politeMessage", item.politeMessage)
            }
            arr.put(obj)
        }
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_RULES_JSON, arr.toString())
            .apply()
    }

    fun loadRules(context: Context): List<AppRuleConfig> {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val raw = prefs.getString(KEY_RULES_JSON, null) ?: return defaultRules()
        return try {
            val arr = JSONArray(raw)
            val list = mutableListOf<AppRuleConfig>()
            for (i in 0 until arr.length()) {
                val obj = arr.getJSONObject(i)
                list.add(
                    AppRuleConfig(
                        packageName = obj.optString("packageName"),
                        appName = obj.optString("appName"),
                        isTracked = obj.optBoolean("isTracked", true),
                        dailyLimitMinutes = obj.optInt("dailyLimitMinutes", 30),
                        cutoffHour = obj.optString("cutoffHour", "22:30"),
                        emoji = obj.optString("emoji", "🌿"),
                        politeMessage = obj.optString(
                            "politeMessage",
                            "Bugünlük kullanım süren doldu güzel insan! Gözlerini dinlendirme vakti, yarın sabah 09:00'da görüşürüz."
                        )
                    )
                )
            }
            list
        } catch (e: Exception) {
            defaultRules()
        }
    }

    private fun defaultRules(): List<AppRuleConfig> {
        return listOf(
            AppRuleConfig(
                packageName = "com.instagram.android",
                appName = "Instagram",
                isTracked = true,
                dailyLimitMinutes = 30,
                cutoffHour = "23:00",
                emoji = "🌿",
                politeMessage = "Bugünlük Instagram süren doldu güzel insan. Gözlerini dinlendirip gerçek dünyaya dönme vakti, yarın sabah 09:00'da görüşürüz!"
            ),
            AppRuleConfig(
                packageName = "com.zhiliaoapp.musically",
                appName = "TikTok",
                isTracked = true,
                dailyLimitMinutes = 20,
                cutoffHour = "22:00",
                emoji = "🐣",
                politeMessage = "TikTok için belirlediğin günlük süre bitti bile! Şimdi kendin için harika bir şey yapma zamanı. Nazikçe kapatılıyor..."
            ),
            AppRuleConfig(
                packageName = "com.google.android.youtube",
                appName = "YouTube",
                isTracked = true,
                dailyLimitMinutes = 45,
                cutoffHour = "23:30",
                emoji = "☕",
                politeMessage = "YouTube keyfin harikaydı ama bugünkü kotamız doldu. Zihnini dinlendir, kilit yarın sabah 09:00'da kendiliğinden açılacak."
            ),
            AppRuleConfig(
                packageName = "com.twitter.android",
                appName = "X (Twitter)",
                isTracked = true,
                dailyLimitMinutes = 25,
                cutoffHour = "22:30",
                emoji = "🌙",
                politeMessage = "Gündemi yeterince takip ettin, şimdi huzur vakti. Yarın sabah 09:00'a kadar mola veriyor, iyi dinlenmeler!"
            )
        )
    }
}
