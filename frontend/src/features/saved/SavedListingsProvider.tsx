import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getErrorMessage } from '../../api/errors';
import { useToast } from '../../components/ui/toast-context';
import { savedService } from '../../services/saved.service';
import { useAuth } from '../auth/context/useAuth';
import { hasPermission } from '../auth/rbac';
import { SavedListingsContext } from './saved-context';

export function SavedListingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const canSave = hasPermission(user?.role, 'listings:save');

  useEffect(() => {
    if (!canSave) return undefined;
    let active = true;
    savedService
      .listListings()
      .then((items) => active && setSavedIds(new Set(items.map((l) => l.id))))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [canSave, user?.id]);

  const toggle = useCallback(
    async (listingId: string) => {
      if (!user) {
        navigate(`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`);
        return false;
      }
      if (!canSave) {
        toast.show({ title: 'Not available for your account', message: 'Admin accounts cannot save ads.', tone: 'info' });
        return false;
      }
      const wasSaved = savedIds.has(listingId);
      setPendingIds((s) => new Set(s).add(listingId));
      // Optimistic update, rolled back on failure
      setSavedIds((s) => {
        const next = new Set(s);
        if (wasSaved) next.delete(listingId);
        else next.add(listingId);
        return next;
      });
      try {
        if (wasSaved) await savedService.removeListing(listingId);
        else await savedService.saveListing(listingId);
        toast.show({ title: wasSaved ? 'Removed from saved ads' : 'Saved to your list' });
        return true;
      } catch (error) {
        setSavedIds((s) => {
          const next = new Set(s);
          if (wasSaved) next.add(listingId);
          else next.delete(listingId);
          return next;
        });
        toast.show({ title: 'Could not update saved ads', message: getErrorMessage(error), tone: 'error' });
        return false;
      } finally {
        setPendingIds((s) => {
          const next = new Set(s);
          next.delete(listingId);
          return next;
        });
      }
    },
    [user, canSave, savedIds, navigate, location.pathname, location.search, toast],
  );

  const value = useMemo(() => ({ isSaved: (id: string) => canSave && savedIds.has(id), toggle, pendingIds }), [canSave, savedIds, toggle, pendingIds]);

  return <SavedListingsContext.Provider value={value}>{children}</SavedListingsContext.Provider>;
}
