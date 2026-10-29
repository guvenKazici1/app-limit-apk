package com.dinginsure.appblocker

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.graphics.Color
import android.graphics.Typeface
import android.net.Uri
import android.os.Bundle
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

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        MorningNineUnlockReceiver.scheduleNextMorningNineAm(this)
        buildUserInterface()
    }

    override fun onResume() {
        super.onResume()
        if (::listContainer.isInitialized) {
            refreshAppList()
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
            setPadding(0, 12, 0, 32)
        }

        val permRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(0, 0, 0, 32)
        }

        val accButton = Button(this).apply {
            text = "1. Erişilebilirlik İzni Ver"
            setOnClickListener {
                startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
            }
        }

        val overlayButton = Button(this).apply {
            text = "2. Üstte Gösterim İzni"
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

        permRow.addView(accButton, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
            rightMargin = 12
        })
        permRow.addView(overlayButton, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))

        listContainer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
        }

        mainColumn.addView(titleText)
        mainColumn.addView(subtitleText)
        mainColumn.addView(permRow)
        mainColumn.addView(listContainer)

        rootScroll.addView(mainColumn)
        setContentView(rootScroll)

        refreshAppList()
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
            val usedSec = BlindPasswordVault.getUsedSecondsToday(this, pkg)
            val usedMin = usedSec / 60

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
                    isLocked -> "KİLİTLİ (09:00'da Açılır)"
                    rule.isTracked -> "Süre: ${usedMin}/${rule.dailyLimitMinutes}dk • Saat: ${rule.cutoffHour.ifEmpty { "Yok" }}"
                    else -> "Denetim Kapalı"
                }
                textSize = 13f
                setTextColor(if (isLocked) Color.parseColor("#DC2626") else Color.parseColor("#047857"))
                setPadding(0, 8, 0, 12)
            }

            val editButton = Button(this).apply {
                text = "Süre ve Saat Ayarla"
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
            text = "Bu uygulama için günlük süre sınırını aktif et"
            isChecked = rule.isTracked
        }

        val limitInput = EditText(this).apply {
            hint = "Günlük dakika sınırı (örn: 30)"
            inputType = InputType.TYPE_CLASS_NUMBER
            setText(rule.dailyLimitMinutes.toString())
        }

        val cutoffInput = EditText(this).apply {
            hint = "Akşam kapanış saati (örn: 22:30)"
            setText(rule.cutoffHour)
        }

        val emojiInput = EditText(this).apply {
            hint = "Tatlı Emoji (örn: 🌿, 🐣, ☕)"
            setText(rule.emoji)
        }

        val msgInput = EditText(this).apply {
            hint = "Nazik uyarı mesajı"
            setText(rule.politeMessage)
        }

        layout.addView(trackCheck)
        layout.addView(limitInput)
        layout.addView(cutoffInput)
        layout.addView(emojiInput)
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
                refreshAppList()
                Toast.makeText(this, "${rule.appName} ayarları kaydedildi!", Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton("İptal", null)
            .show()
    }
}
