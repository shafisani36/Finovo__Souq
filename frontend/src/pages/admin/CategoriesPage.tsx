import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronRight, EyeOff, FolderTree, Pencil, Plus, Trash2 } from 'lucide-react';
import { getErrorMessage } from '../../api/errors';
import { CategoryForm } from '../../components/admin/CategoryForm';
import { PageHeader } from '../../components/dashboard/PageHeader';
import { CategoryIcon } from '../../components/listings/CategoryIcon';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { EmptyState, ErrorState, SkeletonBlock } from '../../components/ui/States';
import { useToast } from '../../components/ui/toast-context';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { adminService } from '../../services/admin.service';
import type { AdminCategory, CategoryPayload } from '../../types';
import { formatNumber } from '../../utils/format';

const MAX_DEPTH = 4;

/** Own and inherited details together; a detail the category overrides counts once */
const detailCount = (c: AdminCategory) => {
  const count = new Set([...c.inheritedFields, ...c.fields].map((f) => f.fieldKey)).size;
  return `${count} ${count === 1 ? 'detail' : 'details'}`;
};

type Editing = { category: AdminCategory | null; parentId: string | null } | null;

/** Category tree manager: add, edit, move, reorder, hide and delete categories */
export function CategoriesPage() {
  useDocumentTitle('Categories');
  const toast = useToast();
  const tree = useAsync(() => adminService.categories(), []);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<AdminCategory | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const categories = useMemo(() => tree.data ?? [], [tree.data]);
  const siblingsOf = (c: AdminCategory) => categories.filter((s) => s.parentId === c.parentId);
  // A row is shown when none of the categories above it is collapsed
  const visible = categories.filter((c) => !c.path.slice(0, -1).some((id) => collapsed.has(id)));

  const toggle = (id: string) =>
    setCollapsed((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const run = async (id: string, action: () => Promise<void>, success: string) => {
    setBusyId(id);
    try {
      await action();
      toast.show({ title: success });
      tree.reload();
    } catch (error) {
      toast.show({ title: 'Could not save', message: getErrorMessage(error), tone: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const move = (c: AdminCategory, by: number) => {
    const ids = siblingsOf(c).map((s) => s.id);
    const index = ids.indexOf(c.id);
    [ids[index], ids[index + by]] = [ids[index + by], ids[index]];
    void run(c.id, () => adminService.reorderCategories(c.parentId, ids), 'Order saved');
  };

  const save = async (payload: CategoryPayload) => {
    if (!editing) return;
    if (editing.category) await adminService.updateCategory(editing.category.id, payload);
    else await adminService.createCategory(payload);
    toast.show({ title: editing.category ? 'Category saved' : 'Category created', message: payload.name });
    setEditing(null);
    tree.reload();
  };

  const canAddChild = (c: AdminCategory) => c.depth < MAX_DEPTH - 1 && c.directListings === 0;

  return (
    <>
      <PageHeader
        title="Categories"
        subtitle={`Build the category tree up to ${MAX_DEPTH} levels deep. Ads can only be posted in a final category (one without subcategories).`}
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEditing({ category: null, parentId: null })}>
            Add category
          </Button>
        }
      />

      <section className="card">
        {tree.error ? (
          <ErrorState error={tree.error} onRetry={tree.reload} />
        ) : tree.isLoading || !tree.data ? (
          <SkeletonBlock height={420} />
        ) : categories.length === 0 ? (
          <EmptyState icon={<FolderTree size={26} />} title="No categories yet" text="Add the first top-level category to start." />
        ) : (
          <ul className="category-tree" role="tree" aria-label="Categories">
            {visible.map((c) => {
              const siblings = siblingsOf(c);
              const position = siblings.findIndex((s) => s.id === c.id);
              const isCollapsed = collapsed.has(c.id);
              return (
                <li key={c.id} role="treeitem" aria-level={c.depth + 1} aria-expanded={c.isLeaf ? undefined : !isCollapsed} className={`category-row${c.isVisible ? '' : ' is-hidden'}`} style={{ paddingInlineStart: `calc(${c.depth} * 28px + 12px)` }}>
                  {c.isLeaf ? (
                    <span className="category-row__toggle" aria-hidden="true" />
                  ) : (
                    <button type="button" className={`category-row__toggle${isCollapsed ? '' : ' is-open'}`} onClick={() => toggle(c.id)} aria-label={isCollapsed ? `Show subcategories of ${c.name}` : `Hide subcategories of ${c.name}`}>
                      <ChevronRight size={16} />
                    </button>
                  )}
                  <span className="category-row__icon">
                    <CategoryIcon icon={c.effectiveIcon} size={17} />
                  </span>
                  <span className="category-row__main">
                    <strong>{c.name}</strong>
                    <span className="category-row__meta">
                      /{c.slug} · {c.isLeaf ? detailCount(c) : `${c.childCount} ${c.childCount === 1 ? 'subcategory' : 'subcategories'}`}
                    </span>
                  </span>
                  <span className="category-row__badges">
                    {!c.isActive && (
                      <Badge tone="warning" icon={<EyeOff size={12} />}>
                        Hidden
                      </Badge>
                    )}
                    {c.isLeaf && <Badge tone="neutral">Final</Badge>}
                    <span className="category-row__count tabular">{formatNumber(c.liveListings)} live</span>
                  </span>
                  <span className="category-row__actions">
                    <button type="button" className="icon-btn icon-btn--sm" onClick={() => move(c, -1)} disabled={position === 0 || busyId !== null} aria-label={`Move ${c.name} up`}>
                      <ArrowUp size={15} />
                    </button>
                    <button type="button" className="icon-btn icon-btn--sm" onClick={() => move(c, 1)} disabled={position === siblings.length - 1 || busyId !== null} aria-label={`Move ${c.name} down`}>
                      <ArrowDown size={15} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn--sm"
                      onClick={() => setEditing({ category: null, parentId: c.id })}
                      disabled={!canAddChild(c)}
                      aria-label={`Add a subcategory to ${c.name}`}
                      title={canAddChild(c) ? 'Add subcategory' : c.directListings ? 'This category holds ads, so it cannot get subcategories' : 'Maximum depth reached'}
                    >
                      <Plus size={15} />
                    </button>
                    <button type="button" className="icon-btn icon-btn--sm" onClick={() => setEditing({ category: c, parentId: c.parentId })} aria-label={`Edit ${c.name}`}>
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn--sm"
                      onClick={() => setDeleting(c)}
                      disabled={!c.isLeaf || c.directListings > 0}
                      aria-label={`Delete ${c.name}`}
                      title={!c.isLeaf ? 'Delete its subcategories first' : c.directListings ? 'Has ads: hide it instead' : 'Delete'}
                    >
                      <Trash2 size={15} />
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Modal
        open={Boolean(editing)}
        title={editing?.category ? `Edit ${editing.category.name}` : editing?.parentId ? `New subcategory in ${categories.find((c) => c.id === editing.parentId)?.name ?? ''}` : 'New category'}
        onClose={() => setEditing(null)}
        maxWidth={760}
      >
        {editing && <CategoryForm key={editing.category?.id ?? `new-${editing.parentId}`} categories={categories} category={editing.category} defaultParentId={editing.parentId} onSubmit={save} onCancel={() => setEditing(null)} />}
      </Modal>

      <Modal
        open={Boolean(deleting)}
        title={`Delete ${deleting?.name}?`}
        description="This cannot be undone. Categories with ads cannot be deleted; hide them instead."
        onClose={() => setDeleting(null)}
        footer={
          <>
            <Button onClick={() => setDeleting(null)}>Cancel</Button>
            <Button
              variant="danger"
              isLoading={busyId === deleting?.id}
              onClick={() => {
                if (!deleting) return;
                const target = deleting;
                setDeleting(null);
                void run(target.id, () => adminService.deleteCategory(target.id), 'Category deleted');
              }}
            >
              Delete category
            </Button>
          </>
        }
      >
        <p className="text-muted">Only categories without subcategories and without any ads can be deleted.</p>
      </Modal>
    </>
  );
}
