interface ColorLegendProps {
  min: number;
  max: number;
}

export function ColorLegend({ min, max }: ColorLegendProps) {
  return (
    <div className="panel color-legend" aria-label="Artwork count color scale">
      <span className="legend-label">Collaboration artworks per country</span>
      <div className="legend-bar" />
      <div className="legend-range">
        <span>{min.toLocaleString()}</span>
        <span>{max.toLocaleString()}</span>
      </div>
    </div>
  );
}
