import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RichText } from './RichText';

describe('RichText', () => {
  it('renders headings, lists, paragraphs and bold text', () => {
    const { container } = render(<RichText text={'Intro line\n\n## Meeting\n- Meet in public\n- **Never** pay first\n\nLast paragraph'} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Meeting' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(container.querySelector('strong')).toHaveTextContent('Never');
    expect(container.querySelectorAll('p')).toHaveLength(2);
  });

  it('never turns admin text into HTML', () => {
    const { container } = render(<RichText text={'<img src=x onerror="alert(1)"> <script>alert(1)</script>'} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(container).toHaveTextContent('<script>alert(1)</script>');
  });
});
