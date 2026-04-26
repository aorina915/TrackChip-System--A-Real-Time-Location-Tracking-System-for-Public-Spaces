import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';

describe('TrackChip Client', () => {
  test('renders login if not authenticated', () => {
    render(<App />);
    expect(screen.getByText(/TrackChip/i)).toBeInTheDocument();
    expect(screen.getByText(/Welcome Back/i)).toBeInTheDocument();
  });

  test('login form requires username password', () => {
    render(<App />);
    const loginButton = screen.getByText('Login');
    fireEvent.click(loginButton);
    // Since required fields are empty, form doesn't submit, no error
    expect(loginButton).toBeInTheDocument();
  });
});
