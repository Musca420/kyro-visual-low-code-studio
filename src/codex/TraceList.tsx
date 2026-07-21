export function TraceList({
  items,
  empty,
}: {
  items: { title: string; body: string }[];
  empty: string;
}) {
  return items.length ? (
    <div className="trace-list">
      {items.map((item, index) => (
        <article key={index}>
          <strong>{item.title}</strong>
          <pre>{item.body}</pre>
        </article>
      ))}
    </div>
  ) : (
    <div className="codex-welcome">
      <strong>{empty}</strong>
      <p>
        This section updates automatically after analysis or application.
      </p>
    </div>
  );
}
