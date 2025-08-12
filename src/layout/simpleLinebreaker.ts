import type { AttributedString, LayoutOptions, Run } from '@react-pdf/textkit';

/**
 * A simplified linebreaker that properly handles graphemes and emoji
 * Key principles:
 * 1. Use grapheme segmentation to identify visual units
 * 2. Never break within a grapheme
 * 3. Map graphemes to glyphs (usually 1:1 for properly shaped text)
 * 4. Calculate widths at the grapheme level
 */

interface Grapheme {
  text: string;
  start: number; // Start position in original string
  end: number;   // End position in original string
  width: number;
  isBreakable: boolean; // Can we break after this grapheme?
}

/**
 * Get grapheme clusters from a string
 */
function getGraphemes(text: string): Array<{ segment: string; index: number }> {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    return Array.from(segmenter.segment(text));
  }
  // Fallback: treat each character as a grapheme
  return text.split('').map((char, index) => ({ segment: char, index }));
}

/**
 * Check if we can break after this position
 */
function canBreakAfter(text: string, grapheme: string, nextGrapheme: string | undefined): boolean {
  // Always can break at the end
  if (!nextGrapheme) return true;
  
  // Can break after whitespace
  if (/\s/.test(grapheme)) return true;
  
  // Can break before whitespace
  if (/\s/.test(nextGrapheme)) return true;
  
  // For CJK characters, we can break between them
  const isCJK = (char: string) => {
    const code = char.charCodeAt(0);
    return (code >= 0x4E00 && code <= 0x9FFF) || // CJK Unified Ideographs
           (code >= 0x3040 && code <= 0x309F) || // Hiragana
           (code >= 0x30A0 && code <= 0x30FF) || // Katakana
           (code >= 0xAC00 && code <= 0xD7AF);   // Hangul
  };
  
  if (isCJK(grapheme) || isCJK(nextGrapheme)) {
    return true;
  }
  
  // Use word segmenter if available
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const wordSegmenter = new Intl.Segmenter(undefined, { granularity: 'word' });
    // Check if there's a word boundary here
    const segments = Array.from(wordSegmenter.segment(grapheme + nextGrapheme));
    return segments.length > 1;
  }
  
  return false;
}

/**
 * Calculate the width of a grapheme based on its glyphs
 */
function getGraphemeWidth(
  graphemeStart: number,
  graphemeEnd: number,
  runs: Run[],
  string: string
): number {
  // Find the run that contains this grapheme
  for (const run of runs) {
    const runStart = run.start || 0;
    const runEnd = run.end || 0;
    
    if (graphemeStart >= runStart && graphemeStart < runEnd) {
      // If we have glyph measurements
      if (run.positions && run.glyphs) {
        // Map the grapheme to its glyph
        // In properly shaped text, graphemes usually correspond to glyphs
        // For simplicity, we'll use the grapheme index within the run
        // Note: Run doesn't have a string property, we need to extract from main string
        const runString = string.substring(runStart, runEnd);
        const graphemes = getGraphemes(runString);
        let graphemeIndex = 0;
        let currentPos = runStart;
        
        for (const g of graphemes) {
          if (currentPos === graphemeStart) {
            // Found our grapheme
            if (graphemeIndex < run.glyphs.length && graphemeIndex < run.positions.length) {
              // Return the width of this glyph
              return run.positions[graphemeIndex].xAdvance || 0;
            }
            break;
          }
          currentPos += g.segment.length;
          graphemeIndex++;
        }
      }
      
      // Fallback: estimate based on font size
      const fontSize = run.attributes?.fontSize || 60;
      const graphemeLength = graphemeEnd - graphemeStart;
      
      // Emoji and multi-codepoint graphemes get full width
      if (graphemeLength > 1) {
        return fontSize;
      }
      
      // Regular characters
      return fontSize * 0.6;
    }
  }
  
  return 36; // Default fallback
}

/**
 * Extract runs for a line
 */
function extractRunsForLine(
  runs: Run[],
  lineStart: number,
  lineEnd: number,
  string: string
): Run[] {
  const result: Run[] = [];
  
  for (const run of runs) {
    const runStart = run.start || 0;
    const runEnd = run.end || 0;
    
    // Check for overlap
    if (runEnd <= lineStart || runStart >= lineEnd) {
      continue;
    }
    
    // Calculate overlap
    const overlapStart = Math.max(runStart, lineStart);
    const overlapEnd = Math.min(runEnd, lineEnd);
    
    // Create new run for the overlap
    const newRun: Run = {
      ...run,
      start: overlapStart - lineStart, // Make relative to line
      end: overlapEnd - lineStart,
    };
    
    // If we have glyphs, we need to slice them appropriately
    if (run.glyphs && run.positions) {
      // For simplicity, we'll map based on grapheme boundaries
      // This is where the real complexity would be, but we'll keep it simple
      const startOffset = overlapStart - runStart;
      const endOffset = overlapEnd - runStart;
      
      // Count graphemes to find the slice range
      const runString = string.substring(runStart, runEnd);
      const graphemes = getGraphemes(runString);
      
      let startGlyphIdx = 0;
      let endGlyphIdx = run.glyphs.length;
      let currentPos = 0;
      
      for (let i = 0; i < graphemes.length; i++) {
        const g = graphemes[i];
        if (currentPos === startOffset) {
          startGlyphIdx = i;
        }
        if (currentPos === endOffset) {
          endGlyphIdx = i;
          break;
        }
        currentPos += g.segment.length;
      }
      
      newRun.glyphs = run.glyphs.slice(startGlyphIdx, endGlyphIdx);
      newRun.positions = run.positions.slice(startGlyphIdx, endGlyphIdx);
    }
    
    result.push(newRun);
  }
  
  return result;
}

/**
 * Simple linebreaker that handles graphemes properly
 */
export const simpleLinebreaker = (options: LayoutOptions = {}) => {
  return (attributedString: AttributedString, availableWidths: number[]): AttributedString[] => {
    const { string, runs } = attributedString;
    const lines: AttributedString[] = [];
    
    if (!string || string.length === 0) {
      return lines;
    }
    
    console.log('=== SIMPLE LINEBREAKER ===');
    console.log('Input:', JSON.stringify(string));
    console.log('Widths:', availableWidths);
    
    // Get all graphemes
    const graphemeData = getGraphemes(string);
    console.log('Graphemes:', graphemeData.length);
    
    // Build grapheme objects with width and break info
    const graphemes: Grapheme[] = [];
    for (let i = 0; i < graphemeData.length; i++) {
      const g = graphemeData[i];
      const nextG = graphemeData[i + 1];
      
      const grapheme: Grapheme = {
        text: g.segment,
        start: g.index,
        end: g.index + g.segment.length,
        width: getGraphemeWidth(g.index, g.index + g.segment.length, runs, string),
        isBreakable: canBreakAfter(string, g.segment, nextG?.segment),
      };
      
      graphemes.push(grapheme);
    }
    
    // Now break into lines
    let lineIndex = 0;
    let currentLineStart = 0;
    let currentLineWidth = 0;
    let lastBreakPoint = 0;
    let widthAtLastBreak = 0;
    
    for (let i = 0; i < graphemes.length; i++) {
      const grapheme = graphemes[i];
      const maxWidth = lineIndex < availableWidths.length 
        ? availableWidths[lineIndex]
        : availableWidths[availableWidths.length - 1];
      
      const newWidth = currentLineWidth + grapheme.width;
      
      // Check for explicit line breaks
      if (grapheme.text === '\n' || grapheme.text === '\r') {
        // Create line up to this point
        const lineText = string.substring(currentLineStart, grapheme.start);
        createLine(lineText, currentLineStart, grapheme.start);
        
        currentLineStart = grapheme.end;
        currentLineWidth = 0;
        lastBreakPoint = grapheme.end;
        widthAtLastBreak = 0;
        lineIndex++;
        continue;
      }
      
      // Check if adding this grapheme exceeds width
      if (newWidth > maxWidth && i > 0) {
        // Need to break
        let breakAt = lastBreakPoint > currentLineStart ? lastBreakPoint : grapheme.start;
        
        // If we haven't moved forward, force break before current grapheme
        if (breakAt === currentLineStart && grapheme.start > currentLineStart) {
          breakAt = grapheme.start;
        }
        
        const lineText = string.substring(currentLineStart, breakAt).trimEnd();
        createLine(lineText, currentLineStart, currentLineStart + lineText.length);
        
        // Start next line
        currentLineStart = breakAt;
        // Skip leading whitespace on new line
        while (currentLineStart < string.length && /\s/.test(string[currentLineStart])) {
          currentLineStart++;
        }
        
        // Recalculate width for remaining graphemes on new line
        currentLineWidth = 0;
        for (let j = i; j < graphemes.length && graphemes[j].start < currentLineStart; j++) {
          // Skip graphemes before new line start
        }
        
        // Add current grapheme to new line if it starts at or after line start
        if (grapheme.start >= currentLineStart) {
          currentLineWidth = grapheme.width;
        }
        
        lastBreakPoint = currentLineStart;
        widthAtLastBreak = 0;
        lineIndex++;
      } else {
        // Grapheme fits
        currentLineWidth = newWidth;
        
        // Track break points
        if (grapheme.isBreakable) {
          lastBreakPoint = grapheme.end;
          widthAtLastBreak = currentLineWidth;
        }
      }
    }
    
    // Create final line
    if (currentLineStart < string.length) {
      const lineText = string.substring(currentLineStart).trimEnd();
      createLine(lineText, currentLineStart, currentLineStart + lineText.length);
    }
    
    function createLine(text: string, start: number, end: number) {
      const lineRuns = extractRunsForLine(runs, start, end, string);
      
      // Calculate actual line width
      let lineWidth = 0;
      const lineGraphemes = getGraphemes(text);
      for (const g of lineGraphemes) {
        lineWidth += getGraphemeWidth(start + g.index, start + g.index + g.segment.length, runs, string);
      }
      
      const line: AttributedString = {
        string: text,
        runs: lineRuns,
        box: {
          x: 0,
          y: 0,
          width: lineWidth,
          height: 0,
        },
      };
      
      lines.push(line);
      console.log(`Line ${lines.length - 1}: "${text}" (width: ${lineWidth})`);
    }
    
    console.log(`Created ${lines.length} lines`);
    return lines;
  };
};