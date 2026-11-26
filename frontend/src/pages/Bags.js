import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Package } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { api, apiError } from '@/lib/api';
import { fmtG } from '@/lib/format';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/PageHeader';
import { PhotoThumb } from '@/components/common/PhotoThumb';
import { StatusBadge } from '@/components/common/StatusBadge';
import { EmptyState } from '@/components/common/EmptyState';
import { CardGridSkeleton } from '@/components/common/Loading';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function Bags() {
  const { t, L, metal, workspace } = useApp();
  const navigate = useNavigate();
  const [bags, setBags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [purity, setPurity] = useState('all');
  const [purities, setPurities] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { workspace, metal };
      if (search) params.search = search;
      if (status !== 'all') params.status = status;
      if (purity !== 'all') params.purity = purity;
      const { data } = await api.get('/bags', { params });
      setBags(data || []);
    } catch (e) { toast.error(apiError(e)); } finally { setLoading(false); }
  }, [workspace, metal, search, status, purity]);

  const loadPurities = useCallback(async () => {
    try { const { data } = await api.get('/bags/purities', { params: { workspace, metal } }); setPurities(data || []); }
    catch { /* ignore */ }
  }, [workspace, metal]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadPurities(); }, [loadPurities]);

  return (
    <div className="space-y-6" data-testid="bags-page">
      <PageHeader title={t('bags')} subtitle={`${t(metal)} · ${t(workspace)}`}
        actions={<Button onClick={() => navigate('/bags/new')} className="h-11" data-testid="new-bag-btn"><Plus className="mr-2 h-4 w-4" />{t('new_bag')}</Button>} />

      <Card className="flex flex-wrap items-center gap-3 p-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`${t('search')}...`} className="pl-9" data-testid="bags-search" />
        </div>
        <Select value={purity} onValueChange={setPurity}>
          <SelectTrigger className="w-[140px]" data-testid="filter-purity"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('all')} {L('शुद्धता', 'Purity')}</SelectItem>
            {purities.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[150px]" data-testid="filter-status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('all')}</SelectItem>
            <SelectItem value="open">{t('open')}</SelectItem>
            <SelectItem value="delivered">{t('deliveries')}</SelectItem>
          </SelectContent>
        </Select>
      </Card>

      {loading ? <CardGridSkeleton /> : bags.length === 0 ? (
        <EmptyState icon={Package} title={L('अभी कोई बैग नहीं', 'No bags yet')} subtitle={L('सामग्री जारी करने के लिए नया बैग खोलें।', 'Open a new bag to issue material.')}
          action={<Button onClick={() => navigate('/bags/new')} data-testid="empty-new-bag"><Plus className="mr-2 h-4 w-4" />{t('new_bag')}</Button>} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {bags.map((b) => (
            <Card key={b.id} className="overflow-hidden p-0" data-testid="photo-led-card">
              <div className="relative">
                <PhotoThumb id={b.photos?.[0]} />
                <div className="absolute left-2 top-2"><StatusBadge status={b.status} /></div>
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="leading-tight"><p className="text-base font-semibold">{b.design_name}</p><p className="text-xs text-muted-foreground">{b.bag_no} · {b.purity}</p></div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-muted px-2 py-2 text-center"><p className="text-[11px] text-muted-foreground">{L('जारी', 'Issued')}</p><p className="font-num text-sm font-semibold">{fmtG(b.summary?.issued_metal_g)}</p></div>
                  <div className="rounded-lg bg-muted px-2 py-2 text-center"><p className="text-[11px] text-muted-foreground">{L('नुकसान', 'Loss')}</p><p className="font-num text-sm font-semibold text-[hsl(var(--warning))]">{fmtG(b.summary?.outstanding_loss_g)}</p></div>
                </div>
                <Button onClick={() => navigate(`/bags/${b.id}`)} className="mt-3 h-11 w-full" data-testid="photo-led-card-open-button">{t('open_bag')}</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
