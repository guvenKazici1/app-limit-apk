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
    private lateinit var liveActiveBanner: TextView
    private var autoPermissionDialog: AlertDialog? = null
    private val uiRefreshHandler = Handler(Looper.getMainLooper())

    private val liveUiRefreshRunnable = object : Runnable {
        override fun run() {
            updateLiveBanner()
            uiRefreshHandler.postDelayed(this, 2000L)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        MorningNineUnlockReceiver.scheduleNextMorningNineAm(this)
        startTrackerForegroundService()
        buildUserInterface()
    }

    override fun onResume() {
        super.onResume()
        startTrackerForegroundService()
        checkAndAutoRouteMissingPermissions()
        updateLiveBanner()
        if (::listContainer.isInitialized) {
            refreshAppList()
        }
        uiRefreshHandler.post(liveUiRefreshRunnable)
    }

    override fun onPause() {
        super.onPause()
        uiRefreshHandler.removeCallbacks(liveUiRefreshRunnable)
    }

    /**
     * Uygulama içinde izin butonu aramaya gerek kalmadan, eksik izin varsa
     * açılışta otomatik tespit eder ve doğrudan ilgili Android izin ekranını açar.
     */
    private fun checkAndAutoRouteMissingPermissions() {
        autoPermissionDialog?.dismiss()

        if (!BlindPasswordVault.hasUsageStatsPermission(this)) {
            autoPermissionDialog = AlertDialog.Builder(this)
                .setCancelable(false)
                .setTitle("Otomatik Süre Sayacı İçin Tek SeferlikOnay 🌿")
                .setMessage("Hangi uygulamayı açarsanız açın otomatik tespit edip süre tutabilmesi için açılacak ekranda 'DinginSüre'yi seçip izni aktif edin.")
                .setPositiveButton("Ayarlara Git (Otomatik Aç)") { _, _ ->
                    try {
                        startActivity(
                            Intent(
                                Settings.ACTION_USAGE_ACCESS_SETTINGS,
                                Uri.parse("package:$packageName")
                            )
                        )
                    } catch (_: Exception) {
                        startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS))
                    }
                }
                .show()
            return
        }

        if (!Settings.canDrawOverlays(this)) {
            autoPermissionDialog = AlertDialog.Builder(this)
                .setCancelable(false)
                .setTitle("Tatlı Emoji Uyarı Ekranı Onayı 🐣")
                .setMessage("Süre dolduğunda ekranda tatlı bir emoji ve nazik uyarı mesajı belirmesi için 'Diğer uygulamaların üzerinde göster' iznini aktif edin.")
                .setPositiveButton("İzni Aç") { _, _ ->
                    val intent = Intent(
                        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:$packageName")
                    )
                    startActivity(intent)
                }
                .setNegativeButton("Şimdilik Geç", null)
                .show()
            return
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
            text = "Hangi uygulamayı açarsanız açın otomatik olarak tespit edilir ve arka planda süresi sayılır. Süre dolduğunda tatlı bir emoji ve nazik uyarı sonrası uygulama kapanır, sabah 09:00'a kadar kör şifreyle kilitlenir."
            textSize = 14f
            setTextColor(Color.parseColor("#475569"))
            setPadding(0, 12, 0, 24)
        }

        liveActiveBanner = TextView(this).apply {
            textSize = 14f
            setPadding(36, 28, 36, 28)
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.parseColor("#065F46"))
        }

        // Varsayılan otomatik süre kartı
        val globalAutoCard = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.parseColor("#ECFDF5"))
            setPadding(36, 28, 36, 28)
        }

        val globalTitle = TextView(this).apply {
            text = "⚡ Otomatik Algılama & Varsayılan Süre"
            textSize = 15f
            setTypeface(null, Typeface.BOLD)
            setTextColor(Color.parseColor("#065F46"))
        }

        val globalDesc = TextView(this).apply {
            val defMin = BlindPasswordVault.getGlobalDefaultLimitMinutes(this@MainActivity)
            text = "Özel süre belirlemediğiniz herhangi bir uygulamaya girdiğinizde otomatik olarak günlük $defMin dakika sınırla süre tutmaya başlar."
            textSize = 13f
            setTextColor(Color.parseColor("#047857"))
            setPadding(0, 8, 0, 16)
        }

        val changeDefaultBtn = Button(this).apply {
            text = "Varsayılan Otomatik Süreyi Değiştir (${BlindPasswordVault.getGlobalDefaultLimitMinutes(this@MainActivity)} dk)"
            setOnClickListener {
                showGlobalLimitDialog(globalDesc, this)
            }
        }

        globalAutoCard.addView(globalTitle)
        globalAutoCard.addView(globalDesc)
        globalAutoCard.addView(changeDefaultBtn)

        listContainer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(0, 32, 0, 0)
        }

        mainColumn.addView(titleText)
        mainColumn.addView(subtitleText)
        mainColumn.addView(liveActiveBanner, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply { bottomMargin = 24 })
        mainColumn.addView(globalAutoCard)
        mainColumn.addView(listContainer)

        rootScroll.addView(mainColumn)
        setContentView(rootScroll)

        updateLiveBanner()
        refreshAppList()
    }

    private fun showGlobalLimitDialog(descView: TextView, btnView: Button) {
        val input = EditText(this).apply {
            inputType = InputType.TYPE_CLASS_NUMBER
            setText(BlindPasswordVault.getGlobalDefaultLimitMinutes(this@MainActivity).toString())
        }
        AlertDialog.Builder(this)
            .setTitle("Otomatik Varsayılan Günlük Süre (Dakika)")
            .setMessage("Açtığınız herhangi bir uygulama için varsayılan günlük kaç dakika süre tutulsun?")
            .setView(input)
            .setPositiveButton("Kaydet") { _, _ ->
                val mins = input.text.toString().toIntOrNull()?.coerceAtLeast(1) ?: 30
                BlindPasswordVault.setGlobalDefaultLimitMinutes(this, mins)
                descView.text = "Özel süre belirlemediğiniz herhangi bir uygulamaya girdiğinizde otomatik olarak günlük $mins dakika sınırla süre tutmaya başlar."
                btnView.text = "Varsayılan Otomatik Süreyi Değiştir ($mins dk)"
                refreshAppList()
            }
            .setNegativeButton("İptal", null)
            .show()
    }

    private fun updateLiveBanner() {
        if (!::liveActiveBanner.isInitialized) return
        val hasUsage = BlindPasswordVault.hasUsageStatsPermission(this)
        if (!hasUsage) {
            liveActiveBanner.text = "⚠️ Otomatik süre sayacının başlaması için izin bekleniyor..."
            liveActiveBanner.setBackgroundColor(Color.parseColor("#991B1B"))
            return
        }

        val rules = BlindPasswordVault.loadRules(this)
        val totalUsedSec = rules.sumOf { BlindPasswordVault.getEffectiveUsedSecondsToday(this, it.packageName) }
        val lockedCount = rules.count { BlindPasswordVault.isAppCurrentlyLocked(this, it.packageName) }

        liveActiveBanner.text = "✅ Otomatik Uygulama Algılama Aktif\n" +
            "Bugün Toplam Süre: ${totalUsedSec / 60}dk ${totalUsedSec % 60}sn • Kilitli Uygulama: $lockedCount • Sabah 09:00 Sıfırlama"
        liveActiveBanner.setBackgroundColor(Color.parseColor("#065F46"))
    }

    private fun refreshAppList() {
        listContainer.removeAllViews()
        val savedRules = BlindPasswordVault.loadRules(this).associateBy { it.packageName }
        val defaultLimit = BlindPasswordVault.getGlobalDefaultLimitMinutes(this)

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
                isTracked = true,
                dailyLimitMinutes = defaultLimit,
                cutoffHour = "23:00",
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

            val nameText = TextView(this).apply {
                text = "${rule.emoji}  $label"
                textSize = 17f
                setTypeface(null, Typeface.BOLD)
                setTextColor(Color.parseColor("#0F172A"))
            }

            val statusText = TextView(this).apply {
                text = when {
                    isLocked -> "🔒 KİLİTLİ (Kör Şifre Atandı • Yarın Sabah 09:00'da Açılır)"
                    rule.isTracked -> "⏱️ Otomatik Sayaç Aktif: ${usedMin}dk ${remSec}sn / ${rule.dailyLimitMinutes}dk • Kapanış: ${rule.cutoffHour.ifEmpty { "Yok" }}"
                    else -> "Bu uygulama için sayaç durduruldu"
                }
                textSize = 13f
                setTextColor(
                    if (isLocked) Color.parseColor("#DC2626")
                    else if (rule.isTracked) Color.parseColor("#047857")
                    else Color.parseColor("#64748B")
                )
                setPadding(0, 8, 0, 12)
            }

            val editButton = Button(this).apply {
                text = "Özel Süre / Saat Ayarla (${rule.dailyLimitMinutes} dk)"
                setOnClickListener {
                    showEditRuleDialog(rule)
                }
            }

            card.addView(nameText)
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
            text = "Otomatik süre sayacı aktif"
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
            text = "Akşam Kapanış Saati (SS:DD):"
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
            .setPositiveButton("Kaydet") { _, _ ->
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
                Toast.makeText(this, "${rule.appName} süresi güncellendi!", Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton("İptal", null)
            .show()
    }
}
