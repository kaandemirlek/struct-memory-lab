// StoreHydration.tsx — rehydrates the persisted store after the client mounts.
// Because the store uses `skipHydration`, server and first client render both
// use the default state (no mismatch); we then load localStorage in an effect.
// After rehydration, a shared permalink (#s=...) takes precedence and is loaded
// into the working model.
"use client";

import { useEffect } from "react";
import { useStructStore } from "@/store/useStructStore";
import { consumeSharedModel } from "@/lib/share";

export default function StoreHydration() {
  useEffect(() => {
    // rehydrate() may return a promise; load any shared link only after it
    // resolves so the shared struct overrides persisted state.
    Promise.resolve(useStructStore.persist.rehydrate()).finally(() => {
      consumeSharedModel(useStructStore.getState().setModel);
    });
  }, []);
  return null;
}
