import { useCallback, useEffect, useState } from "react";
import type { GlobeEdge } from "../types";

interface EdgeTooltipProps {
  edge: GlobeEdge | null;
  pinned: boolean;
  focusWorkId: number | null;
  onUnpin: () => void;
}

export function EdgeTooltip({ edge, pinned, focusWorkId, onUnpin }: EdgeTooltipProps) {
  const [workIndex, setWorkIndex] = useState(0);

  useEffect(() => {
    if (!edge) {
      setWorkIndex(0);
      return;
    }
    if (focusWorkId != null) {
      const idx = edge.works.findIndex((w) => w.workId === focusWorkId);
      setWorkIndex(idx >= 0 ? idx : 0);
    } else {
      setWorkIndex(0);
    }
  }, [edge?.source, edge?.target, focusWorkId, edge]);

  const goPrev = useCallback(() => {
    if (!edge) return;
    setWorkIndex((i) => (i - 1 + edge.works.length) % edge.works.length);
  }, [edge]);

  const goNext = useCallback(() => {
    if (!edge) return;
    setWorkIndex((i) => (i + 1) % edge.works.length);
  }, [edge]);

  useEffect(() => {
    if (!edge) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "Escape" && pinned) onUnpin();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [edge, goPrev, goNext, pinned, onUnpin]);

  const work = edge?.works[workIndex] ?? edge?.works[0];

  return (
    <aside
      className={`panel edge-tooltip${edge && work ? " edge-tooltip--active" : ""}${pinned ? " edge-tooltip--pinned" : ""}`}
      role="region"
      aria-label="Collaboration artwork details"
    >
      <div className="edge-tooltip-header">
        <h2>Artwork Details{pinned ? " (pinned)" : ""}</h2>
        {pinned && (
          <button type="button" className="unpin-btn" onClick={onUnpin}>
            Unpin
          </button>
        )}
      </div>
      {edge && work ? (
        <>
          <p className="edge-countries">
            {edge.sourceName} ↔ {edge.targetName}
          </p>
          <p className="edge-weight">
            {edge.weight} shared work{edge.weight !== 1 ? "s" : ""}
          </p>
          <hr />
          <dl>
            <div>
              <dt>Work ID</dt>
              <dd>{work.workId}</dd>
            </div>
            <div>
              <dt>Title</dt>
              <dd>{work.title || "Untitled"}</dd>
            </div>
            <div>
              <dt>Published</dt>
              <dd>{work.date || work.year || "Unknown"}</dd>
            </div>
            <div>
              <dt>Artists</dt>
              <dd>{work.artists || "Unknown"}</dd>
            </div>
          </dl>
          {work.thumbnail ? (
            <img
              src={work.thumbnail}
              alt={`Thumbnail for ${work.title}`}
              className="work-thumbnail"
              loading="lazy"
            />
          ) : (
            <div className="work-thumbnail placeholder" aria-hidden="true">
              No image available
            </div>
          )}
          {edge.works.length > 1 && (
            <div className="work-carousel">
              <button type="button" onClick={goPrev} aria-label="Previous work">
                ‹
              </button>
              <span>
                {workIndex + 1} / {edge.works.length}
              </span>
              <button type="button" onClick={goNext} aria-label="Next work">
                ›
              </button>
            </div>
          )}
        </>
      ) : (
        <p className="panel-hint">
          Click a collaboration arc to pin artwork details, or search below.
        </p>
      )}
    </aside>
  );
}
