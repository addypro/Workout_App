import { UnitSystem } from '../types/models';

export function roundToIncrement(value: number, increment: number): number {
  if (increment <= 0) return value;
  return Math.round(value / increment) * increment;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function lbToKg(lb: number): number {
  return lb * 0.45359237;
}

export function kgToLb(kg: number): number {
  return kg / 0.45359237;
}

export function convertWeight(value: number, from: UnitSystem, to: UnitSystem): number {
  if (from === to) return value;
  return from === 'lb' ? lbToKg(value) : kgToLb(value);
}
