import { ChangeEvent, useCallback, useState } from 'react';

export type LayoutMethod = 'dom' | 'html2canvas' | 'textkit-text' | 'textkit-path';

export function useRadioChange(
  initialValue: LayoutMethod,
): [LayoutMethod, (e: ChangeEvent<HTMLInputElement>) => void] {
  const [value, setValue] = useState(initialValue);
  const onChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value as LayoutMethod);
  }, []);
  return [value, onChange];
}