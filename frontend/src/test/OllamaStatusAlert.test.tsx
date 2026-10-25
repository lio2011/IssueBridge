import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { OllamaStatusAlert } from '../components/OllamaStatusAlert';
import type { LLMHealthResponse } from '../types';

describe('OllamaStatusAlert component', () => {
  it('renders nothing when health is ready', () => {
    const health: LLMHealthResponse = {
      status: 'ready',
      provider: 'ollama',
      model: 'gemma4:e4b',
      endpoint: 'http://127.0.0.1:11434',
      details: 'All good',
      available_models: ['gemma4:e4b'],
    };
    const { container } = render(
      <OllamaStatusAlert health={health} onRefresh={vi.fn()} checking={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders command instructions when Ollama is unavailable', () => {
    const health: LLMHealthResponse = {
      status: 'ollama_unavailable',
      provider: 'ollama',
      model: 'gemma4:e4b',
      endpoint: 'http://127.0.0.1:11434',
      details: 'Connection refused',
      available_models: [],
    };
    const onRefresh = vi.fn();

    render(
      <OllamaStatusAlert health={health} onRefresh={onRefresh} checking={false} />
    );

    expect(screen.getByText('Local Ollama Service Unavailable')).toBeInTheDocument();
    expect(screen.getByText(/ollama serve/i)).toBeInTheDocument();

    const recheckBtn = screen.getByRole('button', { name: /Recheck Ollama/i });
    fireEvent.click(recheckBtn);
    expect(onRefresh).toHaveBeenCalled();
  });
});
