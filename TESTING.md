# Halkora — Test Süreci

> Prod öncesi elle test rehberi. `docs/` gitignore'da olduğu için bu dosya
> **kökte** duruyor ve repoya dahil — her cihazda `git pull` ile güncel gelir.
>
> **Nasıl kullanılır:** her turda ilgili bölümü baştan sona geç, kutucukları
> işaretle. Bulduğun her hatayı §13'teki şablonla kaydet. Bir bölüm tamamen
> temiz geçmeden bir sonrakine güvenme — özellikle §1 (kurulum) doğru
> değilse aşağıdaki her şey yanıltıcı sonuç verir.
>
> **İşaretler:** 🔴 prod'a çıkmadan MUTLAKA geçmeli · 🟡 önemli ama bloklayıcı
> değil · 📱 iki cihaz/hesap gerekir · ⏱️ birden fazla gün gerekir (start_date
> geriye alınarak kurulur — bkz. docs/TEST-CHECKLIST.md)

---

## 0. Test ortamı hazırlığı

Bunlar yanlışsa aşağıdaki tüm sonuçlar şüphelidir.

- [ ] 🔴 Build gerçek Supabase'e bağlı (Ayarlar → DEV bölümünde `uid:` bir
      değer gösteriyor, `—` değil). `—` ise build mock modda derlenmiş,
      hiçbir gerçek-mod testi geçerli değil.
- [ ] 🔴 `docs/YAPILACAKLAR.md`'deki tüm SQL dosyaları çalıştırılmış.
- [ ] 🔴 Tüm Edge Function'lar güncel deploy edilmiş:
      `notify` · `check-in` · `evening-reminder` · `delete-account`
- [ ] Dashboard → Database → Webhooks: `messages`, `nudges`, `invites`
      için hook'lar duruyor. (`check_ins` hook'u artık gereksiz — fonksiyon
      onu no-op'luyor; dursa da zararsız.)
- [ ] Test için **iki ayrı Apple hesabı / iki cihaz** hazır (📱 işaretli
      maddelerin çoğu tek cihazla doğrulanamaz).
- [ ] Çok günlü senaryolar `challenges.start_date` geriye alınarak kurulur;
      zaman hızlandırma modu kaldırıldı.

---

## 1. Kurulum / ilk açılış

- [ ] Uygulama tamamen silinip yeniden kuruluyor → açılışta boot ekranı
      (halka animasyonu) görünüyor, takılı kalmıyor.
- [ ] 🔴 Anonim giriş: "Hemen başla" ile giriliyor, onboarding açılıyor.
- [ ] 🔴 Apple ile giriş: Apple sheet açılıyor, iptal edilince uygulama
      çökmüyor / kilitlenmiyor, tekrar denenebiliyor.
- [ ] Onboarding: isim gir → altında `@kullaniciadi` önizlemesi canlı
      güncelleniyor (Türkçe karakterler doğru sadeleşiyor: "Enes Şeval" →
      `enesseval`).
- [ ] Onboarding bildirim adımı: izin sorulunca **İzin Verme** de → akış
      devam ediyor, uygulama kilitlenmiyor.
- [ ] Onboarding bitince ana ekrana düşüyor, boş durum metni görünüyor.
- [ ] Uygulamayı kapat/aç → tekrar giriş istemiyor (oturum kalıcı).

---

## 2. Halka oluşturma (create)

- [ ] Şablonlardan biriyle başla → başlık ve günlük hedef otomatik doluyor.
- [ ] Sıfırdan: başlık + günlük hedef elle yazılıyor.
- [ ] Süre seçenekleri çalışıyor; **özel gün sayısı** üst sınırı aşamıyor.
- [ ] Joker sayısı seçimi kaydediliyor (detayda "🃏 N/M" doğru görünüyor).
- [ ] Bahis metni: preset seçimi + serbest metin ikisi de kaydediliyor.
- [ ] 🔴 **Bugün başlat** → halka `active`, gün 1.
- [ ] 🔴 **Yarın başlat** → halka `upcoming`, "Yarın başlıyor" etiketi,
      check-in butonu YOK.
- [ ] 🔴 **Grup dolunca başlat (lobi)** → halka `lobby`, kurucuda "Şimdi
      başlat" / "İleri bir tarih seç" görünüyor, katılımcıda "Kurucu
      başlatacak".
- [ ] "Sadece ilk gün katılım" açık oluşturulan halkaya 2. günde katılım
      reddediliyor (📱).
- [ ] Ücretsiz hesapta 3. aktif halka oluşturulmaya çalışılınca paywall
      çıkıyor (Ayarlar → DEV → Pro kapalıyken).
- [ ] Pro açıkken sınır yok.

---

## 3. Ana ekran (home)

- [ ] Kartlar doğru kovalara ayrılıyor: bugün yapılacaklar / yapılanlar /
      yaklaşanlar.
- [ ] Aşağı çekip yenileme çalışıyor.
- [ ] Kartta halka adı, gün sayacı, ilerleme halkası doğru.
- [ ] Karta swipe → düzenleme kısayolu (kurucuysan ⚙️ ekranını açıyor).
- [ ] Tamamlanan halkalar geçmiş bölümüne düşüyor.
- [ ] İnternet kapalıyken açılış: hata durumu gösteriliyor, beyaz/boş
      ekran ya da çökme YOK. Tekrar dene çalışıyor.

---

## 4. Halka detayı + check-in

- [ ] 🔴 Check-in butonuna bas → halka segmenti anında doluyor (optimistik),
      sayaç artıyor.
- [ ] 🔴 Geri al → segment boşalıyor, sunucuda da siliniyor (uygulamayı
      kapatıp açınca geri gelmiyor).
- [ ] Aynı gün ikinci kez check-in yapılamıyor.
- [ ] ⏱️ Dün kaçırıldıysa joker teklifi geliyor; joker kullanılınca dünkü
      segment altın rengine dönüyor ve joker hakkı azalıyor.
- [ ] Joker hakkı bitince tekrar kullanılamıyor (anlamlı hata).
- [ ] Katılımcı listesi: kim check-in yapmış / yapmamış doğru.
- [ ] "Bugün yapmayanlar" satırında el sallama butonu görünüyor.
- [ ] 🔴 Kendine el sallayamıyorsun (kendi satırında buton yok).
- [ ] 📱 El salla → karşı tarafa bildirim gidiyor + sohbete sistem mesajı
      düşüyor.
- [ ] Aynı kişiye aynı gün ikinci el sallama engelleniyor (titreşim + shake).
- [ ] 🔴 Farklı bir halkada aynı kişiye el sallama AYRI hak (biri diğerini
      kilitlemiyor).
- [ ] ⏱️ Son gün herkes check-in yapınca halka otomatik bitiyor ve bitiş
      ekranına geçiyor.
- [ ] ⏱️ 🔴 Detay ekranı açıkken gün dönerse ekran kendini güncelliyor
      (çıkıp girmeye gerek yok).

---

## 5. Sohbet

- [ ] 🔴 Mesaj gönder → mesaj listede beliriyor ve **liste otomatik en alta
      kayıyor** (elle kaydırmak gerekmiyor).
- [ ] Gönderim başarısızsa (uçak modu) mesaj geri alınıyor + hata gösteriliyor.
- [ ] 📱 Karşı taraftan gelen mesaj otomatik düşüyor.
- [ ] Geçmişi yukarı kaydırmışken yeni mesaj gelirse ekran zıplamıyor,
      sağ altta "en alta in" oku çıkıyor; oka basınca en alta iniyor.
- [ ] Emoji tepkisi ekleniyor, sayaç artıyor; aynı emoji iki kez eklenmiyor.
- [ ] Sistem mesajları (el sallama, halka ayarı değişikliği) ortada, farklı
      stille görünüyor.
- [ ] Sohbet yüklenemezse hata satırı + tekrar dene çıkıyor.

---

## 6. Davet ve katılma

- [ ] Davet ekranı: link ve kod görünüyor, kopyalanıyor, paylaş sheet'i açılıyor.
- [ ] 📱 Linki ikinci cihazda aç → katılma önizlemesi (halka adı, hedef,
      katılımcılar) doğru.
- [ ] 📱 Katıl → halka ikinci hesabın ana ekranında beliriyor.
- [ ] Geçersiz/eksik kod → "bulunamadı" mesajı (çökme yok).
- [ ] 🔴 Uygulama KURULU DEĞİLKEN linke tıkla → App Store / web sayfası
      açılıyor (ölü link değil).
- [ ] 🔴 Uygulama kuruluyken linke tıkla → doğrudan uygulama açılıyor
      (Universal Link).
- [ ] Çıkış yapmışken linke tıkla → giriş sonrası davet kaybolmuyor,
      katılma ekranına dönüyor.
- [ ] 📱 `@kullaniciadi` ile davet → karşı tarafa "Halka daveti" bildirimi.
- [ ] Olmayan kullanıcı adı → anlamlı hata.

---

## 7. Bildirimler

> Her biri için: uygulama **kapalıyken** (arka planda değil, tamamen kapalı)
> test et — asıl kırılgan senaryo bu.

- [ ] 🔴 📱 Sohbet mesajı → karşı tarafa anında bildirim; başlık gönderenin
      adı, alt satır halka adı, gövde mesaj metni.
- [ ] 🔴 Ayarlar'dan "bildirimde mesaj içeriği"ni kapat → yeni mesajda
      içerik yerine "yeni bir mesaj gönderdi" yazıyor.
- [ ] 📱 El sallama → seçilen mesaj bildirimde görünüyor.
- [ ] 📱 Halka adı/hedefi değişince → gruba bildirim + sohbete sistem mesajı.
- [ ] Check-in yapınca **bildirim GİTMİYOR** (bilerek kaldırıldı).
- [ ] 🔴 Bildirime dokun → doğru halkanın detayına gidiyor (uygulama kapalıyken de).
- [ ] Davet bildirimine dokun → katılma ekranına gidiyor.
- [ ] 🔴 O halkanın detay ekranı AÇIKKEN o halkaya ait bildirim gelirse
      üstte banner ÇIKMIYOR; başka halkanınki normal çıkıyor.
- [ ] Ayarlar → bildirim izni kapalıyken uyarı/yönlendirme doğru.

---

## 8. Widget'lar (iOS 17+)

- [ ] Ayarlar → DEV → "Widget teşhis" → `probe OK · paylaşılan:N` diyor.
- [ ] **Küçük (2×2)** eklenebiliyor; halka adı, gün sayacı, halka ve pill
      doğru.
- [ ] 🔴 Uygulama TAMAMEN KAPALIYKEN widget'a dokun → check-in yapılıyor,
      uygulama açılmıyor, kart "Yapıldı ✓"ya dönüyor.
- [ ] Uygulamayı aç → check-in gerçekten kaydolmuş (detayda görünüyor).
- [ ] 🔴 Bu işlemden sonra oturum düşmüyor (tekrar giriş istemiyor).
- [ ] **Orta (4×2)**: günlük hedef, "N/M tamamladı", joker satırı doğru;
      pill'e basınca check-in, kartın kalanına basınca halka açılıyor.
- [ ] **Kilit ekranı**: dairesel (gün numarası → ✓), dikdörtgen (başlık +
      tik barı), satır içi (saat üstü) — üçü de eklenebiliyor.
- [ ] ⏱️ 🔴 Gün dönünce widget kendi kendine yeni güne geçiyor (uygulamayı
      açmadan).
- [ ] Birden fazla aktif halka → widget 15 dakikada bir sıradakine geçiyor,
      sağ üstte noktalar görünüyor.
- [ ] Widget'a uzun bas → "Widget'ı Düzenle" → halka seçilebiliyor, seçilen
      halkada sabit kalıyor.
- [ ] Hiç aktif halka yokken → "Yeni bir halka başlat" durumu, dokununca
      uygulama açılıyor.
- [ ] Uzun başlıklı halka → 2 satırda kırpılıyor, taşma yok.
- [ ] 30+ günlük halka → segmentler yerine tek yay + sayaç.

---

## 9. Bitiş ekranı ve paylaşım

- [ ] ⏱️ Halka bitince bitiş ekranı açılıyor; istatistikler (kişi, check-in,
      tamamlama %) doğru.
- [ ] Pro'ya özel gelişmiş istatistikler kilitliyken paywall'a yönlendiriyor.
- [ ] Paylaşım kartı: 4 şablon da çiziliyor, halka adı + bahis metni
      görselde görünüyor.
- [ ] Görsel paylaşılabiliyor / kaydedilebiliyor.
- [ ] "Yeniden başlat" akışı çalışıyor.

---

## 10. Bahis v2 ve rövanş

> Sıra bozulursa hiçbir şey yüklenmez: **SQL → notify deploy → build.**
> Build önce gittiyse challenge listesi hiç gelmez (yeni istemci eski DB'de
> `kind` kolonunu arıyor) — SQL'i çalıştırıp uygulamayı yeniden aç.

### Kurulum
- [ ] 🔴 `docs/db-stake-v2.sql` çalıştırıldı.
- [ ] 🔴 `supabase functions deploy notify --no-verify-jwt` yapıldı.
- [ ] Ana ekran normal yükleniyor (yüklenmiyorsa yukarıdaki sıra bozulmuş).

### Oluşturma
- [ ] Bahis adımında **Bireysel / Kolektif** seçimi görünüyor.
- [ ] Bireysel: eşik seçenekleri süreye göre değişiyor — 14 günde 3 önerili,
      **30 günde 6 seçeneği listede VAR** (sabit 0-1-2-3 değil).
- [ ] Süreyi değiştir → öneri güncelleniyor. Eşiği elle seçtikten sonra süreyi
      değiştir → **senin seçimin korunuyor**.
- [ ] Kolektif: %80 / %90 / %100 ve kendi placeholder metni.
- [ ] Bahis metni boş bırakılırsa halka bahissiz kuruluyor, hata yok.

### Sonuç hesabı ⏱️
- [ ] 🔴 Eşiği aşan kişi(ler) doğru listeleniyor.
- [ ] 🔴 Herkes eşiği geçtiyse kutlama metni çıkıyor ve **"Ödendi" butonu YOK**.
- [ ] Jokerle günü kurtaran kişi kaybeden sayılmıyor.
- [ ] 🔴 **Erken bitirme:** uzun bir halkayı 2-3. günde bitir → kalan günler
      kaçırılmış SAYILMIYOR, herkes borçlu çıkmıyor.
- [ ] 🔴 📱 **Sonradan katılan:** halka başladıktan sonra katılan biri,
      katılmadan önceki günlerden sorumlu değil.
- [ ] Kolektif: hedef fiili katılımcı sayısıyla hesaplanıyor (lobiden başlamış,
      kişi sayısı sonradan belli olmuş halkada da doğru).
- [ ] v2 ÖNCESİ bahisli tamamlanmış halka → eski davranış (sadece metin),
      buton yok, hiçbir yerde hata yok.

### Ödendi / kutlandı
- [ ] 🔴 Butona bas → kart "✓ Bahis kapandı" haline dönüyor.
- [ ] 🔴 Sohbete sistem mesajı düşüyor ve 📱 gruba push gidiyor.
- [ ] Mesaj içeriği sunucudan geliyor. *Bilinen sınırlama:* metnin dili,
      butona basan kişinin diline göre — herkes kendi dilinde görmüyor.
- [ ] İkinci kez basılamıyor.
- [ ] 📱 İki cihaz aynı anda basarsa ikincisi sessizce geçiyor, hata vermiyor.

### Rövanş
- [ ] 🔴 Bitiş ekranı → "Rövanş" → create ekranı **lobi açık** geliyor.
- [ ] Başlık, günlük hedef, süre ve bahis (tür + eşik/yüzde dahil) dolu geliyor.
- [ ] 🔴 📱 Eski halkadaki herkese **"Rövanş! 🔁"** bildirimi gidiyor —
      normal davet metni değil.
- [ ] Bildirime dokun → katılma ekranı → katılınca lobide görünüyor.
- [ ] Kurucu lobiden "Şimdi başlat" ile başlatabiliyor.
- [ ] Aynı kişiye ikinci kez rövanş daveti gönderilirse akış kırılmıyor.

---

## 11. Ayarlar ve hesap

- [ ] İsim değiştirilebiliyor; baş harfler güncelleniyor.
- [ ] Kullanıcı adı değiştirilebiliyor; rezerve isim (`admin`) ve alınmış
      isim anlamlı hata veriyor.
- [ ] 🔴 Dil değiştir (TR↔EN) → tüm ekranlar anında çeviriliyor, açıkta
      kalan Türkçe/İngilizce metin yok.
- [ ] Dil değişimi sonrası **bildirim metinleri de** yeni dilde geliyor (📱).
- [ ] Anonim hesaptan Apple hesabına bağlama → halkalar korunuyor.
- [ ] Çıkış yap → giriş ekranına dönüyor.
- [ ] 🔴 Çıkış sonrası tekrar giriş → başka hesabın verisi görünmüyor.
- [ ] 🔴 **Hesabı sil** → gerçekten siliniyor; yeni hesap açınca eski
      halkalar/veriler GÖRÜNMÜYOR.
- [ ] Hesap silme sonrası yeni hesapta bildirimler çalışıyor (push token
      yeniden kaydoluyor).
- [ ] Uygulama versiyonu doğru görünüyor.

---

## 12. Genel sağlamlık

- [ ] Uçak modunda her ekran: anlamlı hata + tekrar dene (beyaz ekran yok).
- [ ] Uygulamayı 1+ saat arka planda bırakıp aç → ilk işlem (mesaj/check-in)
      hata vermiyor (oturum tazeleniyor).
- [ ] Hızlı çift dokunma: check-in, gönder, katıl butonlarında çift kayıt
      oluşmuyor.
- [ ] Küçük ekran (iPhone SE) ve büyük ekran: taşma/kesilme yok.
- [ ] Karanlık ortamda kontrast okunaklı.
- [ ] Uzun metin girişleri (100+ karakter başlık) hiçbir ekranı bozmuyor.
- [ ] 🔴 Hiçbir ekranda çeviri anahtarı ham haliyle görünmüyor
      (`common.something` gibi).

---

## 13. Bulunan hataların kaydı

Her hata için:

```
### [Tarih] Kısa başlık
- **Nerede:** ekran/akış
- **Adımlar:** 1... 2... 3...
- **Beklenen:**
- **Olan:**
- **Cihaz/build:** iPhone __, TestFlight build __
- **Öncelik:** 🔴 / 🟡
- **Durum:** açık / düzeltildi (commit ___)
```

---

## Prod çıkış öncesi son kontrol

- [ ] 🔴 Yukarıdaki tüm 🔴 maddeler geçti.
- [ ] 🔴 Hesap silme akışı gerçek cihazda doğrulandı (App Store incelemesi
      bunu test ediyor).
- [ ] Gizlilik politikası + kullanım koşulları yayında.
- [ ] `docs/YAPILACAKLAR.md`'deki açık maddeler gözden geçirildi.
