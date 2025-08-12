import type { AttributedString, LayoutOptions, Run } from '@react-pdf/textkit';

// Create a word segmenter for finding word boundaries
// This properly handles all languages including CJK, Arabic, etc.
const wordSegmenter = typeof Intl !== 'undefined' && Intl.Segmenter 
  ? new Intl.Segmenter(undefined, { granularity: 'word' })
  : null;

// Fallback regex for whitespace detection if Segmenter is not available
// \s matches [ \t\n\r\f\v] and Unicode spaces
// \p{Z} matches any kind of whitespace or invisible separator (Unicode category)
const whitespaceRegex = /[\s\p{Z}]/u;

// CJK characters that cannot start a line (closing punctuation)
const noLineStart = /[!%),.:;?\]}¢°·'"†‡›℃∶、。〃〆〕〗〞﹚﹜）］｝〉》」』】〙〟'"｠»ヽヾーァィゥェォッャュョヮヵヶぁぃぅぇぉっゃゅょゎゕゖㇰㇱㇳㇴㇵㇶㇷㇸㇹㇺㇻㇼㇽㇾㇿ々〻‐゠–〜！％），．：；？］]/u;

// CJK characters that cannot end a line (opening punctuation)
const noLineEnd = /[$(\[{£¥·'"〈《「『【〔〖〝﹙﹛（［｛｟«〘￥￦#＄]/u;

/**
 * Check if we can break between two characters (considering CJK rules)
 */
function canBreakBetween(text: string, beforeIndex: number): boolean {
  // Can't break at the very beginning
  if (beforeIndex <= 0) return false;
  
  // Can break at the very end
  if (beforeIndex >= text.length) return true;
  
  const prevChar = text[beforeIndex - 1];
  const nextChar = text[beforeIndex];
  
  // Check CJK line breaking rules
  // Can't put certain characters at the start of a line
  if (noLineStart.test(nextChar)) {
    return false;
  }
  
  // Can't put certain characters at the end of a line
  if (noLineEnd.test(prevChar)) {
    return false;
  }
  
  return true;
}

/**
 * Check if a character is a valid word break point
 * Uses Intl.Segmenter for proper i18n support, falls back to regex
 */
function isWordBreakPoint(text: string, index: number): boolean {
  // Always allow breaking at the start or end
  if (index <= 0 || index >= text.length) {
    return true;
  }
  
  // First check CJK breaking rules
  if (!canBreakBetween(text, index)) {
    return false;
  }
  
  // For CJK characters, we can generally break between any two characters
  // (except for the prohibited combinations checked above)
  const prevChar = text[index - 1];
  const currChar = text[index];
  
  // Check if we're dealing with CJK characters (basic check)
  const isCJK = (char: string) => {
    const code = char.charCodeAt(0);
    return (code >= 0x4E00 && code <= 0x9FFF) || // CJK Unified Ideographs
           (code >= 0x3040 && code <= 0x309F) || // Hiragana
           (code >= 0x30A0 && code <= 0x30FF) || // Katakana
           (code >= 0xAC00 && code <= 0xD7AF);   // Hangul
  };
  
  // Between two CJK characters, we can usually break (unless prohibited by rules above)
  if (isCJK(prevChar) || isCJK(currChar)) {
    return true;
  }
  
  // Use Intl.Segmenter if available for non-CJK text
  if (wordSegmenter) {
    const segments = Array.from(wordSegmenter.segment(text));
    for (const segment of segments) {
      if (segment.index === index) {
        return true;
      }
    }
    return false;
  }
  
  // Fallback: check if current or previous character is whitespace
  return whitespaceRegex.test(currChar) || whitespaceRegex.test(prevChar);
}

/**
 * Check if a character is whitespace (including Unicode spaces)
 */
function isWhitespace(char: string): boolean {
  return whitespaceRegex.test(char);
}

/**
 * Custom line breaker that strictly enforces container width
 * Uses a simple greedy algorithm that breaks at the last valid word boundary
 * Supports international text through Intl.Segmenter
 */
export const customLinebreaker = (options: LayoutOptions = {}) => {
  return (attributedString: AttributedString, availableWidths: number[]): AttributedString[] => {
    const { string, runs, syllables } = attributedString;
    const lines: AttributedString[] = [];
    
    if (!string || string.length === 0) {
      return lines;
    }

    console.log('=== CUSTOM LINEBREAKER ===');
    console.log('Input string:', JSON.stringify(string));
    console.log('Available widths:', availableWidths);
    console.log('Runs:', runs.length);
    console.log('Has syllables?', !!syllables);
    if (runs.length > 0) {
      console.log('First run:', {
        start: runs[0].start,
        end: runs[0].end,
        hasGlyphs: !!runs[0].glyphs,
        glyphCount: runs[0].glyphs?.length,
        hasPositions: !!runs[0].positions,
        positionCount: runs[0].positions?.length,
        hasGlyphIndices: !!runs[0].glyphIndices,
        glyphIndicesCount: runs[0].glyphIndices?.length
      });
    }

    // Get the width for the current line (use last width if we run out)
    const getLineWidth = (lineIndex: number) => {
      return lineIndex < availableWidths.length 
        ? availableWidths[lineIndex] 
        : availableWidths[availableWidths.length - 1];
    };

    let currentPosition = 0;
    let lineIndex = 0;
    
    while (currentPosition < string.length) {
      const maxWidth = getLineWidth(lineIndex);
      let lineEnd = currentPosition;
      let lastBreakPoint = -1;
      let widthAtLastBreak = 0;
      let currentWidth = 0;
      
      console.log(`Line ${lineIndex}: max width = ${maxWidth}, starting at position ${currentPosition}`);
      
      // Scan forward to find where to break the line
      for (let i = currentPosition; i < string.length; i++) {
        const char = string[i];
        
        // Get the width of this character from the runs
        const charWidth = getCharacterWidth(attributedString, i);
        const newWidth = currentWidth + charWidth;
        
        // Check if adding this non-whitespace character would exceed the line width
        // We only check overflow for non-whitespace characters since trailing spaces get trimmed
        if (!isWhitespace(char) && newWidth > maxWidth) {
          // If we have a previous break point, use it
          if (lastBreakPoint > currentPosition) {
            lineEnd = lastBreakPoint;
            currentWidth = widthAtLastBreak;
            console.log(`  Breaking at word boundary position ${lastBreakPoint}, width: ${widthAtLastBreak}`);
            break;
          } else if (i > currentPosition) {
            // No break point found, break at the previous character
            lineEnd = i;
            console.log(`  Forced break at position ${i}, width: ${currentWidth}`);
            break;
          } else {
            // Single character doesn't fit, take at least one character
            lineEnd = i + 1;
            currentWidth = charWidth;
            console.log(`  Single char overflow at position ${i}, taking one char`);
            break;
          }
        }
        
        // Track valid word break points
        if (isWordBreakPoint(string, i + 1)) {
          lastBreakPoint = i + 1;
          // For whitespace breaks, store width without the whitespace
          // For other breaks (like CJK), include the character
          if (isWhitespace(char)) {
            widthAtLastBreak = currentWidth;
          } else {
            widthAtLastBreak = newWidth;
          }
        }
        
        // Update current width
        currentWidth = newWidth;
        
        // Handle explicit line breaks
        if (char === '\n' || char === '\r') {
          lineEnd = i + 1;
          console.log(`  Line break at position ${i}`);
          break;
        }
        
        // If we reach the end of the string, take everything
        if (i === string.length - 1) {
          lineEnd = string.length;
          console.log(`  End of string at position ${i}`);
          break;
        }
      }
      
      // Create the line
      const lineString = string.substring(currentPosition, lineEnd);
      const trimmedLineString = lineString.trimEnd();
      
      console.log(`  Creating line from pos ${currentPosition} to ${lineEnd}`);
      console.log(`  Raw line: "${lineString}"`);
      console.log(`  Trimmed line: "${trimmedLineString}"`);
      
      const lineRuns = extractRunsForRange(runs, currentPosition, currentPosition + trimmedLineString.length);
      
      // Calculate the actual width of the trimmed line (without trailing spaces)
      let actualLineWidth = 0;
      for (let i = currentPosition; i < currentPosition + trimmedLineString.length; i++) {
        actualLineWidth += getCharacterWidth(attributedString, i);
      }
      
      console.log(`  Line content: "${trimmedLineString}", width: ${actualLineWidth}`);
      
      const line: AttributedString = {
        string: trimmedLineString,
        runs: lineRuns,
        box: {
          x: 0,
          y: 0,
          width: actualLineWidth,
          height: 0, // Will be calculated by the layout engine
        }
      };
      
      lines.push(line);
      
      // Move to the next line
      currentPosition = lineEnd;
      
      // Skip whitespace at the start of the next line
      while (currentPosition < string.length && isWhitespace(string[currentPosition])) {
        currentPosition++;
      }
      
      lineIndex++;
    }
    
    console.log(`Created ${lines.length} lines`);
    return lines;
  };
};

/**
 * Get the width of a character at a specific position
 */
function getCharacterWidth(attributedString: AttributedString, position: number): number {
  const { runs } = attributedString;
  
  // Find the run that contains this position
  for (const run of runs) {
    const runStart = run.start || 0;
    const runEnd = run.end || 0;
    
    if (position >= runStart && position < runEnd) {
      // If we have positions (glyph measurements), use them
      if (run.positions && run.positions.length > 0) {
        const relativePos = position - runStart;
        if (relativePos < run.positions.length) {
          return run.positions[relativePos].xAdvance || 0;
        }
      }
      
      // If we have xAdvance for the whole run, estimate
      if (run.xAdvance !== undefined && runEnd > runStart) {
        return run.xAdvance / (runEnd - runStart);
      }
      
      // Fallback: estimate based on font size
      const fontSize = run.attributes?.fontSize || 60;
      return fontSize * 0.6; // Rough estimate
    }
  }
  
  // Default fallback
  return 36;
}

/**
 * Extract runs for a specific range of the string
 */
function extractRunsForRange(runs: Run[], start: number, end: number): Run[] {
  const result: Run[] = [];
  
  console.log(`  Extracting runs for range [${start}, ${end})`);
  
  for (const run of runs) {
    const runStart = run.start || 0;
    const runEnd = run.end || 0;
    
    // Check if this run overlaps with our range
    if (runEnd <= start || runStart >= end) {
      continue; // No overlap
    }
    
    // Calculate the overlap
    const overlapStart = Math.max(runStart, start);
    const overlapEnd = Math.min(runEnd, end);
    
    console.log(`    Run [${runStart}, ${runEnd}) overlaps at [${overlapStart}, ${overlapEnd})`);
    
    // Create a new run for the overlapping portion
    // IMPORTANT: Adjust start/end to be relative to the line's string (0-based)
    const newRun: Run = {
      ...run,
      start: overlapStart - start, // Make relative to line start
      end: overlapEnd - start,     // Make relative to line start
    };
    
    // If the original run has glyphs and positions, slice them to match the line
    if (run.glyphs && run.positions) {
      const charStart = overlapStart - runStart;
      const charEnd = overlapEnd - runStart;
      
      console.log(`    Slicing glyphs for chars [${charStart}, ${charEnd}) from ${run.glyphs.length} glyphs`);
      
      // For CJK text, there's usually a 1:1 mapping between characters and glyphs
      // But we need to handle the general case with ligatures etc.
      if (run.glyphIndices && Array.isArray(run.glyphIndices)) {
        // glyphIndices[i] = the glyph index where character i starts
        const startGlyphIdx = run.glyphIndices[charStart] || 0;
        const endGlyphIdx = charEnd < run.glyphIndices.length 
          ? run.glyphIndices[charEnd] 
          : run.glyphs.length;
        
        newRun.glyphs = run.glyphs.slice(startGlyphIdx, endGlyphIdx);
        newRun.positions = run.positions.slice(startGlyphIdx, endGlyphIdx);
        
        // Create new glyphIndices array relative to the sliced glyphs
        newRun.glyphIndices = [];
        for (let i = 0; i < (charEnd - charStart); i++) {
          const originalIdx = charStart + i;
          if (originalIdx < run.glyphIndices.length) {
            newRun.glyphIndices[i] = run.glyphIndices[originalIdx] - startGlyphIdx;
          } else {
            newRun.glyphIndices[i] = newRun.glyphs.length;
          }
        }
      } else {
        // No glyphIndices means 1:1 character to glyph mapping
        newRun.glyphs = run.glyphs.slice(charStart, charEnd);
        newRun.positions = run.positions.slice(charStart, charEnd);
      }
      
      // Recalculate xAdvance
      if (newRun.positions && newRun.positions.length > 0) {
        newRun.xAdvance = newRun.positions.reduce((sum, pos) => sum + (pos.xAdvance || 0), 0);
      }
      
      console.log(`    Created run with ${newRun.glyphs?.length} glyphs for ${charEnd - charStart} chars`);
    }
    
    result.push(newRun);
  }
  
  console.log(`    Created ${result.length} runs for line`);
  return result;
}