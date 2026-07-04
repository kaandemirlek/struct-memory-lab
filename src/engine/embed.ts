// ============================================================================
// embed.ts — export/import köprüsü için paylaşılan sabit (bağımsız yaprak modül)
// ============================================================================
// exportCpp, header'a "// struct-memory-lab-model:{...}" satırını gömer; parseCpp
// bu satırı görürse modeli KAYIPSIZ geri yükler (Status Bits, bit anlamları dahil).
// Sabit burada durur ki parser ve exporter ikisi de import edebilsin — aralarında
// döngüsel bağımlılık (ve bundler çözümleme sorunu) oluşmasın.
// ============================================================================

export const EMBED_MARKER = "// struct-memory-lab-model:";
