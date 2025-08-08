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
import { computeLayout, Layout } from './layout/layout';
import { Html2CanvasRenderer } from './layout/Html2CanvasRenderer';
import { useCheckboxChange } from './useCheckboxChange';
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
  const [showTextEditor, onChangeShowOverlap] = useCheckboxChange(false);
  const [showOutlines, onChangeShowOutlines] = useCheckboxChange(true);
  const [useHtml2Canvas, onChangeUseHtml2Canvas] = useCheckboxChange(true);

  const content = editorState.getCurrentContent();
  const editorRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Layout | undefined>();

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
      console.log(`do layout`);
      setLayout(computeLayout(editorRef.current, characterLevel));
    }
  }, [characterLevel, editorState]);

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
            <input
              type="checkbox"
              checked={useHtml2Canvas}
              onChange={onChangeUseHtml2Canvas}
            />
            Use html2canvas (instead of Canvas2D)
          </label>
        </li>
      </ul>
      <p>
        Type in the left-hand side and see a second canvas rendered on right.
        Keyboard shortcuts for bold and italic should work.
      </p>
      <div className={styles.main}>
        <div className={styles.editorWrapper} id="editor-wrapper-left">
          {useHtml2Canvas ? (
            <Html2CanvasRenderer
              sourceElement={editorRef.current}
              showOutlines={showOutlines}
              refreshTrigger={editorState}
              width={layout?.width}
              height={layout?.height}
            />
          ) : (
            layout && (
              <LayoutCanvas showOutlines={showOutlines} layout={layout} />
            )
          )}
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
        {useHtml2Canvas ? (
          <Html2CanvasRenderer
            sourceElement={editorRef.current}
            showOutlines={showOutlines}
            refreshTrigger={editorState}
            width={layout?.width}
            height={layout?.height}
          />
        ) : (
          layout && <LayoutCanvas showOutlines={showOutlines} layout={layout} />
        )}
      </div>
      <p>
        <a href="https://github.com/marcello3d/draft-canvas">
          Source code on Github
        </a>
      </p>
    </div>
  );
}
