import React, { useEffect, useMemo, useRef, useState } from 'react';
import styles from '../App.module.css';
import { Layout } from './layout';
import { 
  TextkitCanvasProps, 
  getTextkitPathLayout, 
  renderOutlines, 
  setupCanvas 
} from './textkit';

export const TextkitPathCanvas = React.memo(function TextkitPathCanvas({
  width,
  height,
  text,
  showOutlines,
  defaultFont = '400 60px "Roboto"',
  editorState,
  useCustomLineBreaker
}: TextkitCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [textkitLayout, setTextkitLayout] = useState<Layout | null>(null);
  const [glyphPaths, setGlyphPaths] = useState<any[]>([]);

  useEffect(() => {
    const startTime = performance.now();
    getTextkitPathLayout(text, width, height, editorState, useCustomLineBreaker).then(({ layout, glyphPaths }) => {
      setTextkitLayout(layout);
      setGlyphPaths(glyphPaths);
      const endTime = performance.now();
      console.log(`Textkit path layout total time: ${endTime - startTime}ms`);
    });
  }, [text, width, height, editorState, useCustomLineBreaker]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !textkitLayout || glyphPaths.length === 0) {
      return;
    }

    const ctx = setupCanvas(canvas, width, height);
    if (!ctx) {
      return;
    }

    const startTime = performance.now();
    
    ctx.fillStyle = 'black';
    
    for (const glyph of glyphPaths) {
      if (glyph.isEmoji) {
        // Render emoji using fillText
        ctx.save();
        ctx.font = glyph.font;
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(glyph.char, glyph.x, glyph.y);
        ctx.restore();
      } else {
        // Render regular glyph using path
        const { path, x, y, scale } = glyph;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(scale, -scale);
        const path2d = new Path2D(path);
        ctx.fill(path2d);
        ctx.restore();
      }
    }
    
    renderOutlines(ctx, textkitLayout.lines, showOutlines);
    
    const endTime = performance.now();
    console.log(`Canvas rendering took ${endTime - startTime}ms for textkit-path`);
  }, [width, height, showOutlines, textkitLayout, glyphPaths]);

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