import { useState } from 'react';

/**
 * Optional artwork from public/art/<name>.png. Renders nothing until the file
 * exists, so designers can drop images in without code changes.
 * See docs/ART_PROMPTS.md for the list of names, sizes and prompts.
 */
export function Art({ name, alt = '', className, style, width, height }: { name: string; alt?: string; className?: string; style?: React.CSSProperties; width?: number; height?: number }) {
  const [missing, setMissing] = useState(false);
  if (missing) return null;
  const src = `${import.meta.env.BASE_URL}art/${name}.png`;
  return <img src={src} alt={alt} className={`art${className ? ` ${className}` : ''}`} style={style} width={width} height={height} draggable={false} loading="lazy" onError={() => setMissing(true)} />;
}
