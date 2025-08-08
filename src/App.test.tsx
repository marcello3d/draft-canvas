import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from './App';

test('renders draft canvas demo', () => {
  const { getByText } = render(<App />);
  const titleElement = getByText(/DraftJS/i);
  expect(titleElement).toBeInTheDocument();
});
