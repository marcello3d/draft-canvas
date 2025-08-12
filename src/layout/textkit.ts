import { Layout } from './layout';
import { computeTextkitLayout, computeTextkitLayoutWithPaths } from './textkitLayout';
import { EditorState } from 'draft-js';

export interface TextkitCanvasProps {
  width: number;
  height: number;
  text: string;
  showOutlines: boolean;
  defaultFont?: string;
  editorState: EditorState;
  useCustomLineBreaker?: boolean | 'simple';
}

export async function getTextkitTextLayout(
  text: string,
  width: number,
  height: number,
  editorState?: EditorState,
  useCustomLineBreaker?: boolean | 'simple'
): Promise<Layout> {
  return computeTextkitLayout(text, width, height, 60, editorState, useCustomLineBreaker);
}

export async function getTextkitPathLayout(
  text: string,
  width: number,
  height: number,
  editorState?: EditorState,
  useCustomLineBreaker?: boolean | 'simple'
): Promise<{ layout: Layout; glyphPaths: any[] }> {
  return computeTextkitLayoutWithPaths(text, width, height, 60, editorState, useCustomLineBreaker);
}

export async function getTextkitRenderLayout(
  text: string,
  width: number,
  height: number,
  editorState?: EditorState,
  useCustomLineBreaker?: boolean | 'simple'
): Promise<{ layout: Layout; glyphData: any[] }> {
  const { computeTextkitLayoutWithRender } = await import('./textkitLayout');
  return computeTextkitLayoutWithRender(text, width, height, 60, editorState, useCustomLineBreaker);
}

export function renderOutlines(
  ctx: CanvasRenderingContext2D,
  lines: any[],
  showOutlines: boolean
) {
  if (showOutlines) {
    ctx.strokeStyle = 'rgba(255,0,0,0.2)';
    ctx.lineWidth = 1 / window.devicePixelRatio;
    for (const { top, left, bottom, right } of lines) {
      ctx.strokeRect(left, top, right - left, bottom - top);
    }
  }
}

export function setupCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number
): CanvasRenderingContext2D | null {
  canvas.width = width * window.devicePixelRatio;
  canvas.height = height * window.devicePixelRatio;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  return ctx;
}