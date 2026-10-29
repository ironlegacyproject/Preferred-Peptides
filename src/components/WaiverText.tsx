import { WAIVER_INTRO, WAIVER_SECTIONS, WAIVER_TITLE, WAIVER_VERSION } from "@/lib/waiver";

export function WaiverText({ showTitle = true }: { showTitle?: boolean }) {
  return (
    <div className="text-sm leading-relaxed">
      {showTitle && <h2 className="display text-xl">{WAIVER_TITLE}</h2>}
      <p className={showTitle ? "mt-3" : ""}>{WAIVER_INTRO}</p>
      <ol className="mt-4 grid list-none gap-3 p-0">
        {WAIVER_SECTIONS.map((s, i) => (
          <li key={s.heading}>
            <h3 className="font-semibold">
              {i + 1}. {s.heading}
            </h3>
            <p className="mt-0.5 text-muted">{s.body}</p>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-xs text-muted">Version {WAIVER_VERSION}</p>
    </div>
  );
}
