import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Truck, Recycle, Gem, Pencil, Boxes } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { api, apiError } from '@/lib/api';
import { fmtG, fmtRs, fmtDateTime } from '@/lib/format';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/PageHeader';
import { PhotoThumb } from '@/components/common/PhotoThumb';
import { PhotoUploader } from '@/components/common/PhotoUploader';
import { StatusBadge } from '@/components/common/StatusBadge';
import { MetricTile } from '@/components/common/KpiTile';
import { BilingualLabel } from '@/components/common/BilingualLabel';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';

const stepName = (map, id) => (map[id] ? `${map[id].name_hi} / ${map[id].name_en}` : '-');

export default function BagDetail() {
  const { id } = useParams();
  const { t, metal, workspace } = useApp();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [steps, setSteps] = useState({});
  const [karigars, setKarigars] = useState({});
  const [expenses, setExpenses] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/bags/${id}`);
      setDetail(data);
      const [s, k, e] = await Promise.all([
        api.get('/steps', { params: { workspace } }),
        api.get('/karigars', { params: { workspace } }),
        api.get('/expenses', { params: { workspace, metal, bag_id: id } }),
      ]);
      setSteps(Object.fromEntries((s.data || []).map((x) => [x.id, x])));
      setKarigars(Object.fromEntries((k.data || []).map((x) => [x.id, x])));
      setExpenses(e.data || []);
    } catch (err) { toast.error(apiError(err)); } finally { setLoading(false); }
  }, [id, workspace, metal]);

  useEffect(() => { load(); }, [load]);

  if (loading || !detail) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const { bag, accounting: acc, costing, packets } = detail;
  const activePackets = packets.filter((p) => p.status === 'active');

  return (
    <div className="space-y-6" data-testid="bag-detail-page">
      <PageHeader titleHi={bag.design_name} titleEn={`${bag.bag_no} · ${bag.purity}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigate('/bags')} className="h-11"><ArrowLeft className="mr-2 h-4 w-4" />{t('back')}</Button>
            <EditBagDialog bag={bag} karigars={Object.values(karigars)} onDone={load} />
            <ScrapDialog bagId={bag.id} onDone={load} />
            <StoneDialog bag={bag} onDone={load} />
            {bag.status === 'open' ? <DeliverDialog bag={bag} packets={activePackets} onDone={load} /> : null}
          </div>
        } />

      <div className="flex items-center gap-2"><StatusBadge status={bag.status} /><span className="text-sm text-muted-foreground">{bag.notes}</span></div>

      {/* Photos */}
      {(bag.photos || []).length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6" data-testid="bag-photo-strip">
          {bag.photos.map((p) => <PhotoThumb key={p} id={p} ratio={1} />)}
        </div>
      ) : <PhotoThumb id={null} className="max-w-xs" />}

      {/* Accounting */}
      <Card className="p-5">
        <p className="mb-3 font-semibold">धातु हिसाब / Metal Accounting</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
          <MetricTile k="issued" value={fmtG(acc.issued_metal_g)} testId="acc-issued" />
          <MetricTile labelHi="प्रोडक्शन में" labelEn="In Production" value={fmtG(acc.metal_in_production_g)} />
          <MetricTile labelHi="डिलीवर्ड" labelEn="Delivered" value={fmtG(acc.delivered_metal_g)} tone="success" />
          <MetricTile labelHi="स्क्रैप" labelEn="Scrap Returned" value={fmtG(acc.scrap_returned_g)} />
          <MetricTile k="loss" labelEn="Metal Loss" value={fmtG(acc.metal_loss_g)} tone="warning" testId="acc-loss" />
          <MetricTile k="outstanding_loss" value={fmtG(acc.outstanding_loss_g)} tone="danger" testId="acc-outstanding" />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricTile labelHi="जारी स्टोन" labelEn="Stones Issued" value={`${acc.issued_stones_count} / ${fmtG(acc.issued_stones_weight_g)}`} />
          <MetricTile labelHi="मौजूदा स्टोन" labelEn="Stones Now" value={`${acc.current_stones_count} / ${fmtG(acc.current_stones_weight_g)}`} />
          <MetricTile k="recovered" value={fmtG(acc.recovered_allocated_g)} tone="info" />
        </div>
      </Card>

      {/* Costing */}
      <Card className="p-5">
        <p className="mb-3 font-semibold">लागत / Costing</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
          <MetricTile labelHi="रेट ₹/kg" labelEn="Labour Rate" value={fmtRs(costing.labour_rate_per_kg)} />
          <MetricTile k="gross_weight" labelEn="Finished Gross" value={fmtG(costing.gross_finished_g)} />
          <MetricTile k="labour" labelEn="Labour Amount" value={fmtRs(costing.labour_amount)} />
          <MetricTile labelHi="खर्च" labelEn="Expenses" value={fmtRs(costing.expenses_total)} />
          <MetricTile k="total_cost" value={fmtRs(costing.total_cost)} tone="primary" />
          <MetricTile labelHi="प्रति आइटम" labelEn="Per Item" value={fmtRs(costing.cost_per_item)} />
        </div>
      </Card>

      <Tabs defaultValue="packets">
        <TabsList>
          <TabsTrigger value="packets" data-testid="tab-packets">{t('packets')}</TabsTrigger>
          <TabsTrigger value="accounting" data-testid="tab-accounting">हिसाब</TabsTrigger>
          <TabsTrigger value="expenses" data-testid="tab-expenses">खर्च</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">{t('history')}</TabsTrigger>
        </TabsList>

        <TabsContent value="packets" className="mt-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {packets.map((p) => (
              <Card key={p.id} className="p-4 transition-colors hover:border-primary">
                <div className="flex items-start justify-between">
                  <div className="leading-tight"><p className="font-semibold">{p.packet_no}</p><p className="text-xs text-muted-foreground">{stepName(steps, p.current_step_id)}</p></div>
                  <div className="flex flex-col items-end gap-1"><StatusBadge status={p.status} />{p.is_mixed ? <StatusBadge status="mixed" /> : null}</div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-lg bg-muted px-2 py-2"><p className="text-[11px] text-muted-foreground">धातु / Metal</p><p className="font-num text-sm font-semibold">{fmtG(p.metal_weight_g)}</p></div>
                  <div className="rounded-lg bg-muted px-2 py-2"><p className="text-[11px] text-muted-foreground">कारीगर</p><p className="text-sm font-medium">{karigars[p.karigar_id]?.name || '-'}</p></div>
                </div>
                <Button variant="outline" className="mt-3 h-10 w-full" onClick={() => navigate(`/packets/${p.id}`)} data-testid={`open-packet-${p.packet_no}`}>{t('open')}</Button>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="accounting" className="mt-4 space-y-4">
          <Card className="p-4">
            <p className="mb-2 font-semibold">स्क्रैप वापस / Scrap Returns</p>
            {detail.scrap_returns.length === 0 ? <p className="text-sm text-muted-foreground">{t('no_data')}</p> : (
              <ul className="space-y-2">{detail.scrap_returns.map((s) => <li key={s.id} className="flex justify-between rounded-lg border border-border p-2 text-sm"><span>{fmtG(s.scrap_g)} · {s.note}</span><span className="text-muted-foreground">{fmtDateTime(s.created_at)}</span></li>)}</ul>
            )}
          </Card>
          <Card className="p-4">
            <p className="mb-2 font-semibold">स्टोन लेनदेन / Stone Transactions</p>
            {detail.stone_txns.length === 0 ? <p className="text-sm text-muted-foreground">{t('no_data')}</p> : (
              <ul className="space-y-2">{detail.stone_txns.map((s) => <li key={s.id} className="flex justify-between rounded-lg border border-border p-2 text-sm"><span className="capitalize">{s.type.replace('_',' ')} · {s.count} pc / {fmtG(s.weight_g)}</span><span className="text-muted-foreground">{fmtDateTime(s.created_at)}</span></li>)}</ul>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="expenses" className="mt-4">
          <Card className="p-4">
            {expenses.length === 0 ? <p className="text-sm text-muted-foreground">{t('no_data')}</p> : (
              <ul className="space-y-2">{expenses.map((e) => <li key={e.id} className="flex justify-between rounded-lg border border-border p-2 text-sm"><span>{e.category} · {e.note}</span><span className="font-num font-semibold">{fmtRs(e.amount)}</span></li>)}</ul>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card className="p-4">
            <ul className="space-y-2" data-testid="bag-history">
              {(bag.history || []).slice().reverse().map((h, i) => (
                <li key={i} className="flex items-start justify-between rounded-lg border border-border p-2 text-sm">
                  <span><span className="font-medium capitalize">{h.action}</span> — {h.detail}</span>
                  <span className="whitespace-nowrap text-muted-foreground">{h.by_name} · {fmtDateTime(h.at)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* --- Dialogs --- */
function EditBagDialog({ bag, karigars, onDone }) {
  const [open, setOpen] = useState(false);
  const [photos, setPhotos] = useState(bag.photos || []);
  const [karigar, setKarigar] = useState(bag.karigar_id || '');
  const [notes, setNotes] = useState(bag.notes || '');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { await api.put(`/bags/${bag.id}`, { photos, karigar_id: karigar || null, notes }); toast.success('Saved'); setOpen(false); onDone(); }
    catch (e) { toast.error(apiError(e)); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" className="h-11" data-testid="edit-bag-btn"><Pencil className="mr-2 h-4 w-4" />Edit</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit Bag · {bag.bag_no}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <PhotoUploader value={photos} onChange={setPhotos} testId="edit-bag-photos" />
          <div className="space-y-2"><Label><BilingualLabel k="karigar" /></Label>
            <Select value={karigar} onValueChange={setKarigar}><SelectTrigger data-testid="edit-bag-karigar"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{karigars.map((k) => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label><BilingualLabel k="note" /></Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter><Button onClick={save} disabled={busy} data-testid="edit-bag-save">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScrapDialog({ bagId, onDone }) {
  const [open, setOpen] = useState(false);
  const [scrap, setScrap] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!scrap) return;
    setBusy(true);
    try { await api.post(`/bags/${bagId}/scrap`, { scrap_g: Number(scrap), note }); toast.success('Scrap recorded'); setOpen(false); setScrap(''); setNote(''); onDone(); }
    catch (e) { toast.error(apiError(e)); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" className="h-11" data-testid="scrap-btn"><Recycle className="mr-2 h-4 w-4" />Scrap</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>स्क्रैप वापस / Return Scrap</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label><BilingualLabel hi="स्क्रैप (g)" en="Scrap weight (g)" /></Label><Input type="number" step="any" value={scrap} onChange={(e) => setScrap(e.target.value)} className="h-11" data-testid="scrap-weight" /></div>
          <div className="space-y-2"><Label><BilingualLabel k="note" /></Label><Input value={note} onChange={(e) => setNote(e.target.value)} className="h-11" /></div>
        </div>
        <DialogFooter><Button onClick={save} disabled={busy} data-testid="scrap-save">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StoneDialog({ bag, onDone }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('remove');
  const [count, setCount] = useState('');
  const [weight, setWeight] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { await api.post(`/bags/${bag.id}/stones`, { type, count: Number(count || 0), weight_g: Number(weight || 0), note }); toast.success('Stone txn recorded'); setOpen(false); setCount(''); setWeight(''); onDone(); }
    catch (e) { toast.error(apiError(e)); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" className="h-11" data-testid="stone-btn"><Gem className="mr-2 h-4 w-4" />Stones</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>स्टोन / Stones</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label><BilingualLabel hi="प्रकार" en="Type" /></Label>
            <Select value={type} onValueChange={setType}><SelectTrigger data-testid="stone-type"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="add">Add</SelectItem><SelectItem value="remove">Remove</SelectItem><SelectItem value="transfer_out">Transfer out</SelectItem></SelectContent></Select></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label><BilingualLabel k="stones_count" /></Label><Input type="number" step="any" value={count} onChange={(e) => setCount(e.target.value)} className="h-11" data-testid="stone-count" /></div>
            <div className="space-y-2"><Label><BilingualLabel k="stones_weight" en="Weight (g)" /></Label><Input type="number" step="any" value={weight} onChange={(e) => setWeight(e.target.value)} className="h-11" data-testid="stone-weight" /></div>
          </div>
          <div className="space-y-2"><Label><BilingualLabel k="note" /></Label><Input value={note} onChange={(e) => setNote(e.target.value)} className="h-11" /></div>
        </div>
        <DialogFooter><Button onClick={save} disabled={busy} data-testid="stone-save">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeliverDialog({ bag, packets, onDone }) {
  const { metal, workspace } = useApp();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState([]);
  const [items, setItems] = useState('');
  const [gross, setGross] = useState('');
  const [showroom, setShowroom] = useState('');
  const [busy, setBusy] = useState(false);

  const toggle = (id) => setSelected((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  useEffect(() => {
    const g = packets.filter((p) => selected.includes(p.id)).reduce((s, p) => s + (p.metal_weight_g || 0) + (p.stone_weight_g || 0), 0);
    if (selected.length) setGross(String(Math.round(g * 1000) / 1000));
  }, [selected]); // eslint-disable-line

  const save = async () => {
    setBusy(true);
    try {
      await api.post('/deliveries', { bag_id: bag.id, packet_ids: selected, items_count: Number(items || 0), gross_weight_g: Number(gross || 0), showroom }, { params: { workspace, metal } });
      toast.success('डिलीवरी दर्ज / Delivered');
      setOpen(false); onDone();
    } catch (e) { toast.error(apiError(e)); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="h-11" data-testid="deliver-btn"><Truck className="mr-2 h-4 w-4" />Deliver</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>शोरूम डिलीवरी / Deliver to Showroom</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium">पैकेट चुनें / Select packets</p>
            {packets.length === 0 ? <p className="text-sm text-muted-foreground">No active packets</p> : (
              <div className="space-y-2">{packets.map((p) => (
                <label key={p.id} className="flex items-center gap-3 rounded-lg border border-border p-2">
                  <Checkbox checked={selected.includes(p.id)} onCheckedChange={() => toggle(p.id)} data-testid={`deliver-pkt-${p.packet_no}`} />
                  <span className="text-sm">{p.packet_no} · {fmtG(p.metal_weight_g)}</span>
                </label>
              ))}</div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label><BilingualLabel k="items" /></Label><Input type="number" value={items} onChange={(e) => setItems(e.target.value)} className="h-11" data-testid="deliver-items" /></div>
            <div className="space-y-2"><Label><BilingualLabel k="gross_weight" en="Gross (g)" /></Label><Input type="number" step="any" value={gross} onChange={(e) => setGross(e.target.value)} className="h-11" data-testid="deliver-gross" /></div>
          </div>
          <div className="space-y-2"><Label><BilingualLabel k="showroom" /></Label><Input value={showroom} onChange={(e) => setShowroom(e.target.value)} className="h-11" data-testid="deliver-showroom" /></div>
        </div>
        <DialogFooter><Button onClick={save} disabled={busy || selected.length === 0} data-testid="deliver-save">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Confirm Delivery</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
