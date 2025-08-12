import { computeTextkitLayout, computeTextkitLayoutWithPaths } from './textkitLayout';
import { EditorState, ContentState } from 'draft-js';

// Mock fontkit to avoid loading actual font files in tests
jest.mock('fontkit', () => ({
  create: jest.fn((buffer) => {
    // Return a mock font object
    return {
      ascent: 1900,
      descent: -500,
      unitsPerEm: 2048,
      postscriptName: 'Roboto-Regular',
      familyName: 'Roboto',
      layout: jest.fn((text) => {
        // Return mock glyphs for the text
        const glyphs = text.split('').map((char: string, i: number) => ({
          id: char.charCodeAt(0),
          codePoints: [char.charCodeAt(0)],
          advanceWidth: 1000, // Mock advance width
          string: char,
          _metrics: {
            advanceWidth: 1000
          }
        }));
        
        return {
          glyphs,
          positions: glyphs.map(() => ({
            xAdvance: 1000 * (60 / 2048), // Scale to font size
            yAdvance: 0,
            xOffset: 0,
            yOffset: 0
          }))
        };
      }),
      getGlyph: jest.fn((id) => ({
        id,
        path: {
          toSVG: () => `M0,0 L10,10` // Mock SVG path
        }
      }))
    };
  })
}));

// Mock fetch for font loading
global.fetch = jest.fn((url) => {
  return Promise.resolve({
    ok: true,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))
  } as Response);
});

describe('textkitLayout', () => {
  describe('computeTextkitLayout', () => {
    it('should layout simple English text', async () => {
      const text = 'Hello world';
      const width = 500;
      const height = 300;
      const fontSize = 60;
      
      const layout = await computeTextkitLayout(text, width, height, fontSize);
      
      expect(layout).toHaveProperty('width', width);
      expect(layout).toHaveProperty('height', height);
      expect(layout).toHaveProperty('lines');
      expect(layout.lines.length).toBeGreaterThan(0);
      
      // Check that lines have the expected structure
      layout.lines.forEach(line => {
        expect(line).toHaveProperty('text');
        expect(line).toHaveProperty('left');
        expect(line).toHaveProperty('top');
        expect(line).toHaveProperty('right');
        expect(line).toHaveProperty('bottom');
        expect(line).toHaveProperty('font');
      });
      
      // Snapshot the layout
      expect(layout).toMatchSnapshot();
    });

    it('should layout Chinese text correctly', async () => {
      const text = '目前基本上一';
      const width = 180; // Force wrapping after ~3 characters
      const height = 300;
      const fontSize = 60;
      
      const layout = await computeTextkitLayout(text, width, height, fontSize);
      
      expect(layout.lines.length).toBeGreaterThan(0);
      
      // Log the actual output for debugging
      console.log('Chinese text layout:');
      layout.lines.forEach((line, i) => {
        console.log(`  Line ${i}: "${line.text}"`);
      });
      
      // Check that we're not getting repeated characters
      const allText = layout.lines.map(l => l.text).join('');
      expect(allText).toBe(text);
      
      expect(layout).toMatchSnapshot();
    });

    it('should handle text with styles', async () => {
      const editorState = EditorState.createWithContent(
        ContentState.createFromText('Hello bold world')
      );
      
      // Add bold style to "bold" word (chars 6-10)
      const content = editorState.getCurrentContent();
      const block = content.getFirstBlock();
      const selection = editorState.getSelection().merge({
        anchorKey: block.getKey(),
        focusKey: block.getKey(),
        anchorOffset: 6,
        focusOffset: 10,
        isBackward: false
      });
      
      // Apply bold style
      const newContent = content.getBlockMap().map(b => {
        if (b?.getKey() === block.getKey()) {
          let newBlock = b;
          for (let i = 6; i < 10; i++) {
            const charList = newBlock.getCharacterList();
            const char = charList.get(i);
            if (char) {
              // Create a new CharacterMetadata with the BOLD style added
              const newStyle = char.getStyle().add('BOLD');
              // Use the CharacterMetadata.applyStyle method
              const CharacterMetadata = require('draft-js').CharacterMetadata;
              const newChar = CharacterMetadata.applyStyle(char, 'BOLD');
              const newCharList = charList.set(i, newChar);
              newBlock = newBlock.set('characterList', newCharList) as any;
            }
          }
          return newBlock;
        }
        return b;
      });
      
      const styledEditorState = EditorState.createWithContent(
        content.merge({ blockMap: newContent }) as ContentState
      );
      
      const text = 'Hello bold world';
      const width = 500;
      const height = 300;
      const fontSize = 60;
      
      const layout = await computeTextkitLayout(text, width, height, fontSize, styledEditorState);
      
      expect(layout).toMatchSnapshot();
    });

    it('should handle the problematic "what is going on toi" case', async () => {
      const text = 'what is going on toi';
      const width = 500;
      const height = 300;
      const fontSize = 60;
      
      const layout = await computeTextkitLayout(text, width, height, fontSize);
      
      // Check that no line exceeds the width
      layout.lines.forEach(line => {
        const lineWidth = line.right - line.left;
        expect(lineWidth).toBeLessThanOrEqual(width);
      });
      
      expect(layout).toMatchSnapshot();
    });

    it('should handle multi-line text with newlines', async () => {
      const text = 'First line\nSecond line\nThird line';
      const width = 500;
      const height = 300;
      const fontSize = 60;
      
      const layout = await computeTextkitLayout(text, width, height, fontSize);
      
      // Should have at least 3 lines (one for each explicit line break)
      expect(layout.lines.length).toBeGreaterThanOrEqual(3);
      
      expect(layout).toMatchSnapshot();
    });
  });

  describe('computeTextkitLayoutWithPaths', () => {
    it('should return layout with glyph paths', async () => {
      const text = 'ABC';
      const width = 500;
      const height = 300;
      const fontSize = 60;
      
      const result = await computeTextkitLayoutWithPaths(text, width, height, fontSize);
      
      expect(result).toHaveProperty('layout');
      expect(result).toHaveProperty('glyphPaths');
      
      // Check that we have glyph paths
      expect(result.glyphPaths.length).toBeGreaterThan(0);
      
      result.glyphPaths.forEach(glyph => {
        expect(glyph).toHaveProperty('path');
        expect(glyph).toHaveProperty('x');
        expect(glyph).toHaveProperty('y');
        expect(glyph).toHaveProperty('scale');
      });
      
      expect(result).toMatchSnapshot();
    });

    it('should handle Chinese text with paths', async () => {
      const text = '目前基';
      const width = 200;
      const height = 300;
      const fontSize = 60;
      
      const result = await computeTextkitLayoutWithPaths(text, width, height, fontSize);
      
      // Log for debugging
      console.log('Chinese text with paths:');
      console.log('  Lines:', result.layout.lines.map(l => l.text));
      console.log('  Glyph count:', result.glyphPaths.length);
      
      // Check that glyphs match the text length
      expect(result.glyphPaths.length).toBe(text.length);
      
      expect(result).toMatchSnapshot();
    });
  });
});