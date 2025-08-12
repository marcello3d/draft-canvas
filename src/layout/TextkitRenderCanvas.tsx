import React, { useEffect, useMemo, useRef, useState } from 'react';
import styles from '../App.module.css';
import { Layout } from './layout';
import { 
  TextkitCanvasProps, 
  getTextkitRenderLayout, 
  renderOutlines, 
  setupCanvas 
} from './textkit';

/**
 * TextkitRenderCanvas uses fontkit's glyph.render() method
 * This should handle complex glyphs and emoji better than manual path extraction
 */
export const TextkitRenderCanvas = React.memo(function TextkitRenderCanvas({
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
  const [glyphData, setGlyphData] = useState<any[]>([]);

  useEffect(() => {
    const startTime = performance.now();
    getTextkitRenderLayout(text, width, height, editorState, useCustomLineBreaker).then(({ layout, glyphData }) => {
      setTextkitLayout(layout);
      setGlyphData(glyphData);
      const endTime = performance.now();
      console.log(`Textkit render layout total time: ${endTime - startTime}ms`);
    });
  }, [text, width, height, editorState, useCustomLineBreaker]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !textkitLayout || glyphData.length === 0) {
      return;
    }

    const ctx = setupCanvas(canvas, width, height);
    if (!ctx) {
      return;
    }

    const startTime = performance.now();
    
    // Process each glyph
    for (const data of glyphData) {
      if (data.isEmoji) {
        // Render emoji using fillText (same as before)
        ctx.save();
        ctx.font = data.font;
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = 'black';
        ctx.fillText(data.char, data.x, data.y);
        ctx.restore();
      } else if (data.render) {
        // Use the glyph.render function
        ctx.save();
        
        // Call the render function with the context
        // The render function should handle translation and scaling
        data.render(ctx);
        
        ctx.restore();
      } else if (data.path) {
        // Fallback to path rendering if render function not available
        ctx.save();
        ctx.translate(data.x, data.y);
        ctx.scale(data.scale, -data.scale);
        ctx.fillStyle = 'black';
        const path2d = new Path2D(data.path);
        ctx.fill(path2d);
        ctx.restore();
      }
    }
    
    renderOutlines(ctx, textkitLayout.lines, showOutlines);
    
    const endTime = performance.now();
    console.log(`Canvas rendering took ${endTime - startTime}ms for textkit-render`);
  }, [width, height, showOutlines, textkitLayout, glyphData]);

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