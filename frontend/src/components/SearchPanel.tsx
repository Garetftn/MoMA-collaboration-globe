import { useMemo, useState } from "react";
import type { AuthorSearchResult, GlobeData } from "../types";
import { buildAuthorMap, debounce, searchAuthors } from "../utils";

interface SearchPanelProps {
  data: GlobeData;
  onSelect: (result: AuthorSearchResult) => void;
  activeAuthorId: string | null;
}

export function SearchPanel({ data, onSelect, activeAuthorId }: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const authorMap = useMemo(() => buildAuthorMap(data.authors), [data.authors]);

  const debouncedSet = useMemo(
    () => debounce((value: string) => setDebouncedQuery(value), 200),
    [],
  );

  const results = useMemo(
    () => searchAuthors(debouncedQuery, data.searchIndex ?? [], authorMap),
    [debouncedQuery, data.searchIndex, authorMap],
  );

  return (
    <div className="panel search-panel">
      <h2>Search</h2>
      <label htmlFor="author-search" className="sr-only">
        Search by author name
      </label>
      <input
        id="author-search"
        type="search"
        placeholder="Author name…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          debouncedSet(e.target.value);
        }}
        autoComplete="off"
      />
      {debouncedQuery && (
        <div className="search-results" role="listbox" aria-label="Matching authors">
          {results.length === 0 ? (
            <p className="panel-hint">No authors found.</p>
          ) : (
            results.slice(0, 20).map((result) => (
              <button
                key={result.authorId}
                type="button"
                role="option"
                aria-selected={activeAuthorId === result.authorId}
                className={`search-result${activeAuthorId === result.authorId ? " search-result--active" : ""}`}
                onClick={() => onSelect(result)}
              >
                <span className="search-result-label">{result.label}</span>
                <span className="search-result-hint">{result.author.bio}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
