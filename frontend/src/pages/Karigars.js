import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Users, Trash2, Loader2 } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { api, apiError } from '@/lib/api';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function Karigars() {
  const { t, workspace } = useApp();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const { data } = await api.get('/karigars', { params: { workspace } }); setList(data || []); }
    catch (e) { toast.error(apiError(e)); } finally { setLoading(false); }
  }, [workspace]);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try { await api.post('/karigars', { name: name.trim() }, { params: { workspace } }); setName(''); await load(); toast.success('जुड़ गया / Added'); }
    catch (e) { toast.error(apiError(e)); } finally { setBusy(false); }
  };

  const remove = async (id) => {
    try { await api.delete(`/karigars/${id}`); setList((p) => p.filter((k) => k.id !== id)); }
    catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div className="space-y-6" data-testid="karigars-page">
      <PageHeader titleHi={t('karigars')} titleEn="Karigars" subtitle={t(workspace)} />
      <Card className="flex flex-wrap items-end gap-3 p-4">
        <div className="flex-1 min-w-[220px]">
          <p className="mb-1 text-sm font-medium">नया कारीगर / New Karigar</p>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="नाम / Name" className="h-11" data-testid="karigar-name" />
        </div>
        <Button onClick={add} className="h-11" disabled={busy} data-testid="karigar-add">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}{t('add')}</Button>
      </Card>

      {loading ? null : list.length === 0 ? (
        <EmptyState icon={Users} title="कोई कारीगर नहीं" subtitle="Add karigars to assign them as packet handlers." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="karigars-list">
          {list.map((k) => (
            <Card key={k.id} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-primary font-semibold">{(k.name || '?').charAt(0)}</span>
                <p className="font-medium">{k.name}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => remove(k.id)} data-testid={`karigar-remove-${k.id}`}><Trash2 className="h-4 w-4" /></Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
