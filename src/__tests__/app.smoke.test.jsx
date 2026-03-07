import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

// Stub speechSynthesis (not available in jsdom)
beforeEach(() => {
  window.speechSynthesis = { cancel: vi.fn(), speak: vi.fn() };
  // Stub fetch to return empty users (shows select-user screen)
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));
});

describe('App smoke test', () => {
  it('renders without crashing (catches hook ordering / TDZ errors)', () => {
    expect(() => render(<App />)).not.toThrow();
  });

  it('shows the sign-in screen on initial load', () => {
    const { container } = render(<App />);
    expect(container.textContent).toContain('Sign in to start playing');
    expect(container.textContent).toContain('Create an account');
  });
});
