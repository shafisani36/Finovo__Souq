import { useEffect, useState } from 'react';
import { Search, UserCheck, UserX, Users } from 'lucide-react';
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

const TYPE_FILTERS = [
  { value: 'all', label: 'All accounts' },
  { value: 'seller', label: 'Sellers' },
  { value: 'buyer', label: 'Buyers' },
  { value: 'admin', label: 'Admins' },
];

const STATUS_FILTERS = [
  { value: 'all', label: 'Any status' },
  { value: 'pending', label: 'Waiting for approval' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
];

export function UsersPage() {
  useDocumentTitle('Users');
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
        status,
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
          ? { title: 'Seller approved', message: `${user.name} can sign in now. An approval email has been sent.` }
          : { title: 'Seller approved, email not sent', message: `${user.name} can sign in now, but the email failed. Check the mail settings.`, tone: 'error' },
      );
    } catch (error) {
      toast.show({ title: 'Could not approve', message: getErrorMessage(error), tone: 'error' });
    } finally {
      setApprovingId(null);
    }
  };

  const confirmStatus = async () => {
    if (!target) return;
    if (reason.trim().length < 5) {
      setReasonError('Add a short reason (at least 5 characters).');
      return;
    }
    setSaving(true);
    try {
      const updated = await adminService.setUserStatus(target.id, nextStatus, reason.trim());
      replaceUser(updated);
      toast.show({ title: isRejecting ? 'Seller rejected' : nextStatus === 'suspended' ? 'User suspended' : 'User reactivated', message: updated.name });
      setTarget(null);
    } catch (error) {
      setReasonError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="Users" subtitle="Approve new sellers, find accounts and suspend abusive users. Pending and suspended users cannot sign in." />
      <section className="card">
        <div className="toolbar">
          <div className="toolbar__search">
            <Search size={16} aria-hidden="true" />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, email or phone" aria-label="Search users" />
          </div>
          <div className="toolbar__filters">
            <Select size="sm" value={type} onChange={(next) => update({ type: next, page: null })} options={TYPE_FILTERS} aria-label="Account type" />
            <Select size="sm" value={status} onChange={(next) => update({ status: next, page: null })} options={STATUS_FILTERS} aria-label="Status" />
          </div>
        </div>

        {users.error ? (
          <ErrorState error={users.error} onRetry={users.reload} />
        ) : users.isLoading || !users.data ? (
          <SkeletonBlock height={320} />
        ) : users.data.items.length === 0 ? (
          <EmptyState icon={<Users size={26} />} title="No users found" text="Try another name, phone number or filter." />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Account</th>
                    <th>Phone</th>
                    <th>City</th>
                    <th>Status</th>
                    <th className="table__num">Joined</th>
                    <th className="table__num">
                      <span className="sr-only">Actions</span>
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
                            <span className="table-item__meta">{u.email ?? 'No email'}</span>
                          </span>
                        </div>
                      </td>
                      <td>
                        <Badge tone={u.role === 'admin' ? 'primary' : u.accountType === 'seller' ? 'info' : 'neutral'}>{u.role === 'admin' ? ROLE_LABELS.admin : u.accountType === 'seller' ? 'Seller' : 'Buyer'}</Badge>
                      </td>
                      <td className="tabular">{u.phone}</td>
                      <td>{u.city ?? '-'}</td>
                      <td>
                        <UserStatusBadge status={u.status} />
                      </td>
                      <td className="table__num">{formatDate(u.createdAt)}</td>
                      <td>
                        <div className="table__actions">
                          {u.status === 'pending' && (
                            <Button size="sm" variant="success" icon={<UserCheck size={14} />} isLoading={approvingId === u.id} onClick={() => void approve(u)}>
                              Approve
                            </Button>
                          )}
                          {u.role !== 'admin' && (
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
                              {u.status === 'suspended' ? 'Reactivate' : u.status === 'pending' ? 'Reject' : 'Suspend'}
                            </Button>
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
        title={isRejecting ? `Reject ${target?.name}?` : nextStatus === 'suspended' ? `Suspend ${target?.name}?` : `Reactivate ${target?.name}?`}
        description={isRejecting ? 'The seller account will not be able to sign in. You can reactivate it later.' : nextStatus === 'suspended' ? 'They will be signed out and cannot sign in until reactivated.' : 'They will be able to sign in and use their account again.'}
        onClose={() => setTarget(null)}
        footer={
          <>
            <Button onClick={() => setTarget(null)}>Cancel</Button>
            <Button variant={nextStatus === 'suspended' ? 'danger' : 'success'} isLoading={saving} onClick={confirmStatus}>
              {isRejecting ? 'Reject seller' : nextStatus === 'suspended' ? 'Suspend user' : 'Reactivate user'}
            </Button>
          </>
        }
      >
        <TextareaField
          label="Reason"
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setReasonError('');
          }}
          error={reasonError}
          maxLength={300}
          required
          hint="Kept in the admin history."
        />
      </Modal>
    </>
  );
}
