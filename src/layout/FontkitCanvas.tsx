import React, { useEffect, useRef, useState, useMemo } from 'react';
import { EditorState } from 'draft-js';
import styles from '../App.module.css';
import { computeFontkitLayout } from './fontkitLayout';
import { Layout } from './layout';

interface FontkitCanvasProps {
  width: number;
  height: number;
  text: string;
  showOutlines: boolean;
  editorState: EditorState;
  fontSize?: number;
}

/**
 * Canvas component that uses pure fontkit for layout and rendering
 * - Uses fontkit to layout each line
 * - Manually wraps at whitespace boundaries
 * - Renders glyphs using glyph.render(ctx, size)
 */
export const FontkitCanvas = React.memo(function FontkitCanvas({
  width,
  height,
  text,
  showOutlines,
  editorState,
  fontSize = 60,
}: FontkitCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [glyphData, setGlyphData] = useState<any[]>([]);

  // Compute layout when text or dimensions change
  useEffect(() => {
    const performLayout = async () => {
      const startTime = performance.now();
      
      try {
        const result = await computeFontkitLayout(
          text,
          width,
          height,
          fontSize,
          editorState
        );
        
        setLayout(result.layout);
        setGlyphData(result.glyphData);
        
        const endTime = performance.now();
        console.log(`FontkitCanvas layout total time: ${endTime - startTime}ms`);
      } catch (error) {
        console.error('Error computing fontkit layout:', error);
      }
    };
    
    performLayout();
  }, [text, width, height, fontSize, editorState]);

  // Render to canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !layout || glyphData.length === 0) {
      return;
    }

    // Setup canvas with device pixel ratio for crisp rendering
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Could not get canvas context');
      return;
    }
    
    // Scale for device pixel ratio
    ctx.scale(dpr, dpr);
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    const startTime = performance.now();
    
    // Render each glyph
    for (const data of glyphData) {
      if (data.isEmoji) {
        // Render emoji using fillText
        ctx.save();
        ctx.font = data.font;
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = 'black';
        ctx.fillText(data.char, data.x, data.y);
        ctx.restore();
      } else if (data.render) {
        // Use the glyph.render function
        // The render function handles all transformations internally
        data.render(ctx);
      }
    }
    
    // Draw outlines if enabled
    if (showOutlines && layout.lines) {
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      
      for (const line of layout.lines) {
        ctx.strokeRect(
          line.left,
          line.top,
          line.right - line.left,
          line.bottom - line.top
        );
      }
      
      ctx.setLineDash([]);
    }
    
    const endTime = performance.now();
    console.log(`FontkitCanvas rendering took ${endTime - startTime}ms`);
  }, [width, height, showOutlines, layout, glyphData]);

  // Canvas style
  const style = useMemo(
    () => ({
      width: `${width}px`,
      height: `${height}px`,
    }),
    [width, height]
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