import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import styles from './App.module.css';
import {
  ContentState,
  DraftEditorCommand,
  Editor,
  EditorState,
  RichUtils,
  Modifier,
  CompositeDecorator,
  ContentBlock,
} from 'draft-js';
import 'draft-js/dist/Draft.css';
import { LayoutCanvas } from './layout/LayoutCanvas';
import { TextkitTextCanvas } from './layout/TextkitTextCanvas';
import { TextkitPathCanvas } from './layout/TextkitPathCanvas';
import { TextkitRenderCanvas } from './layout/TextkitRenderCanvas';
import { FontkitCanvas } from './layout/FontkitCanvas';
import { computeLayout, Layout } from './layout/layout';
import { Html2CanvasRenderer } from './layout/Html2CanvasRenderer';
import { useCheckboxChange } from './useCheckboxChange';
import { useRadioChange, LayoutMethod } from './useRadioChange';
import classNames from 'classnames';

// Component for rendering line break spans
const LineBreakSpan: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <span className={styles.lineBreak}>{children}</span>;
};

// Strategy function to find word wrap positions when lines exceed 15 characters
const findLineBreakEntities = (
  contentBlock: ContentBlock,
  callback: (start: number, end: number) => void,
) => {
  const text = contentBlock.getText();
  let currentLineStart = 0;
  
  while (currentLineStart < text.length) {
    // Check if there's more than 15 characters remaining
    if (currentLineStart + 15 >= text.length) {
      // Line is 15 chars or less, no wrapping needed
      break;
    }
    
    // Look for the last space before or at position 15 from current start
    const searchEnd = currentLineStart + 15;
    let lastSpaceIndex = -1;
    
    // Find the last space in the range
    for (let i = currentLineStart; i <= searchEnd && i < text.length; i++) {
      if (text[i] === ' ') {
        lastSpaceIndex = i;
      }
    }
    
    // If we found a space before position 15, mark it for line break
    if (lastSpaceIndex !== -1 && lastSpaceIndex > currentLineStart) {
      callback(lastSpaceIndex, lastSpaceIndex + 1);
      currentLineStart = lastSpaceIndex + 1;
    } else {
      // No space found in first 15 chars, look for next space after position 15
      let nextSpaceIndex = -1;
      for (let i = searchEnd + 1; i < text.length; i++) {
        if (text[i] === ' ') {
          nextSpaceIndex = i;
          break;
        }
      }
      
      if (nextSpaceIndex !== -1) {
        // Found a space after position 15, break there
        callback(nextSpaceIndex, nextSpaceIndex + 1);
        currentLineStart = nextSpaceIndex + 1;
      } else {
        // No more spaces in the text, done
        break;
      }
    }
  }
};

// Create decorator
const lineBreakDecorator = new CompositeDecorator([
  {
    strategy: findLineBreakEntities,
    component: LineBreakSpan,
  },
]);

export default function App() {
  const [editorState, setRawEditorState] = React.useState(() =>
    EditorState.createWithContent(
      ContentState.createFromText(
        "Hello this is some wrapping text I'm trying to start with",
      ),
      lineBreakDecorator,
    ),
  );
  const setEditorState = useCallback(
    (newState: EditorState) => {
      // The decorator automatically handles the line break rendering
      // Just update the state
      setRawEditorState(newState);
    },
    [setRawEditorState],
  );

  const [characterLevel, onChangeCharacterLevel] = useCheckboxChange(true);
  const [showTextEditor, onChangeShowOverlap] = useCheckboxChange(true);
  const [showOutlines, onChangeShowOutlines] = useCheckboxChange(true);
  const [lineBreaker, setLineBreaker] = useState<
    'default' | 'custom' | 'simple'
  >('simple');
  const [layoutMethod, onChangeLayoutMethod] = useRadioChange('fontkit');

  const content = editorState.getCurrentContent();
  const editorRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Layout | undefined>();
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const plainText = content.getPlainText();

  // Load all Roboto and CJK font variants using FontFace API with variable fonts
  React.useEffect(() => {
    const loadFonts = async () => {
      const fonts = [
        // Roboto variable fonts - define specific weights for Canvas2D compatibility
        new FontFace(
          'Roboto',
          'url(/Roboto/Roboto-VariableFont_wdth,wght.ttf)',
          { weight: '100 900', style: 'normal' },
        ),
        new FontFace(
          'Roboto',
          'url(/Roboto/Roboto-Italic-VariableFont_wdth,wght.ttf)',
          { weight: '100 900', style: 'italic' },
        ),
        // Noto Sans SC (Simplified Chinese) variable font
        new FontFace(
          'Noto Sans SC',
          'url(/Noto_Sans_SC/NotoSansSC-VariableFont_wght.ttf)',
          { weight: '100 900', style: 'normal' },
        ),
        // Noto Sans TC (Traditional Chinese) variable font
        new FontFace(
          'Noto Sans TC',
          'url(/Noto_Sans_TC/NotoSansTC-VariableFont_wght.ttf)',
          { weight: '100 900', style: 'normal' },
        ),
        // Noto Sans JP (Japanese) variable font
        new FontFace(
          'Noto Sans JP',
          'url(/Noto_Sans_JP/NotoSansJP-VariableFont_wght.ttf)',
          { weight: '100 900', style: 'normal' },
        ),
        // Noto Sans KR (Korean) variable font
        new FontFace(
          'Noto Sans KR',
          'url(/Noto_Sans_KR/NotoSansKR-VariableFont_wght.ttf)',
          { weight: '100 900', style: 'normal' },
        ),
        // Noto Color Emoji
        new FontFace(
          'Noto Color Emoji',
          'url(/Noto_Color_Emoji/NotoColorEmoji-Regular.ttf)',
          { weight: '400', style: 'normal' },
        ),
      ];

      try {
        const loadedFonts = await Promise.all(fonts.map((font) => font.load()));
        loadedFonts.forEach((font) => document.fonts.add(font));
        console.log('All fonts loaded successfully (Roboto + CJK)');
        setFontsLoaded(true);
      } catch (error) {
        console.error('Error loading fonts:', error);
        setFontsLoaded(true); // Continue even if fonts fail to load
      }
    };

    loadFonts();
  }, []);

  const handleKeyCommand = useCallback(
    (command: DraftEditorCommand, editorState: EditorState) => {
      const newState = RichUtils.handleKeyCommand(editorState, command);

      if (newState) {
        setEditorState(newState);
        return 'handled';
      }

      return 'not-handled';
    },
    [],
  );

  useLayoutEffect(() => {
    if (editorRef.current && fontsLoaded) {
      if (layoutMethod === 'dom' || layoutMethod === 'html2canvas') {
        const startTime = performance.now();
        console.log(`do layout`);
        setLayout(computeLayout(editorRef.current, characterLevel));
        const endTime = performance.now();
        console.log(`DOM layout took ${endTime - startTime}ms`);
      } else if (
        layoutMethod === 'textkit-text' ||
        layoutMethod === 'textkit-path' ||
        layoutMethod === 'fontkit'
      ) {
        // Use actual editor dimensions for textkit/fontkit layout
        const width = editorRef.current.clientWidth;
        const height = editorRef.current.clientHeight;

        console.log(
          'Editor dimensions for textkit/fontkit:',
          width,
          'x',
          height,
        );

        setLayout({ width, height, lines: [] });
      }
    }
  }, [characterLevel, editorState, layoutMethod, fontsLoaded]);

  if (!fontsLoaded) {
    return (
      <div className={styles.root}>
        <h2>Loading fonts...</h2>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <h2>DraftJS + Canvas demo (Canvas2D & html2canvas)</h2>
      <ul>
        <li>
          <label>
            <input
              type="checkbox"
              checked={characterLevel}
              onChange={onChangeCharacterLevel}
            />
            Character-level layout
          </label>
        </li>
        <li>
          <label>
            <input
              type="checkbox"
              checked={showTextEditor}
              onChange={onChangeShowOverlap}
            />
            Show DraftJS editor
          </label>
        </li>
        <li>
          <label>
            <input
              type="checkbox"
              checked={showOutlines}
              onChange={onChangeShowOutlines}
            />
            Show outlines
          </label>
        </li>
        <li>
          <label>
            Line breaker:
            <select
              value={lineBreaker}
              onChange={(e) =>
                setLineBreaker(
                  e.target.value as 'default' | 'custom' | 'simple',
                )
              }
              style={{ marginLeft: '8px' }}
            >
              <option value="default">Default (textkit)</option>
              <option value="custom">Custom (complex)</option>
              <option value="simple">Simple (new)</option>
            </select>
          </label>
        </li>
        <li>
          <fieldset>
            <legend>Layout Method:</legend>
            <label>
              <input
                type="radio"
                name="layoutMethod"
                value="dom"
                checked={layoutMethod === 'dom'}
                onChange={onChangeLayoutMethod}
              />
              Custom DOM layout measurement
            </label>
            <br />
            <label>
              <input
                type="radio"
                name="layoutMethod"
                value="html2canvas"
                checked={layoutMethod === 'html2canvas'}
                onChange={onChangeLayoutMethod}
              />
              html2canvas
            </label>
            <br />
            <label>
              <input
                type="radio"
                name="layoutMethod"
                value="textkit-text"
                checked={layoutMethod === 'textkit-text'}
                onChange={onChangeLayoutMethod}
              />
              textkit + canvas2d text rendering
            </label>
            <br />
            <label>
              <input
                type="radio"
                name="layoutMethod"
                value="textkit-path"
                checked={layoutMethod === 'textkit-path'}
                onChange={onChangeLayoutMethod}
              />
              textkit + canvas2d path rendering
            </label>
            <br />
            <label>
              <input
                type="radio"
                name="layoutMethod"
                value="textkit-render"
                checked={layoutMethod === 'textkit-render'}
                onChange={onChangeLayoutMethod}
              />
              textkit + glyph.render()
            </label>
            <br />
            <label>
              <input
                type="radio"
                name="layoutMethod"
                value="fontkit"
                checked={layoutMethod === 'fontkit'}
                onChange={onChangeLayoutMethod}
              />
              fontkit only + manual wrap
            </label>
          </fieldset>
        </li>
      </ul>
      <p>
        Type in the left-hand side and see a second canvas rendered on right.
        Keyboard shortcuts for bold and italic should work.
      </p>
      <div className={styles.main}>
        <div className={styles.editorWrapper} id="editor-wrapper-left">
          {layoutMethod === 'html2canvas' ? (
            <Html2CanvasRenderer
              sourceElement={editorRef.current}
              showOutlines={showOutlines}
              refreshTrigger={editorState}
              width={layout?.width}
              height={layout?.height}
            />
          ) : layoutMethod === 'dom' ? (
            layout && (
              <LayoutCanvas showOutlines={showOutlines} layout={layout} />
            )
          ) : layoutMethod === 'textkit-text' ? (
            layout && (
              <TextkitTextCanvas
                width={layout.width}
                height={layout.height}
                text={plainText}
                showOutlines={showOutlines}
                editorState={editorState}
                useCustomLineBreaker={
                  lineBreaker === 'simple' ? 'simple' : lineBreaker === 'custom'
                }
              />
            )
          ) : layoutMethod === 'textkit-path' ? (
            layout && (
              <TextkitPathCanvas
                width={layout.width}
                height={layout.height}
                text={plainText}
                showOutlines={showOutlines}
                editorState={editorState}
                useCustomLineBreaker={
                  lineBreaker === 'simple' ? 'simple' : lineBreaker === 'custom'
                }
              />
            )
          ) : layoutMethod === 'textkit-render' ? (
            layout && (
              <TextkitRenderCanvas
                width={layout.width}
                height={layout.height}
                text={plainText}
                showOutlines={showOutlines}
                editorState={editorState}
                useCustomLineBreaker={
                  lineBreaker === 'simple' ? 'simple' : lineBreaker === 'custom'
                }
              />
            )
          ) : layoutMethod === 'fontkit' ? (
            layout && (
              <FontkitCanvas
                width={layout.width}
                height={layout.height}
                text={plainText}
                showOutlines={showOutlines}
                editorState={editorState}
              />
            )
          ) : null}
          <div
            ref={editorRef}
            className={classNames(styles.editor, {
              [styles.showOverlap]: showTextEditor,
            })}
          >
            {/* @ts-ignore - Draft.js type issue with React 18 */}
            <Editor
              editorState={editorState}
              handleKeyCommand={handleKeyCommand}
              onChange={setEditorState}
            />
          </div>
        </div>
        {layoutMethod === 'html2canvas' ? (
          <Html2CanvasRenderer
            sourceElement={editorRef.current}
            showOutlines={showOutlines}
            refreshTrigger={editorState}
            width={layout?.width}
            height={layout?.height}
          />
        ) : layoutMethod === 'dom' ? (
          layout && <LayoutCanvas showOutlines={showOutlines} layout={layout} />
        ) : layoutMethod === 'textkit-text' ? (
          layout && (
            <TextkitTextCanvas
              width={layout.width}
              height={layout.height}
              text={plainText}
              showOutlines={showOutlines}
              editorState={editorState}
              useCustomLineBreaker={
                lineBreaker === 'simple' ? 'simple' : lineBreaker === 'custom'
              }
            />
          )
        ) : layoutMethod === 'textkit-path' ? (
          layout && (
            <TextkitPathCanvas
              width={layout.width}
              height={layout.height}
              text={plainText}
              showOutlines={showOutlines}
              editorState={editorState}
              useCustomLineBreaker={
                lineBreaker === 'simple' ? 'simple' : lineBreaker === 'custom'
              }
            />
          )
        ) : layoutMethod === 'textkit-render' ? (
          layout && (
            <TextkitRenderCanvas
              width={layout.width}
              height={layout.height}
              text={plainText}
              showOutlines={showOutlines}
              editorState={editorState}
              useCustomLineBreaker={
                lineBreaker === 'simple' ? 'simple' : lineBreaker === 'custom'
              }
            />
          )
        ) : layoutMethod === 'fontkit' ? (
          layout && (
            <FontkitCanvas
              width={layout.width}
              height={layout.height}
              text={plainText}
              showOutlines={showOutlines}
              editorState={editorState}
            />
          )
        ) : null}
      </div>
      <p>
        <a href="https://github.com/marcello3d/draft-canvas">
          Source code on Github
        </a>
      </p>
    </div>
  );
}
