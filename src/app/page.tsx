import StoreHydration from "@/components/StoreHydration";
import ImportBox from "@/components/ImportBox";
import FieldEditor from "@/components/FieldEditor";
import LayoutVisualizer from "@/components/LayoutVisualizer";
import SafetyStatus from "@/components/SafetyStatus";
import VersionSidebar from "@/components/VersionSidebar";
import DiffView from "@/components/DiffView";
import WarningsPanel from "@/components/WarningsPanel";
import OptimizerPanel from "@/components/OptimizerPanel";
import ExportBox from "@/components/ExportBox";

export default function Home() {
  return (
    <div className="min-h-screen">
      <StoreHydration />
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="flex w-full items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
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
          <div className="ml-auto flex items-center gap-2">
            <ImportBox />
            <ExportBox />
          </div>
        </div>
      </header>

      <main className="w-full px-4 py-5 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)_auto]">
          <div className="space-y-5">
            <FieldEditor />
          </div>

          <div className="min-w-0 space-y-4">
            <LayoutVisualizer />
            <SafetyStatus />
            <div className="grid gap-4 xl:grid-cols-2">
              <DiffView />
              <WarningsPanel />
            </div>
            <OptimizerPanel />
          </div>

          <VersionSidebar />
        </div>
      </main>
    </div>
  );
}
