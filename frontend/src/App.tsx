import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { AuthorPanel } from "./components/AuthorPanel";
import { CountryPanel } from "./components/CountryPanel";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { SearchPanel } from "./components/SearchPanel";
import { WeightFilter } from "./components/WeightFilter";
import { useGlobeData } from "./hooks/useGlobeData";
import type { Author, AuthorSearchResult, GlobeNode } from "./types";
import { buildAuthorMap, buildNodeMap, hydrateAuthorWorks } from "./utils";
import "./App.css";

const GlobeView = lazy(() =>
  import("./components/GlobeView").then((module) => ({ default: module.GlobeView })),
);

function AppInner() {
  const { data, error } = useGlobeData();
  const [hoveredCountry, setHoveredCountry] = useState<GlobeNode | null>(null);
  const [selectedCountryIso, setSelectedCountryIso] = useState<string | null>(null);
  const [selectedAuthorId, setSelectedAuthorId] = useState<string | null>(null);
  const [selectedAuthor, setSelectedAuthor] = useState<Author | null>(null);
  const [minWeight, setMinWeight] = useState(2);

  useEffect(() => {
    if (data?.meta.defaultMinWeight) {
      setMinWeight(data.meta.defaultMinWeight);
    }
  }, [data]);

  const nodeMap = useMemo(
    () => (data ? buildNodeMap(data.nodes) : new Map<string, GlobeNode>()),
    [data],
  );

  const authorMap = useMemo(
    () => (data ? buildAuthorMap(data.authors) : new Map()),
    [data],
  );

  const maxEdgeWeight = useMemo(
    () => (data ? Math.max(...data.edges.map((e) => e.weight), 1) : 10),
    [data],
  );

  const displayCountry = useMemo(() => {
    if (selectedAuthorId) {
      const author = authorMap.get(selectedAuthorId);
      if (author) return nodeMap.get(author.country) ?? null;
    }
    if (selectedCountryIso) return nodeMap.get(selectedCountryIso) ?? null;
    return hoveredCountry;
  }, [selectedAuthorId, selectedCountryIso, hoveredCountry, nodeMap, authorMap]);

  const selectedAuthorBase = selectedAuthorId ? authorMap.get(selectedAuthorId) ?? null : null;

  useEffect(() => {
    if (!selectedAuthorBase) {
      setSelectedAuthor(null);
      return;
    }

    let cancelled = false;
    hydrateAuthorWorks(selectedAuthorBase).then((author) => {
      if (!cancelled) setSelectedAuthor(author);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedAuthorBase]);

  const handleCountrySelect = useCallback((iso: string | null) => {
    setSelectedCountryIso((current) => (current === iso ? null : iso));
    if (iso) {
      setHoveredCountry(nodeMap.get(iso) ?? null);
    }
  }, [nodeMap]);

  const handleAuthorSelect = useCallback((authorId: string | null) => {
    setSelectedAuthorId(authorId);
    if (authorId) {
      setSelectedCountryIso(null);
    }
  }, []);

  const handleSearchSelect = useCallback((result: AuthorSearchResult) => {
    handleAuthorSelect(result.authorId);
  }, [handleAuthorSelect]);

  const handleUnpin = useCallback(() => {
    setSelectedAuthorId(null);
    setSelectedAuthor(null);
  }, []);

  if (error) {
    return (
      <main className="app error">
        <p>Failed to load visualization data: {error}</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="app loading">
        <p>Loading MoMA collaboration globe…</p>
      </main>
    );
  }

  return (
    <main className="app">
      <header className="app-header">
        <h1>Global MoMA Collaboration Globe</h1>
        <p>
          {data.meta.authorCount.toLocaleString()} collaborating authors across{" "}
          {data.meta.crossCountryWorks.toLocaleString()} multi-artist works
        </p>
      </header>

      <div className="globe-container">
        <ErrorBoundary>
          <Suspense fallback={<p className="globe-loading">Initializing globe…</p>}>
            <GlobeView
              data={data}
              minWeight={minWeight}
              selectedAuthorId={selectedAuthorId}
              onCountryHover={setHoveredCountry}
              onCountrySelect={handleCountrySelect}
              onAuthorSelect={handleAuthorSelect}
            />
          </Suspense>
        </ErrorBoundary>
      </div>

      <CountryPanel
        country={displayCountry}
        nodeMap={nodeMap}
        selected={!!selectedCountryIso}
      />
      <AuthorPanel
        author={selectedAuthor}
        pinned={!!selectedAuthorId}
        onUnpin={handleUnpin}
      />
      <SearchPanel
        data={data}
        onSelect={handleSearchSelect}
        activeAuthorId={selectedAuthorId}
      />
      {!selectedAuthorId && (
        <WeightFilter
          value={minWeight}
          max={maxEdgeWeight}
          onChange={setMinWeight}
        />
      )}
    </main>
  );
}

const App = memo(AppInner);
export default App;
