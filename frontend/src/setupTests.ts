import "@testing-library/jest-dom/vitest";

// Polyfill scrollIntoView for jsdom
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function () {};
}

// Mock clipboard API
afterEach(() => {
  vitest.restoreAllMocks();
  vi.clearAllMocks();
});
