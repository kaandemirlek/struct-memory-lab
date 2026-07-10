"use client";

import { useState } from "react";
import FieldsSidebar from "@/components/FieldsSidebar";
import MiddleWorkspace, { type WorkspaceTab } from "@/components/MiddleWorkspace";
import VersionSidebar from "@/components/VersionSidebar";
import ChatAssistant from "@/components/ChatAssistant";

export default function WorkspaceShell() {
  const [tab, setTab] = useState<WorkspaceTab>("edit");

  return (
    <>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[auto_minmax(0,1fr)_auto]">
        <FieldsSidebar />

        <MiddleWorkspace tab={tab} onTabChange={setTab} />

        <VersionSidebar mode={tab} />
      </div>

      <ChatAssistant />
    </>
  );
}
