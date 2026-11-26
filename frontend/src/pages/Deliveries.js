import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Truck, Loader2, Plus } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { api, apiError } from '@/lib/api';
import { fmtG, fmtRs, fmtDateTime } from '@/lib/format';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { StatusBadge } from '@/components/common/StatusBadge';
import { BilingualLabel } from '@/components/common/BilingualLabel';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';

export default function Deliveries() {
  const { t, L, metal, workspace } = useApp();
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
      <PageHeader title={t('deliveries')} subtitle={`${t(metal)} · ${t(workspace)}`}
        actions={<NewDeliveryDialog onDone={load} />} />

      {loading ? <Loader2 className="mx-auto my-10 h-7 w-7 animate-spin text-primary" /> : list.length === 0 ? (
        <EmptyState icon={Truck} title={L('कोई डिलीवरी नहीं', 'No deliveries yet')} subtitle={L('QC पास पीस शोरूम भेजें।', 'Dispatch QC-passed pieces to the showroom.')} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((d) => (
            <Card key={d.id} className="p-4" data-testid={`delivery-${d.bag_no}`}>
              <div className="flex items-start justify-between">
                <div className="leading-tight"><p className="font-semibold">{d.is_mixed ? L('मिश्रित शिपमेंट', 'Mixed shipment') : d.bag_no}</p><p className="text-xs text-muted-foreground">{d.design_name || (d.is_mixed ? `${(d.allocations || []).length} ${L('बैग', 'bags')}` : '')}</p></div>
                {d.is_mixed ? <StatusBadge status="mixed" /> : <Truck className="h-5 w-5 text-[hsl(var(--success))]" />}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-center text-sm">
                <div className="rounded-lg bg-muted px-2 py-2"><p className="text-[11px] text-muted-foreground">{L('आइटम', 'Items')}</p><p className="font-num font-semibold">{d.items_count}</p></div>
                <div className="rounded-lg bg-muted px-2 py-2"><p className="text-[11px] text-muted-foreground">{L('ग्रॉस', 'Gross')}</p><p className="font-num font-semibold">{fmtG(d.gross_weight_g)}</p></div>
              </div>
              {d.is_mixed ? (
                <div className="mt-2 space-y-1" data-testid="delivery-allocations">
                  {(d.allocations || []).map((a) => (
                    <div key={a.bag_id} className="flex items-center justify-between rounded-md bg-accent/40 px-2 py-1 text-xs">
                      <span>{a.bag_no} · {fmtG(a.gross_weight_g)}</span>
                      <span className="font-num font-semibold">{fmtRs(a.labour_amount)}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{d.showroom || '-'}</span>
                <span className="font-num font-semibold">{fmtRs(d.labour_amount)}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{fmtDateTime(d.created_at)} · {L('दर', 'rate')} {fmtRs(d.labour_rate_per_kg)}/kg</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function NewDeliveryDialog({ onDone }) {
  const { t, L, metal, workspace } = useApp();
  const [open, setOpen] = useState(false);
  const [packets, setPackets] = useState([]);
  const [bagMap, setBagMap] = useState({});
  const [rate, setRate] = useState(0);
  const [selected, setSelected] = useState([]);
  const [items, setItems] = useState('');
  const [gross, setGross] = useState('');
  const [showroom, setShowroom] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected([]); setItems(''); setGross(''); setShowroom('');
    Promise.all([
      api.get('/deliveries/eligible', { params: { workspace, metal } }),
      api.get('/bags', { params: { workspace, metal } }),
      api.get('/settings', { params: { workspace } }),
    ]).then(([pe, b, st]) => {
      setPackets(pe.data || []);
      setBagMap(Object.fromEntries((b.data || []).map((x) => [x.id, x])));
      setRate(Number(st.data?.labour_rates?.[metal] || 0));
    }).catch((e) => toast.error(apiError(e)));
  }, [open, workspace, metal]);

  const toggle = (id) => setSelected((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  const selPackets = useMemo(() => packets.filter((p) => selected.includes(p.id)), [packets, selected]);

  useEffect(() => {
    const g = selPackets.reduce((s, p) => s + (p.metal_weight_g || 0) + (p.stone_weight_g || 0), 0);
    if (selPackets.length) setGross(String(Math.round(g * 1000) / 1000));
  }, [selected]); // eslint-disable-line

  // Per-source-bag allocation preview (by metal share).
  const allocations = useMemo(() => {
    const byBag = {};
    selPackets.forEach((p) => (p.composition || []).forEach((c) => { byBag[c.bag_id] = (byBag[c.bag_id] || 0) + Number(c.metal_g || 0); }));
    const totalMetal = Object.values(byBag).reduce((s, v) => s + v, 0) || 1;
    const g = Number(gross || 0);
    return Object.entries(byBag).map(([bid, m]) => {
      const share = m / totalMetal;
      const gAlloc = Math.round(g * share * 10000) / 10000;
      return { bag_id: bid, bag_no: bagMap[bid]?.bag_no || bid.slice(0, 6), metal_g: m, gross: gAlloc, labour: Math.round((gAlloc / 1000) * rate * 100) / 100 };
    });
  }, [selPackets, gross, rate, bagMap]);

  const isMixed = allocations.length > 1;

  const save = async () => {
    if (selected.length === 0) { toast.error(L('कम से कम एक पैकेट चुनें', 'Select at least one packet')); return; }
    setBusy(true);
    try {
      await api.post('/deliveries', { packet_ids: selected, items_count: Number(items || 0), gross_weight_g: Number(gross || 0), showroom }, { params: { workspace, metal } });
      toast.success(L('डिलीवरी दर्ज हुई', 'Dispatched')); setOpen(false); onDone();
    } catch (e) { toast.error(apiError(e)); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="h-11" data-testid="new-delivery-btn"><Plus className="mr-2 h-4 w-4" />{t('deliver')}</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{t('deliver')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">{L('सिर्फ़ QC पास किए सक्रिय पैकेट भेजे जा सकते हैं।', 'Only QC-passed active packets can be dispatched.')}</p>
          <div>
            <p className="mb-2 text-sm font-medium">{L('भेजने योग्य पैकेट', 'Eligible packets')}</p>
            {packets.length === 0 ? <p className="text-sm text-muted-foreground">{L('कोई पात्र पैकेट नहीं (पहले QC पास करें)', 'No eligible packets (pass QC first)')}</p> : (
              <div className="max-h-48 space-y-2 overflow-y-auto pr-1">{packets.map((p) => (
                <label key={p.id} className="flex items-center gap-3 rounded-lg border border-border p-2">
                  <Checkbox checked={selected.includes(p.id)} onCheckedChange={() => toggle(p.id)} data-testid={`delivery-pkt-${p.packet_no}`} />
                  <span className="text-sm">{p.packet_no} · {fmtG(p.metal_weight_g)} · <span className="text-muted-foreground">{(p.composition || []).map((c) => bagMap[c.bag_id]?.bag_no).filter(Boolean).join(', ')}</span></span>
                </label>
              ))}</div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label><BilingualLabel k="items" /></Label><Input type="number" value={items} onChange={(e) => setItems(e.target.value)} className="h-11" data-testid="delivery-items" /></div>
            <div className="space-y-2"><Label>{L('ग्रॉस वज़न (g)', 'Gross weight (g)')}</Label><Input type="number" step="any" value={gross} onChange={(e) => setGross(e.target.value)} className="h-11" data-testid="delivery-gross" /></div>
          </div>
          {selected.length > 0 ? (
            <div className="rounded-lg bg-accent/40 p-3 text-sm" data-testid="delivery-alloc-preview">
              <p className="mb-1 font-semibold">{isMixed ? L('स्रोत बैग के अनुसार बँटवारा', 'Allocation by source bag') : L('लेबर', 'Labour')} · {L('दर', 'rate')} {fmtRs(rate)}/kg</p>
              {allocations.map((a) => (
                <div key={a.bag_id} className="flex items-center justify-between py-0.5 font-num">
                  <span>{a.bag_no} · {fmtG(a.gross)}</span><span className="font-semibold">{fmtRs(a.labour)}</span>
                </div>
              ))}
            </div>
          ) : null}
          <div className="space-y-2"><Label><BilingualLabel k="showroom" /></Label><Input value={showroom} onChange={(e) => setShowroom(e.target.value)} className="h-11" data-testid="delivery-showroom" /></div>
        </div>
        <DialogFooter><Button onClick={save} disabled={busy || selected.length === 0} data-testid="delivery-save">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{t('confirm')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
