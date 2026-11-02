const widths = ["82%", "68%", "91%", "74%", "86%"];

function Shape({ width = "100%", height = 14, className = "" }) {
  return <span aria-hidden="true" className={`skeleton-shape ${className}`} style={{ width, height }} />;
}

export function SkeletonTable({ rows = 5, columns = 4 }) {
  return (
    <div className="skeleton-table" aria-hidden="true">
      <div className="skeleton-table-row skeleton-table-head" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {Array.from({ length: columns }, (_, i) => <Shape key={i} width={`${55 + (i * 13) % 35}%`} height={12} />)}
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div className="skeleton-table-row" key={row} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }, (_, column) => <Shape key={column} width={widths[(row + column) % widths.length]} />)}
        </div>
      ))}
    </div>
  );
}

function Header({ action = false }) {
  return (
    <div className="skeleton-header">
      <div className="skeleton-heading">
        <Shape width="min(260px, 70vw)" height={32} />
        <Shape width="min(360px, 82vw)" height={14} />
      </div>
      {action && <Shape className="skeleton-action" width={132} height={36} />}
    </div>
  );
}

function Stats({ count = 4 }) {
  return (
    <div className="skeleton-stats" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i}><Shape width="44%" height={24} /><Shape width="64%" height={12} /></div>
      ))}
    </div>
  );
}

function SectionTitle() {
  return <div className="skeleton-section-title"><Shape width={112} height={18} /></div>;
}

export default function PageSkeleton({ variant = "dashboard" }) {
  return (
    <section className={`page-skeleton skeleton-${variant}`} role="status" aria-label="Loading page">
      <span className="sr-only">Loading page...</span>
      {variant === "auth" ? (
        <div className="panel skeleton-auth">
          <Shape width={150} height={22} />
          <Shape width="80%" height={14} />
          <Shape height={36} />
          <Shape height={36} />
          <Shape width="45%" height={36} />
        </div>
      ) : (
        <>
          {variant === "cohort" || variant === "course" ? <Shape className="skeleton-crumb" width={150} height={13} /> : null}
          <Header action={["dashboard", "table", "cohort"].includes(variant)} />
          {["dashboard", "course", "cohort"].includes(variant) && <Stats count={variant === "course" ? 5 : 4} />}
          {variant === "cohort" && <div className="skeleton-chart panel"><Shape width="100%" height={80} /></div>}
          {variant === "course" && <div className="skeleton-tabs"><Shape width={52} height={16} /><Shape width={64} height={16} /><Shape width={46} height={16} /></div>}
          {variant === "project" && (
            <>
              <div className="skeleton-properties">
                {Array.from({ length: 4 }, (_, i) => <div key={i}><Shape width="70%" height={12} /><Shape width="85%" height={14} /></div>)}
              </div>
              <div className="skeleton-tabs"><Shape width={68} height={16} /><Shape width={58} height={16} /><Shape width={74} height={16} /><Shape width={48} height={16} /></div>
            </>
          )}
          {variant === "form" ? (
            <div className="panel skeleton-form">
              <Shape width="35%" height={14} />
              <Shape height={36} />
              <Shape width="35%" height={14} />
              <Shape height={36} />
              <Shape width={132} height={36} />
            </div>
          ) : variant === "feed" ? (
            <div className="panel skeleton-feed">
              {Array.from({ length: 5 }, (_, i) => <div key={i}><Shape width={widths[i]} height={16} /><Shape width="28%" height={12} /></div>)}
            </div>
          ) : variant === "dashboard" ? (
            <>
              <SectionTitle />
              <SkeletonTable rows={5} columns={5} />
              <SectionTitle />
              <div className="panel skeleton-feed">{Array.from({ length: 3 }, (_, i) => <div key={i}><Shape width="65%" /><Shape width={84} height={30} /></div>)}</div>
            </>
          ) : (
            <>
              {variant !== "project" && <SectionTitle />}
              <SkeletonTable rows={variant === "course" ? 4 : 5} columns={variant === "project" ? 4 : 5} />
            </>
          )}
        </>
      )}
    </section>
  );
}
