import { ChangeEvent, useCallback, useState } from 'react';

export function useCheckboxChange(
  defaultValue: boolean,
): [boolean, (event: ChangeEvent<HTMLInputElement>) => void] {
  const [checked, setChecked] = useState(defaultValue);
  const onChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setChecked(event.currentTarget.checked);
  }, []);
  return [checked, onChange];
}
