import React, { useRef, useState } from 'react';
import { Camera, Loader2, X } from 'lucide-react';
import { api, apiError, fileUrl } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

// Uploads photos to managed storage and returns their ids via onChange.
export const PhotoUploader = ({ value = [], onChange, testId = 'photo-uploader' }) => {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      const ids = [];
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append('file', file);
        const { data } = await api.post('/files/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
        ids.push(data.id);
      }
      onChange([...(value || []), ...ids]);
      toast.success('फोटो जुड़ गई / Photo added');
    } catch (e) {
      toast.error(apiError(e, 'Photo upload failed'));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const removeAt = (idx) => onChange(value.filter((_, i) => i !== idx));

  return (
    <div data-testid={testId}>
      <div className="flex flex-wrap gap-3">
        {(value || []).map((id, idx) => (
          <div key={id} className="relative h-24 w-24 overflow-hidden rounded-lg border border-border">
            <img src={fileUrl(id)} alt="upload" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => removeAt(idx)}
              className="absolute right-1 top-1 rounded-full bg-background/80 p-1 text-destructive hover:bg-background"
              data-testid={`${testId}-remove-${idx}`}
              aria-label="Remove photo"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border bg-accent/50 text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
          data-testid={`${testId}-add`}
        >
          {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <Camera className="h-6 w-6" />}
          <span className="text-xs">{busy ? '...' : 'फोटो / Photo'}</span>
        </button>
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
    </div>
  );
};
