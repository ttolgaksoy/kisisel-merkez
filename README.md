# Kişisel Merkez

Tek kişi için hazırlanmış, iPhone ana ekranına kurulabilen kişisel planlama uygulaması.

## İçerik

- Günlük öncelikler ve görevler
- Aylık takvim
- Her hafta otomatik tekrarlanan spor programı, hareket listesi ve tek tek tamamlama takibi
- Toplam süre, enerji ve kaliteyle sade manuel uyku kaydı
- Gelir, ekstra para ve yatırım getirisi kayıtları
- Ay sonunda kalacak tutar ve tahmini toplam birikim özeti
- Banka birikimi, maaş, düzenli gider ve aylık toplam ekstreyle sade bütçe takibi
- Fatura ve abonelikler için düzenli gider; kredi kartı için ayrı aylık toplam ekstre takibi
- ChatGPT sohbetlerinden hazırlanan özel veri paketini mevcut kayıtlara ekleme
- Tekrarlayan görevler, hızlı not kutusu ve 3 dakikalık haftalık planlama
- Yaklaşan ödemeler, ay sonu bütçe tahmini ve sayısal hedefler
- Aylık yedek hatırlatması ve isteğe bağlı PIN kilidi
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
