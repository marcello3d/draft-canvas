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
    ctx.textBaseline = 'bottom';
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.fillStyle = 'black';
    ctx.lineWidth = 1 / window.devicePixelRatio;
    for (const { text, x, y, font = defaultFont, width, height } of lines) {
      ctx.font = font;
      if (showOutlines) {
        ctx.strokeRect(x, y, width, height);
      }
      ctx.fillText(text, x, y + height);
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
