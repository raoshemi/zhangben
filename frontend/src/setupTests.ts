import '@testing-library/jest-dom';

// Ant Design 响应式组件（Row/Col/Grid）依赖 window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// jsdom 不支持 getComputedStyle 的伪元素查询（rc-table 滚动条测量会用到），忽略第二个参数避免抛错
const originalGetComputedStyle = window.getComputedStyle;
window.getComputedStyle = ((elt: Element) =>
  originalGetComputedStyle(elt)) as typeof window.getComputedStyle;
