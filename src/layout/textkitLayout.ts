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
  type LayoutOptions,
} from '@react-pdf/textkit';
import * as fontkit from 'fontkit';
import { Layout } from './layout';
import { EditorState, ContentBlock } from 'draft-js';
import { customLinebreaker } from './customLinebreaker';

let fontCache: { [key: string]: any } = {};

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

// Create a layout engine with our custom strict linebreaker
const strictLayoutEngine = createLayoutEngine({
  bidi,
  fontSubstitution,
  scriptItemizer,
  textDecoration,
  linebreaker: customLinebreaker, // Use our custom linebreaker (no cast needed!)
  justification,
  // Explicitly no hyphenationCallback to disable hyphenation
});

async function loadFont(fontPath: string) {
  if (!fontCache[fontPath]) {
    console.log('Loading font:', fontPath);
    const response = await fetch(fontPath);
    if (!response.ok) {
      console.error('Failed to load font:', fontPath, response.status);
      throw new Error(`Failed to load font: ${fontPath}`);
    }
    const buffer = await response.arrayBuffer();
    // Create a buffer-like object that fontkit can use
    const uint8Array = new Uint8Array(buffer);
    const font = fontkit.create(uint8Array as any);
    console.log('Font loaded:', fontPath);
    fontCache[fontPath] = font;
  }
  return fontCache[fontPath];
}

async function loadRobotoFonts() {
  const [
    regular, 
    bold, 
    italic, 
    boldItalic,
    // Simplified Chinese fonts
    notoSansSC,
    notoSansSCBold,
    // Traditional Chinese fonts
    notoSansTC,
    notoSansTCBold,
    // Japanese fonts
    notoSansJP,
    notoSansJPBold,
    // Korean fonts
    notoSansKR,
    notoSansKRBold,
    // Emoji font
    notoColorEmoji,
  ] = await Promise.all([
    loadFont('/Roboto/Roboto-Regular.ttf'),
    loadFont('/Roboto/Roboto-Bold.ttf'),
    loadFont('/Roboto/Roboto-Italic.ttf'),
    loadFont('/Roboto/Roboto-BoldItalic.ttf'),
    // Simplified Chinese
    loadFont('/Noto_Sans_SC/static/NotoSansSC-Regular.ttf'),
    loadFont('/Noto_Sans_SC/static/NotoSansSC-Bold.ttf'),
    // Traditional Chinese
    loadFont('/Noto_Sans_TC/static/NotoSansTC-Regular.ttf'),
    loadFont('/Noto_Sans_TC/static/NotoSansTC-Bold.ttf'),
    // Japanese
    loadFont('/Noto_Sans_JP/static/NotoSansJP-Regular.ttf'),
    loadFont('/Noto_Sans_JP/static/NotoSansJP-Bold.ttf'),
    // Korean
    loadFont('/Noto_Sans_KR/static/NotoSansKR-Regular.ttf'),
    loadFont('/Noto_Sans_KR/static/NotoSansKR-Bold.ttf'),
    // Emoji
    loadFont('/Noto_Color_Emoji/NotoColorEmoji-Regular.ttf'),
  ]);
  
  return {
    regular,
    bold,
    italic,
    boldItalic,
    notoSansSC,
    notoSansSCBold,
    notoSansTC,
    notoSansTCBold,
    notoSansJP,
    notoSansJPBold,
    notoSansKR,
    notoSansKRBold,
    notoColorEmoji,
  };
}

function getFontForStyles(fonts: any, isBold: boolean, isItalic: boolean) {
  // Return an array of fonts for fallback support
  // Primary font based on style, with all CJK fonts as fallbacks
  // Note: CJK fonts typically don't have italic variants, so we use regular/bold only for CJK
  
  // Order: Latin -> Simplified Chinese -> Traditional Chinese -> Japanese -> Korean
  // This covers most common use cases while providing comprehensive CJK support
  
  if (isBold && isItalic) {
    return [
      fonts.boldItalic,
      fonts.notoSansSCBold,
      fonts.notoSansTCBold,
      fonts.notoSansJPBold,
      fonts.notoSansKRBold,
      fonts.notoColorEmoji,
    ];
  }
  if (isBold) {
    return [
      fonts.bold,
      fonts.notoSansSCBold,
      fonts.notoSansTCBold,
      fonts.notoSansJPBold,
      fonts.notoSansKRBold,
      fonts.notoColorEmoji,
    ];
  }
  if (isItalic) {
    // Use regular CJK fonts when italic (CJK doesn't have true italics)
    return [
      fonts.italic,
      fonts.notoSansSC,
      fonts.notoSansTC,
      fonts.notoSansJP,
      fonts.notoSansKR,
      fonts.notoColorEmoji,
    ];
  }
  return [
    fonts.regular,
    fonts.notoSansSC,
    fonts.notoSansTC,
    fonts.notoSansJP,
    fonts.notoSansKR,
    fonts.notoColorEmoji,
  ];
}

export interface StyleRange {
  start: number;
  end: number;
  isBold: boolean;
  isItalic: boolean;
}

export function extractStyleRanges(editorState: EditorState): StyleRange[] {
  const contentState = editorState.getCurrentContent();
  const blocks = contentState.getBlocksAsArray();
  const styleRanges: StyleRange[] = [];
  let offset = 0;

  blocks.forEach((block: ContentBlock, blockIndex: number) => {
    const text = block.getText();
    const characterList = block.getCharacterList();
    
    // Handle empty blocks (e.g., when user hits enter)
    if (text.length === 0) {
      // Still need to account for the newline character in offset
      if (blockIndex < blocks.length - 1) {
        // Create a range for the newline with default styling
        styleRanges.push({
          start: offset,
          end: offset + 1,
          isBold: false,
          isItalic: false,
        });
        offset += 1;
      }
      return;
    }
    
    let currentBold = false;
    let currentItalic = false;
    let rangeStart = offset;
    let isFirst = true;
    
    characterList.forEach((char, index) => {
      if (index === undefined) return;
      
      const styles = char?.getStyle();
      const hasBold = styles?.has('BOLD') || false;
      const hasItalic = styles?.has('ITALIC') || false;
      
      if (isFirst) {
        currentBold = hasBold;
        currentItalic = hasItalic;
        isFirst = false;
      } else if (currentBold !== hasBold || currentItalic !== hasItalic) {
        // Style changed, save the previous range
        if (rangeStart < offset + index) {
          styleRanges.push({
            start: rangeStart,
            end: offset + index,
            isBold: currentBold,
            isItalic: currentItalic,
          });
        }
        currentBold = hasBold;
        currentItalic = hasItalic;
        rangeStart = offset + index;
      }
    });
    
    // Save the last range of the block
    if (rangeStart < offset + text.length) {
      styleRanges.push({
        start: rangeStart,
        end: offset + text.length,
        isBold: currentBold,
        isItalic: currentItalic,
      });
    }
    
    offset += text.length;
    // Add newline between blocks (except last block)
    if (blockIndex < blocks.length - 1) {
      offset += 1;
    }
  });

  return styleRanges;
}

export async function computeTextkitLayout(
  text: string,
  width: number,
  height: number,
  fontSize: number = 60,
  editorState?: EditorState,
): Promise<Layout> {
  const startTime = performance.now();
  const fonts = await loadRobotoFonts();
  const styleRanges = editorState ? extractStyleRanges(editorState) : [];

  // Create runs based on style ranges
  // Ensure we always have at least one run with attributes, even for empty text
  const runs = styleRanges.length > 0 ? styleRanges.map(range => ({
    start: range.start,
    end: range.end,
    attributes: {
      font: getFontForStyles(fonts, range.isBold, range.isItalic), // Now returns an array
      fontSize,
      color: 'black',
      hyphenationFactor: 0, // Disable hyphenation
    },
  })) : [{
    start: 0,
    end: Math.max(text.length, 1), // Ensure at least 1 character range for empty text
    attributes: {
      font: [fonts.regular, fonts.notoSansSC, fonts.notoSansTC, fonts.notoSansJP, fonts.notoSansKR, fonts.notoColorEmoji], // Array with CJK and emoji fallback fonts
      fontSize,
      color: 'black',
      hyphenationFactor: 0, // Disable hyphenation
    },
  }];

  const attributedString: AttributedString = {
    string: text,
    runs,
  };

  const container: Container = {
    x: 0,
    y: 0,
    width,
    height: Infinity, // Don't limit height to allow natural wrapping
  };

  // Layout options for stricter line breaking
  // Using tiny non-zero values to give the algorithm minimal flexibility
  // while still being very strict about line boundaries
  const layoutOptions: LayoutOptions = {
    tolerance: 0.1, // Very low tolerance for line breaking
    hyphenationPenalty: Infinity, // Effectively disable hyphenation
    // Very small factors to allow minimal adjustment without causing overflow
    shrinkCharFactor: { before: 0.01, after: 0.01 },
    shrinkWhitespaceFactor: { before: 0.1, after: 0.1 },
    expandCharFactor: { before: 0.01, after: 0.01 },
    expandWhitespaceFactor: { before: 0.1, after: 0.1 },
  };

  console.log('=== TEXTKIT TEXT LAYOUT DEBUG ===');
  console.log('Input text:', JSON.stringify(text));
  console.log('Text length:', text.length);
  console.log('Container width:', width);
  console.log('Font size:', fontSize);
  console.log('Layout options:', layoutOptions);

  // Use strict layout engine to prevent overflow
  // layoutEngine returns an array of paragraphs
  const paragraphs = strictLayoutEngine(attributedString, container, layoutOptions);
  
  console.log('Paragraphs returned:', paragraphs?.length);
  if (paragraphs && paragraphs.length > 0) {
    paragraphs.forEach((paragraph, pIdx) => {
      console.log(`Paragraph ${pIdx}: ${paragraph.length} lines`);
      paragraph.forEach((line, lIdx) => {
        console.log(`  Line ${lIdx}:`, {
          box: line.box,
          string: line.string,
          runs: line.runs?.length,
          totalGlyphs: line.runs?.reduce((sum, run) => sum + (run.glyphs?.length || 0), 0)
        });
      });
    });
  }

  const lines: any[] = [];

  if (paragraphs && paragraphs.length > 0) {
    for (const paragraph of paragraphs) {
      // Each paragraph is an array of lines (AttributedString[])
      for (const line of paragraph) {
        if (line.runs) {
          let lineX = line.box?.x || 0; // Track X position across runs in this line
          
          for (const run of line.runs) {
            if (run.positions && run.glyphs) {
              let currentX = lineX; // Start from accumulated position
              let text = '';
              let startX = currentX;

              for (let i = 0; i < run.glyphs.length; i++) {
                const glyph = run.glyphs[i];
                const position = run.positions[i];
                const char = String.fromCodePoint(...glyph.codePoints);
                
                text += char;
                currentX += position.xAdvance || 0;
                
                // Log details for last few characters
                if (i >= run.glyphs.length - 3) {
                  console.log(`    Glyph ${i}: "${char}" | xAdvance: ${position.xAdvance}, currentX: ${currentX.toFixed(2)}`);
                }
              }

              if (text.trim()) {
                // Determine font weight and style from the run's font
                // The font array may contain multiple fonts for fallback
                const runFonts = run.attributes?.font;
                const primaryFont = runFonts?.[0];
                let fontWeight = 400;
                let fontStyle = 'normal';
                
                // Check if the primary font is any of the bold fonts
                const boldFonts = [
                  fonts.bold,
                  fonts.boldItalic,
                  fonts.notoSansSCBold,
                  fonts.notoSansTCBold,
                  fonts.notoSansJPBold,
                  fonts.notoSansKRBold,
                ];
                
                const italicFonts = [
                  fonts.italic,
                  fonts.boldItalic,
                ];
                
                if (boldFonts.includes(primaryFont)) {
                  fontWeight = 700;
                }
                if (italicFonts.includes(primaryFont)) {
                  fontStyle = 'italic';
                }
                
                // Include all CJK and emoji fonts in the font family for comprehensive fallback
                const fontFamily = '"Roboto", "Noto Sans SC", "Noto Sans TC", "Noto Sans JP", "Noto Sans KR", "Noto Color Emoji", sans-serif';
                const fontString = fontStyle === 'italic' 
                  ? `italic ${fontWeight} ${fontSize}px ${fontFamily}`
                  : `${fontWeight} ${fontSize}px ${fontFamily}`;
                
                lines.push({
                  text,
                  left: startX,
                  top: line.box?.y || 0,
                  right: currentX,
                  bottom: (line.box?.y || 0) + (line.box?.height || fontSize),
                  font: fontString,
                });
              }
              
              // Update lineX for the next run
              lineX = currentX;
            }
          }
        }
      }
    }
  }

  const endTime = performance.now();
  console.log(`Textkit layout took ${endTime - startTime}ms`);
  console.log('Final lines extracted:', lines.length);
  lines.forEach((line, idx) => {
    console.log(`  Line ${idx}: "${line.text}" | left: ${line.left.toFixed(2)}, right: ${line.right.toFixed(2)}, width: ${(line.right - line.left).toFixed(2)}`);
  });
  console.log('Total text from lines:', lines.map(l => l.text).join(''));

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
  editorState?: EditorState,
): Promise<{ layout: Layout; glyphPaths: any[] }> {
  const startTime = performance.now();
  const fonts = await loadRobotoFonts();
  const styleRanges = editorState ? extractStyleRanges(editorState) : [];

  // Create runs based on style ranges
  // Ensure we always have at least one run with attributes, even for empty text
  const runs = styleRanges.length > 0 ? styleRanges.map(range => ({
    start: range.start,
    end: range.end,
    attributes: {
      font: getFontForStyles(fonts, range.isBold, range.isItalic), // Now returns an array
      fontSize,
      color: 'black',
      hyphenationFactor: 0, // Disable hyphenation
    },
  })) : [{
    start: 0,
    end: Math.max(text.length, 1), // Ensure at least 1 character range for empty text
    attributes: {
      font: [fonts.regular, fonts.notoSansSC, fonts.notoSansTC, fonts.notoSansJP, fonts.notoSansKR, fonts.notoColorEmoji], // Array with CJK and emoji fallback fonts
      fontSize,
      color: 'black',
      hyphenationFactor: 0, // Disable hyphenation
    },
  }];

  const attributedString: AttributedString = {
    string: text,
    runs,
  };

  const container: Container = {
    x: 0,
    y: 0,
    width,
    height: Infinity, // Don't limit height to allow natural wrapping
  };

  // Layout options for stricter line breaking
  // Using tiny non-zero values to give the algorithm minimal flexibility
  // while still being very strict about line boundaries
  const layoutOptions: LayoutOptions = {
    tolerance: 0.1, // Very low tolerance for line breaking
    hyphenationPenalty: Infinity, // Effectively disable hyphenation
    // Very small factors to allow minimal adjustment without causing overflow
    shrinkCharFactor: { before: 0.01, after: 0.01 },
    shrinkWhitespaceFactor: { before: 0.1, after: 0.1 },
    expandCharFactor: { before: 0.01, after: 0.01 },
    expandWhitespaceFactor: { before: 0.1, after: 0.1 },
  };

  // Use strict layout engine to prevent overflow
  // layoutEngine returns an array of paragraphs
  const paragraphs = strictLayoutEngine(attributedString, container, layoutOptions);

  const lines: any[] = [];
  const glyphPaths: any[] = [];

  if (paragraphs && paragraphs.length > 0) {
    for (const paragraph of paragraphs) {
      // Each paragraph is an array of lines (AttributedString[])
      for (const line of paragraph) {
        if (line.runs) {
          let lineX = line.box?.x || 0; // Track X position across runs in this line
          
          for (const run of line.runs) {
            if (run.positions && run.glyphs) {
              let currentX = lineX; // Start from accumulated position

              // Get the font from the run attributes
              const runFont = run.attributes?.font?.[0] || fonts.regular;
              // Calculate proper ascent from font metrics
              const ascent = ((runFont as any).ascent / (runFont as any).unitsPerEm) * fontSize;

              for (let i = 0; i < run.glyphs.length; i++) {
                const glyph = run.glyphs[i];
                const position = run.positions[i];

                if (glyph && 'id' in glyph) {
                  // Check if this is an emoji (color emoji font or emoji codepoint)
                  const glyphCodePoints = (glyph as any).codePoints as number[] | undefined;
                  const isEmoji = runFont === fonts.notoColorEmoji || 
                    (glyphCodePoints && glyphCodePoints.some((cp: number) => 
                      // Common emoji ranges
                      (cp >= 0x1F300 && cp <= 0x1F9FF) || // Misc symbols and pictographs
                      (cp >= 0x2600 && cp <= 0x26FF) ||   // Misc symbols
                      (cp >= 0x2700 && cp <= 0x27BF) ||   // Dingbats
                      (cp >= 0x1F600 && cp <= 0x1F64F) || // Emoticons
                      (cp >= 0x1F680 && cp <= 0x1F6FF)    // Transport and map
                    ));
                  
                  const glyphX = currentX + (position.xOffset || 0);
                  const glyphY = (line.box?.y || 0) + ascent + (position.yOffset || 0);
                  
                  if (isEmoji) {
                    // For emoji, store the character to render with fillText
                    const glyphString = (glyph as any).string as string | undefined;
                    const char = glyphString || String.fromCodePoint(...(glyphCodePoints || []));
                    glyphPaths.push({
                      isEmoji: true,
                      char,
                      x: glyphX,
                      y: glyphY,
                      fontSize,
                      font: `${fontSize}px "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji"`,
                    });
                  } else {
                    // Regular glyph - try to get the path
                    const glyphId = (glyph as any).id;
                    const glyphObj = (runFont as any).getGlyph(glyphId);
                    if (glyphObj && glyphObj.path) {
                      glyphPaths.push({
                        path: glyphObj.path.toSVG(),
                        x: glyphX,
                        y: glyphY,
                        scale: fontSize / (runFont as any).unitsPerEm,
                      });
                    }
                  }
                  
                  const glyphWithString = glyph as any;
                  if (glyphWithString.string && glyphWithString.string.trim()) {
                    lines.push({
                      text: glyphWithString.string,
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
              
              // Update lineX for the next run
              lineX = currentX;
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
