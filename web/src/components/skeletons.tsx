type BoxProps = { className?: string };

export function Bone({ className = "" }: BoxProps) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

function Card({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border border-[var(--line)] bg-[var(--card)] ${className}`}
    >
      {children}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading…</span>
      {children}
    </div>
  );
}

export function TitleSkeleton({ withEyebrow = false }: { withEyebrow?: boolean }) {
  return (
    <div>
      {withEyebrow ? <Bone className="mb-2 h-4 w-16" /> : null}
      <Bone className="h-8 w-56 max-w-[70%] sm:h-9 sm:w-72" />
    </div>
  );
}

export function TabsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="tab-scroll -mx-4 mt-5 border-b border-[var(--line)] px-4 pb-3 sm:mx-0 sm:mt-6 sm:px-0">
      {Array.from({ length: count }).map((_, i) => (
        <Bone key={i} className="h-9 w-28 rounded-full" />
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Card className="divide-y divide-[var(--line)]">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-4 px-4 py-3.5">
          <div className="min-w-0 flex-1 space-y-2">
            <Bone className="h-4 w-28" />
            <Bone className="h-3 w-48 max-w-full" />
          </div>
          <Bone className="h-4 w-20 shrink-0" />
        </div>
      ))}
    </Card>
  );
}

export function TableSkeleton({
  rows = 8,
  cols = 6,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <>
      <div className="md:hidden">
        <ListSkeleton rows={Math.min(rows, 6)} />
      </div>
      <Card className="hidden overflow-hidden md:block">
        <div
          className="grid gap-4 border-b border-[var(--line)] bg-[var(--bg-accent)]/50 px-4 py-3"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: cols }).map((_, i) => (
            <Bone key={i} className="h-3 w-16" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            className="grid gap-4 border-b border-[var(--line)] px-4 py-3.5 last:border-0"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: cols }).map((_, c) => (
              <Bone
                key={c}
                className={`h-4 ${c === 0 ? "w-20" : c % 2 ? "w-full" : "w-3/4"}`}
              />
            ))}
          </div>
        ))}
      </Card>
    </>
  );
}

function FieldGrid({ count, cols }: { count: number; cols: string }) {
  return (
    <div className={`grid gap-3 ${cols}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Bone className="h-3 w-20" />
          <Bone className="h-10 w-full rounded-xl" />
        </div>
      ))}
    </div>
  );
}

export function FormSkeleton({ fields = 9 }: { fields?: number }) {
  return (
    <Card className="space-y-5 p-4 sm:p-6">
      <Bone className="h-6 w-40" />
      <FieldGrid count={fields} cols="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" />
      <Bone className="h-24 w-full rounded-xl" />
      <Bone className="h-10 w-36 rounded-full" />
    </Card>
  );
}

export function DashboardSkeleton() {
  return (
    <Shell>
      <div className="space-y-6 sm:space-y-8">
        <div>
          <TitleSkeleton withEyebrow />
          <TabsSkeleton count={2} />
        </div>
        <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="space-y-3 p-5 sm:p-6">
              <Bone className="h-3.5 w-24" />
              <Bone className="h-10 w-28" />
              <Bone className="h-3 w-32" />
            </Card>
          ))}
        </div>
        {[0, 1].map((row) => (
          <div key={row} className="grid gap-4 lg:grid-cols-2">
            {[0, 1].map((i) => (
              <Card key={i} className="p-4 sm:p-5">
                <Bone className="h-5 w-36" />
                <Bone className="mt-2 h-3 w-24" />
                <Bone className="mt-5 h-[200px] w-full rounded-xl sm:h-[240px]" />
              </Card>
            ))}
          </div>
        ))}
      </div>
    </Shell>
  );
}

export function PropertiesSearchSkeleton() {
  return (
    <div className="space-y-5">
      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <Bone className="h-5 w-36" />
          <Bone className="h-9 w-28 rounded-full" />
        </div>
        <Bone className="mt-3 h-20 w-full rounded-xl" />
      </Card>
      <Card className="p-4">
        <FieldGrid count={4} cols="grid-cols-2 xl:grid-cols-4" />
        <div className="mt-4 flex gap-2">
          <Bone className="h-10 w-28 rounded-full" />
          <Bone className="h-10 w-24 rounded-full" />
        </div>
      </Card>
      <Bone className="h-4 w-40" />
      <TableSkeleton rows={8} cols={7} />
    </div>
  );
}

export function PropertiesSkeleton({
  tab = "search",
}: {
  tab?: "search" | "add" | "mine";
}) {
  return (
    <Shell>
      <TitleSkeleton />
      <TabsSkeleton count={3} />
      <div className="mt-5 sm:mt-8">
        {tab === "add" ? <FormSkeleton fields={12} /> : null}
        {tab === "mine" ? (
          <div className="space-y-4">
            <Bone className="h-4 w-56" />
            <TableSkeleton rows={8} cols={7} />
          </div>
        ) : null}
        {tab === "search" ? <PropertiesSearchSkeleton /> : null}
      </div>
    </Shell>
  );
}

export function ActivitySkeleton() {
  return (
    <Shell>
      <TitleSkeleton />
      <Bone className="mt-2 h-4 w-72 max-w-full" />
      <Card className="mt-5 flex flex-col gap-3 p-4 sm:mt-6 sm:flex-row sm:items-end">
        <Bone className="h-10 w-full rounded-xl sm:w-44" />
        <Bone className="h-10 w-full rounded-xl sm:flex-1" />
        <Bone className="h-10 w-24 rounded-full" />
      </Card>
      <div className="tab-scroll -mx-4 mt-4 px-4 sm:mx-0 sm:px-0">
        {Array.from({ length: 6 }).map((_, i) => (
          <Bone key={i} className="h-8 w-24 rounded-full" />
        ))}
      </div>
      <div className="mt-4">
        <TableSkeleton rows={10} cols={7} />
      </div>
    </Shell>
  );
}

export function SocialQueueSkeleton() {
  return (
    <Shell>
      <TitleSkeleton />
      <Bone className="mt-2 h-4 w-80 max-w-full" />
      <TabsSkeleton count={2} />
      <div className="mt-5 sm:mt-6">
        <ListSkeleton rows={7} />
      </div>
    </Shell>
  );
}

export function UserManagementSkeleton() {
  return (
    <Shell>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <TitleSkeleton />
            <Bone className="mt-2 h-4 w-72 max-w-full" />
          </div>
          <Bone className="h-10 w-36 rounded-full" />
        </div>
        <Bone className="h-11 w-60 rounded-full" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Bone key={i} className="h-[4.75rem] rounded-2xl" />
          ))}
        </div>
        <TableSkeleton rows={6} cols={6} />
      </div>
    </Shell>
  );
}

export function AccountSkeleton() {
  return (
    <Shell>
      <div className="space-y-6">
        <div>
          <TitleSkeleton />
          <Bone className="mt-2 h-4 w-52" />
        </div>
        <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)] xl:grid-cols-[22rem_minmax(0,1fr)]">
          <Card className="overflow-hidden">
            <Bone className="h-24 rounded-none" />
            <div className="space-y-4 p-5">
              <Bone className="-mt-14 h-20 w-20 rounded-full" />
              <Bone className="h-6 w-40" />
              <FieldGrid count={3} cols="grid-cols-1" />
              <Bone className="h-10 w-full rounded-full" />
            </div>
          </Card>
          <Card className="space-y-4 p-5">
            <Bone className="h-10 w-56" />
            <FieldGrid count={3} cols="grid-cols-1" />
            <Bone className="h-10 w-40 rounded-full" />
          </Card>
        </div>
      </div>
    </Shell>
  );
}

export function GenericPageSkeleton() {
  return (
    <Shell>
      <TitleSkeleton />
      <div className="mt-6 space-y-4">
        <Card className="p-4 sm:p-6">
          <FieldGrid count={3} cols="grid-cols-1 sm:grid-cols-3" />
        </Card>
        <ListSkeleton rows={6} />
      </div>
    </Shell>
  );
}

export function PublicSearchSkeleton({ title = true }: { title?: boolean }) {
  return (
    <Shell>
      {title ? <TitleSkeleton /> : null}
      <Card className="mt-5 grid grid-cols-2 gap-3 p-4 sm:mt-6 md:grid-cols-4">
        <Bone className="col-span-2 h-10 rounded-xl md:col-span-1" />
        <Bone className="h-10 rounded-xl" />
        <Bone className="h-10 rounded-xl" />
        <Bone className="col-span-2 h-10 rounded-xl md:col-span-1" />
      </Card>
      <Bone className="mt-4 h-4 w-24" />
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="space-y-2 p-4">
            <Bone className="h-4 w-24" />
            <Bone className="h-3 w-40" />
            <Bone className="mt-3 h-4 w-28" />
          </Card>
        ))}
      </div>
    </Shell>
  );
}

export function PublicPropertySkeleton() {
  return (
    <Shell>
      <Bone className="h-4 w-16" />
      <Bone className="mt-4 h-9 w-48" />
      <Bone className="mt-2 h-4 w-64 max-w-full" />
      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Bone key={i} className="aspect-[4/3] w-full rounded-xl" />
        ))}
      </div>
      <Card className="mt-6 grid grid-cols-2 gap-4 p-4 sm:mt-8 sm:p-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Bone className="h-3 w-16" />
            <Bone className="h-4 w-28" />
          </div>
        ))}
      </Card>
    </Shell>
  );
}
