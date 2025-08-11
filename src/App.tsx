import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import styles from './App.module.css';
import {
  ContentState,
  DraftEditorCommand,
  Editor,
  EditorState,
  RichUtils,
} from 'draft-js';
import 'draft-js/dist/Draft.css';
import { LayoutCanvas } from './layout/LayoutCanvas';
import { TextkitTextCanvas } from './layout/TextkitTextCanvas';
import { TextkitPathCanvas } from './layout/TextkitPathCanvas';
import { computeLayout, Layout } from './layout/layout';
import { Html2CanvasRenderer } from './layout/Html2CanvasRenderer';
import { useCheckboxChange } from './useCheckboxChange';
import { useRadioChange, LayoutMethod } from './useRadioChange';
import classNames from 'classnames';

export default function App() {
  const [editorState, setEditorState] = React.useState(() =>
    EditorState.createWithContent(
      ContentState.createFromText(
        "Hello this is some wrapping text I'm trying to start with",
      ),
    ),
  );

  const [characterLevel, onChangeCharacterLevel] = useCheckboxChange(true);
  const [showTextEditor, onChangeShowOverlap] = useCheckboxChange(true);
  const [showOutlines, onChangeShowOutlines] = useCheckboxChange(true);
  const [layoutMethod, onChangeLayoutMethod] = useRadioChange('textkit-text');

  const content = editorState.getCurrentContent();
  const editorRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Layout | undefined>();
  const plainText = content.getPlainText();

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
    if (editorRef.current) {
      if (layoutMethod === 'dom' || layoutMethod === 'html2canvas') {
        const startTime = performance.now();
        console.log(`do layout`);
        setLayout(computeLayout(editorRef.current, characterLevel));
        const endTime = performance.now();
        console.log(`DOM layout took ${endTime - startTime}ms`);
      } else if (
        layoutMethod === 'textkit-text' ||
        layoutMethod === 'textkit-path'
      ) {
        // Use actual editor dimensions for textkit layout
        const width = editorRef.current.clientWidth;
        const height = editorRef.current.clientHeight;
        
        console.log('Editor dimensions for textkit:', width, 'x', height);
        
        setLayout({ width, height, lines: [] });
      }
    }
  }, [characterLevel, editorState, layoutMethod]);

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
