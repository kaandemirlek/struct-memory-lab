# 🧩 Struct Memory Lab

C++ struct'larını parse eden, bellek yerleşimini (offset/padding/size) gösteren,
versiyonlayan, diff/uyumluluk uyarısı üreten ve tekrar `.hpp` olarak dışa aktaran
bir araç. İki kişilik staj projesi — **dikey slice** modeliyle bölündü.

## Hızlı başlangıç

```bash
npm install      # bağımlılıklar (Node 24 LTS)
npm run dev      # http://localhost:3000
npm run build    # production build (CI öncesi kontrol)
npx tsc --noEmit # tip kontrolü
```

## Mimari — iki dikey slice

Her kişi bir özelliği **uçtan uca** (logic + UI) sahiplenir.

| | Person A — *Import & Layout* | Person B — *Versioning & Export* |
|---|---|---|
| **Backend** (`src/engine/`) | `parser.ts`, `layout.ts` | `versioning.ts`, `diff.ts`, `compatibility.ts`, `exporter.ts` |
| **Frontend** (`src/components/`) | `ImportBox`, `FieldEditor`, `LayoutVisualizer` | `VersionPanel`, `DiffView`, `WarningsPanel`, `ExportBox` |

### Ortak temel (yalnızca birlikte değiştirin)
- `src/types.ts` — **sözleşme**: veri şekilleri + fonksiyon imzaları.
- `src/store/useStructStore.ts` — iki slice'ın buluştuğu **ortak hafıza**.
- `src/app/page.tsx` — sol panel (A) / sağ panel (B) iskeleti.

### Tek bağımlılık
`compatibility.ts` (B) → `computeLayout` (A) gerektirir.
A bitene kadar B, `src/engine/layout.mock.ts`'i kullanır; A bitince
`compatibility.ts` içindeki import'u `@/engine/layout` yapmak yeterli (tek satır).

## Git akışı (ikiniz aynı anda)

`main` her zaman çalışır durumda kalır. Kimse doğrudan `main`'e push'lamaz.

```bash
git switch -c feat/a-parser     # kendi feature branch'in
# ...çalış, commit'le...
git push -u origin feat/a-parser
# GitHub'da Pull Request aç → DİĞER kişi review eder → main'e merge
```

- **Person A** branch'leri: `feat/a-...`
- **Person B** branch'leri: `feat/b-...`
- Farklı dosyalara dokunduğunuz için merge çakışması olmaz —
  `types.ts` ve store hariç (onları birlikte, ayrı bir PR'da değiştirin).
- Birbirinizin PR'ını **review edin** — projenin diğer yarısını böyle öğrenirsiniz.

## Yol haritası
Milestone'lar ve görev dağılımı için bkz. proje planı (chat). Stub dosyalarındaki
`// TODO (PERSON A/B)` işaretleri başlangıç noktanız.
