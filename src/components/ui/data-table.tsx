'use client';

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { useTable, type ColumnDef, type ColumnFiltersState, type ColumnVisibilityState, type GroupingState, type PaginationState, type RowData, type SortingState } from '@tanstack/react-table';

import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';

import { features, type DataTableFeatures } from './data-table-features';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useIsMobile } from '@/hooks/use-mobile';
import { ArrowUpDown, ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react';

interface DataTableProps<TData extends RowData> {
	columns: ColumnDef<DataTableFeatures, TData>[];
	data: TData[];
	meta?: Record<string, unknown>;
	groupOptions?: { value: string; label: string }[];
	renderMobileRowCard?: (item: TData, meta?: Record<string, unknown>) => ReactNode;
}

export function DataTable<TData extends RowData>({
	columns,
	data,
	meta,
	groupOptions = [],
	renderMobileRowCard,
}: DataTableProps<TData>) {
  const isMobile = useIsMobile()
	const [sorting, setSorting] = useState<SortingState>([]);
	const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
	const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>({});
	const [grouping, setGrouping] = useState<GroupingState>([]);
	const [search, setSearch] = useState('');
	const deferredSearch = useDeferredValue(search);
	const normalizedSearch = useMemo(() => deferredSearch.trim().toLowerCase(), [deferredSearch]);
	useEffect(() => {
		async function resetPageIndex() {
			setTimeout(() => setPagination((current) => current.pageIndex === 0 ? current : { ...current, pageIndex: 0 }), 0);
		}
	 resetPageIndex();
	}, [normalizedSearch]);
	
	const filteredData = useMemo(
		() => normalizedSearch
			? data.filter((item) => JSON.stringify(item).toLowerCase().includes(normalizedSearch))
			: data,
		[data, normalizedSearch],
	);
	const toggleGrouping = useCallback((value: string) => {
		setGrouping((current) => current.includes(value) ? [] : [value]);
	}, []);
	const table = useTable({
		features,
		data: filteredData,
		columns,
		meta,
		onSortingChange: setSorting,
		onPaginationChange: setPagination,
		onColumnFiltersChange: setColumnFilters,
		onColumnVisibilityChange: setColumnVisibility,
		onGroupingChange: setGrouping,
		state: { sorting, pagination, columnFilters, columnVisibility, grouping },
		autoResetPageIndex: false,
	});
	// Mobile cards have no column headers, so header sorting is desktop-only.
	// This dropdown gives the card layout the same sorting (e.g. by balance).
	const sortableColumns = useMemo(() => table.getAllColumns().filter((column) => column.getCanSort()), [table]);
	const sortValue = sorting.length > 0 ? `${sorting[0].id}:${sorting[0].desc ? 'desc' : 'asc'}` : 'none';
	const prettyColumnName = useCallback(
		(id: string) => id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
		[],
	);
	const onMobileSortChange = useCallback((value: string) => {
		if (value === 'none') {
			setSorting([]);
			return;
		}
		const sep = value.lastIndexOf(':');
		setSorting([{ id: value.slice(0, sep), desc: value.slice(sep + 1) === 'desc' }]);
	}, []);

	return (
		<div className='space-y-3'>
			<div className='flex flex-wrap items-center gap-2'>
				<Input
					placeholder='Search…'
					aria-label='Search table'
					value={search}
					onChange={(event) => setSearch(event.target.value)}
					className='max-w-sm'
				/>
				<DropdownMenu>
					<DropdownMenuTrigger asChild><Button variant='outline'>Columns</Button></DropdownMenuTrigger>
					<DropdownMenuContent align='end'>
						{table.getAllColumns().filter((column) => column.getCanHide()).map((column) => (
							<DropdownMenuCheckboxItem key={column.id} checked={column.getIsVisible()} onCheckedChange={(value) => column.toggleVisibility(!!value)}>
								{prettyColumnName(column.id)}
							</DropdownMenuCheckboxItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
				{groupOptions.map((option) => (
					<Button key={option.value} variant={grouping.includes(option.value) ? 'secondary' : 'outline'} onClick={() => toggleGrouping(option.value)}>
						{option.label}
					</Button>
				))}
				{sortableColumns.length > 0 && (
					<div className='flex items-center gap-2 md:hidden'>
						<span className='text-sm text-muted-foreground'>Sort</span>
						<Select value={sortValue} onValueChange={onMobileSortChange}>
							<SelectTrigger size='sm' aria-label='Sort rows'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='none'>Default order</SelectItem>
								{sortableColumns.map((column) => (
									<SelectItem key={`${column.id}:asc`} value={`${column.id}:asc`}>
										{prettyColumnName(column.id)} ↑
									</SelectItem>
								))}
								{sortableColumns.map((column) => (
									<SelectItem key={`${column.id}:desc`} value={`${column.id}:desc`}>
										{prettyColumnName(column.id)} ↓
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				)}
			</div>
      {(isMobile && renderMobileRowCard) ? (
        <div className='space-y-3 md:hidden'>
          {table.getRowModel().rows?.length ? table.getRowModel().rows.map((row) => (
            <div key={row.id}>{renderMobileRowCard(row.original, meta)}</div>
          )) : (
            <div className='rounded-md border py-10 text-center text-sm text-muted-foreground'>No results.</div>
          )}
        </div>
      ) :
        <div className={'overflow-x-auto rounded-md border'}>
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id}>
                        {header.isPlaceholder ? null : (
													header.column.getCanSort() ? (
														<Button
															variant='ghost'
															size='sm'
															className='-ml-2 h-8 gap-1 px-2 font-medium'
															onClick={header.column.getToggleSortingHandler()}
														>
															<table.FlexRender header={header} />
															{header.column.getIsSorted() === 'asc' ? (
																<ChevronUp />
															) : header.column.getIsSorted() === 'desc' ? (
																<ChevronDown />
															) : (
																<ArrowUpDown className='text-muted-foreground' />
															)}
														</Button>
													) : (
														<table.FlexRender header={header} />
													)
                        )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && 'selected'}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        <table.FlexRender cell={cell} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className='h-24 text-center'>
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      }
			<div className='flex flex-wrap items-center justify-between gap-3 py-4'>
				<div className='flex items-center gap-2 text-sm text-muted-foreground'>
					<span>Per page</span>
					<Select
						value={String(pagination.pageSize)}
						onValueChange={(value) => setPagination({ pageIndex: 0, pageSize: Number(value) })}
					>
						<SelectTrigger size='sm' aria-label='Rows per page'>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{[10, 20, 50, 100].map((size) => (
								<SelectItem key={size} value={String(size)}>{size}</SelectItem>
							))}
						</SelectContent>
					</Select>
					<span>
						Page {pagination.pageIndex + 1} of {Math.max(table.getPageCount(), 1)}
					</span>
				</div>
				<div className='flex items-center gap-2'>
					<Button variant='outline' size='icon-sm' aria-label='Previous page' onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
						<ChevronLeft />
					</Button>
					<Button variant='outline' size='icon-sm' aria-label='Next page' onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
						<ChevronRight />
					</Button>
				</div>
			</div>
		</div>
	);
}
