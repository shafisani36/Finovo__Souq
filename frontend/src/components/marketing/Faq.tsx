import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { FaqItem } from '../../content/faq';

/** Accordion where one answer is open at a time */
export function Faq({ items, defaultOpen = 0 }: { items: FaqItem[]; defaultOpen?: number | null }) {
  const [open, setOpen] = useState<number | null>(defaultOpen);
  const baseId = useId();

  return (
    <div className="faq">
      {items.map((item, index) => {
        const isOpen = open === index;
        const buttonId = `${baseId}-q-${index}`;
        const panelId = `${baseId}-a-${index}`;
        return (
          <div key={item.question} className={`faq__item${isOpen ? ' is-open' : ''}`}>
            <h3 className="faq__heading">
              <button type="button" id={buttonId} className="faq__question" aria-expanded={isOpen} aria-controls={panelId} onClick={() => setOpen(isOpen ? null : index)}>
                <span>{item.question}</span>
                <ChevronDown size={18} aria-hidden="true" className="faq__chevron" />
              </button>
            </h3>
            <div id={panelId} role="region" aria-labelledby={buttonId} className="faq__answer" hidden={!isOpen}>
              <p>{item.answer}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
