// page.tsx — UYGULAMA İSKELETİ (Step 0'da birlikte kuruldu)
// Sol sütun = Person A slice'ı · Sağ sütun = Person B slice'ı
// Her iki sütun da ortak store üzerinden bağlanır.

import ImportBox from "@/components/ImportBox";
import FieldEditor from "@/components/FieldEditor";
import LayoutVisualizer from "@/components/LayoutVisualizer";
import VersionPanel from "@/components/VersionPanel";
import DiffView from "@/components/DiffView";
import WarningsPanel from "@/components/WarningsPanel";
import ExportBox from "@/components/ExportBox";

export default function Home() {
  return (
    <main className="min-h-screen p-6 max-w-7xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">🧩 Struct Memory Lab</h1>
        <p className="text-sm opacity-70">
          C++ struct'larını parse et, bellek yerleşimini gör, versiyonla ve dışa aktar.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        {/* ---------------- PERSON A: Import & Live Layout ---------------- */}
        <div className="space-y-6">
          <h2 className="text-xs uppercase tracking-wide opacity-50">
            Person A — Import &amp; Layout
          </h2>
          <ImportBox />
          <FieldEditor />
          <LayoutVisualizer />
        </div>

        {/* ---------------- PERSON B: Versioning & Export ---------------- */}
        <div className="space-y-6">
          <h2 className="text-xs uppercase tracking-wide opacity-50">
            Person B — Versioning &amp; Export
          </h2>
          <VersionPanel />
          <DiffView />
          <WarningsPanel />
          <ExportBox />
        </div>
      </div>
    </main>
  );
}
