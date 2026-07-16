import React, { useState, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight, ArrowUpDown, Edit, Trash2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import EmptyState from '@/components/shared/EmptyState';
import { useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';

export default function DataTable({
  data = [],
  columns = [],
  searchPlaceholder = 'Search...',
  filters = [],
  onEdit,
  onDelete,
  onView,
  onRowClick,
  pageSize: defaultPageSize = 10,
  emptyTitle,
  emptyDescription,
  emptyAction,
  emptyActionLabel,
}) {
  const [search, setSearch] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const filterValues = useMemo(() => {
    const vals = {};
    filters.forEach(f => {
      const v = searchParams.get(`filter.${f.key}`);
      if (v) vals[f.key] = v;
    });
    return vals;
  }, [searchParams, filters]);
  const handleFilterChange = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value && value !== '_all') {
      next.set(`filter.${key}`, value);
    } else {
      next.delete(`filter.${key}`);
    }
    setSearchParams(next);
    setPage(0);
  };
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const filtered = useMemo(() => {
    let result = [...data];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(row =>
        columns.some(col => {
          const val = row[col.key];
          return val && String(val).toLowerCase().includes(q);
        })
      );
    }
    Object.entries(filterValues).forEach(([key, value]) => {
      if (value && value !== '_all') {
        result = result.filter(row => String(row[key]) === value);
      }
    });
    if (sortKey) {
      result.sort((a, b) => {
        const aVal = a[sortKey] ?? '';
        const bVal = b[sortKey] ?? '';
        const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return result;
  }, [data, search, filterValues, sortKey, sortDir, columns]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const hasActions = onEdit || onDelete || onView;

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Toolbar */}
      <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            className="pl-9 h-9"
          />
        </div>
        {filters.map(filter => (
          <Select
            key={filter.key}
            value={filterValues[filter.key] || '_all'}
            onValueChange={v => handleFilterChange(filter.key, v)}
          >
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder={filter.label} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All {filter.label}</SelectItem>
              {filter.options.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
      </div>

      {/* Table */}
      {paged.length === 0 ? (
        <EmptyState
          title={emptyTitle || 'No records found'}
          description={emptyDescription || (search ? 'Try adjusting your search or filters' : undefined)}
          action={!search ? emptyAction : undefined}
          actionLabel={emptyActionLabel}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {columns.map(col => (
                  <th
                    key={col.key}
                    className="text-left px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap cursor-pointer select-none active:text-foreground transition-colors"
                    onClick={() => col.sortable !== false && handleSort(col.key)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {col.sortable !== false && (
                        <ArrowUpDown className={cn(
                          "w-3 h-3",
                          sortKey === col.key ? "text-primary" : "text-muted-foreground/40"
                        )} />
                      )}
                    </span>
                  </th>
                ))}
                {hasActions && (
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paged.map((row, i) => (
                <tr key={row.id || i} className={cn("active:bg-muted/30 transition-colors", onRowClick && "cursor-pointer")} onClick={onRowClick ? () => onRowClick(row) : undefined}>
                  {columns.map(col => (
                    <td key={col.key} className="px-4 py-3 whitespace-nowrap">
                      {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                    </td>
                  ))}
                  {hasActions && (
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1 md:gap-1 gap-y-2 flex-wrap justify-end">
                        {onView && (
                          <Button variant="ghost" size="sm" onClick={() => onView(row)} aria-label="View" className="h-11 w-11 md:h-8 md:w-8 p-0">
                            <Eye className="w-4 h-4" />
                          </Button>
                        )}
                        {onEdit && (
                          <Button variant="ghost" size="sm" onClick={() => onEdit(row)} aria-label="Edit" className="h-11 w-11 md:h-8 md:w-8 p-0">
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}
                        {onDelete && (
                          <Button variant="ghost" size="sm" onClick={() => onDelete(row)} aria-label="Delete" className="h-11 w-11 md:h-8 md:w-8 p-0 text-destructive active:text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <p className="text-sm text-muted-foreground">
            Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, filtered.length)} of {filtered.length}
          </p>
          <div className="flex items-center gap-2">
            <Select value={String(pageSize)} onValueChange={v => { setPageSize(Number(v)); setPage(0); }}>
              <SelectTrigger className="w-[70px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 25, 50].map(n => (
                  <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)} aria-label="Previous page" className="h-11 w-11 md:h-8 md:w-8 p-0">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium min-w-[60px] text-center">
              {page + 1} / {totalPages || 1}
            </span>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} aria-label="Next page" className="h-11 w-11 md:h-8 md:w-8 p-0">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}