import React, {
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import styles from './App.module.css';
import { ContentState, Editor, EditorState } from 'draft-js';
import 'draft-js/dist/Draft.css';

type Layout = {
  width: number;
  height: number;
  lines: Line[];
};
type Line = {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
};

const cssFont = 'italic 300 80px "Marker Felt"';

export default function App() {
  const [editorState, setEditorState] = React.useState(() =>
    EditorState.createWithContent(
      ContentState.createFromText(
        "Hello this is some wrapping text I'm trying to start with",
      ),
    ),
  );

  const content = editorState.getCurrentContent();
  const editorRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Layout | undefined>();
  useLayoutEffect(() => {
    if (editorRef.current) {
      const layout = computeLayout(editorRef.current);
      setLayout(layout);
      console.log(`layout: ${JSON.stringify(layout, undefined, 2)}`);
    }
  }, [content]);

  const editorStyle = useMemo(
    () => ({
      font: cssFont,
    }),
    [],
  );

  return (
    <div className={styles.root}>
      <h2>DraftJS + Canvas2D demo</h2>
      <p>Type in the left-hand side and see the canvas rendered on right.</p>
      <div className={styles.main}>
        <div className={styles.editorWrapper}>
          <div ref={editorRef} className={styles.editor} style={editorStyle}>
            <Editor
              editorState={editorState}
              onChange={setEditorState}
              textAlignment="center"
            />
          </div>
          {layout && <LayoutCanvas layout={layout} />}
        </div>
        {layout && <LayoutCanvas layout={layout} />}
      </div>
    </div>
  );
}

const LayoutCanvas = memo(function LayoutCanvas({
  layout: { width, height, lines },
}: {
  layout: Layout;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.font = cssFont;
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = 'red';
    for (const { text, x, y, width, height } of lines) {
      ctx.fillText(text, x, y + height);
    }
  }, [width, height, lines]);
  const style = useMemo(
    () => ({
      width: `${width}px`,
      height: `${height}px`,
    }),
    [height, width],
  );
  return (
    <canvas
      className={styles.canvas}
      style={style}
      ref={canvasRef}
      width={width}
      height={height}
    />
  );
});

function computeLayout(div: HTMLDivElement): Layout | undefined {
  const spans = div.querySelectorAll('span[data-text]');
  const lines: Line[] = [];
  const bounds = div
    // .querySelector('div[data-contents]')!
    .getBoundingClientRect();
  const offsetX = bounds.x;
  const offsetY = bounds.y;
  for (const span of Array.from(spans)) {
    const spanText = span.textContent;
    if (spanText === null) {
      console.warn(`TEXT is NULL`);
      continue;
    }
    for (const rect of Array.from(span.getClientRects())) {
      const cp1 = caret(rect.left + 1, rect.top + 1);
      const cp2 = caret(rect.right + 1, rect.top + 1);
      if (
        !(
          cp1?.offsetNode.parentNode === span &&
          cp2?.offsetNode.parentNode === span
        )
      ) {
        console.warn(`     span mismatch!!!`);
        continue;
      }
      const text = spanText.slice(cp1.offset, cp2.offset);
      lines.push({
        x: rect.x - offsetX,
        y: rect.y - offsetY,
        width: rect.width,
        height: rect.height,
        text,
      });
    }
  }
  return {
    width: div.offsetWidth,
    height: div.offsetHeight,
    lines,
  };
}

type SimpleCaret = {
  readonly offsetNode: Node;
  readonly offset: number;
};

function caret(x: number, y: number): SimpleCaret | undefined {
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
