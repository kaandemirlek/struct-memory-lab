// ============================================================================
// test/setup.ts — her test dosyasından önce koşan global hazırlık.
// ============================================================================
// jsdom, bazı tarayıcı API'lerini sağlamaz; bileşenlerin kullandığı ikisini
// polyfill'leriz. Bu dosya DOM'a DOKUNMAZ (yalnızca globalThis'e yazar), bu
// yüzden düz "node" ortamındaki motor testlerinde de zararsızca çalışır.
// React Testing Library'nin cleanup'ı ise her bileşen test dosyasında ayrıca
// çağrılır (globals kapalı olduğundan otomatik cleanup devrede değil).
// ============================================================================

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

// LayoutVisualizer, kabın genişliğini ölçmek için ResizeObserver kullanır.
if (!("ResizeObserver" in globalThis)) {
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = ResizeObserverStub;
}

// Bazı UI kodları matchMedia'ya bakabilir (tema vb.); jsdom'da yoktur.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}
