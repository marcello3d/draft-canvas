import React, { memo, useEffect, useMemo, useRef } from 'react';
import styles from '../App.module.css';
import { Layout } from './layout';

export const LayoutCanvas = memo(function LayoutCanvas({
  layout: { width, height, lines },
  defaultFont = '400 80px "Marker Felt"',
  showOutlines,
}: {
  defaultFont?: string;
  showOutlines: boolean;
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
    ctx.textBaseline = 'ideographic';
    ctx.strokeStyle = 'rgba(255,0,0,0.2)';
    ctx.fillStyle = 'black';
    ctx.lineWidth = 1 / window.devicePixelRatio;
    for (const {
      text,
      top,
      left,
      bottom,
      right,
      font = defaultFont,
    } of lines) {
      ctx.font = font;
      if (showOutlines) {
        ctx.strokeRect(left, top, right - left, bottom - top);
      }
      ctx.fillText(text, left, bottom);
    }
  }, [width, height, lines, defaultFont, showOutlines]);
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
