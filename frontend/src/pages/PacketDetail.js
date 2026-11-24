import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, ArrowRightCircle, Camera, Split as SplitIcon, CheckSquare, UserCheck, Plus, Trash2 } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { api, apiError } from '@/lib/api';
import { fmtG, fmtDateTime } from '@/lib/format';
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
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';

const stepName = (map, id) => (map[id] ? `${map[id].name_hi} / ${map[id].name_en}` : '-');

export default function PacketDetail() {
  const { id } = useParams();
  const { t, metal, workspace } = useApp();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [steps, setSteps] = useState([]);
  const [stepMap, setStepMap] = useState({});
  const [karigars, setKarigars] = useState([]);
  const [karigarMap, setKarigarMap] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, s, k] = await Promise.all([
        api.get(`/packets/${id}`),
        api.get('/steps', { params: { workspace } }),
        api.get('/karigars', { params: { workspace } }),
      ]);
      setData(p.data);
      setSteps(s.data || []);
      setStepMap(Object.fromEntries((s.data || []).map((x) => [x.id, x])));
      setKarigars(k.data || []);
      setKarigarMap(Object.fromEntries((k.data || []).map((x) => [x.id, x])));
    } catch (e) { toast.error(apiError(e)); } finally { setLoading(false); }
  }, [id, workspace]);

  useEffect(() => { load(); }, [load]);

  if (loading || !data) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const { packet: pkt, movements, handovers, qc_records: qc, traceability } = data;
  const isActive = pkt.status === 'active';

  return (
    <div className="space-y-6" data-testid="packet-detail-page">
      <PageHeader titleHi={pkt.packet_no} titleEn={stepName(stepMap, pkt.current_step_id)}
        actions={<Button variant="outline" onClick={() => navigate(-1)} className="h-11"><ArrowLeft className="mr-2 h-4 w-4" />{t('back')}</Button>} />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={pkt.status} />
        {pkt.is_mixed ? <StatusBadge status="mixed" /> : null}
        {pkt.qc_status && pkt.qc_status !== 'none' ? <StatusBadge status={pkt.qc_status} /> : null}
        <span className="text-sm text-muted-foreground">कारीगर: {karigarMap[pkt.karigar_id]?.name || '-'}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          {(pkt.photos || []).length > 0 ? <PhotoThumb id={pkt.photos[pkt.photos.length - 1]} /> : <PhotoThumb id={null} />}
          <div className="grid grid-cols-2 gap-3">
            <MetricTile k="balance" labelEn="Metal Balance" value={fmtG(pkt.metal_weight_g)} tone="primary" testId="pkt-metal" />
            <MetricTile k="stones_weight" labelEn="Stones" value={`${pkt.stone_count} / ${fmtG(pkt.stone_weight_g)}`} />
          </div>
          {/* Traceability */}
          <Card className="p-4">
            <p className="mb-2 text-sm font-semibold"><BilingualLabel k="traceability" /></p>
            <div className="space-y-2" data-testid="packet-traceability">
              {traceability.map((tr) => (
                <div key={tr.bag_id} className="flex items-center justify-between rounded-lg border border-border p-2 text-sm">
                  <button className="text-primary underline-offset-2 hover:underline" onClick={() => navigate(`/bags/${tr.bag_id}`)}>{tr.bag_no} · {tr.design_name}</button>
                  <span className="font-num font-semibold">{fmtG(tr.metal_g)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          {/* Action bar */}
          {isActive ? (
            <Card className="flex flex-wrap gap-2 p-3" data-testid="packet-actions">
              <MoveDialog pkt={pkt} steps={steps} karigars={karigars} onDone={load} />
              <RepackDialog pkt={pkt} onDone={load} />
              <SplitDialog pkt={pkt} onDone={load} />
              <QCDialog pkt={pkt} steps={steps} onDone={load} />
              <HandoverDialog pkt={pkt} karigars={karigars} onDone={load} />
            </Card>
          ) : <Card className="p-3 text-sm text-muted-foreground">यह पैकेट अब सक्रिय नहीं / This packet is no longer active ({pkt.status}).</Card>}

          {/* Timeline */}
          <Card className="p-4">
            <p className="mb-3 font-semibold">गतिविधि / Movement Timeline</p>
            {movements.length === 0 ? <p className="text-sm text-muted-foreground">{t('no_data')}</p> : (
              <ol className="relative ml-3 border-l border-border" data-testid="packet-movement-timeline">
                {movements.map((m) => (
                  <li key={m.id} className="mb-5 ml-4" data-testid="packet-movement-timeline-item">
                    <span className="absolute -left-[7px] mt-1 h-3 w-3 rounded-full bg-primary" />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">{stepName(stepMap, m.from_step_id)} → {stepName(stepMap, m.to_step_id)}</p>
                      <span className="text-xs text-muted-foreground">{fmtDateTime(m.created_at)}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs">
                      <Badge variant="secondary" className="font-num">In {fmtG(m.metal_in_g)}</Badge>
                      <Badge variant="secondary" className="font-num">Out {fmtG(m.metal_out_g)}</Badge>
                      <Badge className="border-0 bg-[hsl(var(--warning))] font-num text-black">Loss {fmtG(m.loss_g)}</Badge>
                      <span className="text-muted-foreground">{karigarMap[m.karigar_id]?.name || ''} {m.note ? `· ${m.note}` : ''}</span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          {(handovers.length > 0 || qc.length > 0) ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="p-4">
                <p className="mb-2 font-semibold">{t('handover')}</p>
                {handovers.length === 0 ? <p className="text-sm text-muted-foreground">{t('no_data')}</p> : (
                  <ul className="space-y-2 text-sm">{handovers.map((h) => <li key={h.id} className="rounded-lg border border-border p-2">{karigarMap[h.from_karigar_id]?.name || '-'} → {karigarMap[h.to_karigar_id]?.name || '-'} <span className="text-muted-foreground">· {fmtDateTime(h.created_at)}</span></li>)}</ul>
                )}
              </Card>
              <Card className="p-4">
                <p className="mb-2 font-semibold">{t('quality_check')}</p>
                {qc.length === 0 ? <p className="text-sm text-muted-foreground">{t('no_data')}</p> : (
                  <ul className="space-y-2 text-sm">{qc.map((q) => <li key={q.id} className="flex items-center justify-between rounded-lg border border-border p-2"><StatusBadge status={q.result} /><span className="text-muted-foreground">{q.note} · {fmtDateTime(q.created_at)}</span></li>)}</ul>
                )}
              </Card>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* --- Action dialogs --- */
function MoveDialog({ pkt, steps, karigars, onDone }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [toStep, setToStep] = useState('');
  const [mIn, setMIn] = useState(String(pkt.metal_weight_g));
  const [mOut, setMOut] = useState(String(pkt.metal_weight_g));
  const [karigar, setKarigar] = useState(pkt.karigar_id || '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const loss = useMemo(() => Math.max(Number(mIn || 0) - Number(mOut || 0), 0), [mIn, mOut]);

  const save = async () => {
    if (!toStep) { toast.error('Select a step'); return; }
    setBusy(true);
    try {
      await api.post(`/packets/${pkt.id}/move`, { to_step_id: toStep, metal_in_g: Number(mIn), metal_out_g: Number(mOut), karigar_id: karigar || null, note });
      toast.success('आगे भेजा / Moved'); setOpen(false); onDone();
    } catch (e) { toast.error(apiError(e)); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="h-11" data-testid="move-btn"><ArrowRightCircle className="mr-2 h-4 w-4" />{t('move')}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('move')} · {pkt.packet_no}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label><BilingualLabel k="step" en="Move to step" /></Label>
            <Select value={toStep} onValueChange={setToStep}><SelectTrigger data-testid="move-step"><SelectValue placeholder="Select step" /></SelectTrigger>
              <SelectContent>{steps.map((s) => <SelectItem key={s.id} value={s.id}>{s.name_hi} / {s.name_en}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label><BilingualLabel k="weight_in" en="Weight In (g)" /></Label><Input type="number" step="any" value={mIn} onChange={(e) => setMIn(e.target.value)} className="h-11" data-testid="move-in" /></div>
            <div className="space-y-2"><Label><BilingualLabel k="weight_out" en="Weight Out (g)" /></Label><Input type="number" step="any" value={mOut} onChange={(e) => setMOut(e.target.value)} className="h-11" data-testid="move-out" /></div>
          </div>
          <div className="rounded-lg bg-[hsl(var(--warning))]/10 p-3 text-sm" data-testid="move-loss-preview"><BilingualLabel k="loss" /> : <span className="font-num font-semibold">{fmtG(loss)}</span></div>
          <div className="space-y-2"><Label><BilingualLabel k="karigar" /></Label>
            <Select value={karigar} onValueChange={setKarigar}><SelectTrigger data-testid="move-karigar"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{karigars.map((k) => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label><BilingualLabel k="note" /></Label><Input value={note} onChange={(e) => setNote(e.target.value)} className="h-11" /></div>
        </div>
        <DialogFooter><Button onClick={save} disabled={busy} data-testid="move-save">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{t('confirm')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RepackDialog({ pkt, onDone }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { await api.post(`/packets/${pkt.id}/repack`, { photos, note }); toast.success('रीपैक हुआ / Repacked'); setOpen(false); setPhotos([]); onDone(); }
    catch (e) { toast.error(apiError(e)); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" className="h-11" data-testid="repack-btn"><Camera className="mr-2 h-4 w-4" />{t('repack')}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('repack')} · {pkt.packet_no}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <PhotoUploader value={photos} onChange={setPhotos} testId="repack-photos" />
          <div className="space-y-2"><Label><BilingualLabel k="note" /></Label><Input value={note} onChange={(e) => setNote(e.target.value)} className="h-11" /></div>
        </div>
        <DialogFooter><Button onClick={save} disabled={busy} data-testid="repack-save">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{t('save')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SplitDialog({ pkt, onDone }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState([{ metal_g: '', label: '' }, { metal_g: '', label: '' }]);
  const [busy, setBusy] = useState(false);
  const total = rows.reduce((s, r) => s + Number(r.metal_g || 0), 0);
  const remaining = Math.round((pkt.metal_weight_g - total) * 1000) / 1000;

  const setRow = (i, k, v) => setRows((p) => p.map((r, idx) => idx === i ? { ...r, [k]: v } : r));
  const addRow = () => setRows((p) => [...p, { metal_g: '', label: '' }]);
  const delRow = (i) => setRows((p) => p.filter((_, idx) => idx !== i));

  const save = async () => {
    const children = rows.filter((r) => Number(r.metal_g) > 0).map((r) => ({ metal_g: Number(r.metal_g), label: r.label }));
    if (children.length < 2) { toast.error('At least two child packets'); return; }
    setBusy(true);
    try { await api.post(`/packets/${pkt.id}/split`, { children }); toast.success('बांटा गया / Split'); setOpen(false); onDone(); }
    catch (e) { toast.error(apiError(e)); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" className="h-11" data-testid="split-btn"><SplitIcon className="mr-2 h-4 w-4" />{t('split')}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('split')} · {fmtG(pkt.metal_weight_g)}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {rows.map((r, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="flex-1 space-y-1"><Label className="text-xs">वज़न (g) / Metal</Label><Input type="number" step="any" value={r.metal_g} onChange={(e) => setRow(i, 'metal_g', e.target.value)} className="h-11" data-testid={`split-metal-${i}`} /></div>
              <div className="flex-1 space-y-1"><Label className="text-xs">लेबल / Label</Label><Input value={r.label} onChange={(e) => setRow(i, 'label', e.target.value)} className="h-11" /></div>
              {rows.length > 2 ? <Button type="button" variant="ghost" size="icon" className="h-11 w-11 text-destructive" onClick={() => delRow(i)}><Trash2 className="h-4 w-4" /></Button> : null}
            </div>
          ))}
          <Button type="button" variant="outline" className="w-full" onClick={addRow} data-testid="split-add-row"><Plus className="mr-2 h-4 w-4" />Add</Button>
          <div className={`rounded-lg p-3 text-sm ${remaining < 0 ? 'bg-destructive/10 text-destructive' : 'bg-muted'}`} data-testid="split-remaining">बचा / Remaining: <span className="font-num font-semibold">{fmtG(remaining)}</span></div>
        </div>
        <DialogFooter><Button onClick={save} disabled={busy || remaining < 0} data-testid="split-save">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{t('confirm')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QCDialog({ pkt, steps, onDone }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState('pass');
  const [reworkStep, setReworkStep] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (result === 'fail' && !reworkStep) { toast.error('Select a rework step'); return; }
    setBusy(true);
    try { await api.post(`/packets/${pkt.id}/qc`, { result, rework_step_id: result === 'fail' ? reworkStep : null, note }); toast.success('QC दर्ज / QC recorded'); setOpen(false); onDone(); }
    catch (e) { toast.error(apiError(e)); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" className="h-11" data-testid="qc-btn"><CheckSquare className="mr-2 h-4 w-4" />{t('quality_check')}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('quality_check')} · {pkt.packet_no}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <RadioGroup value={result} onValueChange={setResult} className="flex gap-4">
            <label className="flex items-center gap-2"><RadioGroupItem value="pass" data-testid="qc-pass" />{t('pass')}</label>
            <label className="flex items-center gap-2"><RadioGroupItem value="fail" data-testid="qc-fail" />{t('fail')}</label>
          </RadioGroup>
          {result === 'fail' ? (
            <div className="space-y-2"><Label><BilingualLabel hi="रीवर्क स्टेप" en="Rework step" /></Label>
              <Select value={reworkStep} onValueChange={setReworkStep}><SelectTrigger data-testid="qc-rework-step"><SelectValue placeholder="Select step" /></SelectTrigger>
                <SelectContent>{steps.map((s) => <SelectItem key={s.id} value={s.id}>{s.name_hi} / {s.name_en}</SelectItem>)}</SelectContent></Select></div>
          ) : null}
          <div className="space-y-2"><Label><BilingualLabel k="note" /></Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} /></div>
        </div>
        <DialogFooter><Button onClick={save} disabled={busy} data-testid="qc-save">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{t('confirm')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HandoverDialog({ pkt, karigars, onDone }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!to) { toast.error('Select karigar'); return; }
    setBusy(true);
    try { await api.post(`/packets/${pkt.id}/handover`, { to_karigar_id: to, note }); toast.success('हैंडओवर दर्ज / Handover recorded'); setOpen(false); onDone(); }
    catch (e) { toast.error(apiError(e)); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" className="h-11" data-testid="handover-btn"><UserCheck className="mr-2 h-4 w-4" />{t('handover')}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('handover')} · {pkt.packet_no}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label><BilingualLabel hi="किसको" en="Hand over to" /></Label>
            <Select value={to} onValueChange={setTo}><SelectTrigger data-testid="handover-karigar"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{karigars.map((k) => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label><BilingualLabel k="note" /></Label><Input value={note} onChange={(e) => setNote(e.target.value)} className="h-11" /></div>
        </div>
        <DialogFooter><Button onClick={save} disabled={busy} data-testid="handover-save">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{t('confirm')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
