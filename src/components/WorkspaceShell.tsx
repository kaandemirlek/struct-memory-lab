"use client";

import { useState } from "react";
import FieldEditor from "@/components/FieldEditor";
import MiddleWorkspace, { type WorkspaceTab } from "@/components/MiddleWorkspace";
import VersionSidebar from "@/components/VersionSidebar";
import ChatAssistant from "@/components/ChatAssistant";

export default function WorkspaceShell() {
  const [tab, setTab] = useState<WorkspaceTab>("edit");

  return (
    <>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(300px,440px)_minmax(0,1fr)_auto]">
        <div className="space-y-5">
          <FieldEditor />
        </div>

        <MiddleWorkspace tab={tab} onTabChange={setTab} />

        <VersionSidebar mode={tab} />
      </div>

      <ChatAssistant />
    </>
  );
}
