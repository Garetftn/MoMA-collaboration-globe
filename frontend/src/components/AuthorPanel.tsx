import { useCallback, useEffect, useState } from "react";
import type { Author } from "../types";

interface AuthorPanelProps {
  author: Author | null;
  pinned: boolean;
  onUnpin: () => void;
}

function formatWorkCount(author: Author): string {
  const total = author.workCount ?? author.works.length;
  if (total > author.works.length) {
    return `${author.works.length}+`;
  }
  if (author.workCount == null && author.works.length === 40) {
    return "40+";
  }
  return String(author.works.length);
}

export function AuthorPanel({ author, pinned, onUnpin }: AuthorPanelProps) {
  const [workIndex, setWorkIndex] = useState(0);

  useEffect(() => {
    setWorkIndex(0);
  }, [author?.id]);

  const goPrev = useCallback(() => {
    if (!author?.works.length) return;
    setWorkIndex((i) => (i - 1 + author.works.length) % author.works.length);
  }, [author]);

  const goNext = useCallback(() => {
    if (!author?.works.length) return;
    setWorkIndex((i) => (i + 1) % author.works.length);
  }, [author]);

  useEffect(() => {
    if (!author) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "Escape" && pinned) onUnpin();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [author, goPrev, goNext, pinned, onUnpin]);

  const work = author?.works[workIndex] ?? author?.works[0];

  return (
    <aside
      className={`panel author-panel${author ? " author-panel--active" : ""}${pinned ? " author-panel--pinned" : ""}`}
      role="region"
      aria-label="Author details"
    >
      <div className="author-panel-header">
        <h2>Author Details{pinned ? " (selected)" : ""}</h2>
        {pinned && (
          <button type="button" className="unpin-btn" onClick={onUnpin}>
            Clear
          </button>
        )}
      </div>
      {author ? (
        <>
          <p className="author-name">{author.name}</p>
          <p className="author-bio">{author.bio || "No biography available"}</p>
          <p className="author-country">{author.countryName}</p>
          <hr />
          <div>
            <h3 className="section-label">Top collaborations</h3>
            {author.topCollaborations.length > 0 ? (
              <ol className="collab-list">
                {author.topCollaborations.map((collab) => (
                  <li key={collab.authorId}>
                    <span className="collab-name">
                      {collab.authorName}
                      <span className="collab-country"> · {collab.countryName}</span>
                    </span>
                    <span className="collab-count">
                      {collab.count} work{collab.count !== 1 ? "s" : ""}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="panel-hint">No cross-country collaborations recorded.</p>
            )}
          </div>
          <hr />
          <div>
            <h3 className="section-label">Works ({author ? formatWorkCount(author) : 0})</h3>
            {work ? (
              <>
                <dl className="work-details">
                  <div>
                    <dt>Title</dt>
                    <dd>{work.title || "Untitled"}</dd>
                  </div>
                  <div>
                    <dt>Published</dt>
                    <dd>{work.date || work.year || "Unknown"}</dd>
                  </div>
                  <div>
                    <dt>Work ID</dt>
                    <dd>{work.workId}</dd>
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
                {author.works.length > 1 && (
                  <div className="work-carousel">
                    <button type="button" onClick={goPrev} aria-label="Previous work">
                      ‹
                    </button>
                    <span>
                      {workIndex + 1} / {author.works.length}
                    </span>
                    <button type="button" onClick={goNext} aria-label="Next work">
                      ›
                    </button>
                  </div>
                )}
              </>
            ) : (
              <p className="panel-hint">No works listed.</p>
            )}
          </div>
        </>
      ) : (
        <p className="panel-hint">
          Click an author dot on the map to view their biography, works, and collaboration arcs.
        </p>
      )}
    </aside>
  );
}
