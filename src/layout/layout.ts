import { caret } from './caret';

export type Layout = {
  width: number;
  height: number;
  lines: Line[];
};
type Line = {
  x: number;
  y: number;
  width: number;
  height: number;
  font?: string;
  text: string;
};

export function computeLayout(
  div: HTMLDivElement,
  characterLevel: boolean,
): Layout | undefined {
  const spans = div.querySelectorAll('span[data-text]');
  const lines: Line[] = [];
  const bounds = div
    // .querySelector('div[data-contents]')!
    .getBoundingClientRect();
  const offsetX = bounds.x;
  const offsetY = bounds.y;
  for (const span of Array.from(spans)) {
    const textNode = span.firstChild;
    const spanText = textNode?.textContent;
    if (!textNode || !spanText) {
      console.warn(`TEXT is NULL`);
      continue;
    }
    const { font } = getComputedStyle(span);
    if (characterLevel) {
      const range = document.createRange();
      const points = Array.from(spanText);
      let i = 0;
      for (const text of points) {
        range.setStart(textNode, i);
        range.setEnd(textNode, (i += text.length));
        const rect = range.getBoundingClientRect();
        lines.push({
          x: rect.x - offsetX,
          y: rect.y - offsetY,
          width: rect.width,
          height: rect.height,
          font: font || undefined,
          text,
        });
      }
    } else {
      for (const rect of Array.from(span.getClientRects())) {
        const cp1 = caret(rect.left + 1, rect.top + 1);
        const cp2 = caret(rect.right + 1, rect.top + 1);
        if (cp1?.offsetNode !== textNode || cp2?.offsetNode !== textNode) {
          console.warn(`span mismatch!!!`);
          continue;
        }
        const text = spanText.slice(cp1.offset, cp2.offset);
        lines.push({
          x: rect.x - offsetX,
          y: rect.y - offsetY,
          width: rect.width,
          height: rect.height,
          font: font || undefined,
          text,
        });
      }
    }
  }
  return {
    width: div.offsetWidth,
    height: div.offsetHeight,
    lines,
  };
}
