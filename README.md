# 🏢 Claude Manager

Çok-ajanlı Claude yönetim sistemi ve web paneli. Bir şirket ofisi gibi: patron, yönetici, takım lideri ve çalışan rollerinde birden fazla Claude ajanı çalıştırır; durumlarını, token harcamalarını ve görevlerini tek panelden yönetirsiniz.

## Özellikler

- **Ajanlar** — her ajan bağımsız bir [Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk) oturumu; kişilik dosyası (`agents/<id>/personality.md`), rol, model ve MCP bağlantıları ajan başına yapılandırılır.
- **Durum izleme** — `boşta / çalışıyor / onay bekliyor / kapalı` durumları canlı (WebSocket) güncellenir.
- **Terminal** — her ajanın konuşma ve araç akışı panelde; doğrudan mesaj/görev gönderebilir, izin isteklerini onaylayabilirsiniz.
- **Hiyerarşi** — `boss/manager/team-leader` rolündeki ajanlar `list_agents`, `delegate_task`, `check_task` araçlarıyla işi ekibe dağıtır; görevler **Görevler** sekmesinde izlenir.
- **Model seçimi** — ajan başına Haiku (ucuz) / Sonnet (dengeli) / Opus (güçlü); basit işler için güçlü model kullanmak zorunda kalmazsınız. Boss görevleri uygun ajana yönlendirir.
- **Token takibi** — ajan başına ve toplam token + tahmini maliyet (`data/usage.json`, kalıcı).
- **Hafıza** — `memory/shared/` (ortak) ve `memory/<ajan>/` (özel) markdown klasörleri; ajan hafıza modu `config.json`'dan seçilir. Klasör doğrudan **Obsidian vault** olarak açılabilir; istenirse `graphify` ile bilgi grafiğine dönüştürülebilir.
- **Prompt kütüphanesi** — kayıtlı komut/prompt şablonları; tek tıkla seçili ajana gönderilir.

## Kurulum

Gereksinimler: Node.js 20+, giriş yapılmış Claude Code (`claude login` — Agent SDK aboneliğinizi otomatik kullanır, API anahtarı gerekmez).

```bash
npm install
npm run dev
```

- Panel: http://localhost:5173
- API: http://localhost:4600 (WS: `/ws`)

## Hızlı başlangıç

1. **+ Yeni Ajan** ile bir **Patron** oluşturun (model: Sonnet/Opus).
2. Farklı uzmanlıklarda **Çalışan** ajanlar ekleyin (model: Haiku/Sonnet). "Açıklama" alanını doldurun — patron görev dağıtırken bunu okur.
3. Patronun terminaline ne istediğinizi yazın; işi ekibe kendisi böler ve sonuçları toplar. Ya da **Görevler** sekmesinden ajanlara doğrudan görev atayın.
4. Araç izin istekleri panele düşer (sarı bant) — onaylayın/reddedin. Güvendiğiniz ajanlarda "Otomatik onay"ı açabilirsiniz.

## Dizinler

| Dizin | İçerik |
|---|---|
| `agents/<id>/` | `config.json` + `personality.md` + `skills/` |
| `memory/` | Obsidian uyumlu hafıza (ortak + ajan başına) |
| `prompts/` | Prompt kütüphanesi |
| `workspaces/<id>/` | Ajanın çalışma klasörü (git'e girmez) |
| `data/` | Token ve görev geçmişi (git'e girmez) |
