import React from 'react';
import { Camera } from 'lucide-react';
import { fileUrl } from '@/lib/api';
import { AspectRatio } from '@/components/ui/aspect-ratio';

export const PhotoThumb = ({ id, alt = 'photo', ratio = 4 / 3, className = '', testId }) => {
  const url = id ? fileUrl(id) : null;
  return (
    <AspectRatio ratio={ratio} className={`overflow-hidden rounded-lg bg-accent ${className}`}>
      {url ? (
        <img src={url} alt={alt} className="h-full w-full object-cover" data-testid={testId} loading="lazy" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 border border-dashed border-border bg-accent/60 text-muted-foreground" data-testid={testId}>
          <Camera className="h-6 w-6" />
          <span className="text-xs">कोई फोटो नहीं / No photo</span>
        </div>
      )}
    </AspectRatio>
  );
};
