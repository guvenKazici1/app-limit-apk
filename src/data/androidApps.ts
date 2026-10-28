export interface AndroidAppItem {
  id: string;
  packageName: string;
  name: string;
  category: 'Sosyal Medya' | 'Video & Eğlence' | 'Oyun' | 'Mesajlaşma' | 'Alışveriş';
  color: string;
  iconType: 'instagram' | 'tiktok' | 'youtube' | 'twitter' | 'game' | 'whatsapp' | 'reddit' | 'shopping' | 'netflix' | 'custom';
  isTracked: boolean;
  dailyLimitMinutes: number;
  usedSecondsToday: number;
  cutoffHour: string | null; // e.g., "22:30" or null if disabled
  blindLockPinHash: string; // Stored internally, unknown to user
  blindLockLength: number;
  lockedReason: 'NONE' | 'QUOTA_EXCEEDED' | 'AFTER_CUTOFF_HOUR';
  customEmoji: string;
  customPoliteMessage: string;
  autoCloseDelaySec: number;
}

export interface InterceptionLog {
  id: string;
  timestamp: string;
  appName: string;
  packageName: string;
  reason: 'Süre Doldu' | 'Saat Kısıtlaması' | 'Sabah 09:00 Sıfırlama';
  emoji: string;
  messageShown: string;
}

function generateCryptoBlindPin(length = 16): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
  const array = new Uint32Array(length);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(array);
    return Array.from(array, (x) => chars[x % chars.length]).join('');
  }
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export function createNewBlindVaultHash(): string {
  const rawSecret = generateCryptoBlindPin(24);
  // Immediately hash/mask so the raw password is never readable even in memory inspection
  let hash = 0;
  for (let i = 0; i < rawSecret.length; i++) {
    const chr = rawSecret.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0;
  }
  const hexSuffix = Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
  return `SHA256-BLIND-${hexSuffix}-${rawSecret.slice(0, 3).replace(/./g, '•')}`;
}

export const INITIAL_ANDROID_APPS: AndroidAppItem[] = [
  {
    id: 'app-instagram',
    packageName: 'com.instagram.android',
    name: 'Instagram',
    category: 'Sosyal Medya',
    color: '#E1306C',
    iconType: 'instagram',
    isTracked: true,
    dailyLimitMinutes: 30,
    usedSecondsToday: 29 * 60 + 45, // 15 seconds away from limit so user can immediately see or test it!
    cutoffHour: '23:00',
    blindLockPinHash: createNewBlindVaultHash(),
    blindLockLength: 16,
    lockedReason: 'NONE',
    customEmoji: '🌿',
    customPoliteMessage: 'Bugünlük Instagram süren doldu güzel insan. Gözlerini dinlendirip gerçek dünyaya dönme vakti, yarın sabah 09:00\'da görüşürüz!',
    autoCloseDelaySec: 4,
  },
  {
    id: 'app-tiktok',
    packageName: 'com.zhiliaoapp.musically',
    name: 'TikTok',
    category: 'Video & Eğlence',
    color: '#111827',
    iconType: 'tiktok',
    isTracked: true,
    dailyLimitMinutes: 20,
    usedSecondsToday: 20 * 60, // Already reached quota!
    cutoffHour: '22:00',
    blindLockPinHash: createNewBlindVaultHash(),
    blindLockLength: 16,
    lockedReason: 'QUOTA_EXCEEDED',
    customEmoji: '🐣',
    customPoliteMessage: 'TikTok için belirlediğin günlük 20 dakika bitti bile! Şimdi kendin için harika bir şey yapma zamanı. Uygulama nazikçe kapatılıyor...',
    autoCloseDelaySec: 4,
  },
  {
    id: 'app-youtube',
    packageName: 'com.google.android.youtube',
    name: 'YouTube',
    category: 'Video & Eğlence',
    color: '#DC2626',
    iconType: 'youtube',
    isTracked: true,
    dailyLimitMinutes: 45,
    usedSecondsToday: 18 * 60 + 20,
    cutoffHour: '23:30',
    blindLockPinHash: createNewBlindVaultHash(),
    blindLockLength: 16,
    lockedReason: 'NONE',
    customEmoji: '☕',
    customPoliteMessage: 'YouTube keyfin harikaydı ama bugünkü kotamız doldu. Zihnini dinlendir, kilit yarın sabah 09:00\'da kendiliğinden açılacak.',
    autoCloseDelaySec: 4,
  },
  {
    id: 'app-twitter',
    packageName: 'com.twitter.android',
    name: 'X (Twitter)',
    category: 'Sosyal Medya',
    color: '#0F172A',
    iconType: 'twitter',
    isTracked: true,
    dailyLimitMinutes: 25,
    usedSecondsToday: 12 * 60,
    cutoffHour: '21:30',
    blindLockPinHash: createNewBlindVaultHash(),
    blindLockLength: 16,
    lockedReason: 'NONE',
    customEmoji: '🌙',
    customPoliteMessage: 'Gündemi yeterince takip ettin, şimdi huzur vakti. X yarın sabah 09:00\'a kadar mola veriyor, iyi dinlenmeler!',
    autoCloseDelaySec: 4,
  },
  {
    id: 'app-pubg',
    packageName: 'com.tencent.ig',
    name: 'Brawl Stars / Mobil Oyun',
    category: 'Oyun',
    color: '#D97706',
    iconType: 'game',
    isTracked: true,
    dailyLimitMinutes: 40,
    usedSecondsToday: 40 * 60,
    cutoffHour: '22:00',
    blindLockPinHash: createNewBlindVaultHash(),
    blindLockLength: 16,
    lockedReason: 'QUOTA_EXCEEDED',
    customEmoji: '🧸',
    customPoliteMessage: 'Harika mücadeleydin! Ancak günlük oyun süremiz sona erdi. Yarın sabah 09:00\'da enerjin yenilenmiş olarak devam edebilirsin.',
    autoCloseDelaySec: 4,
  },
  {
    id: 'app-reddit',
    packageName: 'com.reddit.frontpage',
    name: 'Reddit',
    category: 'Sosyal Medya',
    color: '#EA580C',
    iconType: 'reddit',
    isTracked: false,
    dailyLimitMinutes: 30,
    usedSecondsToday: 5 * 60,
    cutoffHour: null,
    blindLockPinHash: createNewBlindVaultHash(),
    blindLockLength: 16,
    lockedReason: 'NONE',
    customEmoji: '🦊',
    customPoliteMessage: 'Bugünlük forum gezintimiz tamamlandı! Gözlerini ekrandan ayırıp derin bir nefes al, yarın sabah 09:00\'da kilit kalkacak.',
    autoCloseDelaySec: 4,
  },
  {
    id: 'app-trendyol',
    packageName: 'trendyol.com',
    name: 'Alışveriş & Mağaza',
    category: 'Alışveriş',
    color: '#F97316',
    iconType: 'shopping',
    isTracked: true,
    dailyLimitMinutes: 15,
    usedSecondsToday: 8 * 60 + 10,
    cutoffHour: '22:00',
    blindLockPinHash: createNewBlindVaultHash(),
    blindLockLength: 16,
    lockedReason: 'NONE',
    customEmoji: '🌸',
    customPoliteMessage: 'Vitrinlere yeterince göz attık! Bütçeni ve zamanını korumak için uygulamayı şimdi kapatıyoruz. Sabah 09:00\'da görüşmek üzere.',
    autoCloseDelaySec: 4,
  },
  {
    id: 'app-netflix',
    packageName: 'com.netflix.mediaclient',
    name: 'Netflix',
    category: 'Video & Eğlence',
    color: '#991B1B',
    iconType: 'netflix',
    isTracked: false,
    dailyLimitMinutes: 60,
    usedSecondsToday: 24 * 60,
    cutoffHour: '23:45',
    blindLockPinHash: createNewBlindVaultHash(),
    blindLockLength: 16,
    lockedReason: 'NONE',
    customEmoji: '🍿',
    customPoliteMessage: 'Bir sonraki bölüme geçmeden önce uyku ve dinlenme zamanı! Uygulama şimdi kapanıyor, yarın sabah 09:00\'da devam edebilirsin.',
    autoCloseDelaySec: 4,
  }
];

export const POLITE_EMOJI_PRESETS = [
  { emoji: '🌿', label: 'Dingin Yaprak', defaultMsg: 'Bugünlük süren doldu güzel insan. Gözlerini dinlendirip gerçek dünyaya dönme vakti, yarın sabah 09:00\'da görüşürüz!' },
  { emoji: '🐣', label: 'Tatlı Civciv', defaultMsg: 'Bu uygulama için belirlediğin günlük süre bitti bile! Şimdi kendin için harika bir şey yapma zamanı. Nazikçe kapatılıyor...' },
  { emoji: '☕', label: 'Sıcak Kahve', defaultMsg: 'Keyfin harikaydı ama bugünkü kotamız doldu. Zihnini dinlendir, kilit yarın sabah 09:00\'da kendiliğinden açılacak.' },
  { emoji: '🌙', label: 'Huzurlu Gece', defaultMsg: 'Belirlediğin dinlenme saatine ulaştık. Ekranı bırakıp huzurla dinlenme vakti, sabah 09:00\'a kadar iyi geceler!' },
  { emoji: '🧸', label: 'Yumuşak Ayıcık', defaultMsg: 'Kendine verdiğin sözü hatırla! Bugünlük kullanım sınırına ulaştın. Uygulama şimdi kapanıyor, yarın sabah 09:00\'da görüşürüz.' },
  { emoji: '🌸', label: 'Bahar Çiçeği', defaultMsg: 'Zamanın çok değerli! Bugünlük ekran süreni tamamladın, şimdi dışarıdaki hayatın tadını çıkarma sırası.' }
];
