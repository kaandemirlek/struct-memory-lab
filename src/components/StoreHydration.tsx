// StoreHydration.tsx — rehydrates the persisted store after the client mounts.
// Because the store uses `skipHydration`, server and first client render both
// use the default state (no mismatch); we then load localStorage in an effect.
"use client";

import { useEffect } from "react";
import { useStructStore } from "@/store/useStructStore";

export default function StoreHydration() {
  useEffect(() => {
    useStructStore.persist.rehydrate();
  }, []);
  return null;
}
