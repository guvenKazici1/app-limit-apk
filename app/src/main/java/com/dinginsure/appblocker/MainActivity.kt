package com.dinginsure.appblocker

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.graphics.Color
import android.graphics.Typeface
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.text.InputType
import android.view.Gravity
import android.widget.Button
import android.widget.CheckBox
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import com.dinginsure.appblocker.security.AppRuleConfig
import com.dinginsure.appblocker.security.BlindPasswordVault

class MainActivity : Activity() {

    private lateinit var listContainer: LinearLayout
    private lateinit var permissionStatusBanner: TextView
    private val uiHandler = Handler(Looper.getMainLooper())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        MorningNineUnlockReceiver.scheduleNextMorningNineAm(this)
        startTrackerForegroundService()
        buildUserInterface()
    }

    override fun onResume() {
        super.onResume()
        startTrackerForegroundService()
        updatePermissionStatusBanner()
        if (::listContainer.isInitialized) {
            refreshAppList()
        }
    }

    private fun startTrackerForegroundService() {
        try {
            val intent = Intent(this, UsageTrackerForegroundService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(intent)
            } else {
                startService(intent)
            }
        } catch (_: Exception) {
        }
    }

    private fun buildUserInterface() {
        val rootScroll = ScrollView(this).apply {
            setBackgroundColor(Color.parseColor("#F8FAFC"))
        }

        val mainColumn = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 64, 48, 64)
        }

        val titleText = TextView(this).apply {
            text = "DinginSüre 🌿"
            textSize = 26f
            setTypeface(null, Typeface.BOLD)
            setTextColor(Color.parseColor("#0F172A"))
        }

        val subtitleText = TextView(this).apply {
            text = "Uygulamalarınız için günlük süre ve akşam kapanış saati belirleyin. Süre dolduğunda tatlı bir emoji ve nazik uyarı sonrası uygulama kapanır, kimsenin bilmediği rastgele şifreyle ertesi sabah 09:00'a kadar kilitlenir."
            textSize = 14f
            setTextColor(Color.parseColor("#475569"))
            setPadding(0, 12, 0, 24)
        }

        permissionStatusBanner = TextView(this).apply {
            textSize = 13f
            setPadding(32, 24, 32, 24)
            setTextColor(Color.WHITE)
        }

        val permColumn = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(0, 24, 0, 32)
        }

        val usagePermButton = Button(this).apply {
            text = "1. Kullanım Süresi Erişimi İzni Ver (Zorunlu - Süre Sayacı İçin)"
            setOnClickListener {
                startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS))
            }
        }

        val overlayButton = Button(this).apply {
            text = "2. Diğer Uygulamaların Üstünde Gösterim İzni Ver (Emoji Ekranı İçin)"
            setOnClickListener {
                if (!Settings.canDrawOverlays(this@MainActivity)) {
                    val intent = Intent(
                        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:$packageName")
                    )
                    startActivity(intent)
                } else {
                    Toast.makeText(this@MainActivity, "Üstte gösterim izni zaten aktif!", Toast.LENGTH_SHORT).show()
                }
            }
        }

        val accButton = Button(this).apply {
            text = "3. Erişilebilirlik Servisini Aç (Anında Kapatma İçin)"
            setOnClickListener {
                startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
            }
        }

        permColumn.addView(usagePermButton)
        permColumn.addView(overlayButton)
        permColumn.addView(accButton)

        listContainer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
        }

        mainColumn.addView(titleText)
        mainColumn.addView(subtitleText)
        mainColumn.addView(permissionStatusBanner)
        mainColumn.addView(permColumn)
        mainColumn.addView(listContainer)

        rootScroll.addView(mainColumn)
        setContentView(rootScroll)

        updatePermissionStatusBanner()
        refreshAppList()
    }

    private fun updatePermissionStatusBanner() {
        if (!::permissionStatusBanner.isInitialized) return
        val hasUsage = BlindPasswordVault.hasUsageStatsPermission(this)
        val hasOverlay = Settings.canDrawOverlays(this)
        val hasAcc = BlindPasswordVault.isAccessibilityServiceEnabled(this)

        val statusLines = mutableListOf<String>()
        statusLines.add(if (hasUsage) "✅ 1. Kullanım Süresi Sayacı İzni: AKTİF" else "❌ 1. Kullanım Süresi Sayacı İzni: KAPALI (Süre tutması için 1. butona basıp DinginSüre'ye izin verin)")
        statusLines.add(if (hasOverlay) "✅ 2. Üstte Gösterim İzni: AKTİF" else "⚠️ 2. Üstte Gösterim İzni: KAPALI")
        statusLines.add(if (hasAcc) "✅ 3. Erişilebilirlik Servisi: AKTİF" else "⚠️ 3. Erişilebilirlik Servisi: KAPALI")

        permissionStatusBanner.text = statusLines.joinToString("\n")
        permissionStatusBanner.setBackgroundColor(
            if (hasUsage) Color.parseColor("#065F46") else Color.parseColor("#991B1B")
        )
    }

    private fun refreshAppList() {
        listContainer.removeAllViews()
        val savedRules = BlindPasswordVault.loadRules(this).associateBy { it.packageName }

        val pm = packageManager
        val installedApps = pm.getInstalledApplications(0)
            .filter { (it.flags and ApplicationInfo.FLAG_SYSTEM) == 0 && it.packageName != packageName }
            .sortedBy { pm.getApplicationLabel(it).toString().lowercase() }

        val combinedPackages = LinkedHashMap<String, String>()
        for (rule in savedRules.values) {
            combinedPackages[rule.packageName] = rule.appName
        }
        for (appInfo in installedApps) {
            combinedPackages[appInfo.packageName] = pm.getApplicationLabel(appInfo).toString()
        }

        for ((pkg, label) in combinedPackages) {
            val rule = savedRules[pkg] ?: AppRuleConfig(
                packageName = pkg,
                appName = label,
                isTracked = false,
                dailyLimitMinutes = 30,
                cutoffHour = "22:30",
                emoji = "🌿",
                politeMessage = "Bugünlük $label süren doldu güzel insan! Gözlerini dinlendirip gerçek dünyaya dönme vakti, yarın sabah 09:00'da görüşürüz."
            )

            val isLocked = BlindPasswordVault.isAppCurrentlyLocked(this, pkg)
            val usedSec = BlindPasswordVault.getEffectiveUsedSecondsToday(this, pkg)
            val usedMin = usedSec / 60
            val remSec = usedSec % 60

            val card = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setBackgroundColor(Color.WHITE)
                setPadding(36, 32, 36, 32)
            }

            val topRow = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
            }

            val nameText = TextView(this).apply {
                text = "${rule.emoji}  $label"
                textSize = 17f
                setTypeface(null, Typeface.BOLD)
                setTextColor(Color.parseColor("#0F172A"))
            }

            val statusText = TextView(this).apply {
                text = when {
                    isLocked -> "🔒 KİLİTLİ (Kör Şifre Atandı • Yarın 09:00'da Açılır)"
                    rule.isTracked -> "⏱️ Bugün Kullanılan: ${usedMin}dk ${remSec}sn / Hedef: ${rule.dailyLimitMinutes}dk • Kapanış: ${rule.cutoffHour.ifEmpty { "Yok" }}"
                    else -> "Denetim Kapalı (Süre tutmak için aşağıdan ayarlayın)"
                }
                textSize = 13f
                setTextColor(if (isLocked) Color.parseColor("#DC2626") else if (rule.isTracked) Color.parseColor("#047857") else Color.parseColor("#64748B"))
                setPadding(0, 8, 0, 12)
            }

            val editButton = Button(this).apply {
                text = if (rule.isTracked) "Süreyi Düzenle (${rule.dailyLimitMinutes} dk)" else "Süre Sınırı Başlat"
                setOnClickListener {
                    showEditRuleDialog(rule)
                }
            }

            topRow.addView(nameText, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
            card.addView(topRow)
            card.addView(statusText)
            card.addView(editButton)

            val params = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                bottomMargin = 24
            }
            listContainer.addView(card, params)
        }
    }

    private fun showEditRuleDialog(rule: AppRuleConfig) {
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 32, 48, 16)
        }

        val trackCheck = CheckBox(this).apply {
            text = "Bu uygulama için günlük süre sayacını aktif et"
            // Kullanıcı süre ayarlamak için pencereyi açtığında otomatik seçili gelsin!
            isChecked = true
        }

        val limitLabel = TextView(this).apply {
            text = "Günlük Kullanım Süresi (Dakika):"
            setPadding(0, 16, 0, 4)
        }

        val limitInput = EditText(this).apply {
            hint = "Örn: 30"
            inputType = InputType.TYPE_CLASS_NUMBER
            setText(rule.dailyLimitMinutes.toString())
        }

        val cutoffLabel = TextView(this).apply {
            text = "Akşam Kapanış Saati (SS:DD veya boş bırakın):"
            setPadding(0, 16, 0, 4)
        }

        val cutoffInput = EditText(this).apply {
            hint = "Örn: 22:30"
            setText(rule.cutoffHour)
        }

        val emojiLabel = TextView(this).apply {
            text = "Tatlı Emoji:"
            setPadding(0, 16, 0, 4)
        }

        val emojiInput = EditText(this).apply {
            hint = "Örn: 🌿, 🐣, ☕"
            setText(rule.emoji)
        }

        val msgLabel = TextView(this).apply {
            text = "Nazik Uyarı Mesajı:"
            setPadding(0, 16, 0, 4)
        }

        val msgInput = EditText(this).apply {
            hint = "Nazik uyarı mesajı"
            setText(rule.politeMessage)
        }

        layout.addView(trackCheck)
        layout.addView(limitLabel)
        layout.addView(limitInput)
        layout.addView(cutoffLabel)
        layout.addView(cutoffInput)
        layout.addView(emojiLabel)
        layout.addView(emojiInput)
        layout.addView(msgLabel)
        layout.addView(msgInput)

        AlertDialog.Builder(this)
            .setTitle("${rule.appName} Sınır Ayarları")
            .setView(layout)
            .setPositiveButton("Kaydet ve Sayacı Başlat") { _, _ ->
                val updated = rule.copy(
                    isTracked = trackCheck.isChecked,
                    dailyLimitMinutes = limitInput.text.toString().toIntOrNull()?.coerceAtLeast(1) ?: 30,
                    cutoffHour = cutoffInput.text.toString().trim(),
                    emoji = emojiInput.text.toString().trim().ifEmpty { "🌿" },
                    politeMessage = msgInput.text.toString().trim().ifEmpty { rule.politeMessage }
                )
                BlindPasswordVault.saveRule(this, updated)
                startTrackerForegroundService()
                refreshAppList()
                if (!BlindPasswordVault.hasUsageStatsPermission(this)) {
                    Toast.makeText(
                        this,
                        "Sürenin sayılması için lütfen üstteki '1. Kullanım Süresi Erişimi İzni Ver' butonuna basıp izin verin!",
                        Toast.LENGTH_LONG
                    ).show()
                } else {
                    Toast.makeText(this, "${rule.appName} için sayaç aktif edildi!", Toast.LENGTH_SHORT).show()
                }
            }
            .setNegativeButton("İptal", null)
            .show()
    }
}
