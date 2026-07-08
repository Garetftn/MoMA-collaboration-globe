import { useEffect, useState } from "react";
import type { GlobeData } from "../types";
import { loadGlobeData } from "../utils";

export function useGlobeData() {
  const [data, setData] = useState<GlobeData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadGlobeData()
      .then((core) => {
        if (!cancelled) setData(core);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load data");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { data, error };
}
