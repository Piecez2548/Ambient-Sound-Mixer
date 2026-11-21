import type { CSSProperties } from 'react';

interface Props {
  value: number;
  onChange: (value: number) => void;
  label: string;
  min?: number;
  max?: number;
  /** 0–1: current live level as a share of `value` (natural variation); shown as a brighter part of the fill. */
  live?: number;
}

export function Slider({ value, onChange, label, min = 0, max = 100, live }: Props) {
  const fill = ((value - min) / (max - min)) * 100;
  const style = { '--fill': `${fill}%` } as Record<string, string>;
  if (live !== undefined && live < 1) style['--live'] = `${fill * live}%`;
  return (
    <input
      type="range"
      className="slider"
      min={min}
      max={max}
      value={value}
      aria-label={label}
      onChange={(e) => onChange(Number(e.target.value))}
      style={style as CSSProperties}
    />
  );
}
