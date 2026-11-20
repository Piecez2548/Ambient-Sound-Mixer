import type { CSSProperties } from 'react';

interface Props {
  value: number;
  onChange: (value: number) => void;
  label: string;
  min?: number;
  max?: number;
}

export function Slider({ value, onChange, label, min = 0, max = 100 }: Props) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <input
      type="range"
      className="slider"
      min={min}
      max={max}
      value={value}
      aria-label={label}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ '--fill': `${fill}%` } as CSSProperties}
    />
  );
}
