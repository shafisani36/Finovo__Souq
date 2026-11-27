import { useEffect, useState } from 'react';
import { Search, Trash2, UserCheck, UserX, Users } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { getErrorMessage } from '../../api/errors';
import { PageHeader } from '../../components/dashboard/PageHeader';
import { Avatar } from '../../components/ui/Avatar';
import { Badge, UserStatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { TextareaField } from '../../components/ui/Field';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { Pagination } from '../../components/ui/Pagination';
import { EmptyState, ErrorState, SkeletonBlock } from '../../components/ui/States';
import { useToast } from '../../components/ui/toast-context';
import { ROLE_LABELS } from '../../features/auth/rbac';
import { useAsync } from '../../hooks/useAsync';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { adminService } from '../../services/admin.service';
import type { User } from '../../types';
import { formatDate } from '../../utils/format';
import { t } from '../../i18n';

const TYPE_FILTERS = [
  { value: 'all', label: t('All accounts') },
  { value: 'seller', label: t('Sellers') },
  { value: 'buyer', label: t('Buyers') },
  { value: 'admin', label: t('Admins') },
];

const STATUS_FILTERS = [
  { value: 'all', label: t('Any status') },
  { value: 'pending', label: t('Waiting for approval') },
  { value: 'active', label: t('Active') },
  { value: 'suspended', label: t('Suspended') },
  { value: 'deletion', label: t('Deletion requested') },
  { value: 'deleted', label: t('Deleted') },
];

export function UsersPage() {
  useDocumentTitle(t('Users'));
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const type = searchParams.get('type') ?? 'all';
  const status = searchParams.get('status') ?? 'all';
  const page = Number(searchParams.get('page')) || 1;
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const debouncedQuery = useDebouncedValue(query.trim());
  const [target, setTarget] = useState<User | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([k, v]) => (v && v !== 'all' ? next.set(k, v) : next.delete(k)));
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    if ((searchParams.get('q') ?? '') !== debouncedQuery) update({ q: debouncedQuery || null, page: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);

  const users = useAsync(
    () =>
      adminService.users({
        q: searchParams.get('q') || undefined,
        role: type === 'admin' ? 'admin' : type === 'all' ? undefined : 'user',
        accountType: type === 'buyer' || type === 'seller' ? type : undefined,
        ...(status === 'deletion' ? { deletion: 'requested' as const } : { status }),
        page,
      }),
    [searchParams.toString()],
  );
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const nextStatus = target?.status === 'suspended' ? 'active' : 'suspended';
  const isRejecting = target?.status === 'pending';

  const replaceUser = (updated: User) => users.setData((prev) => (prev ? { ...prev, items: prev.items.map((u) => (u.id === updated.id ? updated : u)) } : prev));

  const approve = async (user: User) => {
    setApprovingId(user.id);
    try {
      const result = await adminService.approveUser(user.id);
      replaceUser(result.user);
      toast.show(
        result.emailSent
          ? {
              title: t('Seller approved'),
              message: t('{name} can sign in now. An approval email has been sent.', {
                name: user.name,
              }),
            }
          : {
              title: t('Seller approved, email not sent'),
              message: t('{name} can sign in now, but the email failed. Check the mail settings.', {
                name: user.name,
              }),
              tone: 'error',
            },
      );
    } catch (error) {
      toast.show({ title: t('Could not approve'), message: getErrorMessage(error), tone: 'error' });
    } finally {
      setApprovingId(null);
    }
  };

  const confirmStatus = async () => {
    if (!target) return;
    if (reason.trim().length < 5) {
      setReasonError(t('Add a short reason (at least 5 characters).'));
      return;
    }
    setSaving(true);
    try {
      const updated = await adminService.setUserStatus(target.id, nextStatus, reason.trim());
      replaceUser(updated);
      toast.show({ title: isRejecting ? t('Seller rejected') : nextStatus === 'suspended' ? t('User suspended') : t('User reactivated'), message: updated.name });
      setTarget(null);
    } catch (error) {
      setReasonError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (reason.trim().length < 5) {
      setReasonError(t('Add a short reason (at least 5 characters).'));
      return;
    }
    setSaving(true);
    try {
      const updated = await adminService.deleteUser(deleteTarget.id, reason.trim());
      replaceUser(updated);
      toast.show({ title: t('Account deleted'), message: t('Personal details, ads and messages have been removed.') });
      setDeleteTarget(null);
    } catch (error) {
      setReasonError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const openDelete = (user: User) => {
    setDeleteTarget(user);
    setReason(user.deletionRequestedAt ? "Deleted at the user's request" : '');
    setReasonError('');
  };

  return (
    <>
      <PageHeader title={t('Users')} subtitle={t('Approve new sellers, find accounts and suspend abusive users. Pending and suspended users cannot sign in.')} />
      <section className="card">
        <div className="toolbar">
          <div className="toolbar__search">
            <Search size={16} aria-hidden="true" />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('Name, email or phone')} aria-label={t('Search users')} />
          </div>
          <div className="toolbar__filters">
            <Select size="sm" value={type} onChange={(next) => update({ type: next, page: null })} options={TYPE_FILTERS} aria-label={t('Account type')} />
            <Select size="sm" value={status} onChange={(next) => update({ status: next, page: null })} options={STATUS_FILTERS} aria-label={t('Status')} />
          </div>
        </div>

        {users.error ? (
          <ErrorState error={users.error} onRetry={users.reload} />
        ) : users.isLoading || !users.data ? (
          <SkeletonBlock height={320} />
        ) : users.data.items.length === 0 ? (
          <EmptyState icon={<Users size={26} />} title={t('No users found')} text={t('Try another name, phone number or filter.')} />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('User')}</th>
                    <th>{t('Account')}</th>
                    <th>{t('Phone')}</th>
                    <th>{t('City')}</th>
                    <th>{t('Status')}</th>
                    <th className="table__num">
                      <span className="sr-only">{t('Actions')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.data.items.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div className="table-item">
                          <Avatar name={u.name} src={u.avatarUrl} size="sm" />
                          <span>
                            <span className="table-item__title">{u.name}</span>
                            <span className="table-item__meta">{u.email ?? t('No email')}</span>
                            <span className="table-item__meta">
                              {t('Joined')} {formatDate(u.createdAt)}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td>
                        <Badge tone={u.role === 'admin' ? 'primary' : u.accountType === 'seller' ? 'info' : 'neutral'}>
                          {u.role === 'admin' ? ROLE_LABELS.admin : u.accountType === 'seller' ? t('Seller') : t('Buyer')}
                        </Badge>
                      </td>
                      <td className="tabular" dir="ltr" style={{ whiteSpace: 'nowrap' }}>
                        {u.phone ?? '-'}
                      </td>
                      <td>{u.city ? t(u.city) : '-'}</td>
                      <td>
                        <div className="badge-row">
                          <UserStatusBadge status={u.status} />
                          {u.deletionRequestedAt && u.status !== 'deleted' && <Badge tone="warning">{t('Deletion requested')}</Badge>}
                        </div>
                      </td>
                      <td>
                        <div className="table__actions">
                          {u.status === 'pending' && (
                            <Button size="sm" variant="success" icon={<UserCheck size={14} />} isLoading={approvingId === u.id} onClick={() => void approve(u)}>
                              {t('Approve')}
                            </Button>
                          )}
                          {u.role !== 'admin' && u.status !== 'deleted' && (
                            <Button
                              size="sm"
                              variant={u.status === 'suspended' ? 'success' : 'danger'}
                              icon={u.status === 'suspended' ? <UserCheck size={14} /> : <UserX size={14} />}
                              onClick={() => {
                                setTarget(u);
                                setReason('');
                                setReasonError('');
                              }}
                            >
                              {u.status === 'suspended' ? t('Reactivate') : u.status === 'pending' ? t('Reject') : t('Suspend')}
                            </Button>
                          )}
                          {u.role !== 'admin' && u.status !== 'deleted' && (
                            <button
                              type="button"
                              className="icon-btn icon-btn--sm"
                              onClick={() => openDelete(u)}
                              aria-label={t('Delete {name}', {
                                name: u.name,
                              })}
                              title={t('Delete account')}
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={users.data.page} totalPages={users.data.totalPages} onChange={(p) => update({ page: p > 1 ? String(p) : null })} />
          </>
        )}
      </section>

      <Modal
        open={Boolean(target)}
        title={
          isRejecting
            ? t('Reject {name}?', {
                name: target?.name,
              })
            : nextStatus === 'suspended'
              ? t('Suspend {name}?', {
                  name: target?.name,
                })
              : t('Reactivate {name}?', {
                  name: target?.name,
                })
        }
        description={
          isRejecting
            ? t('The seller account will not be able to sign in. You can reactivate it later.')
            : nextStatus === 'suspended'
              ? t('They will be signed out and cannot sign in until reactivated.')
              : t('They will be able to sign in and use their account again.')
        }
        onClose={() => setTarget(null)}
        footer={
          <>
            <Button onClick={() => setTarget(null)}>{t('Cancel')}</Button>
            <Button variant={nextStatus === 'suspended' ? 'danger' : 'success'} isLoading={saving} onClick={confirmStatus}>
              {isRejecting ? t('Reject seller') : nextStatus === 'suspended' ? t('Suspend user') : t('Reactivate user')}
            </Button>
          </>
        }
      >
        <TextareaField
          label={t('Reason')}
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setReasonError('');
          }}
          error={reasonError}
          maxLength={300}
          required
          hint={t('Kept in the admin history.')}
        />
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        title={t("Delete {name}'s account?", {
          name: deleteTarget?.name,
        })}
        description={t('This cannot be undone. Their name, email, phone, ads, photos, saved items and chat messages are erased, and they are signed out everywhere.')}
        onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <Button onClick={() => setDeleteTarget(null)}>{t('Cancel')}</Button>
            <Button variant="danger" icon={<Trash2 size={16} />} isLoading={saving} onClick={() => void confirmDelete()}>
              {t('Delete account')}
            </Button>
          </>
        }
      >
        {deleteTarget?.deletionRequestedAt && (
          <div className="alert alert--warning" role="status" style={{ marginBottom: 'var(--space-4)' }}>
            {t('Requested by the user on')} {formatDate(deleteTarget.deletionRequestedAt)}
            {deleteTarget.deletionReason ? `: “${deleteTarget.deletionReason}”` : '.'}
          </div>
        )}
        <TextareaField
          label={t('Reason')}
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setReasonError('');
          }}
          error={reasonError}
          maxLength={300}
          required
          hint={t('Kept in the admin history.')}
        />
      </Modal>
    </>
  );
}
