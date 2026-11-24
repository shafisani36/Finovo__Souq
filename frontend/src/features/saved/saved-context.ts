import { createContext, useContext } from 'react';

export interface SavedListingsContextValue {
  isSaved: (listingId: string) => boolean;
  /** Returns false when the visitor must sign in first */
  toggle: (listingId: string) => Promise<boolean>;
  pendingIds: ReadonlySet<string>;
}

export const SavedListingsContext = createContext<SavedListingsContextValue | null>(null);

export function useSavedListings(): SavedListingsContextValue {
  const context = useContext(SavedListingsContext);
  if (!context) throw new Error('useSavedListings must be used inside SavedListingsProvider');
  return context;
}
