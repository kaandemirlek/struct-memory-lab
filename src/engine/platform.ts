// ============================================================================
// platform.ts — platform / ABI ön ayarları
// ============================================================================
// Üç ön ayar:
//   • linux64 (LP64)  — Linux/macOS x86-64. long = 8 byte, size_t = 8. Varsayılan.
//   • win64  (LLP64)  — Windows x64 (MSVC). long = 4 byte, size_t = 8.
//   • x86-32 (ILP32)  — 32-bit x86, System V ABI (i386 Linux). long = 4,
//                       size_t = 4 ve 8-byte'lık tipler (int64/uint64/double) 4'e hizalanır.
//
// StructModel platformdan TAMAMEN BAĞIMSIZDIR (parser bile). Platform YALNIZCA
// computeLayout anında rol oynar: long / unsigned long / size_t boyutu ve
// 8-byte hizalama buradaki tabloya göre çözülür. Böylece platformu değiştirmek
// yerleşimi anında (re-import gerektirmeden) günceller.
// ============================================================================

import type { CppPrimitive, Platform } from "@/types";
import { TYPE_INFO } from "@/types";

export interface PlatformPreset {
  id: Platform;
  /** Kısa UI etiketi (dropdown). */
  label: string;
  /** Uzun açıklama (tooltip / CLI yardımı). */
  description: string;
}

export const PLATFORMS: PlatformPreset[] = [
  {
    id: "linux64",
    label: "Linux/macOS x64 (LP64)",
    description: "x86-64 System V ABI — long is 8 bytes, size_t is 8 bytes.",
  },
  {
    id: "win64",
    label: "Windows x64 (LLP64)",
    description: "MSVC x64 — long is 4 bytes, size_t is 8 bytes.",
  },
  {
    id: "x86-32",
    label: "32-bit x86 (ILP32)",
    description:
      "i386 System V ABI — size_t is 4 bytes; 8-byte types align to 4.",
  },
];

export function isPlatform(v: unknown): v is Platform {
  return PLATFORMS.some((p) => p.id === v);
}

type TypeTable = Record<CppPrimitive, { size: number; align: number }>;

// win64 (LLP64): LP64 ile tek farkı long = 4 byte (size_t 8 kalır).
const TYPE_INFO_WIN64: TypeTable = {
  ...TYPE_INFO,
  long: { size: 4, align: 4 },
  "unsigned long": { size: 4, align: 4 },
};

// x86-32 (ILP32): long = 4, size_t = 4 ve 8-byte tipler 4'e hizalanır.
const TYPE_INFO_X86_32: TypeTable = {
  ...TYPE_INFO,
  int64_t: { size: 8, align: 4 },
  uint64_t: { size: 8, align: 4 },
  double: { size: 8, align: 4 },
  long: { size: 4, align: 4 },
  "unsigned long": { size: 4, align: 4 },
  size_t: { size: 4, align: 4 },
};

const TYPE_TABLES: Record<Platform, TypeTable> = {
  linux64: TYPE_INFO,
  win64: TYPE_INFO_WIN64,
  "x86-32": TYPE_INFO_X86_32,
};

/** Platforma göre tip boyut/hizalama tablosu. */
export function getTypeInfo(platform: Platform): TypeTable {
  return TYPE_TABLES[platform];
}
