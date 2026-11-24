import React, { useCallback, useEffect, useState } from 'react';
import { Truck, Loader2, Plus } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { api, apiError } from '@/lib/api';
import { fmtG, fmtRs, fmtDateTime } from '@/lib/format';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { BilingualLabel } from '@/components/common/BilingualLabel';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';

export default function Deliveries() {
  const { t, metal, workspace } = useApp();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { const { data } = await api.get('/deliveries', { params: { workspace, metal } }); setList(data || []); }
    catch (e) { toast.error(apiError(e)); } finally { setLoading(false); }
  }, [workspace, metal]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6" data-testid="deliveries-page">
      <PageHeader titleHi={t('deliveries')} titleEn="Deliveries" subtitle={`${t(metal)} · ${t(workspace)}`}
        actions={<NewDeliveryDialog onDone={load} />} />

      {loading ? <Loader2 className="mx-auto my-10 h-7 w-7 animate-spin text-primary" /> : list.length === 0 ? (
        <EmptyState icon={Truck} title="कोई डिलीवरी नहीं" subtitle="Deliver finished bags to the showroom to close them out." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((d) => (
            <Card key={d.id} className="p-4" data-testid={`delivery-${d.bag_no}`}>
              <div className="flex items-start justify-between">
                <div className="leading-tight"><p className="font-semibold">{d.bag_no}</p><p className="text-xs text-muted-foreground">{d.design_name}</p></div>
                <Truck className="h-5 w-5 text-[hsl(var(--success))]" />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-center text-sm">
                <div className="rounded-lg bg-muted px-2 py-2"><p className="text-[11px] text-muted-foreground">आइटम / Items</p><p className="font-num font-semibold">{d.items_count}</p></div>
                <div className="rounded-lg bg-muted px-2 py-2"><p className="text-[11px] text-muted-foreground">ग्रॉस</p><p className="font-num font-semibold">{fmtG(d.gross_weight_g)}</p></div>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{d.showroom || '-'}</span>
                <span className="font-num font-semibold">{fmtRs(d.labour_amount)}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{fmtDateTime(d.created_at)}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function NewDeliveryDialog({ onDone }) {
  const { t, metal, workspace } = useApp();
  const [open, setOpen] = useState(false);
  const [bags, setBags] = useState([]);
  const [bagId, setBagId] = useState('');
  const [packets, setPackets] = useState([]);
  const [selected, setSelected] = useState([]);
  const [items, setItems] = useState('');
  const [gross, setGross] = useState('');
  const [showroom, setShowroom] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    api.get('/bags', { params: { workspace, metal, status: 'open' } }).then((r) => setBags(r.data || [])).catch(() => {});
  }, [open, workspace, metal]);

  useEffect(() => {
    if (!bagId) { setPackets([]); setSelected([]); return; }
    api.get('/packets', { params: { workspace, metal, bag_id: bagId, status: 'active' } }).then((r) => setPackets(r.data || [])).catch(() => {});
  }, [bagId, workspace, metal]);

  const toggle = (id) => setSelected((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  useEffect(() => {
    const g = packets.filter((p) => selected.includes(p.id)).reduce((s, p) => s + (p.metal_weight_g || 0) + (p.stone_weight_g || 0), 0);
    if (selected.length) setGross(String(Math.round(g * 1000) / 1000));
  }, [selected]); // eslint-disable-line

  const save = async () => {
    if (!bagId || selected.length === 0) { toast.error('Select a bag and packets'); return; }
    setBusy(true);
    try {
      await api.post('/deliveries', { bag_id: bagId, packet_ids: selected, items_count: Number(items || 0), gross_weight_g: Number(gross || 0), showroom }, { params: { workspace, metal } });
      toast.success('डिलीवरी दर्ज / Delivered'); setOpen(false); setBagId(''); setSelected([]); setItems(''); setGross(''); onDone();
    } catch (e) { toast.error(apiError(e)); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="h-11" data-testid="new-delivery-btn"><Plus className="mr-2 h-4 w-4" />{t('deliver')}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('deliver')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label><BilingualLabel hi="बैग" en="Bag" /></Label>
            <Select value={bagId} onValueChange={setBagId}><SelectTrigger data-testid="delivery-bag"><SelectValue placeholder="Select open bag" /></SelectTrigger>
              <SelectContent>{bags.map((b) => <SelectItem key={b.id} value={b.id}>{b.bag_no} · {b.design_name}</SelectItem>)}</SelectContent></Select></div>
          {bagId ? (
            <div><p className="mb-2 text-sm font-medium">पैकेट / Packets</p>
              {packets.length === 0 ? <p className="text-sm text-muted-foreground">No active packets</p> : (
                <div className="space-y-2">{packets.map((p) => (
                  <label key={p.id} className="flex items-center gap-3 rounded-lg border border-border p-2">
                    <Checkbox checked={selected.includes(p.id)} onCheckedChange={() => toggle(p.id)} data-testid={`delivery-pkt-${p.packet_no}`} />
                    <span className="text-sm">{p.packet_no} · {fmtG(p.metal_weight_g)}</span>
                  </label>
                ))}</div>
              )}
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label><BilingualLabel k="items" /></Label><Input type="number" value={items} onChange={(e) => setItems(e.target.value)} className="h-11" data-testid="delivery-items" /></div>
            <div className="space-y-2"><Label><BilingualLabel k="gross_weight" en="Gross (g)" /></Label><Input type="number" step="any" value={gross} onChange={(e) => setGross(e.target.value)} className="h-11" data-testid="delivery-gross" /></div>
          </div>
          <div className="space-y-2"><Label><BilingualLabel k="showroom" /></Label><Input value={showroom} onChange={(e) => setShowroom(e.target.value)} className="h-11" data-testid="delivery-showroom" /></div>
        </div>
        <DialogFooter><Button onClick={save} disabled={busy || !bagId || selected.length === 0} data-testid="delivery-save">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{t('confirm')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
