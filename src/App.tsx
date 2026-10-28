import React, { useState } from 'react';
import {
  ShieldCheck,
  Clock,
  Lock,
  Unlock,
  Play,
  FastForward,
  Sunrise,
  EyeOff,
  Download,
  Code2,
  Plus,
  Copy,
  Check,
  Search,
  Sliders,
  X,
  RotateCcw,
  KeyRound,
  Smartphone,
  AlertCircle,
} from 'lucide-react';
import {
  AndroidAppItem,
  INITIAL_ANDROID_APPS,
  InterceptionLog,
  POLITE_EMOJI_PRESETS,
  createNewBlindVaultHash,
} from './data/androidApps';
import { AppIconBadge } from './components/AppIconBadge';
import { generateAndroidSourceFiles } from './utils/androidSourceGenerator';

function formatSecondsAsMinSec(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${String(mins).padStart(2, '0')}dk ${String(secs).padStart(2, '0')}sn`;
}

function isTimePastCutoff(currentSimTime: string, cutoffHour: string | null): boolean {
  if (!cutoffHour) return false;
  const [curH, curM] = currentSimTime.split(':').map(Number);
  const [cutH, cutM] = cutoffHour.split(':').map(Number);

  // Between 00:00 and 08:59 AM, night/cutoff lock remains active until 09:00 AM unlock!
  if (curH < 9) {
    return true;
  }
  if (curH > cutH) return true;
  if (curH === cutH && curM >= cutM) return true;
  return false;
}

export default function App() {
  const [apps, setApps] = useState<AndroidAppItem[]>(INITIAL_ANDROID_APPS);
  const [selectedAppId, setSelectedAppId] = useState<string>('app-instagram');
  const [activeNavSection, setActiveNavSection] = useState<'apps' | 'simulator' | 'vault' | 'apk'>('apps');

  // Simulated Android System Clock (HH:MM)
  const [simulatedClock, setSimulatedClock] = useState<string>('21:15');
  const [isBackgroundRunning, setIsBackgroundRunning] = useState<boolean>(true);
  const [activeForegroundAppId, setActiveForegroundAppId] = useState<string | null>('app-instagram');

  // Polite Emoji Interception State inside the Android Phone Screen
  const [interceptedModal, setInterceptedModal] = useState<{
    app: AndroidAppItem;
    reasonText: string;
    countdownLeft: number;
  } | null>(null);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'tracked' | 'locked'>('all');

  // Custom App Modal
  const [showAddAppModal, setShowAddAppModal] = useState<boolean>(false);
  const [newAppName, setNewAppName] = useState<string>('');
  const [newAppPkg, setNewAppPkg] = useState<string>('');
  const [newAppLimit, setNewAppLimit] = useState<number>(30);
  const [newAppCutoff, setNewAppCutoff] = useState<string>('22:30');

  // APK Export Modal / Tab State
  const [selectedCodeTab, setSelectedCodeTab] = useState<'service' | 'vault' | 'receiver' | 'manifest'>('service');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Interception Logs
  const [logs, setLogs] = useState<InterceptionLog[]>([
    {
      id: 'log-1',
      timestamp: '20:42:10',
      appName: 'TikTok',
      packageName: 'com.zhiliaoapp.musically',
      reason: 'Süre Doldu',
      emoji: '🐣',
      messageShown: 'Günlük 20dk sınırına ulaşıldı, kör şifre ile sabah 09:00\'a kadar kilitlendi.',
    },
    {
      id: 'log-2',
      timestamp: '19:15:04',
      appName: 'Brawl Stars / Mobil Oyun',
      packageName: 'com.tencent.ig',
      reason: 'Süre Doldu',
      emoji: '🧸',
      messageShown: 'Günlük 40dk sınırına ulaşıldı, kör şifre ile sabah 09:00\'a kadar kilitlendi.',
    },
  ]);

  // Trigger interception modal & auto-close timer
  const triggerPoliteInterception = (app: AndroidAppItem, reasonLabel: 'Süre Doldu' | 'Saat Kısıtlaması') => {
    setActiveForegroundAppId(null);
    setInterceptedModal({
      app,
      reasonText:
        reasonLabel === 'Süre Doldu'
          ? `Günlük ${app.dailyLimitMinutes} dakikalık kullanım süreniz doldu.`
          : `Belirlediğiniz ${app.cutoffHour} saat sınırı geçtiği için giriş engellendi.`,
      countdownLeft: app.autoCloseDelaySec,
    });

    setLogs((prev) => [
      {
        id: `log-${Date.now()}`,
        timestamp: `${simulatedClock}:00`,
        appName: app.name,
        packageName: app.packageName,
        reason: reasonLabel,
        emoji: app.customEmoji,
        messageShown: app.customPoliteMessage,
      },
      ...prev.slice(0, 14),
    ]);
  };

  // Handle countdown for the polite emoji auto-close overlay
  React.useEffect(() => {
    if (!interceptedModal) return;
    if (interceptedModal.countdownLeft <= 0) {
      setInterceptedModal(null);
      return;
    }
    const timer = setTimeout(() => {
      setInterceptedModal((prev) => (prev ? { ...prev, countdownLeft: prev.countdownLeft - 1 } : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [interceptedModal]);

  // Background 1-second real-time counter when an app is open in the simulated Android device
  React.useEffect(() => {
    if (!isBackgroundRunning || !activeForegroundAppId || interceptedModal) return;

    const interval = setInterval(() => {
      setApps((prevApps) =>
        prevApps.map((item) => {
          if (item.id !== activeForegroundAppId || !item.isTracked) return item;

          const nextSeconds = item.usedSecondsToday + 1;
          const limitSeconds = item.dailyLimitMinutes * 60;
          const pastCutoff = isTimePastCutoff(simulatedClock, item.cutoffHour);

          if (nextSeconds >= limitSeconds || pastCutoff) {
            const updatedApp: AndroidAppItem = {
              ...item,
              usedSecondsToday: Math.min(nextSeconds, limitSeconds),
              lockedReason: nextSeconds >= limitSeconds ? 'QUOTA_EXCEEDED' : 'AFTER_CUTOFF_HOUR',
              blindLockPinHash: createNewBlindVaultHash(),
            };
            // Schedule polite interception on next tick
            setTimeout(() => {
              triggerPoliteInterception(
                updatedApp,
                nextSeconds >= limitSeconds ? 'Süre Doldu' : 'Saat Kısıtlaması'
              );
            }, 0);
            return updatedApp;
          }

          return {
            ...item,
            usedSecondsToday: nextSeconds,
          };
        })
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [isBackgroundRunning, activeForegroundAppId, simulatedClock, interceptedModal]);

  // Re-evaluate cutoff locks when simulated clock changes
  const handleClockChange = (newTime: string) => {
    setSimulatedClock(newTime);
    setApps((prev) =>
      prev.map((app) => {
        if (!app.isTracked) return app;
        const quotaExceeded = app.usedSecondsToday >= app.dailyLimitMinutes * 60;
        const pastCutoff = isTimePastCutoff(newTime, app.cutoffHour);

        if (quotaExceeded) {
          return { ...app, lockedReason: 'QUOTA_EXCEEDED' };
        }
        if (pastCutoff) {
          return {
            ...app,
            lockedReason: 'AFTER_CUTOFF_HOUR',
            blindLockPinHash: createNewBlindVaultHash(),
          };
        }
        return { ...app, lockedReason: 'NONE' };
      })
    );
  };

  // Simulate Morning 09:00 AM Auto-Unlock & Reset
  const handleMorningNineAmUnlock = () => {
    setSimulatedClock('09:00');
    setInterceptedModal(null);
    setApps((prev) =>
      prev.map((app) => ({
        ...app,
        usedSecondsToday: 0,
        lockedReason: 'NONE',
        blindLockPinHash: createNewBlindVaultHash(),
      }))
    );
    setLogs((prev) => [
      {
        id: `log-${Date.now()}`,
        timestamp: '09:00:00',
        appName: 'Tüm Uygulamalar',
        packageName: 'system.morning.reset',
        reason: 'Sabah 09:00 Sıfırlama',
        emoji: '☀️',
        messageShown: 'Saat 09:00 oldu! Bilinmeyen kör şifre kilitleri kaldırıldı ve arka plan sayaçları yeni gün için sıfırlandı.',
      },
      ...prev.slice(0, 14),
    ]);
  };

  // Attempt to launch an app on the simulated Android phone
  const handleTryOpenAppOnPhone = (app: AndroidAppItem) => {
    setSelectedAppId(app.id);

    if (!app.isTracked) {
      setActiveForegroundAppId(app.id);
      setInterceptedModal(null);
      return;
    }

    const quotaExceeded = app.usedSecondsToday >= app.dailyLimitMinutes * 60;
    const pastCutoff = isTimePastCutoff(simulatedClock, app.cutoffHour);

    if (app.lockedReason !== 'NONE' || quotaExceeded || pastCutoff) {
      const reason = quotaExceeded ? 'Süre Doldu' : 'Saat Kısıtlaması';
      setApps((prev) =>
        prev.map((item) =>
          item.id === app.id
            ? {
                ...item,
                lockedReason: quotaExceeded ? 'QUOTA_EXCEEDED' : 'AFTER_CUTOFF_HOUR',
                blindLockPinHash: createNewBlindVaultHash(),
              }
            : item
        )
      );
      triggerPoliteInterception(app, reason);
      return;
    }

    // Otherwise open normally and let the background counter run
    setInterceptedModal(null);
    setActiveForegroundAppId(app.id);
  };

  // Fast-forward active app usage to 3 seconds before limit (for instant testing)
  const handleFastForwardToLimit = (app: AndroidAppItem) => {
    const targetSec = Math.max(0, app.dailyLimitMinutes * 60 - 3);
    setApps((prev) =>
      prev.map((item) =>
        item.id === app.id
          ? {
              ...item,
              isTracked: true,
              usedSecondsToday: targetSec,
              lockedReason: 'NONE',
            }
          : item
      )
    );
    setInterceptedModal(null);
    setActiveForegroundAppId(app.id);
  };

  // Immediately expire an app's quota and show polite emoji popup
  const handleSimulateImmediateExpire = (app: AndroidAppItem) => {
    const expiredApp: AndroidAppItem = {
      ...app,
      isTracked: true,
      usedSecondsToday: app.dailyLimitMinutes * 60,
      lockedReason: 'QUOTA_EXCEEDED',
      blindLockPinHash: createNewBlindVaultHash(),
    };
    setApps((prev) => prev.map((item) => (item.id === app.id ? expiredApp : item)));
    triggerPoliteInterception(expiredApp, 'Süre Doldu');
  };

  const updateSelectedApp = (patch: Partial<AndroidAppItem>) => {
    setApps((prev) =>
      prev.map((item) => {
        if (item.id !== selectedAppId) return item;
        const updated = { ...item, ...patch };
        const quotaExceeded = updated.usedSecondsToday >= updated.dailyLimitMinutes * 60;
        const pastCutoff = isTimePastCutoff(simulatedClock, updated.cutoffHour);
        if (!updated.isTracked) {
          updated.lockedReason = 'NONE';
        } else if (quotaExceeded) {
          updated.lockedReason = 'QUOTA_EXCEEDED';
        } else if (pastCutoff) {
          updated.lockedReason = 'AFTER_CUTOFF_HOUR';
        } else {
          updated.lockedReason = 'NONE';
        }
        return updated;
      })
    );
  };

  const handleAddCustomApp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAppName.trim()) return;
    const pkg =
      newAppPkg.trim() ||
      `com.android.${newAppName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 14)}`;

    const created: AndroidAppItem = {
      id: `app-custom-${Date.now()}`,
      packageName: pkg,
      name: newAppName.trim(),
      category: 'Sosyal Medya',
      color: '#0D9488',
      iconType: 'custom',
      isTracked: true,
      dailyLimitMinutes: Math.max(1, Number(newAppLimit) || 30),
      usedSecondsToday: 0,
      cutoffHour: newAppCutoff || '22:30',
      blindLockPinHash: createNewBlindVaultHash(),
      blindLockLength: 16,
      lockedReason: 'NONE',
      customEmoji: '🌿',
      customPoliteMessage: `Bugünlük ${newAppName.trim()} süren doldu! Gözlerini dinlendirip gerçek dünyaya dönme vakti, yarın sabah 09:00'da kilit kendiliğinden açılacak.`,
      autoCloseDelaySec: 4,
    };

    setApps((prev) => [created, ...prev]);
    setSelectedAppId(created.id);
    setNewAppName('');
    setNewAppPkg('');
    setShowAddAppModal(false);
  };

  const handleDownloadAndroidBundle = () => {
    const files = generateAndroidSourceFiles(apps);
    const fullBundle = `====================================================================
DİNGİNSÜRE - ANDROID STUDIO PROJE PAKETİ (KOTLIN & MANIFEST)
Oluşturulma Tarihi: ${new Date().toLocaleString('tr-TR')}
====================================================================

[1] app/src/main/AndroidManifest.xml
--------------------------------------------------------------------
${files.manifestXml}

====================================================================
[2] app/src/main/java/com/dinginsure/appblocker/security/BlindPasswordVault.kt
--------------------------------------------------------------------
${files.blindPasswordVaultKt}

====================================================================
[3] app/src/main/java/com/dinginsure/appblocker/AppInterceptorAccessibilityService.kt
--------------------------------------------------------------------
${files.interceptorServiceKt}

====================================================================
[4] app/src/main/java/com/dinginsure/appblocker/MorningNineUnlockReceiver.kt
--------------------------------------------------------------------
${files.morningReceiverKt}

====================================================================
[5] Yapılandırılan Uygulama Kuralları (JSON Özeti)
--------------------------------------------------------------------
${files.rulesJsonString}
`;

    const blob = new Blob([fullBundle], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'DinginSure_Android_APK_Kaynak_Projesi.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const selectedApp = apps.find((a) => a.id === selectedAppId) || apps[0];
  const activeForegroundApp = apps.find((a) => a.id === activeForegroundAppId) || null;

  const filteredApps = apps.filter((app) => {
    const matchesSearch =
      app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.packageName.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (statusFilter === 'tracked') return app.isTracked;
    if (statusFilter === 'locked') return app.isTracked && app.lockedReason !== 'NONE';
    return true;
  });

  const trackedCount = apps.filter((a) => a.isTracked).length;
  const lockedCount = apps.filter((a) => a.isTracked && a.lockedReason !== 'NONE').length;
  const totalUsedMinutesToday = Math.round(
    apps.reduce((acc, a) => acc + (a.isTracked ? a.usedSecondsToday : 0), 0) / 60
  );

  const generatedAndroidCode = generateAndroidSourceFiles(apps);

  const currentCodeString =
    selectedCodeTab === 'service'
      ? generatedAndroidCode.interceptorServiceKt
      : selectedCodeTab === 'vault'
      ? generatedAndroidCode.blindPasswordVaultKt
      : selectedCodeTab === 'receiver'
      ? generatedAndroidCode.morningReceiverKt
      : generatedAndroidCode.manifestXml;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(currentCodeString);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-slate-900">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-8">
          {/* Zone 1: Brand Title, single text element */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveNavSection('apps');
            }}
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            DinginSüre
          </a>

          {/* Zone 2: 4 concise single-line navigation links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <button
              onClick={() => setActiveNavSection('apps')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeNavSection === 'apps' ? 'text-slate-900 underline underline-offset-8 decoration-2 decoration-emerald-600' : ''
              }`}
            >
              Uygulama Süreleri
            </button>
            <button
              onClick={() => setActiveNavSection('simulator')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeNavSection === 'simulator' ? 'text-slate-900 underline underline-offset-8 decoration-2 decoration-emerald-600' : ''
              }`}
            >
              Canlı Telefon Testi
            </button>
            <button
              onClick={() => setActiveNavSection('vault')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeNavSection === 'vault' ? 'text-slate-900 underline underline-offset-8 decoration-2 decoration-emerald-600' : ''
              }`}
            >
              Kör Şifre & 09:00 Döngüsü
            </button>
            <button
              onClick={() => setActiveNavSection('apk')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeNavSection === 'apk' ? 'text-slate-900 underline underline-offset-8 decoration-2 decoration-emerald-600' : ''
              }`}
            >
              Android APK Kodları
            </button>
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="flex items-center shrink-0">
            <button
              onClick={handleDownloadAndroidBundle}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2"
            >
              <Download className="w-3.5 h-3.5" />
              Android APK Projesini İndir
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Top System Overview Bar & Time Cycle Controller */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight text-balance">
              Android Günlük Uygulama Sınırı, Kör Şifre ve Sabah 09:00 Otomatik Kilit Sistemi
            </h1>
            <p className="text-sm text-slate-600 max-w-3xl">
              Uygulamalarınız için günlük süre veya akşam kapanış saati belirleyin. Süre dolduğunda kullanıcıya tatlı bir emoji ile nazik uyarı gösterilir, uygulama anında kapatılır ve <strong>kullanıcının bilmediği rastgele şifreyle</strong> ertesi sabah <strong>09:00&apos;a kadar</strong> kilitlenir.
            </p>
          </div>

          {/* Interactive System Clock & 09:00 AM Reset Controls */}
          <div className="flex flex-wrap items-center gap-3 shrink-0 bg-slate-50 border border-slate-200 rounded-xl p-3">
            <div className="pr-3 border-r border-slate-200">
              <div className="text-[11px] font-medium text-slate-500">Telefon Sistem Saati</div>
              <div className="flex items-center gap-2 mt-0.5">
                <Clock className="w-4 h-4 text-emerald-700" />
                <input
                  type="time"
                  value={simulatedClock}
                  onChange={(e) => handleClockChange(e.target.value)}
                  aria-label="Simüle Edilen Telefon Saati"
                  className="font-mono text-base font-semibold text-slate-900 bg-white border border-slate-200 rounded-md px-2 py-0.5 tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleClockChange('23:15')}
                className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                title="Gece saat sınırını test etmek için saati 23:15 yap"
              >
                Gece 23:15 Testi
              </button>
              <button
                onClick={handleMorningNineAmUnlock}
                className="px-3.5 py-2 text-xs font-semibold text-emerald-950 bg-amber-300 hover:bg-amber-400 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5"
                title="Ertesi sabah saat 09:00'a geç ve tüm kilitleri otomatik kaldır"
              >
                <Sunrise className="w-4 h-4" />
                Sabah 09:00 Kilidi Aç
              </button>
            </div>
          </div>
        </section>

        {/* Key Quantitative Metrics Strip (No Pills, Tabular Numerals) */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs text-slate-500">Denetlenen Uygulamalar</div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                {trackedCount} / {apps.length}
              </span>
              <span className="text-xs text-slate-500">Arka plan sayacı aktif</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs text-slate-500">Şu An Kilitli Uygulamalar</div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-bold font-mono tabular-nums text-rose-600">
                {lockedCount} Uygulama
              </span>
              <span className="text-xs text-slate-500">Kör şifre korumalı</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs text-slate-500">Bugünkü Toplam Ekran Süresi</div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                {totalUsedMinutesToday} dk
              </span>
              <span className="text-xs text-slate-500">Canlı arka plan takibi</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs text-slate-500">Otomatik Kilit Açılış Saati</div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-bold font-mono tabular-nums text-emerald-700">
                09:00
              </span>
              <span className="text-xs text-slate-500">Her sabah döngü sıfırlanır</span>
            </div>
          </div>
        </section>

        {/* Main 12-Column Split Workspace: Left Android Live Simulator (5 cols) + Right Configuration & Code (7 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: Interactive Android APK Device Simulator */}
          <div className="lg:col-span-5 flex flex-col items-center">
            <div className="w-full bg-white border border-slate-200 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Canlı Android APK Simülatörü
                  </h2>
                  <p className="text-xs text-slate-500">
                    Uygulamalara dokunarak süre sayacını ve tatlı emojiyle otomatik kapanışı test edin
                  </p>
                </div>
                <button
                  onClick={() => setIsBackgroundRunning((prev) => !prev)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isBackgroundRunning
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  {isBackgroundRunning ? 'Sayaç Çalışıyor' : 'Sayaç Duraklatıldı'}
                </button>
              </div>

              {/* Android Phone Hardware Frame */}
              <div className="mx-auto w-full max-w-[380px] bg-slate-950 rounded-[36px] p-3 shadow-xl border-4 border-slate-800">
                <div className="bg-slate-900 text-white rounded-[26px] overflow-hidden min-h-[620px] flex flex-col justify-between relative">
                  {/* Android Status Bar */}
                  <div className="px-5 py-2.5 bg-slate-950/80 flex items-center justify-between text-xs font-mono tabular-nums text-slate-300 border-b border-slate-800">
                    <span className="font-semibold text-white">{simulatedClock}</span>
                    <div className="flex items-center gap-2 text-[11px]">
                      <span>DinginSüre Koruma Aktif</span>
                      <span>·</span>
                      <span>100%</span>
                    </div>
                  </div>

                  {/* Phone Screen Body */}
                  <div className="flex-1 p-4 flex flex-col justify-between relative">
                    {/* Currently Running Foreground App Banner */}
                    {activeForegroundApp && !interceptedModal ? (
                      <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-3.5 mb-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <AppIconBadge
                              iconType={activeForegroundApp.iconType}
                              color={activeForegroundApp.color}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-white truncate">
                                {activeForegroundApp.name} Açık
                              </div>
                              <div className="text-[11px] text-emerald-400 font-mono tabular-nums">
                                Sayaç: {formatSecondsAsMinSec(activeForegroundApp.usedSecondsToday)} /{' '}
                                {activeForegroundApp.dailyLimitMinutes}dk
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => handleFastForwardToLimit(activeForegroundApp)}
                              className="px-2.5 py-1.5 text-[11px] font-medium bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 rounded-lg transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1"
                              title="Süreyi bitime 3 saniye kalaya sar"
                            >
                              <FastForward className="w-3 h-3" />
                              Son 3sn
                            </button>
                            <button
                              onClick={() => handleSimulateImmediateExpire(activeForegroundApp)}
                              className="px-2.5 py-1.5 text-[11px] font-medium bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                              title="Süreyi hemen doldur ve nazik kapanışı gör"
                            >
                              Bitir
                            </button>
                          </div>
                        </div>

                        {/* Live Progress Bar inside Phone */}
                        <div className="mt-2.5 w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-400 h-full transition-transform duration-150 origin-left"
                            style={{
                              transform: `scaleX(${Math.min(
                                1,
                                activeForegroundApp.usedSecondsToday /
                                  (activeForegroundApp.dailyLimitMinutes * 60)
                              )})`,
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-800/50 border border-slate-800 rounded-2xl p-3 mb-3 text-center">
                        <p className="text-xs text-slate-300">
                          Ana Ekran · Açmak veya test etmek istediğiniz uygulamaya dokunun
                        </p>
                      </div>
                    )}

                    {/* Installed Apps Grid on Phone */}
                    <div className="my-auto">
                      <div className="text-[11px] font-medium text-slate-400 mb-2.5 px-1 flex items-center justify-between">
                        <span>Telefonumdaki Uygulamalar</span>
                        <span>Sabah 09:00 Sıfırlama</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        {apps.slice(0, 8).map((app) => {
                          const isLocked =
                            app.isTracked &&
                            (app.lockedReason !== 'NONE' ||
                              app.usedSecondsToday >= app.dailyLimitMinutes * 60 ||
                              isTimePastCutoff(simulatedClock, app.cutoffHour));
                          const isRunning = activeForegroundAppId === app.id && !interceptedModal;

                          return (
                            <button
                              key={app.id}
                              onClick={() => handleTryOpenAppOnPhone(app)}
                              className={`p-3 rounded-2xl border text-left transition-colors cursor-pointer flex flex-col justify-between min-h-[92px] ${
                                isRunning
                                  ? 'bg-slate-800 border-emerald-500/70'
                                  : isLocked
                                  ? 'bg-rose-950/30 border-rose-800/60 hover:bg-rose-950/50'
                                  : 'bg-slate-800/60 border-slate-700/70 hover:bg-slate-800'
                              }`}
                            >
                              <div className="flex items-start justify-between w-full gap-2">
                                <AppIconBadge iconType={app.iconType} color={app.color} size="sm" />
                                {isLocked ? (
                                  <Lock className="w-4 h-4 text-rose-400 shrink-0" />
                                ) : app.isTracked ? (
                                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                                ) : null}
                              </div>
                              <div className="mt-2">
                                <div className="text-xs font-semibold text-white truncate">
                                  {app.name}
                                </div>
                                <div className="text-[11px] text-slate-400 font-mono tabular-nums mt-0.5">
                                  {isLocked
                                    ? 'Kilitli (09:00\'da açılır)'
                                    : app.isTracked
                                    ? `${Math.floor(app.usedSecondsToday / 60)}/${app.dailyLimitMinutes}dk`
                                    : 'Sınırsız'}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Bottom Hint inside Phone */}
                    <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Kör Şifre Kasası: Aktif</span>
                      <button
                        onClick={() => setActiveForegroundAppId(null)}
                        className="text-slate-300 hover:text-white underline cursor-pointer"
                      >
                        Ana Ekrana Dön
                      </button>
                    </div>

                    {/* POLITE EMOJI INTERCEPTION OVERLAY (Full-screen inside the Android Phone when locked/expired) */}
                    {interceptedModal && (
                      <div className="absolute inset-0 z-20 bg-slate-950/95 backdrop-blur-md p-6 flex flex-col items-center justify-center text-center animate-fade-in">
                        <div className="text-6xl mb-4 select-none">
                          {interceptedModal.app.customEmoji}
                        </div>

                        <h3 className="text-lg font-bold text-white tracking-tight">
                          {interceptedModal.app.name} Dinlenme Modunda
                        </h3>

                        <p className="text-xs text-amber-300 mt-1 font-medium">
                          {interceptedModal.reasonText}
                        </p>

                        <div className="mt-4 bg-slate-900 border border-slate-800 rounded-2xl p-4 text-sm text-slate-200 leading-relaxed">
                          &ldquo;{interceptedModal.app.customPoliteMessage}&rdquo;
                        </div>

                        {/* Blind Random Password Notice */}
                        <div className="mt-4 w-full bg-slate-900/90 border border-slate-800 rounded-xl p-3 text-left space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] text-slate-400">
                            <span className="flex items-center gap-1 text-emerald-400 font-medium">
                              <EyeOff className="w-3.5 h-3.5" />
                              Kör Rastgele Şifre Atandı
                            </span>
                            <span className="font-mono tabular-nums">Sabah 09:00&apos;da Kalkar</span>
                          </div>
                          <div className="font-mono text-xs text-slate-300 bg-slate-950 px-2.5 py-1.5 rounded border border-slate-800 truncate">
                            {interceptedModal.app.blindLockPinHash}
                          </div>
                          <p className="text-[11px] text-slate-400">
                            Bu şifreyi siz dahil kimse bilmiyor. Uygulama şimdi otomatik kapatılıyor...
                          </p>
                        </div>

                        <div className="mt-5 w-full flex flex-col gap-2">
                          <div className="text-xs font-mono tabular-nums text-slate-300">
                            Uygulama <span className="text-amber-400 font-bold">{interceptedModal.countdownLeft}</span> saniye içinde tamamen kapanıyor...
                          </div>
                          <button
                            onClick={() => setInterceptedModal(null)}
                            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                          >
                            Tamam, Şimdi Kapat ve Ana Ekrana Dön
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Android Home Indicator Bar */}
                  <div className="py-2 bg-slate-950 flex justify-center">
                    <div className="w-28 h-1 bg-slate-700 rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: App Configuration, Blind Vault & Android APK Code Generator */}
          <div className="lg:col-span-7 space-y-6">
            {/* Mode Switch Tabs for Right Panel */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-2">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setActiveNavSection('apps')}
                  className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeNavSection === 'apps' || activeNavSection === 'simulator'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Uygulama Seçimi & Süre Ayarları
                </button>
                <button
                  onClick={() => setActiveNavSection('vault')}
                  className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeNavSection === 'vault'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Kör Şifre Kasası & Kayıtlar
                </button>
                <button
                  onClick={() => setActiveNavSection('apk')}
                  className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeNavSection === 'apk'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Android Studio / APK Kodu
                </button>
              </div>

              <button
                onClick={() => setShowAddAppModal(true)}
                className="px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Yeni Uygulama Ekle
              </button>
            </div>

            {/* TAB 1: APP SELECTION & RULE EDITOR */}
            {(activeNavSection === 'apps' || activeNavSection === 'simulator') && (
              <>
                {/* Selected App Rule Inspector */}
                {selectedApp && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                      <div className="flex items-center gap-3.5">
                        <AppIconBadge
                          iconType={selectedApp.iconType}
                          color={selectedApp.color}
                          size="lg"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-lg font-bold text-slate-900">
                              {selectedApp.name}
                            </h2>
                            <span className="text-xs text-slate-400">·</span>
                            <span className="text-xs text-slate-500 font-mono">
                              {selectedApp.packageName}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                            <span>{selectedApp.category}</span>
                            <span>·</span>
                            <span className="font-mono tabular-nums">
                              Bugün kullanılan: {formatSecondsAsMinSec(selectedApp.usedSecondsToday)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleSimulateImmediateExpire(selectedApp)}
                          className="px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Süreyi Doldur & Uyarıyı Gör
                        </button>
                        <button
                          onClick={() =>
                            updateSelectedApp({ isTracked: !selectedApp.isTracked })
                          }
                          className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            selectedApp.isTracked
                              ? 'bg-emerald-700 text-white hover:bg-emerald-800'
                              : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                          }`}
                        >
                          {selectedApp.isTracked ? 'Süre Sınırı Aktif' : 'Denetim Kapalı'}
                        </button>
                      </div>
                    </div>

                    {/* Controls Grid: Daily Time Limit & Cutoff Hour */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-slate-700">
                            Günlük Kullanım Süresi Sınırı
                          </label>
                          <span className="text-sm font-bold font-mono tabular-nums text-emerald-700">
                            {selectedApp.dailyLimitMinutes} dakika / gün
                          </span>
                        </div>
                        <input
                          type="range"
                          min={5}
                          max={180}
                          step={5}
                          value={selectedApp.dailyLimitMinutes}
                          onChange={(e) =>
                            updateSelectedApp({
                              dailyLimitMinutes: Number(e.target.value),
                              isTracked: true,
                            })
                          }
                          className="w-full accent-emerald-700 cursor-pointer"
                        />
                        <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono tabular-nums">
                          <span>5 dk</span>
                          <span>30 dk</span>
                          <span>60 dk</span>
                          <span>120 dk</span>
                          <span>180 dk</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-slate-700">
                            Belirli Saatten Sonra Girişi Kapat
                          </label>
                          <button
                            onClick={() =>
                              updateSelectedApp({
                                cutoffHour: selectedApp.cutoffHour ? null : '22:00',
                              })
                            }
                            className="text-xs font-medium text-emerald-700 hover:underline cursor-pointer"
                          >
                            {selectedApp.cutoffHour ? 'Saat Sınırını Kaldır' : 'Saat Sınırı Ekle'}
                          </button>
                        </div>
                        <div className="flex items-center gap-3">
                          <input
                            type="time"
                            disabled={!selectedApp.cutoffHour}
                            value={selectedApp.cutoffHour || '22:00'}
                            onChange={(e) =>
                              updateSelectedApp({
                                cutoffHour: e.target.value,
                                isTracked: true,
                              })
                            }
                            className="font-mono text-sm font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 tabular-nums disabled:opacity-50"
                          />
                          <p className="text-xs text-slate-500">
                            {selectedApp.cutoffHour
                              ? `Saat ${selectedApp.cutoffHour} olduğunda süre bitmese bile sabah 09:00'a kadar kilitlenir.`
                              : 'Belirli bir akşam saati kısıtlaması seçilmedi.'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Sweet Emoji & Polite Message Customizer */}
                    <div className="pt-4 border-t border-slate-100 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-700">
                          Süre Dolduğunda Çıkacak Tatlı Emoji ve Nazik Uyarı Mesajı
                        </label>
                        <span className="text-xs text-slate-500">
                          Uyarıdan {selectedApp.autoCloseDelaySec} sn sonra uygulama tamamen kapanır
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {POLITE_EMOJI_PRESETS.map((preset) => (
                          <button
                            key={preset.emoji}
                            type="button"
                            onClick={() =>
                              updateSelectedApp({
                                customEmoji: preset.emoji,
                                customPoliteMessage: preset.defaultMsg,
                              })
                            }
                            className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                              selectedApp.customEmoji === preset.emoji
                                ? 'bg-emerald-50 border-emerald-600 text-emerald-950'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <span className="text-base">{preset.emoji}</span>
                            <span>{preset.label}</span>
                          </button>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                        <div className="sm:col-span-9">
                          <textarea
                            rows={2}
                            value={selectedApp.customPoliteMessage}
                            onChange={(e) =>
                              updateSelectedApp({ customPoliteMessage: e.target.value })
                            }
                            className="w-full text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                            placeholder="Nazik kapanış mesajınızı yazın..."
                          />
                        </div>
                        <div className="sm:col-span-3 bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col justify-between">
                          <div className="text-[11px] font-medium text-slate-500">
                            Kör Şifre Durumu
                          </div>
                          <div className="text-xs font-mono text-slate-800 truncate">
                            {selectedApp.blindLockPinHash}
                          </div>
                          <div className="text-[10px] text-emerald-700 font-medium">
                            Kullanıcı bilmez · 09:00&apos;da açılır
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* All Installed Phone Apps List */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        Telefondaki Uygulamalar ({filteredApps.length})
                      </h3>
                      <p className="text-xs text-slate-500">
                        Bir uygulamaya tıklayarak günlük süre sınırını, kapanış saatini veya nazik mesajını düzenleyin
                      </p>
                    </div>

                    {/* Interactive Filter Controls */}
                    <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0">
                      <button
                        onClick={() => setStatusFilter('all')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          statusFilter === 'all'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Tümü
                      </button>
                      <button
                        onClick={() => setStatusFilter('tracked')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          statusFilter === 'tracked'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Denetlenenler
                      </button>
                      <button
                        onClick={() => setStatusFilter('locked')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          statusFilter === 'locked'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Şu An Kilitli ({lockedCount})
                      </button>
                    </div>
                  </div>

                  {/* Search Input */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Uygulama adı veya paket adı ara (örn: Instagram, TikTok)..."
                      className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>

                  {/* App List Rows */}
                  <div className="divide-y divide-slate-100">
                    {filteredApps.map((app) => {
                      const isSelected = app.id === selectedAppId;
                      const isLocked =
                        app.isTracked &&
                        (app.lockedReason !== 'NONE' ||
                          app.usedSecondsToday >= app.dailyLimitMinutes * 60 ||
                          isTimePastCutoff(simulatedClock, app.cutoffHour));

                      return (
                        <div
                          key={app.id}
                          onClick={() => setSelectedAppId(app.id)}
                          className={`py-3 px-3 -mx-3 rounded-xl transition-colors cursor-pointer flex items-center justify-between gap-4 ${
                            isSelected ? 'bg-emerald-50/70' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <AppIconBadge
                              iconType={app.iconType}
                              color={app.color}
                              size="md"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-slate-900 truncate">
                                  {app.name}
                                </span>
                                <span className="text-xs">{app.customEmoji}</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                                <span>{app.category}</span>
                                <span>·</span>
                                <span className="font-mono tabular-nums">
                                  {formatSecondsAsMinSec(app.usedSecondsToday)} /{' '}
                                  {app.dailyLimitMinutes}dk
                                </span>
                                {app.cutoffHour && (
                                  <>
                                    <span>·</span>
                                    <span className="font-mono tabular-nums">
                                      Kapanış: {app.cutoffHour}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right hidden sm:block">
                              <div
                                className={`text-xs font-semibold ${
                                  isLocked
                                    ? 'text-rose-600'
                                    : app.isTracked
                                    ? 'text-emerald-700'
                                    : 'text-slate-400'
                                }`}
                              >
                                {isLocked
                                  ? 'Kör Şifreyle Kilitli (09:00\'da Açılır)'
                                  : app.isTracked
                                  ? 'Arka Plan Sayacı Aktif'
                                  : 'Sınırsız'}
                              </div>
                              <div className="text-[11px] font-mono text-slate-400">
                                {app.blindLockPinHash.slice(0, 21)}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTryOpenAppOnPhone(app);
                              }}
                              className="px-3 py-1.5 text-xs font-medium bg-slate-900 text-white hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              Telefonda Aç
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* TAB 2: BLIND PASSWORD VAULT & 09:00 AM CYCLE LOGS */}
            {activeNavSection === 'vault' && (
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-5">
                <div className="border-b border-slate-100 pb-4">
                  <h2 className="text-lg font-bold text-slate-900">
                    Kör Şifre Kasası (Kullanıcının Bilmediği Rastgele Kilit) & 09:00 Döngüsü
                  </h2>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    İrade zayıflığını önlemek için DinginSüre, süresi dolan veya saat sınırı geçen her uygulamaya 24 karakterli kriptografik rastgele bir şifre atar ve şifrenin kendisini silip yalnızca SHA-256 özetini saklar. Kullanıcı şifreyi bilmediği için kilidi açamaz; kilit yalnızca ertesi sabah <strong>saat 09:00&apos;da</strong> otomatik olarak kalkar.
                  </p>
                </div>

                {/* Blind Vault Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                        <th className="py-2.5 pr-3">Uygulama</th>
                        <th className="py-2.5 px-3">Kör Şifre Özeti (Kullanıcıya Gizli)</th>
                        <th className="py-2.5 px-3">Kilit Durumu</th>
                        <th className="py-2.5 pl-3 text-right">Sabah Açılış</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {apps
                        .filter((a) => a.isTracked)
                        .map((app) => {
                          const isLocked =
                            app.lockedReason !== 'NONE' ||
                            app.usedSecondsToday >= app.dailyLimitMinutes * 60 ||
                            isTimePastCutoff(simulatedClock, app.cutoffHour);
                          return (
                            <tr key={app.id} className="hover:bg-slate-50">
                              <td className="py-3 pr-3 font-semibold text-slate-900">
                                {app.name}
                              </td>
                              <td className="py-3 px-3 font-mono text-slate-600 tabular-nums">
                                {app.blindLockPinHash}
                              </td>
                              <td className="py-3 px-3">
                                <span
                                  className={`font-medium ${
                                    isLocked ? 'text-rose-600' : 'text-emerald-700'
                                  }`}
                                >
                                  {isLocked ? 'Kilitli (Giriş Kapalı)' : 'Açık (Sayaç İşliyor)'}
                                </span>
                              </td>
                              <td className="py-3 pl-3 text-right font-mono tabular-nums text-slate-700">
                                Yarın 09:00
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>

                {/* Recent Interception Logs */}
                <div className="pt-4 border-t border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900">
                      Son Kilitlenme ve Sabah 09:00 Sıfırlama Kayıtları
                    </h3>
                    <button
                      onClick={handleMorningNineAmUnlock}
                      className="text-xs font-semibold text-emerald-700 hover:underline cursor-pointer"
                    >
                      Şimdi Sabah 09:00 Sıfırlamasını Tetikle
                    </button>
                  </div>
                  <div className="space-y-2">
                    {logs.map((log) => (
                      <div
                        key={log.id}
                        className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start justify-between gap-3 text-xs"
                      >
                        <div className="flex items-start gap-2.5">
                          <span className="text-lg leading-none">{log.emoji}</span>
                          <div>
                            <div className="font-semibold text-slate-900">
                              {log.appName} · <span className="text-slate-500 font-normal">{log.reason}</span>
                            </div>
                            <p className="text-slate-600 mt-0.5">{log.messageShown}</p>
                          </div>
                        </div>
                        <span className="font-mono tabular-nums text-slate-400 shrink-0">
                          {log.timestamp}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: ANDROID STUDIO KOTLIN & APK SOURCE EXPORT */}
            {activeNavSection === 'apk' && (
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Android APK Kaynak Kodları (Kotlin + AccessibilityService + AlarmManager)
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Belirlediğiniz uygulama süreleri ve nazik emoji mesajları aşağıdaki Android kodlarına otomatik işlenmiştir.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={handleCopyCode}
                      className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5"
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedCode ? 'Kopyalandı' : 'Kodu Kopyala'}
                    </button>
                    <button
                      onClick={handleDownloadAndroidBundle}
                      className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Tüm Proje Dosyalarını İndir
                    </button>
                  </div>
                </div>

                {/* File Selector Tabs */}
                <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
                  <button
                    onClick={() => setSelectedCodeTab('service')}
                    className={`px-3 py-1.5 text-xs font-mono rounded-lg transition-colors cursor-pointer ${
                      selectedCodeTab === 'service'
                        ? 'bg-white text-slate-900 font-semibold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    AppInterceptorAccessibilityService.kt
                  </button>
                  <button
                    onClick={() => setSelectedCodeTab('vault')}
                    className={`px-3 py-1.5 text-xs font-mono rounded-lg transition-colors cursor-pointer ${
                      selectedCodeTab === 'vault'
                        ? 'bg-white text-slate-900 font-semibold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    BlindPasswordVault.kt
                  </button>
                  <button
                    onClick={() => setSelectedCodeTab('receiver')}
                    className={`px-3 py-1.5 text-xs font-mono rounded-lg transition-colors cursor-pointer ${
                      selectedCodeTab === 'receiver'
                        ? 'bg-white text-slate-900 font-semibold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    MorningNineUnlockReceiver.kt
                  </button>
                  <button
                    onClick={() => setSelectedCodeTab('manifest')}
                    className={`px-3 py-1.5 text-xs font-mono rounded-lg transition-colors cursor-pointer ${
                      selectedCodeTab === 'manifest'
                        ? 'bg-white text-slate-900 font-semibold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    AndroidManifest.xml
                  </button>
                </div>

                <pre className="bg-slate-950 text-slate-100 font-mono text-xs p-4 rounded-xl overflow-x-auto max-h-[420px] leading-relaxed">
                  <code>{currentCodeString}</code>
                </pre>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Add Custom Phone App Modal */}
      {showAddAppModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                Telefonunuzdaki Bir Uygulamayı Ekleyin
              </h3>
              <button
                onClick={() => setShowAddAppModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCustomApp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Uygulama Adı
                </label>
                <input
                  type="text"
                  required
                  value={newAppName}
                  onChange={(e) => setNewAppName(e.target.value)}
                  placeholder="Örn: Clash Royale, Snapchat, Pinterest"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Android Paket Adı (İsteğe Bağlı)
                </label>
                <input
                  type="text"
                  value={newAppPkg}
                  onChange={(e) => setNewAppPkg(e.target.value)}
                  placeholder="Örn: com.supercell.clashroyale"
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Günlük Süre (Dakika)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={300}
                    value={newAppLimit}
                    onChange={(e) => setNewAppLimit(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kapanış Saati
                  </label>
                  <input
                    type="time"
                    value={newAppCutoff}
                    onChange={(e) => setNewAppCutoff(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddAppModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl cursor-pointer"
                >
                  Uygulamayı Ekle ve Koru
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
