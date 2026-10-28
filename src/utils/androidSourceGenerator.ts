import { AndroidAppItem } from '../data/androidApps';

export function generateAndroidSourceFiles(apps: AndroidAppItem[]) {
  const trackedApps = apps.filter((a) => a.isTracked);
  const rulesJsonString = JSON.stringify(
    trackedApps.map((a) => ({
      packageName: a.packageName,
      name: a.name,
      dailyLimitSeconds: a.dailyLimitMinutes * 60,
      cutoffHour: a.cutoffHour,
      emoji: a.customEmoji,
      politeMessage: a.customPoliteMessage,
      autoCloseDelaySec: a.autoCloseDelaySec,
    })),
    null,
    2
  );

  const manifestXml = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools"
    package="com.dinginsure.appblocker">

    <!-- Arka planda uygulama kullanım sürelerini (UsageStats) okumak için izin -->
    <uses-permission
        android:name="android.permission.PACKAGE_USAGE_STATS"
        tools:ignore="ProtectedPermissions" />

    <!-- Yüklü tüm uygulamaları (APK açıldığında) listelemek için izin -->
    <uses-permission
        android:name="android.permission.QUERY_ALL_PACKAGES"
        tools:ignore="QueryAllPackagesPermission" />

    <!-- Nazik emoji uyarısını kilitli uygulamanın üstünde göstermek için izin -->
    <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />

    <!-- Arka plan sayacının kesintisiz çalışması ve sabah 09:00 alarmı için -->
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_SPECIAL_USE" />
    <uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />

    <application
        android:allowBackup="false"
        android:label="DinginSüre"
        android:supportsRtl="true"
        android:theme="@style/Theme.Material3.DayNight.NoActionBar">

        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <!-- Erişilebilirlik Servisi: Süresi dolan veya saat sınırı geçen uygulamayı anında yakalayıp kapatır -->
        <service
            android:name=".AppInterceptorAccessibilityService"
            android:exported="true"
            android:label="DinginSüre Nazik Kilit Servisi"
            android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE">
            <intent-filter>
                <action android:name="android.accessibilityservice.AccessibilityService" />
            </intent-filter>
            <meta-data
                android:name="android.accessibilityservice"
                android:resource="@xml/accessibility_service_config" />
        </service>

        <!-- Her sabah saat 09:00'da kilitleri ve kör şifreleri sıfırlayan alıcı -->
        <receiver
            android:name=".MorningNineUnlockReceiver"
            android:exported="true">
            <intent-filter>
                <action android:name="com.dinginsure.ACTION_MORNING_0900_UNLOCK" />
                <action android:name="android.intent.action.BOOT_COMPLETED" />
            </intent-filter>
        </receiver>

    </application>
</manifest>`;

  const blindPasswordVaultKt = `package com.dinginsure.appblocker.security

import android.content.Context
import java.security.SecureRandom
import java.security.MessageDigest
import java.util.Calendar

/**
 * BlindPasswordVault (Kör Şifre Kasası)
 * -------------------------------------------------------------
 * Kullanıcıya ASLA gösterilmeyen, SecureRandom ile üretilen 24 haneli
 * kriptografik kilit anahtarı oluşturur. Şifre düz metin olarak saklanmaz,
 * doğrudan SHA-256 özeti alınır ve ertesi sabah saat 09:00'a kadar
 * kullanıcı dahil hiç kimse kilidi şifreyle açamaz.
 */
object BlindPasswordVault {

    private const val PREFS_NAME = "dinginsure_blind_vault"
    private val secureRandom = SecureRandom()

    fun generateUnknowableLockForApp(context: Context, packageName: String): String {
        val randomBytes = ByteArray(32)
        secureRandom.nextBytes(randomBytes)

        // Rastgele baytları SHA-256 ile özetle; orijinal şifreyi bellekte bile tutma!
        val digest = MessageDigest.getInstance("SHA-256")
        val hashBytes = digest.digest(randomBytes)
        val blindHash = hashBytes.joinToString("") { "%02x".format(it) }

        val unlockTimestamp = calculateNextMorningNineAmMillis()

        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString("lock_hash_\$packageName", blindHash)
            .putLong("unlock_at_\$packageName", unlockTimestamp)
            .putBoolean("is_locked_\$packageName", true)
            .apply()

        return "SHA256-BLIND-\${blindHash.take(8).uppercase()}"
    }

    fun isAppCurrentlyLocked(context: Context, packageName: String): Boolean {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val isLocked = prefs.getBoolean("is_locked_\$packageName", false)
        if (!isLocked) return false

        val unlockAt = prefs.getLong("unlock_at_\$packageName", 0L)
        val now = System.currentTimeMillis()

        // Eğer sabah 09:00 geçtiyse kilidi otomatik kaldır
        if (now >= unlockAt) {
            unlockAndResetForMorning(context, packageName)
            return false
        }
        return true
    }

    fun unlockAndResetForMorning(context: Context, packageName: String) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putBoolean("is_locked_\$packageName", false)
            .remove("lock_hash_\$packageName")
            .putLong("used_seconds_\$packageName", 0L)
            .apply()
    }

    fun calculateNextMorningNineAmMillis(): Long {
        val now = Calendar.getInstance()
        val target = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, 9)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
        // Şu an saat 09:00 veya sonrasıysa, ertesi sabah 09:00'a ayarla
        if (!now.before(target)) {
            target.add(Calendar.DAY_OF_YEAR, 1)
        }
        return target.timeInMillis
    }
}`;

  const interceptorServiceKt = `package com.dinginsure.appblocker

import android.accessibilityservice.AccessibilityService
import android.graphics.PixelFormat
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.widget.LinearLayout
import android.widget.TextView
import com.dinginsure.appblocker.security.BlindPasswordVault
import java.util.Calendar

/**
 * AppInterceptorAccessibilityService
 * -------------------------------------------------------------
 * 1. Arka planda seçili uygulamaların kullanım süresini saniye saniye sayar.
 * 2. Günlük süre dolduğunda VEYA belirlenen akşam saatinden sonra girilmeye
 *    çalışıldığında devreye girer.
 * 3. Ekranda tatlı bir emoji ve nazik uyarı mesajı gösterir.
 * 4. GLOBAL_ACTION_HOME ile uygulamayı tamamen kapatıp ana ekrana döner.
 */
class AppInterceptorAccessibilityService : AccessibilityService() {

    private val mainHandler = Handler(Looper.getMainLooper())
    private var currentForegroundPkg: String? = null
    private var overlayView: LinearLayout? = null

    data class AppRule(
        val packageName: String,
        val appName: String,
        val dailyLimitSeconds: Int,
        val cutoffHour: String?, // Örn: "22:30"
        val emoji: String,
        val politeMessage: String,
        val autoCloseDelaySec: Int
    )

    // Web panelinde yapılandırdığınız güncel kurallar:
    private val configuredRules = listOf(
${trackedApps
  .map(
    (a) =>
      `        AppRule("${a.packageName}", "${a.name}", ${a.dailyLimitMinutes * 60}, ${
        a.cutoffHour ? `"${a.cutoffHour}"` : 'null'
      }, "${a.customEmoji}", "${a.customPoliteMessage.replace(/"/g, '\\"')}", ${a.autoCloseDelaySec})`
  )
  .join(',\n')}
    )

    private val backgroundTicker = object : Runnable {
        override fun run() {
            val fgPkg = currentForegroundPkg
            if (fgPkg != null) {
                val rule = configuredRules.find { it.packageName == fgPkg }
                if (rule != null) {
                    incrementAndCheckAppUsage(rule)
                }
            }
            mainHandler.postDelayed(this, 1000L) // Her saniye arka planda çalışmaya devam eder
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

            val rule = configuredRules.find { it.packageName == pkgName } ?: return
            checkAndInterceptImmediately(rule)
        }
    }

    private fun incrementAndCheckAppUsage(rule: AppRule) {
        val prefs = getSharedPreferences("dinginsure_blind_vault", MODE_PRIVATE)
        val key = "used_seconds_\${rule.packageName}"
        val used = prefs.getLong(key, 0L) + 1L
        prefs.edit().putLong(key, used).apply()

        checkAndInterceptImmediately(rule)
    }

    private fun checkAndInterceptImmediately(rule: AppRule) {
        val prefs = getSharedPreferences("dinginsure_blind_vault", MODE_PRIVATE)
        val usedSeconds = prefs.getLong("used_seconds_\${rule.packageName}", 0L)
        val isPastCutoff = isCurrentTimePastCutoff(rule.cutoffHour)
        val isQuotaExceeded = usedSeconds >= rule.dailyLimitSeconds

        if (BlindPasswordVault.isAppCurrentlyLocked(this, rule.packageName) || isQuotaExceeded || isPastCutoff) {
            // Kullanıcı bilmediği rastgele kör şifreyi oluştur ve sabah 09:00'a kadar kilitle
            BlindPasswordVault.generateUnknowableLockForApp(this, rule.packageName)

            // Tatlı emoji ve nazik uyarıyı göster, ardından uygulamayı tamamen kapat
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

        // Gece yarısından sabah 09:00'a kadar da kilit devam eder
        if (nowHour < 9) return true
        return (nowHour > cutoffHour) || (nowHour == cutoffHour && nowMin >= cutoffMin)
    }

    private fun showPoliteEmojiOverlayAndCloseApp(rule: AppRule) {
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
            text = "\${rule.appName} Dinlenme Modunda"
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

        // Uygulamayı arka planda bırakmayıp ana ekrana dönerek tamamen kapat
        performGlobalAction(GLOBAL_ACTION_HOME)

        mainHandler.postDelayed({
            overlayView?.let {
                wm.removeView(it)
                overlayView = null
            }
        }, rule.autoCloseDelaySec * 1000L)
    }

    override fun onInterrupt() {}
}`;

  const morningReceiverKt = `package com.dinginsure.appblocker

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.dinginsure.appblocker.security.BlindPasswordVault

/**
 * MorningNineUnlockReceiver
 * -------------------------------------------------------------
 * Her sabah tam saat 09:00:00'da tetiklenir.
 * Tüm uygulamalardaki kör şifre kilitlerini kaldırır, günlük sayaçları
 * sıfırlar ve yeni günün döngüsünü başlatır.
 */
class MorningNineUnlockReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent?) {
        val trackedPackages = listOf(
${trackedApps.map((a) => `            "${a.packageName}"`).join(',\n')}
        )

        for (pkg in trackedPackages) {
            BlindPasswordVault.unlockAndResetForMorning(context, pkg)
        }

        // Bir sonraki sabah 09:00 için döngüyü yeniden kur
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
            alarmManager.setExactAndAllowWhileIdle(
                AlarmManager.RTC_WAKEUP,
                triggerAtMillis,
                pendingIntent
            )
        }
    }
}`;

  return {
    manifestXml,
    blindPasswordVaultKt,
    interceptorServiceKt,
    morningReceiverKt,
    rulesJsonString,
  };
}
