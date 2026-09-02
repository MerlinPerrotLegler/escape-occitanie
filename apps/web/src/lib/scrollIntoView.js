export const HEADER_SCROLL_OFFSET = 96;

export function scrollNodeIntoView(node, windowObj = globalThis, offset = HEADER_SCROLL_OFFSET) {
  if (!node || typeof windowObj?.scrollTo !== 'function') return;
  const top = node.getBoundingClientRect().top + (windowObj.scrollY || 0) - offset;
  windowObj.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
}
