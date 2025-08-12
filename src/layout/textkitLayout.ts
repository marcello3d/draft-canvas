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
import { simpleLinebreaker } from './simpleLinebreaker';

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

// Create a layout engine with our simple linebreaker
const simpleLayoutEngine = createLayoutEngine({
  bidi,
  fontSubstitution,
  scriptItemizer,
  textDecoration,
  linebreaker: simpleLinebreaker, // Use our new simple linebreaker
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
    robotoVariable,
    robotoItalicVariable,
    // CJK fonts using variable fonts where available
    notoSansSCVariable,
    notoSansTCVariable,
    notoSansJPVariable,
    notoSansKRVariable,
    // Emoji font
    notoColorEmoji,
  ] = await Promise.all([
    loadFont('/Roboto/Roboto-VariableFont_wdth,wght.ttf'),
    loadFont('/Roboto/Roboto-Italic-VariableFont_wdth,wght.ttf'),
    // Simplified Chinese variable font
    loadFont('/Noto_Sans_SC/NotoSansSC-VariableFont_wght.ttf'),
    // Traditional Chinese variable font
    loadFont('/Noto_Sans_TC/NotoSansTC-VariableFont_wght.ttf'),
    // Japanese variable font
    loadFont('/Noto_Sans_JP/NotoSansJP-VariableFont_wght.ttf'),
    // Korean variable font
    loadFont('/Noto_Sans_KR/NotoSansKR-VariableFont_wght.ttf'),
    // Emoji
    loadFont('/Noto_Color_Emoji/NotoColorEmoji-Regular.ttf'),
  ]);
  
  // Create variation instances for different weights
  // fontkit's getVariation method creates a new font instance with specific variation settings
  const createWeightVariation = (font: any, weight: number) => {
    if (font.variationAxes && font.variationAxes.wght) {
      console.log(`Creating variation for weight ${weight}`, font.variationAxes);
      return font.getVariation({ wght: weight, wdth: 100 });
    }
    console.log(`No variation axes found for font, using base font`);
    return font;
  };
  
  return {
    // Create specific weight instances from the variable fonts
    regular: createWeightVariation(robotoVariable, 400),
    bold: createWeightVariation(robotoVariable, 700),
    italic: createWeightVariation(robotoItalicVariable, 400),
    boldItalic: createWeightVariation(robotoItalicVariable, 700),
    notoSansSC: createWeightVariation(notoSansSCVariable, 400),
    notoSansSCBold: createWeightVariation(notoSansSCVariable, 700),
    notoSansTC: createWeightVariation(notoSansTCVariable, 400),
    notoSansTCBold: createWeightVariation(notoSansTCVariable, 700),
    notoSansJP: createWeightVariation(notoSansJPVariable, 400),
    notoSansJPBold: createWeightVariation(notoSansJPVariable, 700),
    notoSansKR: createWeightVariation(notoSansKRVariable, 400),
    notoSansKRBold: createWeightVariation(notoSansKRVariable, 700),
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
  useCustomLineBreaker: boolean | 'simple' = true,
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
      // Store the intended weight for variable fonts
      fontWeight: range.isBold ? 700 : 400,
      fontStyle: range.isItalic ? 'italic' : 'normal',
    },
  })) : [{
    start: 0,
    end: Math.max(text.length, 1), // Ensure at least 1 character range for empty text
    attributes: {
      font: [fonts.regular, fonts.notoSansSC, fonts.notoSansTC, fonts.notoSansJP, fonts.notoSansKR, fonts.notoColorEmoji], // Array with CJK and emoji fallback fonts
      fontSize,
      color: 'black',
      hyphenationFactor: 0, // Disable hyphenation
      // Default weight for variable fonts
      fontWeight: 400,
      fontStyle: 'normal',
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
  console.log('Using line breaker:', useCustomLineBreaker);

  // Choose layout engine based on preference
  const selectedEngine = useCustomLineBreaker === 'simple' 
    ? simpleLayoutEngine 
    : useCustomLineBreaker 
    ? strictLayoutEngine 
    : layoutEngine;
  // layoutEngine returns an array of paragraphs
  const paragraphs = selectedEngine(attributedString, container, layoutOptions);
  
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
        // Accumulate text from all runs in this line
        let lineText = '';
        let lineLeft = line.box?.x || 0;
        let lineRight = lineLeft;
        
        if (line.runs) {
          for (const run of line.runs) {
            if (run.positions && run.glyphs) {
              for (let i = 0; i < run.glyphs.length; i++) {
                const glyph = run.glyphs[i];
                const position = run.positions[i];
                const char = String.fromCodePoint(...glyph.codePoints);
                
                lineText += char;
                lineRight += position.xAdvance || 0;
                
                // Log details for last few characters
                if (i >= run.glyphs.length - 3) {
                  console.log(`    Glyph ${i}: "${char}" | xAdvance: ${position.xAdvance}, lineRight: ${lineRight.toFixed(2)}`);
                }
              }
            }
          }
        }
        
        // Only push one line entry per actual line
        if (lineText.trim()) {
          // Get font from first run (for now, we'll use a single font per line)
          const firstRun = line.runs?.[0];
          let fontWeight = (firstRun?.attributes as any)?.fontWeight || 400;
          let fontStyle = (firstRun?.attributes as any)?.fontStyle || 'normal';
          
          // Include all CJK and emoji fonts in the font family for comprehensive fallback
          const fontFamily = '"Roboto", "Noto Sans SC", "Noto Sans TC", "Noto Sans JP", "Noto Sans KR", "Noto Color Emoji", sans-serif';
          
          // Build font string with proper weight and style
          const fontString = fontStyle === 'italic' 
            ? `italic ${fontWeight} ${fontSize}px ${fontFamily}`
            : `${fontWeight} ${fontSize}px ${fontFamily}`;
          
          // Debug log to check font settings
          if (fontWeight !== 400 || fontStyle !== 'normal') {
            console.log(`Font: weight=${fontWeight}, style=${fontStyle}, string="${fontString}"`);
          }
          
          lines.push({
            text: lineText,
            left: lineLeft,
            top: line.box?.y || 0,
            right: lineRight,
            bottom: (line.box?.y || 0) + (line.box?.height || fontSize),
            font: fontString,
          });
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
  useCustomLineBreaker: boolean | 'simple' = true,
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
      // Store the intended weight for variable fonts
      fontWeight: range.isBold ? 700 : 400,
      fontStyle: range.isItalic ? 'italic' : 'normal',
    },
  })) : [{
    start: 0,
    end: Math.max(text.length, 1), // Ensure at least 1 character range for empty text
    attributes: {
      font: [fonts.regular, fonts.notoSansSC, fonts.notoSansTC, fonts.notoSansJP, fonts.notoSansKR, fonts.notoColorEmoji], // Array with CJK and emoji fallback fonts
      fontSize,
      color: 'black',
      hyphenationFactor: 0, // Disable hyphenation
      // Default weight for variable fonts
      fontWeight: 400,
      fontStyle: 'normal',
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

  // Choose layout engine based on preference
  const selectedEngine = useCustomLineBreaker === 'simple' 
    ? simpleLayoutEngine 
    : useCustomLineBreaker 
    ? strictLayoutEngine 
    : layoutEngine;
  // layoutEngine returns an array of paragraphs
  const paragraphs = selectedEngine(attributedString, container, layoutOptions);

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

              // Process glyphs, grouping keycap sequences together
              let i = 0;
              while (i < run.glyphs.length) {
                const glyph = run.glyphs[i];
                const position = run.positions[i];

                if (glyph && 'id' in glyph) {
                  const glyphCodePoints = (glyph as any).codePoints as number[] | undefined;
                  
                  // Check if this starts a keycap sequence (digit or # followed by variation selector and keycap)
                  let isKeycapSequence = false;
                  let keycapChar = '';
                  let totalAdvance = 0;
                  
                  if (glyphCodePoints && glyphCodePoints.length === 1) {
                    const cp = glyphCodePoints[0];
                    // Check if this is a digit (0-9) or # or *
                    if ((cp >= 0x30 && cp <= 0x39) || cp === 0x23 || cp === 0x2A) {
                      // Look ahead for variation selector and keycap
                      if (i + 2 < run.glyphs.length) {
                        const nextGlyph1 = run.glyphs[i + 1];
                        const nextGlyph2 = run.glyphs[i + 2];
                        const nextCp1 = (nextGlyph1 as any).codePoints as number[] | undefined;
                        const nextCp2 = (nextGlyph2 as any).codePoints as number[] | undefined;
                        
                        if (nextCp1 && nextCp1.includes(0xFE0F) && nextCp2 && nextCp2.includes(0x20E3)) {
                          // This is a keycap sequence!
                          isKeycapSequence = true;
                          // Combine all three characters
                          keycapChar = String.fromCodePoint(cp, 0xFE0F, 0x20E3);
                          // Sum up the advances
                          totalAdvance = (position.xAdvance || 0) + 
                                       (run.positions[i + 1]?.xAdvance || 0) + 
                                       (run.positions[i + 2]?.xAdvance || 0);
                        }
                      }
                    }
                  }
                  
                  const glyphX = currentX + (position.xOffset || 0);
                  const glyphY = (line.box?.y || 0) + ascent + (position.yOffset || 0);
                  
                  if (isKeycapSequence) {
                    // Render the complete keycap emoji as one unit
                    glyphPaths.push({
                      isEmoji: true,
                      char: keycapChar,
                      x: glyphX,
                      y: glyphY,
                      fontSize,
                      font: `${fontSize}px "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji"`,
                    });
                    currentX += totalAdvance;
                    i += 3; // Skip the next two glyphs (variation selector and keycap)
                    continue;
                  }
                  
                  // Check if this is a regular emoji
                  const isEmoji = runFont === fonts.notoColorEmoji || 
                    (glyphCodePoints && glyphCodePoints.some((cp: number) => 
                      // Common emoji ranges
                      (cp >= 0x1F300 && cp <= 0x1F9FF) || // Misc symbols and pictographs
                      (cp >= 0x2600 && cp <= 0x26FF) ||   // Misc symbols
                      (cp >= 0x2700 && cp <= 0x27BF) ||   // Dingbats
                      (cp >= 0x1F600 && cp <= 0x1F64F) || // Emoticons
                      (cp >= 0x1F680 && cp <= 0x1F6FF) || // Transport and map
                      (cp >= 0x1F1E6 && cp <= 0x1F1FF)     // Regional indicator symbols (flags)
                    ));
                  
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
                  } else if (glyphCodePoints && (glyphCodePoints.includes(0xFE0F) || glyphCodePoints.includes(0x20E3))) {
                    // Skip standalone variation selectors and keycaps (they should be part of a sequence)
                    // Don't render them
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
                  
                  currentX += position.xAdvance || 0;
                }
                i++;
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

export async function computeTextkitLayoutWithRender(
  text: string,
  width: number,
  height: number,
  fontSize: number = 60,
  editorState?: EditorState,
  useCustomLineBreaker: boolean | 'simple' = true,
): Promise<{ layout: Layout; glyphData: any[] }> {
  const startTime = performance.now();
  const fonts = await loadRobotoFonts();
  const styleRanges = editorState ? extractStyleRanges(editorState) : [];

  // Create runs based on style ranges (same as before)
  const runs = styleRanges.length > 0 ? styleRanges.map(range => ({
    start: range.start,
    end: range.end,
    attributes: {
      font: getFontForStyles(fonts, range.isBold, range.isItalic),
      fontSize,
      color: 'black',
      hyphenationFactor: 0,
      fontWeight: range.isBold ? 700 : 400,
      fontStyle: range.isItalic ? 'italic' : 'normal',
    },
  })) : [{
    start: 0,
    end: Math.max(text.length, 1),
    attributes: {
      font: [fonts.regular, fonts.notoSansSC, fonts.notoSansTC, fonts.notoSansJP, fonts.notoSansKR, fonts.notoColorEmoji],
      fontSize,
      color: 'black',
      hyphenationFactor: 0,
      fontWeight: 400,
      fontStyle: 'normal',
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
    height: Infinity,
  };

  const layoutOptions: LayoutOptions = {
    tolerance: 0.1,
    hyphenationPenalty: Infinity,
    shrinkCharFactor: { before: 0.01, after: 0.01 },
    shrinkWhitespaceFactor: { before: 0.1, after: 0.1 },
    expandCharFactor: { before: 0.01, after: 0.01 },
    expandWhitespaceFactor: { before: 0.1, after: 0.1 },
  };

  // Choose layout engine based on preference
  const selectedEngine = useCustomLineBreaker === 'simple' 
    ? simpleLayoutEngine 
    : useCustomLineBreaker 
    ? strictLayoutEngine 
    : layoutEngine;
    
  const paragraphs = selectedEngine(attributedString, container, layoutOptions);

  const lines: any[] = [];
  const glyphData: any[] = [];

  if (paragraphs && paragraphs.length > 0) {
    for (const paragraph of paragraphs) {
      for (const line of paragraph) {
        if (line.runs) {
          let lineX = line.box?.x || 0;
          
          for (const run of line.runs) {
            if (run.positions && run.glyphs) {
              let currentX = lineX;
              const runFont = run.attributes?.font?.[0] || fonts.regular;
              const ascent = ((runFont as any).ascent / (runFont as any).unitsPerEm) * fontSize;

              // Process glyphs, grouping keycap sequences
              let i = 0;
              while (i < run.glyphs.length) {
                const glyph = run.glyphs[i];
                const position = run.positions[i];

                if (glyph && 'id' in glyph) {
                  const glyphCodePoints = (glyph as any).codePoints as number[] | undefined;
                  
                  // Check for keycap sequence
                  let isKeycapSequence = false;
                  let keycapChar = '';
                  let totalAdvance = 0;
                  
                  if (glyphCodePoints && glyphCodePoints.length === 1) {
                    const cp = glyphCodePoints[0];
                    if ((cp >= 0x30 && cp <= 0x39) || cp === 0x23 || cp === 0x2A) {
                      if (i + 2 < run.glyphs.length) {
                        const nextGlyph1 = run.glyphs[i + 1];
                        const nextGlyph2 = run.glyphs[i + 2];
                        const nextCp1 = (nextGlyph1 as any).codePoints as number[] | undefined;
                        const nextCp2 = (nextGlyph2 as any).codePoints as number[] | undefined;
                        
                        if (nextCp1 && nextCp1.includes(0xFE0F) && nextCp2 && nextCp2.includes(0x20E3)) {
                          isKeycapSequence = true;
                          keycapChar = String.fromCodePoint(cp, 0xFE0F, 0x20E3);
                          totalAdvance = (position.xAdvance || 0) + 
                                       (run.positions[i + 1]?.xAdvance || 0) + 
                                       (run.positions[i + 2]?.xAdvance || 0);
                        }
                      }
                    }
                  }
                  
                  const glyphX = currentX + (position.xOffset || 0);
                  const glyphY = (line.box?.y || 0) + ascent + (position.yOffset || 0);
                  
                  if (isKeycapSequence) {
                    glyphData.push({
                      isEmoji: true,
                      char: keycapChar,
                      x: glyphX,
                      y: glyphY,
                      fontSize,
                      font: `${fontSize}px "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji"`,
                    });
                    currentX += totalAdvance;
                    i += 3;
                    continue;
                  }
                  
                  // Check if this is an emoji
                  const isEmoji = runFont === fonts.notoColorEmoji || 
                    (glyphCodePoints && glyphCodePoints.some((cp: number) => 
                      (cp >= 0x1F300 && cp <= 0x1F9FF) ||
                      (cp >= 0x2600 && cp <= 0x26FF) ||
                      (cp >= 0x2700 && cp <= 0x27BF) ||
                      (cp >= 0x1F600 && cp <= 0x1F64F) ||
                      (cp >= 0x1F680 && cp <= 0x1F6FF) ||
                      (cp >= 0x1F1E6 && cp <= 0x1F1FF)
                    ));
                  
                  if (isEmoji) {
                    const glyphString = (glyph as any).string as string | undefined;
                    const char = glyphString || String.fromCodePoint(...(glyphCodePoints || []));
                    glyphData.push({
                      isEmoji: true,
                      char,
                      x: glyphX,
                      y: glyphY,
                      fontSize,
                      font: `${fontSize}px "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji"`,
                    });
                  } else if (glyphCodePoints && (glyphCodePoints.includes(0xFE0F) || glyphCodePoints.includes(0x20E3))) {
                    // Skip standalone variation selectors and keycaps
                  } else {
                    // Try to use glyph.render if available
                    const glyphId = (glyph as any).id;
                    const glyphObj = (runFont as any).getGlyph(glyphId);
                    
                    if (glyphObj) {
                      // Use glyph.render(ctx, size) - fontkit's built-in rendering
                      if (typeof glyphObj.render === 'function') {
                        glyphData.push({
                          render: (ctx: CanvasRenderingContext2D) => {
                            ctx.save();
                            // Translate to glyph position
                            ctx.translate(glyphX, glyphY);
                            // Flip Y axis for proper font rendering
                            ctx.scale(1, -1);
                            
                            // Set up the context for rendering
                            ctx.fillStyle = 'black';
                            
                            // Call fontkit's glyph.render with context and size
                            // This handles all the scaling and path drawing internally
                            glyphObj.render(ctx, fontSize);
                            
                            ctx.restore();
                          },
                          x: glyphX,
                          y: glyphY,
                          scale: fontSize / (runFont as any).unitsPerEm,
                          fontSize,
                        });
                      } else if (glyphObj.path) {
                        // Fallback to path if render not available
                        glyphData.push({
                          path: glyphObj.path.toSVG(),
                          x: glyphX,
                          y: glyphY,
                          scale: fontSize / (runFont as any).unitsPerEm,
                        });
                      }
                    }
                  }
                  
                  currentX += position.xAdvance || 0;
                }
                i++;
              }
              
              lineX = currentX;
            }
          }
        }
      }
    }
  }

  const endTime = performance.now();
  console.log(`Textkit layout with render took ${endTime - startTime}ms`);

  return {
    layout: {
      width,
      height,
      lines,
    },
    glyphData,
  };
}
