import React, { useEffect, useMemo, useRef, useState } from 'react';
import styles from '../App.module.css';
import { Layout } from './layout';
import { 
  TextkitCanvasProps, 
  getTextkitTextLayout, 
  renderOutlines, 
  setupCanvas 
} from './textkit';

export const TextkitTextCanvas = React.memo(function TextkitTextCanvas({
  width,
  height,
  text,
  showOutlines,
  defaultFont = '400 60px "Roboto"',
  editorState
}: TextkitCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [textkitLayout, setTextkitLayout] = useState<Layout | null>(null);

  useEffect(() => {
    const startTime = performance.now();
    getTextkitTextLayout(text, width, height, editorState).then((layout) => {
      setTextkitLayout(layout);
      const endTime = performance.now();
      console.log(`Textkit text layout total time: ${endTime - startTime}ms`);
    });
  }, [text, width, height, editorState]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !textkitLayout) {
      return;
    }

    const ctx = setupCanvas(canvas, width, height);
    if (!ctx) {
      return;
    }

    const startTime = performance.now();
    
    ctx.textBaseline = 'ideographic';
    ctx.fillStyle = 'black';
    
    for (const {
      text,
      top,
      left,
      bottom,
      right,
      font = defaultFont,
    } of textkitLayout.lines) {
      // Debug: log the font being set
      if (font !== defaultFont) {
        console.log('Setting canvas font:', font);
        // Also check what font the browser actually used
        ctx.font = font;
        console.log('Browser interpreted as:', ctx.font);
      } else {
        ctx.font = font;
      }
      ctx.fillText(text, left, bottom);
    }
    
    renderOutlines(ctx, textkitLayout.lines, showOutlines);
    
    const endTime = performance.now();
    console.log(`Canvas rendering took ${endTime - startTime}ms for textkit-text`);
  }, [width, height, defaultFont, showOutlines, textkitLayout]);

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