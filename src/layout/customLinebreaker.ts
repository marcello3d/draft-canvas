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
  
  // Don't break in the middle of emoji ZWJ sequences
  // Check if we're at or near a ZWJ
  if (index > 0 && text[index - 1] === '\u200D') {
    return false; // Don't break right after a ZWJ
  }
  if (index < text.length && text[index] === '\u200D') {
    return false; // Don't break right before a ZWJ
  }
  
  // Don't break between variation selectors and their base
  if (index > 0) {
    const currCode = text.charCodeAt(index);
    if (currCode >= 0xFE00 && currCode <= 0xFE0F) {
      return false; // Don't break before variation selector
    }
  }
  
  // Don't break between keycap base and combining keycap
  if (index < text.length && text[index] === '\u20E3') {
    return false; // Don't break before combining enclosing keycap
  }
  
  // Don't break between regional indicator symbols (flag emojis)
  if (index > 0) {
    const prevCode = text.charCodeAt(index - 1);
    const currCode = text.charCodeAt(index);
    
    // Check for surrogate pairs first
    if (prevCode >= 0xD800 && prevCode <= 0xDBFF) {
      if (currCode >= 0xDC00 && currCode <= 0xDFFF) {
        return false; // We're in the middle of a surrogate pair
      }
    }
    
    // Check for regional indicators (they form flag emojis in pairs)
    // Regional indicators are U+1F1E6 to U+1F1FF
    if (index > 1 && index < text.length) {
      const prev2 = text.charCodeAt(index - 2);
      const prev1 = text.charCodeAt(index - 1);
      const curr = text.charCodeAt(index);
      const next = index + 1 < text.length ? text.charCodeAt(index + 1) : 0;
      
      // Check if previous two chars form a regional indicator
      if (prev2 >= 0xD83C && prev2 <= 0xD83C && prev1 >= 0xDDE6 && prev1 <= 0xDDFF) {
        // Previous is a regional indicator
        if (curr >= 0xD83C && curr <= 0xD83C && next >= 0xDDE6 && next <= 0xDDFF) {
          // Current is also a regional indicator - don't break between flags
          return false;
        }
      }
    }
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

    // Use grapheme segmenter to properly handle emoji and complex characters
    const graphemeSegmenter = typeof Intl !== 'undefined' && Intl.Segmenter 
      ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
      : null;
    
    // Convert string to grapheme segments for proper handling
    const graphemes = graphemeSegmenter 
      ? Array.from(graphemeSegmenter.segment(string))
      : string.split('').map((s, i) => ({ segment: s, index: i })); // Fallback to simple split with same structure
    
    console.log(`Total graphemes: ${graphemes.length}`);
    
    let currentPosition = 0;
    let lineIndex = 0;
    let currentGraphemeIndex = 0;
    
    while (currentPosition < string.length) {
      const maxWidth = getLineWidth(lineIndex);
      let lineEnd = currentPosition;
      let lastBreakPoint = -1;
      let lastBreakGraphemeIndex = -1;
      let widthAtLastBreak = 0;
      let currentWidth = 0;
      
      console.log(`Line ${lineIndex}: max width = ${maxWidth}, starting at position ${currentPosition}`);
      
      // Scan forward using grapheme segments
      let graphemeIdx = currentGraphemeIndex;
      while (graphemeIdx < graphemes.length) {
        const grapheme = graphemes[graphemeIdx];
        const segment = grapheme.segment;
        const segmentStart = grapheme.index;
        const segmentEnd = segmentStart + segment.length;
        
        // Skip if this grapheme is before our current position
        if (segmentEnd <= currentPosition) {
          graphemeIdx++;
          continue;
        }
        
        // Get the width of this grapheme
        // We should only get the width once per grapheme, not per codepoint
        // Get the width at the start position of the grapheme
        const graphemeWidth = getGraphemeWidth(attributedString, segmentStart, segmentEnd);
        
        const newWidth = currentWidth + graphemeWidth;
        
        // Check if adding this grapheme would exceed the line width
        // We only check overflow for non-whitespace characters since trailing spaces get trimmed
        if (!isWhitespace(segment) && newWidth > maxWidth) {
          // If we have a previous break point, use it
          if (lastBreakPoint > currentPosition) {
            lineEnd = lastBreakPoint;
            currentWidth = widthAtLastBreak;
            currentGraphemeIndex = lastBreakGraphemeIndex;
            console.log(`  Breaking at word boundary position ${lastBreakPoint}, width: ${widthAtLastBreak}`);
            break;
          } else if (segmentStart > currentPosition) {
            // No break point found, break before this grapheme
            lineEnd = segmentStart;
            currentGraphemeIndex = graphemeIdx;
            console.log(`  Forced break at position ${segmentStart}, width: ${currentWidth}`);
            break;
          } else {
            // Single grapheme doesn't fit, take at least one grapheme
            lineEnd = segmentEnd;
            currentWidth = graphemeWidth;
            currentGraphemeIndex = graphemeIdx + 1;
            console.log(`  Single grapheme overflow at position ${segmentStart}, taking one grapheme`);
            break;
          }
        }
        
        // Track valid word break points (check at grapheme boundaries)
        if (isWordBreakPoint(string, segmentEnd)) {
          lastBreakPoint = segmentEnd;
          lastBreakGraphemeIndex = graphemeIdx + 1;
          // For whitespace breaks, store width without the whitespace
          // For other breaks (like CJK), include the character
          if (isWhitespace(segment)) {
            widthAtLastBreak = currentWidth;
          } else {
            widthAtLastBreak = newWidth;
          }
        }
        
        // Update current width
        currentWidth = newWidth;
        
        // Handle explicit line breaks
        if (segment === '\n' || segment === '\r') {
          lineEnd = segmentEnd;
          currentGraphemeIndex = graphemeIdx + 1;
          console.log(`  Line break at position ${segmentStart}`);
          break;
        }
        
        // If we reach the end of the string, take everything
        if (graphemeIdx === graphemes.length - 1) {
          lineEnd = string.length;
          currentGraphemeIndex = graphemes.length;
          console.log(`  End of string at position ${segmentStart}`);
          break;
        }
        
        graphemeIdx++;
      }
      
      // Create the line
      const lineString = string.substring(currentPosition, lineEnd);
      const trimmedLineString = lineString.trimEnd();
      
      console.log(`  Creating line from pos ${currentPosition} to ${lineEnd}`);
      console.log(`  Raw line: "${lineString}"`);
      console.log(`  Trimmed line: "${trimmedLineString}"`);
      
      const lineRuns = extractRunsForRange(runs, currentPosition, currentPosition + trimmedLineString.length, string);
      
      // Calculate the actual width of the trimmed line (without trailing spaces)
      // Use grapheme segmentation to properly calculate width
      let actualLineWidth = 0;
      if (graphemeSegmenter) {
        const lineSegments = Array.from(graphemeSegmenter.segment(trimmedLineString));
        let charPos = currentPosition;
        for (const segment of lineSegments) {
          actualLineWidth += getCharacterWidth(attributedString, charPos);
          charPos += segment.segment.length;
        }
      } else {
        for (let i = currentPosition; i < currentPosition + trimmedLineString.length; i++) {
          actualLineWidth += getCharacterWidth(attributedString, i);
        }
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
/**
 * Map string position to glyph index, handling multi-codepoint characters
 * like emoji that use surrogate pairs or zero-width joiners
 */
function getGlyphIndexForPosition(string: string, run: Run, position: number): number {
  const runStart = run.start || 0;
  const relativePos = position - runStart;
  
  // If we don't have glyph indices, try to map using grapheme segmentation
  if (!run.glyphIndices || !run.glyphs) {
    // Use grapheme segmenter if available to properly handle emoji
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      const runString = string.substring(runStart, run.end);
      const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
      const segments = Array.from(segmenter.segment(runString));
      
      let charIndex = 0;
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const segmentLength = segment.segment.length;
        
        if (relativePos >= charIndex && relativePos < charIndex + segmentLength) {
          // This position is within this grapheme cluster
          // Return the glyph index for this grapheme
          // Assume glyphs correspond to graphemes
          return Math.min(i, (run.glyphs?.length || 1) - 1);
        }
        charIndex += segmentLength;
      }
    }
    
    // Fallback: simple mapping
    return Math.min(relativePos, (run.glyphs?.length || 1) - 1);
  }
  
  // We have glyphIndices - use them
  if (relativePos < run.glyphIndices.length) {
    return run.glyphIndices[relativePos];
  }
  
  // Fallback
  return Math.min(relativePos, run.glyphs.length - 1);
}

function getGraphemeWidth(attributedString: AttributedString, graphemeStart: number, graphemeEnd: number): number {
  const { runs, string } = attributedString;
  
  // Find the run that contains this grapheme
  for (const run of runs) {
    const runStart = run.start || 0;
    const runEnd = run.end || 0;
    
    // Check if the grapheme overlaps with this run
    if (graphemeStart >= runStart && graphemeStart < runEnd) {
      // If we have positions (glyph measurements), use them
      if (run.positions && run.glyphs && run.positions.length > 0) {
        // For a grapheme, we want to find the glyph that represents it
        // Use the grapheme start position to find the glyph
        const glyphIndex = getGlyphIndexForPosition(string, run, graphemeStart);
        if (glyphIndex < run.positions.length) {
          return run.positions[glyphIndex].xAdvance || 0;
        }
      }
      
      // If we have xAdvance for the whole run, estimate
      if (run.xAdvance !== undefined && runEnd > runStart) {
        // For multi-codepoint graphemes, return the average width times the grapheme length
        const avgWidth = run.xAdvance / (runEnd - runStart);
        return avgWidth * (graphemeEnd - graphemeStart);
      }
      
      // Fallback: estimate based on font size
      const fontSize = run.attributes?.fontSize || 60;
      // For emoji and special characters, use a larger estimate
      const grapheme = string.substring(graphemeStart, graphemeEnd);
      if (grapheme.length > 1) {
        // Multi-codepoint grapheme (likely emoji)
        return fontSize; // Full width for emoji
      }
      return fontSize * 0.6; // Regular character width
    }
  }
  
  // Default fallback
  return 36;
}

function getCharacterWidth(attributedString: AttributedString, position: number): number {
  const { runs, string } = attributedString;
  
  // Find the run that contains this position
  for (const run of runs) {
    const runStart = run.start || 0;
    const runEnd = run.end || 0;
    
    if (position >= runStart && position < runEnd) {
      // If we have positions (glyph measurements), use them
      if (run.positions && run.glyphs && run.positions.length > 0) {
        const glyphIndex = getGlyphIndexForPosition(string, run, position);
        if (glyphIndex < run.positions.length) {
          return run.positions[glyphIndex].xAdvance || 0;
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
function extractRunsForRange(runs: Run[], start: number, end: number, string: string): Run[] {
  const result: Run[] = [];
  
  console.log(`  Extracting runs for range [${start}, ${end})`);
  
  // Use grapheme segmenter to map character positions to grapheme indices
  const graphemeSegmenter = typeof Intl !== 'undefined' && Intl.Segmenter 
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;
  
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
      // Use grapheme segmentation to properly map character ranges to glyph ranges
      const runString = string.substring(runStart, runEnd);
      const graphemes = graphemeSegmenter 
        ? Array.from(graphemeSegmenter.segment(runString))
        : runString.split('').map((s, i) => ({ segment: s, index: i }));
      
      // Find grapheme indices for our overlap range
      let startGraphemeIdx = -1;
      let endGraphemeIdx = -1;
      let currentPos = 0;
      
      for (let i = 0; i < graphemes.length; i++) {
        const grapheme = graphemes[i];
        const segmentLength = grapheme.segment.length;
        const segmentStart = currentPos;
        const segmentEnd = currentPos + segmentLength;
        
        if (startGraphemeIdx === -1 && segmentEnd > (overlapStart - runStart)) {
          startGraphemeIdx = i;
        }
        if (segmentStart < (overlapEnd - runStart)) {
          endGraphemeIdx = i + 1;
        }
        
        currentPos += segmentLength;
      }
      
      if (startGraphemeIdx === -1) startGraphemeIdx = 0;
      if (endGraphemeIdx === -1) endGraphemeIdx = graphemes.length;
      
      console.log(`    Slicing glyphs for graphemes [${startGraphemeIdx}, ${endGraphemeIdx}) from ${run.glyphs.length} glyphs`);
      
      // Assume glyphs correspond to graphemes (which is usually true for properly shaped text)
      const glyphStart = Math.min(startGraphemeIdx, run.glyphs.length);
      const glyphEnd = Math.min(endGraphemeIdx, run.glyphs.length);
      
      newRun.glyphs = run.glyphs.slice(glyphStart, glyphEnd);
      newRun.positions = run.positions.slice(glyphStart, glyphEnd);
      
      // Update glyphIndices if present
      if (run.glyphIndices && Array.isArray(run.glyphIndices)) {
        newRun.glyphIndices = [];
        const charStart = overlapStart - runStart;
        const charEnd = overlapEnd - runStart;
        
        for (let i = 0; i < (charEnd - charStart); i++) {
          const originalIdx = charStart + i;
          if (originalIdx < run.glyphIndices.length) {
            const origGlyphIdx = run.glyphIndices[originalIdx];
            newRun.glyphIndices[i] = Math.max(0, Math.min(origGlyphIdx - glyphStart, newRun.glyphs.length - 1));
          } else {
            newRun.glyphIndices[i] = newRun.glyphs.length - 1;
          }
        }
      }
      
      // Recalculate xAdvance
      if (newRun.positions && newRun.positions.length > 0) {
        newRun.xAdvance = newRun.positions.reduce((sum, pos) => sum + (pos.xAdvance || 0), 0);
      }
      
      console.log(`    Created run with ${newRun.glyphs?.length} glyphs`);
    }
    
    result.push(newRun);
  }
  
  console.log(`    Created ${result.length} runs for line`);
  return result;
}