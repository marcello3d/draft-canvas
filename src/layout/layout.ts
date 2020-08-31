import { caret } from './caret';

export type Layout = {
  width: number;
  height: number;
  lines: Line[];
};
type Line = {
  left: number;
  top: number;
  right: number;
  bottom: number;
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
      let last: Line | undefined;
      for (const text of points) {
        range.setStart(textNode, i);
        range.setEnd(textNode, (i += text.length));
        if (/\s+/.test(text)) {
          last = undefined;
          continue;
        }
        const rect =
          Array.from(range.getClientRects()).find(({ width }) => width > 0) ??
          range.getBoundingClientRect();
        const top = rect.top - offsetY;
        const right = rect.right - offsetX;
        const bottom = rect.bottom - offsetY;
        const left = rect.left - offsetX;
        if (last && last.top === top && last.bottom === bottom) {
          last.right = right;
          last.text += text;
        } else {
          last = { top, right, bottom, left, font: font || undefined, text };
          lines.push(last);
        }
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
        const top = rect.top - offsetY;
        const right = rect.right - offsetX;
        const bottom = rect.bottom - offsetY;
        const left = rect.left - offsetX;
        lines.push({ top, right, bottom, left, font: font || undefined, text });
      }
    }
  }
  console.log(JSON.stringify(lines, undefined, 2));
  return {
    width: div.offsetWidth,
    height: div.offsetHeight,
    lines,
  };
}
