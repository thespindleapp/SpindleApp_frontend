import { garmentPaths } from '../lib/garment';

export function GarmentMark({ name }: { name: string }) {
  const [outer, inner] = garmentPaths(name);
  return (
    <svg className="garment-mark" viewBox="0 0 100 120" aria-hidden="true">
      <path d={outer} />
      <path d={inner} />
    </svg>
  );
}
