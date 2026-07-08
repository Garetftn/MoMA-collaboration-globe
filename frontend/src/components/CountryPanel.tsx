import type { CollaboratorRank, GlobeNode } from "../types";
import { collaboratorName } from "../utils";

interface CountryPanelProps {
  country: GlobeNode | null;
  nodeMap: Map<string, GlobeNode>;
  selected?: boolean;
}

function normalizeCollaborators(
  items: CollaboratorRank[] | string[],
  nodeMap: Map<string, GlobeNode>,
): CollaboratorRank[] {
  return items.map((item) => {
    if (typeof item === "string") {
      return { iso: item, name: collaboratorName(item, nodeMap), count: 0 };
    }
    return item;
  });
}

export function CountryPanel({ country, nodeMap, selected }: CountryPanelProps) {
  const topPartners = country
    ? normalizeCollaborators(country.topCollaborators, nodeMap)
    : [];

  return (
    <aside
      className={`panel country-panel${selected ? " country-panel--selected" : ""}`}
      aria-live="polite"
      aria-label="Country information"
    >
      <h2>Country Overview{selected ? " (selected)" : ""}</h2>
      {country ? (
        <>
          <p className="panel-title">{country.country}</p>
          <dl>
            <div>
              <dt>Authors</dt>
              <dd>{country.artistCount.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Collaboration artworks</dt>
              <dd>{(country.artworkCount ?? 0).toLocaleString()}</dd>
            </div>
            <div>
              <dt>Total collaborations</dt>
              <dd>{country.totalCollaborations.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Top collaboration targets</dt>
              <dd>
                {topPartners.length > 0 ? (
                  <ol className="collab-list">
                    {topPartners.map((partner) => (
                      <li key={partner.iso}>
                        <span className="collab-name">{partner.name}</span>
                        <span className="collab-count">
                          {partner.count.toLocaleString()} collaboration
                          {partner.count !== 1 ? "s" : ""}
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  "None recorded"
                )}
              </dd>
            </div>
          </dl>
        </>
      ) : (
        <p className="panel-hint">Click a country to select it, or hover to preview details.</p>
      )}
    </aside>
  );
}
