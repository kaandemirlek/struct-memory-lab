import StoreHydration from "@/components/StoreHydration";
import HistoryControls from "@/components/HistoryControls";
import PlatformSelect from "@/components/PlatformSelect";
import ThemeToggle from "@/components/ThemeToggle";
import ImportBox from "@/components/ImportBox";
import WorkspaceShell from "@/components/WorkspaceShell";
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
            <PlatformSelect />
            <div className="mx-1 h-5 w-px bg-border" aria-hidden />
            <ThemeToggle />
            <HistoryControls />
            <div className="mx-1 h-5 w-px bg-border" aria-hidden />
            <ImportBox />
            <ExportBox />
          </div>
        </div>
      </header>

      <main className="w-full px-4 py-5 sm:px-6 lg:px-8">
        <WorkspaceShell />
      </main>
    </div>
  );
}
