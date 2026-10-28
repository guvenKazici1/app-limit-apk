# DinginSüre - Android Uygulama Zaman Sınırlayıcı & Kör Şifre Kilidi 🌿

**DinginSüre**, Android cihazlarda seçilen uygulamalar için günlük kullanım süresi sınırı ve akşam kapanış saati belirlemenizi sağlayan, süre dolduğunda tatlı bir emoji ve nazik uyarı göstererek uygulamayı otomatik kapatan dijital denge uygulamasıdır.

 Repository: [guvenKazici1/app-limit-apk](https://github.com/guvenKazici1/app-limit-apk)

---

## 🌟 Öne Çıkan Özellikler

- ⏱️ **Günlük Dakika Sınırı**: Her uygulama için özel kullanım süresi tanımlama (örn. Instagram 30dk, TikTok 20dk).
- 🌙 **Belirli Saatten Sonra Kapatma**: Akşam belirlediğiniz saatten sonra (örn. 22:30) uygulamaya girişi engelleme.
- 🐣 **Tatlı Emoji & Nazik Uyarı Mesajı**: Kapanış anında kullanıcıyı yormayan, pozitif ve nazik bir mesaj ekranı gösterir ve birkaç saniye içinde uygulamayı kapatır.
- 🔐 **Kör Rastgele Şifre Kasası (Blind Vault)**: Süre dolduğunda veya saat geçtiğinde, **kullanıcı dahil kimsenin bilmediği** 24 karakterli kriptografik rastgele bir şifre atanır ve yalnızca SHA-256 özeti saklanır.
- ☀️ **Sabah 09:00 Otomatik Kilit Kaldırma**: Tüm uygulamalardaki kilitler her sabah saat 09:00:00'da kendiliğinden kalkar ve arka plan sayaçları yeni gün için sıfırlanır.

---

## 🚀 GitHub Actions Otomatik APK Derleme

Bu depoda `.github/workflows/build-apk.yml` otomasyonu aktiftir. Her `git push` yaptığınızda GitHub Actions otomatik olarak Android APK dosyasını derler.

- 📥 **Son APK Çıktısını İndirin**: [GitHub Actions Artifacts](https://github.com/guvenKazici1/app-limit-apk/actions)
- 📦 **GitHub Sürümleri**: [GitHub Releases](https://github.com/guvenKazici1/app-limit-apk/releases)

---

## 🛠️ Yerel Android Studio ile Derleme

```bash
# Repoyu klonlayın
git clone https://github.com/guvenKazici1/app-limit-apk.git
cd app-limit-apk

# APK derleyin (Debug)
./gradlew assembleDebug
```

Derlenen APK dosyası `app/build/outputs/apk/debug/app-debug.apk` konumunda oluşacaktır.

---

## 📱 Android Cihaza Yükleme ve İzinler

APK cihazınıza yüklendiğinde uygulamanın tam performansla çalışması için aşağıdaki izinlerin verilmesi gerekir:
1. **Erişilebilirlik Servisi (Accessibility Service)**: Süresi dolan uygulamaları anında algılayıp kapatmak için.
2. **Diğer Uygulamaların Üstünde Gösterim (System Alert Window)**: Tatlı emoji ve nazik uyarı ekranını göstermek için.
3. **Kullanım Erişimi (Usage Access)**: Arka planda uygulama sürelerini doğru saymak için.

---

## 📄 Lisans

Apache-2.0 © [guvenKazici1](https://github.com/guvenKazici1)
