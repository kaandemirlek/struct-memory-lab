import StoreHydration from "@/components/StoreHydration";
import ImportBox from "@/components/ImportBox";
import FieldEditor from "@/components/FieldEditor";
import LayoutVisualizer from "@/components/LayoutVisualizer";
import VersionPanel from "@/components/VersionPanel";
import DiffView from "@/components/DiffView";
import WarningsPanel from "@/components/WarningsPanel";
import ExportBox from "@/components/ExportBox";

export default function Home() {
  return (
    <div className="min-h-screen">
      <StoreHydration />
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-6 py-3">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-accent text-xs font-bold text-accent-foreground">
            S
          </div>
          <div>
            <h1 className="text-sm font-semibold leading-none tracking-tight">
              Struct Memory Lab
            </h1>
            <p className="mt-1 text-xs leading-none text-muted">
              Visualize, version and export C++ struct memory layouts
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <ImportBox />
            <FieldEditor />
            <LayoutVisualizer />
          </div>
          <div className="space-y-6">
            <VersionPanel />
            <DiffView />
            <WarningsPanel />
            <ExportBox />
          </div>
        </div>
      </main>
    </div>
  );
}
