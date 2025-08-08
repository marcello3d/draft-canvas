import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from './App';

test('renders draft canvas demo', () => {
  render(<App />);
  const titleElement = screen.getByText(/DraftJS/i);
  expect(titleElement).toBeInTheDocument();
});
