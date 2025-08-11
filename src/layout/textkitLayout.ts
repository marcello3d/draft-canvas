import createLayoutEngine, {
  bidi,
  fontSubstitution,
  scriptItemizer,
  textDecoration,
  linebreaker,
  justification,
  type AttributedString,
  type Container,
  type Paragraph,
} from '@react-pdf/textkit';
import * as fontkit from 'fontkit';
import { Layout } from './layout';

let robotoFont: any = null;

// Create the layout engine without hyphenation
// We're not including the hyphenationCallback to disable hyphenation
const layoutEngine = createLayoutEngine({
  bidi,
  fontSubstitution,
  scriptItemizer,
  textDecoration,
  linebreaker,
  justification,
  // Explicitly no hyphenationCallback to disable hyphenation
});

async function loadRobotoFont() {
  if (!robotoFont) {
    const response = await fetch('/Roboto/Roboto-Regular.ttf');
    const buffer = await response.arrayBuffer();
    // Create a buffer-like object that fontkit can use
    const uint8Array = new Uint8Array(buffer);
    // @ts-ignore - fontkit expects Buffer but works with Uint8Array in browser
    robotoFont = fontkit.create(uint8Array);
  }
  return robotoFont;
}

export async function computeTextkitLayout(
  text: string,
  width: number,
  height: number,
  fontSize: number = 60,
): Promise<Layout> {
  const startTime = performance.now();
  const font = await loadRobotoFont();

  const attributedString: AttributedString = {
    string: text,
    runs: [
      {
        start: 0,
        end: text.length,
        attributes: {
          font: [font],
          fontSize,
          color: 'black',
        },
      },
    ],
  };

  const container: Container = {
    x: 0,
    y: 0,
    width,
    height,
  };

  // layoutEngine returns an array of paragraphs
  const paragraphs = layoutEngine(attributedString, container);

  const lines: any[] = [];

  if (paragraphs && paragraphs.length > 0) {
    for (const paragraph of paragraphs) {
      // Each paragraph is an array of lines (AttributedString[])
      for (const line of paragraph) {
        if (line.runs) {
          for (const run of line.runs) {
            if (run.positions && run.glyphs) {
              let currentX = line.box?.x || 0;
              let text = '';
              let startX = currentX;

              for (let i = 0; i < run.glyphs.length; i++) {
                const glyph = run.glyphs[i];
                const position = run.positions[i];

                console.log('glyph', glyph);
                text += String.fromCodePoint(...glyph.codePoints);
                currentX += position.xAdvance || 0;
              }

              if (text.trim()) {
                lines.push({
                  text,
                  left: startX,
                  top: line.box?.y || 0,
                  right: currentX,
                  bottom: (line.box?.y || 0) + (line.box?.height || fontSize),
                  font: `400 ${fontSize}px "Roboto"`,
                });
              }
            }
          }
        }
      }
    }
  }

  const endTime = performance.now();
  console.log(`Textkit layout took ${endTime - startTime}ms`, lines);

  return {
    width,
    height,
    lines,
  };
}

export async function computeTextkitLayoutWithPaths(
  text: string,
  width: number,
  height: number,
  fontSize: number = 60,
): Promise<{ layout: Layout; glyphPaths: any[] }> {
  const startTime = performance.now();
  const font = await loadRobotoFont();

  const attributedString: AttributedString = {
    string: text,
    runs: [
      {
        start: 0,
        end: text.length,
        attributes: {
          font: [font],
          fontSize,
          color: 'black',
        },
      },
    ],
  };

  const container: Container = {
    x: 0,
    y: 0,
    width,
    height,
  };

  // layoutEngine returns an array of paragraphs
  const paragraphs = layoutEngine(attributedString, container);

  const lines: any[] = [];
  const glyphPaths: any[] = [];

  if (paragraphs && paragraphs.length > 0) {
    for (const paragraph of paragraphs) {
      // Each paragraph is an array of lines (AttributedString[])
      for (const line of paragraph) {
        if (line.runs) {
          for (const run of line.runs) {
            if (run.positions && run.glyphs) {
              let currentX = line.box?.x || 0;

              // Calculate proper ascent from font metrics
              const ascent = (font.ascent / font.unitsPerEm) * fontSize;

              for (let i = 0; i < run.glyphs.length; i++) {
                const glyph = run.glyphs[i];
                const position = run.positions[i];

                // @ts-ignore
                if (glyph && glyph.id) {
                  // @ts-ignore
                  const glyphObj = font.getGlyph(glyph.id);
                  if (glyphObj && glyphObj.path) {
                    glyphPaths.push({
                      path: glyphObj.path.toSVG(),
                      x: currentX,
                      y: (line.box?.y || 0) + ascent,
                      scale: fontSize / font.unitsPerEm,
                    });
                  }

                  // @ts-ignore
                  if (glyph.string && glyph.string.trim()) {
                    lines.push({
                      // @ts-ignore
                      text: glyph.string,
                      left: currentX,
                      top: line.box?.y || 0,
                      right: currentX + (position.xAdvance || 0),
                      bottom:
                        (line.box?.y || 0) + (line.box?.height || fontSize),
                      font: `400 ${fontSize}px "Roboto"`,
                    });
                  }

                  currentX += position.xAdvance || 0;
                }
              }
            }
          }
        }
      }
    }
  }

  const endTime = performance.now();
  console.log(`Textkit layout with paths took ${endTime - startTime}ms`);

  return {
    layout: {
      width,
      height,
      lines,
    },
    glyphPaths,
  };
}
