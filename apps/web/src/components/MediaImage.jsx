import React from 'react';
import { cn } from '@/lib/utils';

function MediaImage({
  src,
  webp,
  srcSet,
  alt,
  width,
  height,
  priority = false,
  sizes,
  className,
}) {
  const img = (
    <img
      src={src}
      alt={alt}
      width={width || undefined}
      height={height || undefined}
      sizes={sizes}
      srcSet={!webp ? srcSet || undefined : undefined}
      fetchPriority={priority ? 'high' : 'low'}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      className={cn('bg-card', className)}
    />
  );

  if (!webp) return img;

  return (
    <picture className="contents">
      <source type="image/webp" srcSet={srcSet || webp} sizes={sizes} />
      {img}
    </picture>
  );
}

export default MediaImage;

export { MediaImage };
