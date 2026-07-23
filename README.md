# 🏢 Claude Manager

Çok-ajanlı Claude yönetim sistemi ve web paneli. Bir şirket ofisi gibi: patron, yönetici, takım lideri ve çalışan rollerinde birden fazla Claude ajanı çalıştırır; durumlarını, token harcamalarını ve görevlerini tek panelden yönetirsiniz.

## Özellikler

- **Ajanlar** — her ajan bağımsız bir [Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk) oturumu; kişilik dosyası (`agents/<id>/personality.md`), rol, model ve MCP bağlantıları ajan başına yapılandırılır.
- **Durum izleme** — `boşta / çalışıyor / onay bekliyor / kapalı` durumları canlı (WebSocket) güncellenir.
- **Canlı ofis** — piksel-art ofiste her ajan bir karakter: çalışırken masasında yazar/okur (monitörü yanar), boştayken ofiste gezinir, izin beklerken baloncuk çıkarır; boss görev delege edince çalışanın masasına yürür. Karakter üstündeki yakıt çubuğu bağlam doluluğunu gösterir. Görseller [pixel-agents](https://github.com/pixel-agents-hq/pixel-agents) (MIT) projesinden; karakterler [JIK-A-4 "MetroCity"](https://jik-a-4.itch.io/metrocity-free-topdown-character-pack) paketi tabanlıdır.
- **Terminal** — her ajanın konuşma ve araç akışı panelde; doğrudan mesaj/görev gönderebilir, izin isteklerini onaylayabilirsiniz.
- **Hiyerarşi** — `boss/manager/team-leader` rolündeki ajanlar `list_agents`, `delegate_task`, `check_task` araçlarıyla işi ekibe dağıtır; görevler **Görevler** sekmesinde izlenir.
- **Model seçimi** — ajan başına Haiku (ucuz) / Sonnet (dengeli) / Opus (güçlü); basit işler için güçlü model kullanmak zorunda kalmazsınız. Boss görevleri uygun ajana yönlendirir.
- **Token takibi** — ajan başına ve toplam token + tahmini maliyet (`data/usage.json`, kalıcı).
- **Hafıza** — `memory/shared/` (ortak) ve `memory/<ajan>/` (özel) markdown klasörleri; ajan hafıza modu `config.json`'dan seçilir. Klasör doğrudan **Obsidian vault** olarak açılabilir; istenirse `graphify` ile bilgi grafiğine dönüştürülebilir.
- **Prompt kütüphanesi** — kayıtlı komut/prompt şablonları; tek tıkla seçili ajana gönderilir.

## Kurulum

Gereksinimler:
- [Node.js 20+](https://nodejs.org) kurulu olmalı.
- [Claude Code](https://claude.com/product/claude-code) kurulu ve giriş yapılmış olmalı (`claude login` — Agent SDK aboneliğinizi otomatik kullanır, ayrı bir API anahtarı gerekmez).
- Git.

```bash
git clone https://github.com/Serdarsahinn05/claude-manager.git
cd claude-manager
npm install
npm run build
npm link          # `claude-manager` komutunu global olarak kaydeder
```

Ayrı bir kurulum dosyası (installer) yok — `npm link` bunun karşılığı. Panel
çalışırken `~/.claude-manager/` (ajan tanımları, tüm projelerde ortak) ve
çalıştığınız projenin içinde `.claude-manager/` (o projeye özel veri) klasörleri
oluşturur; ayrıntı için aşağıdaki **Dizinler** bölümüne bakın.

## Kullanım

Hangi projede çalışacaksanız o klasörde komutu çalıştırın:

```bash
cd D:/YeniProjem
claude-manager
```

Panel tarayıcıda açılır (http://localhost:4600) ve **ajanlar doğrudan o klasörde çalışır** — dosyaları orada okur, düzenler, oluşturur.

| Seçenek | Açıklama |
|---|---|
| `--dir <yol>` | Başka bir dizinde çalıştır (varsayılan: bulunduğunuz dizin) |
| `--port <no>` | Sunucu portu (varsayılan: 4600) |
| `--no-open` | Tarayıcıyı otomatik açma |

Panel üzerinde geliştirme yapacaksanız hot-reload'lu dev modu:

```bash
npm run dev       # panel http://localhost:5173, API http://localhost:4600
```

## Hızlı başlangıç

1. **+ Yeni Ajan** ile bir **Patron** oluşturun (model: Sonnet/Opus).
2. Farklı uzmanlıklarda **Çalışan** ajanlar ekleyin (model: Haiku/Sonnet). "Açıklama" alanını doldurun — patron görev dağıtırken bunu okur.
3. Patronun terminaline ne istediğinizi yazın; işi ekibe kendisi böler ve sonuçları toplar. Ya da **Görevler** sekmesinden ajanlara doğrudan görev atayın.
4. Araç izin istekleri panele düşer (sarı bant) — onaylayın/reddedin. Güvendiğiniz ajanlarda "Otomatik onay"ı açabilirsiniz.

## Dizinler

Ekip **global**, veri **proje başına** tutulur: aynı ajan ekibi her projede hazır gelir, ama görevler ve hafıza projelere karışmaz.

**`~/.claude-manager/`** — her projede ortak

| Dizin | İçerik |
|---|---|
| `agents/<id>/` | `config.json` + `personality.md` + `skills/<ad>/SKILL.md` |

İlk çalıştırmada varsayılan 8 ajanlık ekip buraya kopyalanır. Sonradan yaptığınız düzenlemeler güncellemelerde korunur.

**`<proje>/.claude-manager/`** — o projeye özel (git'e girmez)

| Dizin | İçerik |
|---|---|
| `memory/` | Obsidian uyumlu hafıza (ortak + ajan başına) |
| `data/` | Token sayımı, görev geçmişi, komut önbelleği |
| `prompts/` | Prompt kütüphanesi |

Ajanların çalışma dizini projenin kendi köküdür.

## Skill'ler

Her ajan dizini aynı zamanda yerel bir Claude Code plugin'idir; `skills/<ad>/SKILL.md` dosyaları terminalde `/<ad>` olarak çağrılır. Kendi `~/.claude/skills` altındaki skill'leriniz ve plugin'leriniz de ajanlarda geçerlidir — terminalde `/` yazınca hepsi listelenir.
