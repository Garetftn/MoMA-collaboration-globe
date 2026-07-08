interface WeightFilterProps {
  value: number;
  max: number;
  onChange: (value: number) => void;
}

export function WeightFilter({ value, max, onChange }: WeightFilterProps) {
  return (
    <div className="panel weight-filter">
      <label htmlFor="weight-filter">
        Minimum collaborations: <strong>{value}</strong>
      </label>
      <input
        id="weight-filter"
        type="range"
        min={1}
        max={Math.max(max, 2)}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuemin={1}
        aria-valuemax={max}
        aria-valuenow={value}
      />
    </div>
  );
}
