import { create as createFont } from 'fontkit';
import { EditorState } from 'draft-js';
import { Layout } from './layout';

interface FontkitFont {
  regular: any;
  bold: any;
  italic: any;
  boldItalic: any;
  notoColorEmoji: any;
  notoSansSC: any; // Simplified Chinese
  notoSansTC: any; // Traditional Chinese
  notoSansJP: any; // Japanese
  notoSansKR: any; // Korean
  notoSansSCBold: any; // Simplified Chinese Bold
  notoSansTCBold: any; // Traditional Chinese Bold
  notoSansJPBold: any; // Japanese Bold
  notoSansKRBold: any; // Korean Bold
}

interface StyleRange {
  start: number;
  end: number;
  isBold: boolean;
  isItalic: boolean;
}

interface GlyphData {
  render?: (ctx: CanvasRenderingContext2D) => void;
  isEmoji?: boolean;
  char?: string;
  x: number;
  y: number;
  fontSize: number;
  font?: string;
}

// Load fonts using fontkit
async function loadFontkitFonts(): Promise<FontkitFont> {
  // In browser environment, we need to convert ArrayBuffer to a format fontkit can use
  const loadFont = async (url: string, weight?: number) => {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    // Convert ArrayBuffer to Uint8Array which fontkit can handle
    const uint8Array = new Uint8Array(arrayBuffer);
    const font = createFont(uint8Array as any);
    
    // Set font weight for variable fonts
    if (weight && (font as any).variationAxes && (font as any).variationAxes.wght) {
      // Set the weight variation
      (font as any).variation = { wght: weight };
    }
    
    return font;
  };

  const [
    regular, bold, italic, boldItalic, notoColorEmoji, 
    notoSansSC, notoSansTC, notoSansJP, notoSansKR,
    notoSansSCBold, notoSansTCBold, notoSansJPBold, notoSansKRBold
  ] = await Promise.all([
    loadFont('/Roboto/Roboto-VariableFont_wdth,wght.ttf', 400),
    loadFont('/Roboto/Roboto-VariableFont_wdth,wght.ttf', 700), // Bold weight
    loadFont('/Roboto/Roboto-Italic-VariableFont_wdth,wght.ttf', 400),
    loadFont('/Roboto/Roboto-Italic-VariableFont_wdth,wght.ttf', 700), // Bold italic weight
    loadFont('/Noto_Color_Emoji/NotoColorEmoji-Regular.ttf'),
    loadFont('/Noto_Sans_SC/NotoSansSC-VariableFont_wght.ttf', 400), // Regular weight for CJK
    loadFont('/Noto_Sans_TC/NotoSansTC-VariableFont_wght.ttf', 400), // Regular weight for CJK
    loadFont('/Noto_Sans_JP/NotoSansJP-VariableFont_wght.ttf', 400), // Regular weight for CJK
    loadFont('/Noto_Sans_KR/NotoSansKR-VariableFont_wght.ttf', 400), // Regular weight for CJK
    loadFont('/Noto_Sans_SC/NotoSansSC-VariableFont_wght.ttf', 700), // Bold weight for CJK
    loadFont('/Noto_Sans_TC/NotoSansTC-VariableFont_wght.ttf', 700), // Bold weight for CJK
    loadFont('/Noto_Sans_JP/NotoSansJP-VariableFont_wght.ttf', 700), // Bold weight for CJK
    loadFont('/Noto_Sans_KR/NotoSansKR-VariableFont_wght.ttf', 700), // Bold weight for CJK
  ]);

  return { 
    regular, bold, italic, boldItalic, notoColorEmoji, 
    notoSansSC, notoSansTC, notoSansJP, notoSansKR,
    notoSansSCBold, notoSansTCBold, notoSansJPBold, notoSansKRBold
  };
}

// Extract style ranges from DraftJS editor state
function extractStyleRanges(editorState: EditorState): StyleRange[] {
  const content = editorState.getCurrentContent();
  const plainText = content.getPlainText();
  const styleRanges: StyleRange[] = [];
  
  let currentOffset = 0;
  content.getBlockMap().forEach(block => {
    const blockLength = block!.getLength();
    const characterList = block!.getCharacterList();
    
    let rangeStart = 0;
    let currentHasBold = false;
    let currentHasItalic = false;
    
    // Get initial styles
    const firstCharStyle = characterList.get(0)?.getStyle();
    if (firstCharStyle) {
      currentHasBold = firstCharStyle.has('BOLD');
      currentHasItalic = firstCharStyle.has('ITALIC');
    }
    
    for (let i = 1; i <= blockLength; i++) {
      let nextHasBold = false;
      let nextHasItalic = false;
      
      if (i < blockLength) {
        const nextStyles = characterList.get(i)?.getStyle();
        if (nextStyles) {
          nextHasBold = nextStyles.has('BOLD');
          nextHasItalic = nextStyles.has('ITALIC');
        }
      }
      
      if ((currentHasBold !== nextHasBold || currentHasItalic !== nextHasItalic) || i === blockLength) {
        if (currentHasBold || currentHasItalic) {
          styleRanges.push({
            start: currentOffset + rangeStart,
            end: currentOffset + i,
            isBold: currentHasBold,
            isItalic: currentHasItalic,
          });
        }
        rangeStart = i;
        currentHasBold = nextHasBold;
        currentHasItalic = nextHasItalic;
      }
    }
    
    currentOffset += blockLength;
  });
  
  return styleRanges;
}

// Get the appropriate font based on style
function getFontForStyle(fonts: FontkitFont, isBold: boolean, isItalic: boolean): any {
  if (isBold && isItalic) return fonts.boldItalic;
  if (isBold) return fonts.bold;
  if (isItalic) return fonts.italic;
  return fonts.regular;
}

// Check if a character is an emoji
function isEmojiCodePoint(codePoint: number): boolean {
  return (
    (codePoint >= 0x1F300 && codePoint <= 0x1FAD6) || // Emoji blocks
    (codePoint >= 0x2600 && codePoint <= 0x26FF) ||   // Misc symbols
    (codePoint >= 0x2700 && codePoint <= 0x27BF) ||   // Dingbats
    (codePoint >= 0x1F600 && codePoint <= 0x1F64F) || // Emoticons
    (codePoint >= 0x1F680 && codePoint <= 0x1F6FF) || // Transport
    (codePoint >= 0x1F1E6 && codePoint <= 0x1F1FF)    // Flags
  );
}

// Check if a character is CJK
function isCJKCodePoint(codePoint: number): boolean {
  return (
    (codePoint >= 0x4E00 && codePoint <= 0x9FFF) ||   // CJK Unified Ideographs
    (codePoint >= 0x3400 && codePoint <= 0x4DBF) ||   // CJK Extension A
    (codePoint >= 0x3040 && codePoint <= 0x309F) ||   // Hiragana
    (codePoint >= 0x30A0 && codePoint <= 0x30FF) ||   // Katakana
    (codePoint >= 0xAC00 && codePoint <= 0xD7AF) ||   // Hangul Syllables
    (codePoint >= 0x1100 && codePoint <= 0x11FF) ||   // Hangul Jamo
    (codePoint >= 0x3130 && codePoint <= 0x318F) ||   // Hangul Compatibility Jamo
    (codePoint >= 0xA960 && codePoint <= 0xA97F)      // Hangul Jamo Extended-A
  );
}

// Detect which CJK font to use based on character
function getCJKFont(text: string, fonts: FontkitFont, isBold: boolean = false): any {
  // Try to detect the script based on character ranges
  for (const char of text) {
    const code = char.charCodeAt(0);
    
    // Korean
    if ((code >= 0xAC00 && code <= 0xD7AF) || (code >= 0x1100 && code <= 0x11FF)) {
      return isBold ? fonts.notoSansKRBold : fonts.notoSansKR;
    }
    
    // Japanese (Hiragana/Katakana)
    if ((code >= 0x3040 && code <= 0x309F) || (code >= 0x30A0 && code <= 0x30FF)) {
      return isBold ? fonts.notoSansJPBold : fonts.notoSansJP;
    }
  }
  
  // Default to Simplified Chinese for general CJK characters
  // In a real app, you might want to detect locale or have user preference
  return isBold ? fonts.notoSansSCBold : fonts.notoSansSC;
}

// Get the best font for a given text considering fallbacks
function selectFontForText(text: string, fonts: FontkitFont, baseFont: any, isBold: boolean = false): any {
  // Check if the text contains special characters that need fallback fonts
  for (const char of text) {
    const codePoint = char.codePointAt(0);
    if (!codePoint) continue;
    
    if (isEmojiCodePoint(codePoint)) {
      return fonts.notoColorEmoji;
    }
    
    if (isCJKCodePoint(codePoint)) {
      return getCJKFont(text, fonts, isBold);
    }
  }
  
  // Check if base font supports all characters
  const glyphRun = baseFont.layout(text);
  for (const glyph of glyphRun.glyphs) {
    // If glyph id is 0, it means the font doesn't have this character
    if ((glyph as any).id === 0) {
      // Try CJK fonts as fallback
      return getCJKFont(text, fonts, isBold);
    }
  }
  
  return baseFont;
}

/**
 * Main layout function using only fontkit
 * 1. Layouts each line of text using fontkit
 * 2. Manually wraps lines at whitespace boundaries
 * 3. Returns glyph data with render functions using glyph.render()
 */
export async function computeFontkitLayout(
  text: string,
  width: number,
  height: number,
  fontSize: number = 60,
  editorState?: EditorState
): Promise<{ layout: Layout; glyphData: GlyphData[] }> {
  const startTime = performance.now();
  const fonts = await loadFontkitFonts();
  const styleRanges = editorState ? extractStyleRanges(editorState) : [];
  
  // Debug logging
  if (styleRanges.length > 0) {
    console.log('Style ranges:', styleRanges);
  }
  
  const lines: any[] = [];
  const glyphData: GlyphData[] = [];
  
  // Create text segments based on style changes
  interface TextSegment {
    text: string;
    isBold: boolean;
    isItalic: boolean;
    start: number;
    end: number;
  }
  
  const segments: TextSegment[] = [];
  
  if (styleRanges.length === 0) {
    // No styles, treat as single segment
    segments.push({
      text: text,
      isBold: false,
      isItalic: false,
      start: 0,
      end: text.length
    });
  } else {
    // Split text based on style ranges
    let lastEnd = 0;
    
    // Sort style ranges by start position
    const sortedRanges = [...styleRanges].sort((a, b) => a.start - b.start);
    
    for (const range of sortedRanges) {
      // Add any unstyled text before this range
      if (range.start > lastEnd) {
        segments.push({
          text: text.slice(lastEnd, range.start),
          isBold: false,
          isItalic: false,
          start: lastEnd,
          end: range.start
        });
      }
      
      // Add the styled range
      segments.push({
        text: text.slice(range.start, range.end),
        isBold: range.isBold,
        isItalic: range.isItalic,
        start: range.start,
        end: range.end
      });
      
      lastEnd = range.end;
    }
    
    // Add any remaining unstyled text
    if (lastEnd < text.length) {
      segments.push({
        text: text.slice(lastEnd),
        isBold: false,
        isItalic: false,
        start: lastEnd,
        end: text.length
      });
    }
  }
  
  // Now layout segments, breaking at word boundaries for wrapping
  let currentLineWidth = 0;
  let currentLineSegments: Array<{segment: TextSegment; glyphRun: any; font: any; width: number}> = [];
  
  // Simple line height - just use font size
  const lineHeight = fontSize;
  
  // Start Y position at the baseline of the first line
  let currentY = fontSize * 0.8; // Start slightly above to account for ascent
  
  // Process each segment
  for (const segment of segments) {
    if (!segment.text) continue;
    
    // Split segment into words for wrapping
    const words = segment.text.split(/(\s+)/);
    
    for (const word of words) {
      if (!word) continue;
      
      // Get the appropriate font for this segment
      const baseFont = getFontForStyle(fonts, segment.isBold, segment.isItalic);
      const font = selectFontForText(word, fonts, baseFont, segment.isBold);
      
      // Layout this word
      const glyphRun = font.layout(word);
      const wordWidth = glyphRun.advanceWidth * (fontSize / font.unitsPerEm);
      
      // Check if we need to wrap
      if (currentLineWidth > 0 && currentLineWidth + wordWidth > width && !/^\s+$/.test(word)) {
        // Wrap to next line - flush current line first
        if (currentLineSegments.length > 0) {
          // Add line boundary info
          lines.push({
            top: currentY - fontSize * 0.8,
            left: 0,
            bottom: currentY + fontSize * 0.2,
            right: currentLineWidth,
          });
          
          // Move to next line
          currentY += lineHeight;
          currentLineSegments = [];
          currentLineWidth = 0;
        }
      }
      
      // Add glyphs from this word to the current line
      let wordX = currentLineWidth;
      
      for (let i = 0; i < glyphRun.glyphs.length; i++) {
        const glyph = glyphRun.glyphs[i];
        const position = glyphRun.positions[i];
        
        const glyphX = wordX + (position.xOffset || 0) * (fontSize / font.unitsPerEm);
        const glyphY = currentY + (position.yOffset || 0) * (fontSize / font.unitsPerEm);
        
        // Check if this glyph is an emoji
        const codePoints = (glyph as any).codePoints as number[] | undefined;
        const isEmoji = font === fonts.notoColorEmoji || (codePoints && codePoints.some(isEmojiCodePoint));
        
        if (isEmoji) {
          // Handle emoji with fillText (Canvas2D handles emoji better this way)
          const glyphString = (glyph as any).string || 
            (codePoints ? String.fromCodePoint(...codePoints) : '');
          
          glyphData.push({
            isEmoji: true,
            char: glyphString,
            x: glyphX,
            y: glyphY,
            fontSize,
            font: `${fontSize}px "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji"`,
          });
        } else {
          // Use glyph.render for regular characters
          const glyphId = (glyph as any).id;
          const glyphObj = font.getGlyph(glyphId);
          
          if (glyphObj && typeof glyphObj.render === 'function') {
            // Create a render function that will be called during canvas rendering
              glyphData.push({
              render: (ctx: CanvasRenderingContext2D) => {
                ctx.save();
                
                // Move to glyph position
                ctx.translate(glyphX, glyphY);
                
                // Flip Y axis for proper font rendering
                // (fonts use bottom-left origin, canvas uses top-left)
                ctx.scale(1, -1);
                
                // Set fill style
                ctx.fillStyle = 'black';
                
                // Call fontkit's glyph.render method
                // This method handles all the complex path drawing internally
                glyphObj.render(ctx, fontSize);
                
                ctx.restore();
              },
              x: glyphX,
              y: glyphY,
              fontSize,
            });
          } else if (glyphObj && glyphObj.path) {
            // Fallback: use path if render is not available
            const pathData = glyphObj.path.toSVG();
            
            glyphData.push({
              render: (ctx: CanvasRenderingContext2D) => {
                ctx.save();
                ctx.translate(glyphX, glyphY);
                ctx.scale(fontSize / font.unitsPerEm, -fontSize / font.unitsPerEm);
                ctx.fillStyle = 'black';
                
                const path2d = new Path2D(pathData);
                ctx.fill(path2d);
                
                ctx.restore();
              },
              x: glyphX,
              y: glyphY,
              fontSize,
            });
          }
        }
        
        wordX += (position.xAdvance || 0) * (fontSize / font.unitsPerEm);
      }
      
      currentLineWidth += wordWidth;
      currentLineSegments.push({segment, glyphRun, font, width: wordWidth});
    }
  }
  
  // Add the last line if it has content
  if (currentLineSegments.length > 0) {
    lines.push({
      top: currentY - fontSize * 0.8,
      left: 0,
      bottom: currentY + fontSize * 0.2,
      right: currentLineWidth,
    });
  }
  
  const endTime = performance.now();
  console.log(`Fontkit manual layout took ${endTime - startTime}ms`);
  
  return {
    layout: {
      width,
      height,
      lines,
    },
    glyphData,
  };
}