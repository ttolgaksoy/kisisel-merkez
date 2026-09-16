# Kişisel Merkez

Tek kişi için hazırlanmış, iPhone ana ekranına kurulabilen kişisel planlama uygulaması.

## İçerik

- Günlük öncelikler ve görevler
- Aylık takvim
- Detaylı spor programı, hareket listesi ve tek tek tamamlama takibi
- Manuel uyku kaydı, süre ve enerji ortalaması
- Gelir, ekstra para ve yatırım getirisi kayıtları
- Aylık gelir-gider panosu, artış/azalış karşılaştırması ve birikim hedefi
- Aylık bütçe, harcama kategorileri ve plansız gider takibi
- Otomatik haftalık değerlendirme
- Kişisel haftalık değerlendirme formu
- ChatGPT'ye aktarılabilen haftalık özet
- JSON yedek alma ve geri yükleme
- Çevrimdışı açılabilen PWA yapısı

## Veri ve gizlilik

Kayıtlar cihazdaki tarayıcı alanında saklanır. Sunucuya gönderilmez. Ayarlar ekranından indirilen yedek dosyası Google Drive veya iCloud Drive'da saklanabilir.

## Hatırlatmalar

İlk sürüm, uygulama açıkken görev ve spor saatlerini kontrol ederek cihaz bildirimi gösterir. Uygulama tamamen kapalıyken bildirim için ileride küçük bir bildirim sunucusu eklenmesi gerekir.

## Yayınlama

Uygulama `dist` klasöründen çalışan statik bir sitedir ve `vercel.json` ile Vercel'e hazırdır. Yayınlandıktan sonra iPhone'da Safari üzerinden açılıp **Paylaş → Ana Ekrana Ekle** ile kurulabilir.
