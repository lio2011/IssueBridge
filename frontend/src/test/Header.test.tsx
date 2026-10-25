import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Header } from '../components/Header';

describe('Header component', () => {
  it('renders branding and navigation tabs', () => {
    const setActiveTab = vi.fn();
    const onRefreshHealth = vi.fn();
    const onOpenHowItWorks = vi.fn();

    render(
      <Header
        activeTab="issue-smith"
        setActiveTab={setActiveTab}
        llmHealth={{
          status: 'ready',
          provider: 'ollama',
          model: 'gemma4:e4b',
          endpoint: 'http://127.0.0.1:11434',
          details: 'Ready',
          available_models: ['gemma4:e4b'],
        }}
        checkingHealth={false}
        onRefreshHealth={onRefreshHealth}
        onOpenHowItWorks={onOpenHowItWorks}
      />
    );

    expect(screen.getByText('IssueBridge')).toBeInTheDocument();
    expect(screen.getByText(/Local AI: gemma4:e4b/i)).toBeInTheDocument();

    const firstPrTab = screen.getAllByRole('button', { name: /FirstPR/i })[0];
    fireEvent.click(firstPrTab);
    expect(setActiveTab).toHaveBeenCalledWith('first-pr');
  });

  it('renders Ollama offline badge when health is unavailable', () => {
    render(
      <Header
        activeTab="issue-smith"
        setActiveTab={vi.fn()}
        llmHealth={{
          status: 'ollama_unavailable',
          provider: 'ollama',
          model: 'gemma4:e4b',
          endpoint: 'http://127.0.0.1:11434',
          details: 'Connection refused',
          available_models: [],
        }}
        checkingHealth={false}
        onRefreshHealth={vi.fn()}
        onOpenHowItWorks={vi.fn()}
      />
    );

    expect(screen.getByText(/Ollama Offline/i)).toBeInTheDocument();
  });
});
