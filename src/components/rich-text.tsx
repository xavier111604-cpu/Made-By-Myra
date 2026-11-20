// Minimal, safe formatter for owner-written text (no HTML is ever injected).
//   "## Heading"  → heading
//   "- item"      → bullet
//   blank line    → new paragraph
export function RichText({ text, className }: { text: string; className?: string }) {
  const blocks = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return (
    <div className={className}>
      {blocks.map((block, i) => {
        const lines = block.split("\n").filter((l) => l.trim());
        if (!lines.length) return null;
        if (lines.length === 1 && lines[0].startsWith("## ")) {
          return <h2 key={i} className="mb-2 mt-8 text-xl font-semibold first:mt-0">{lines[0].slice(3)}</h2>;
        }
        if (lines[0].startsWith("## ")) {
          return (
            <div key={i}>
              <h2 className="mb-2 mt-8 text-xl font-semibold">{lines[0].slice(3)}</h2>
              <Para lines={lines.slice(1)} />
            </div>
          );
        }
        return <Para key={i} lines={lines} />;
      })}
    </div>
  );
}

function Para({ lines }: { lines: string[] }) {
  if (lines.every((l) => l.trim().startsWith("- "))) {
    return (
      <ul className="mb-4 list-disc space-y-1 pl-5">
        {lines.map((l, i) => (
          <li key={i}>{l.trim().slice(2)}</li>
        ))}
      </ul>
    );
  }
  return <p className="mb-4 whitespace-pre-line">{lines.join("\n")}</p>;
}
