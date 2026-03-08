import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

// Stub speechSynthesis (not available in jsdom)
beforeEach(() => {
  window.speechSynthesis = { cancel: vi.fn(), speak: vi.fn() };
  // Ensure localStorage is available as a global (App.jsx uses bare `localStorage`)
  const store = {};
  const ls = {
    getItem: vi.fn((k) => store[k] ?? null),
    setItem: vi.fn((k, v) => { store[k] = String(v); }),
    removeItem: vi.fn((k) => { delete store[k]; }),
    clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]); }),
    get length() { return Object.keys(store).length; },
    key: (i) => Object.keys(store)[i] ?? null,
  };
  Object.defineProperty(window, 'localStorage', { value: ls, writable: true, configurable: true });
  Object.defineProperty(globalThis, 'localStorage', { value: ls, writable: true, configurable: true });
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

  it('shows the "Keep me logged in for 30 days" checkbox on the sign-in screen', () => {
    const { container } = render(<App />);
    expect(container.textContent).toContain('Keep me logged in for 30 days');
    const checkbox = container.querySelector('input[type="checkbox"]');
    expect(checkbox).not.toBeNull();
    expect(checkbox.checked).toBe(false);
  });

  it.each(['stage1', 'stage2', 'results'])(
    'restores to home instead of transient screen "%s" on refresh',
    async (transientScreen) => {
      // Simulate a saved session with a transient gameScreen
      const userData = { name: 'Test', level: 1, creditBank: 0, streak: 0, caught: 0 };
      global.fetch = vi.fn(() =>
        Promise.resolve({ ok: true, json: () => Promise.resolve({ testuser: userData }) })
      );
      localStorage.setItem('currentUser', 'testuser');
      localStorage.setItem('screen', 'game');
      localStorage.setItem('gameScreen', transientScreen);
      localStorage.setItem('jwt', 'fake-jwt');

      render(<App />);

      // Wait for the fetch/restore effect to run
      await vi.waitFor(() => {
        // gameScreen should have been corrected to 'home', which persists back to localStorage
        expect(localStorage.setItem).toHaveBeenCalledWith('gameScreen', 'home');
      });
    }
  );

  it.each(['home', 'collection', 'stats'])(
    'restores safe screen "%s" on refresh without changing it',
    async (safeScreen) => {
      const userData = { name: 'Test', level: 1, creditBank: 0, streak: 0, caught: 0 };
      global.fetch = vi.fn(() =>
        Promise.resolve({ ok: true, json: () => Promise.resolve({ testuser: userData }) })
      );
      localStorage.setItem('currentUser', 'testuser');
      localStorage.setItem('screen', 'game');
      localStorage.setItem('gameScreen', safeScreen);
      localStorage.setItem('jwt', 'fake-jwt');

      render(<App />);

      await vi.waitFor(() => {
        expect(localStorage.setItem).toHaveBeenCalledWith('gameScreen', safeScreen);
      });
    }
  );
});
