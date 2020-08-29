import { SimpleCaret } from '../App';

export function caret(x: number, y: number): SimpleCaret | undefined {
  if (document.caretPositionFromPoint) {
    return document.caretPositionFromPoint(x, y) || undefined;
  }
  if (document.caretRangeFromPoint) {
    const range = document.caretRangeFromPoint(x, y);
    return range
      ? {
          offsetNode: range.startContainer,
          offset: range.startOffset,
        }
      : undefined;
  }
  return undefined;
}
