import { useEffect, useState } from 'react';
import { BadgeCheck, Ban, ExternalLink, Search, Store as StoreIcon, Undo2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { getErrorMessage } from '../../api/errors';
import { PageHeader } from '../../components/dashboard/PageHeader';
import { Avatar } from '../../components/ui/Avatar';
import { Badge, type BadgeTone } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { TextareaField } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { Pagination } from '../../components/ui/Pagination';
import { Select } from '../../components/ui/Select';
import { EmptyState, ErrorState, SkeletonBlock } from '../../components/ui/States';
import { useToast } from '../../components/ui/toast-context';
import { useAsync } from '../../hooks/useAsync';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { adminService } from '../../services/admin.service';
import type { AdminStore, StoreStatus } from '../../types';
import { formatDate } from '../../utils/format';
import { t } from '../../i18n';

const STATUS_FILTERS = [
  { value: 'all', label: t('All stores') },
  { value: 'pending', label: t('Waiting for check') },
  { value: 'verified', label: t('Verified') },
  { value: 'rejected', label: t('Sent back') },
  { value: 'suspended', label: t('Suspended') },
];

const STATUS_BADGE: Record<StoreStatus, { label: string; tone: BadgeTone }> = {
  pending: { label: t('Waiting for check'), tone: 'warning' },
  verified: { label: t('Verified'), tone: 'success' },
  rejected: { label: t('Sent back'), tone: 'neutral' },
  suspended: { label: t('Suspended'), tone: 'danger' },
};

type Decision = 'reject' | 'suspend';

/** Business stores: check the commercial registration, then verify, send back or suspend */
export function StoresPage() {
  useDocumentTitle(t('Stores'));
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') ?? 'all';
  const page = Number(searchParams.get('page')) || 1;
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const debouncedQuery = useDebouncedValue(query.trim());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, setPending] = useState<{ store: AdminStore; decision: Decision } | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([k, v]) => (v && v !== 'all' ? next.set(k, v) : next.delete(k)));
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    if ((searchParams.get('q') ?? '') !== debouncedQuery) update({ q: debouncedQuery || null, page: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);

  const stores = useAsync(() => adminService.stores({ status: status === 'all' ? undefined : status, q: searchParams.get('q') || undefined, page }), [searchParams.toString()]);

  const decide = async (store: AdminStore, decision: 'verify' | Decision, note = '') => {
    setBusyId(store.id);
    try {
      const updated = await adminService.decideStore(store.id, decision, note);
      stores.setData((prev) => (prev ? { ...prev, items: prev.items.map((s) => (s.id === updated.id ? { ...s, ...updated, owner: s.owner } : s)) } : prev));
      toast.show({ title: decision === 'verify' ? t('Store verified') : decision === 'reject' ? t('Store sent back') : t('Store suspended') });
      setPending(null);
    } catch (error) {
      if (pending) setReasonError(getErrorMessage(error));
      else toast.show({ title: t('Could not update store'), message: getErrorMessage(error), tone: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const confirm = () => {
    if (!pending) return;
    if (reason.trim().length < 5) {
      setReasonError(t('Tell the seller why, in a few words.'));
      return;
    }
    void decide(pending.store, pending.decision, reason.trim());
  };

  return (
    <>
      <PageHeader title={t('Stores')} subtitle={t("Check each business's 10-digit commercial registration before verifying. Verified stores get a public page and a badge on every ad.")} />
      <section className="card">
        <div className="toolbar">
          <div className="toolbar__search">
            <Search size={16} aria-hidden="true" />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('Store name or CR number')} aria-label={t('Search stores')} />
          </div>
          <div className="toolbar__filters">
            <Select size="sm" value={status} onChange={(next) => update({ status: next, page: null })} options={STATUS_FILTERS} aria-label={t('Status')} />
          </div>
        </div>

        {stores.error ? (
          <ErrorState error={stores.error} onRetry={stores.reload} />
        ) : stores.isLoading || !stores.data ? (
          <SkeletonBlock height={280} />
        ) : stores.data.items.length === 0 ? (
          <EmptyState icon={<StoreIcon size={26} />} title={t('No stores found')} text={t('Sellers open a store from their account; new ones appear here for checking.')} />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('Store')}</th>
                    <th>{t('Owner')}</th>
                    <th>{t('CR number')}</th>
                    <th>{t('Status')}</th>
                    <th className="table__num">
                      <span className="sr-only">{t('Actions')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stores.data.items.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <div className="table-item">
                          <Avatar name={s.name} src={s.logoUrl} size="sm" />
                          <span>
                            <span className="table-item__title">{s.name}</span>
                            <span className="table-item__meta">
                              {s.city ? t(s.city) : t('No city')} {t('· opened')} {formatDate(s.createdAt)}
                            </span>
                            {s.reviewNote && <span className="table-item__meta">{s.reviewNote}</span>}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="table-item__title">{s.owner?.name ?? t('Former member')}</span>
                        {s.owner && <span className="table-item__meta">{s.owner.email}</span>}
                      </td>
                      <td className="tabular" dir="ltr">
                        {s.commercialRegistration}
                      </td>
                      <td>
                        <Badge tone={STATUS_BADGE[s.status].tone}>{STATUS_BADGE[s.status].label}</Badge>
                      </td>
                      <td>
                        <div className="table__actions">
                          {s.status === 'verified' && (
                            <a
                              className="icon-btn icon-btn--sm"
                              href={`/stores/${s.slug}`}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={t('Open {name}', {
                                name: s.name,
                              })}
                              title={t('Open store page')}
                            >
                              <ExternalLink size={15} />
                            </a>
                          )}
                          {s.status !== 'verified' && (
                            <Button
                              size="sm"
                              variant="success"
                              icon={s.status === 'suspended' ? <Undo2 size={14} /> : <BadgeCheck size={14} />}
                              isLoading={busyId === s.id && !pending}
                              disabled={Boolean(busyId)}
                              onClick={() => void decide(s, 'verify')}
                            >
                              {s.status === 'suspended' ? t('Restore') : t('Verify')}
                            </Button>
                          )}
                          {(s.status === 'pending' || s.status === 'verified') && (
                            <Button
                              size="sm"
                              variant={s.status === 'verified' ? 'danger' : 'default'}
                              icon={<Ban size={14} />}
                              disabled={Boolean(busyId)}
                              onClick={() => {
                                setPending({ store: s, decision: s.status === 'verified' ? 'suspend' : 'reject' });
                                setReason('');
                                setReasonError('');
                              }}
                            >
                              {s.status === 'verified' ? t('Suspend') : t('Send back')}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={stores.data.page} totalPages={stores.data.totalPages} onChange={(next) => update({ page: next > 1 ? String(next) : null })} />
          </>
        )}
      </section>

      <Modal
        open={Boolean(pending)}
        title={
          pending?.decision === 'suspend'
            ? t('Suspend {name}?', {
                name: pending.store.name,
              })
            : t('Send {name} back?', {
                name: pending?.store.name,
              })
        }
        description={
          pending?.decision === 'suspend'
            ? t("The store page and badge disappear until you restore it. The seller's ads stay live.")
            : t('The seller sees your reason and can fix the details and send the store again.')
        }
        onClose={() => setPending(null)}
        footer={
          <>
            <Button onClick={() => setPending(null)}>{t('Cancel')}</Button>
            <Button variant="danger" isLoading={busyId === pending?.store.id} onClick={confirm}>
              {pending?.decision === 'suspend' ? t('Suspend store') : t('Send back')}
            </Button>
          </>
        }
      >
        <TextareaField
          label={t('Reason for the seller')}
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setReasonError('');
          }}
          error={reasonError}
          maxLength={300}
          required
          placeholder={t('e.g. The CR number does not match the business name.')}
        />
      </Modal>
    </>
  );
}
