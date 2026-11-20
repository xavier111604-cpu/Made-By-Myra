import { ScriptHeading } from "./decor";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="container-page grid min-h-[70vh] place-items-center py-12">
      <div className="card w-full max-w-md p-8">
        <ScriptHeading as="h1" className="text-5xl">{title}</ScriptHeading>
        {subtitle && <p className="mb-6 mt-2 text-sm text-charcoal/70">{subtitle}</p>}
        <div className={subtitle ? "" : "mt-6"}>{children}</div>
      </div>
    </div>
  );
}
