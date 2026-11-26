import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, ArrowRightCircle, Camera, Split as SplitIcon, CheckSquare, UserCheck, Plus, Trash2, Check, X } from 'lucide-react';
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

const signed = (n) => `${n > 0 ? '+' : ''}${fmtG(n)}`;

export default function PacketDetail() {
  const { id } = useParams();
  const { t, L, metal, workspace, canManage } = useApp();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [steps, setSteps] = useState([]);
  const [stepMap, setStepMap] = useState({});
  const [karigars, setKarigars] = useState([]);
  const [karigarMap, setKarigarMap] = useState({});
  const [limit, setLimit] = useState(0.5);

  const stepName = useCallback((sid) => (stepMap[sid] ? L(stepMap[sid].name_hi, stepMap[sid].name_en) : '-'), [stepMap, L]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, s, k, st] = await Promise.all([
        api.get(`/packets/${id}`),
        api.get('/steps', { params: { workspace } }),
        api.get('/karigars', { params: { workspace, metal } }),
        api.get('/settings', { params: { workspace } }),
      ]);
      setData(p.data);
      setSteps(s.data || []);
      setStepMap(Object.fromEntries((s.data || []).map((x) => [x.id, x])));
      setKarigars(k.data || []);
      setKarigarMap(Object.fromEntries((k.data || []).map((x) => [x.id, x])));
      setLimit(Number(st.data?.adjustment_limit_g ?? 0.5));
    } catch (e) { toast.error(apiError(e)); } finally { setLoading(false); }
  }, [id, workspace, metal]);

  useEffect(() => { load(); }, [load]);

  const approve = async (mvId) => {
    try { await api.post(`/movements/${mvId}/approve`); toast.success(L('समायोजन मंज़ूर हुआ', 'Adjustment approved')); load(); }
    catch (e) { toast.error(apiError(e)); }
  };
  const reject = async (mvId) => {
    try { await api.post(`/movements/${mvId}/reject`); toast.success(L('समायोजन अस्वीकृत', 'Adjustment rejected')); load(); }
    catch (e) { toast.error(apiError(e)); }
  };

  if (loading || !data) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const { packet: pkt, movements, handovers, qc_records: qc, traceability } = data;
  const isActive = pkt.status === 'active';

  return (
    <div className="space-y-6" data-testid="packet-detail-page">
      <PageHeader title={pkt.packet_no} subtitle={stepName(pkt.current_step_id)}
        actions={<Button variant="outline" onClick={() => navigate(-1)} className="h-11"><ArrowLeft className="mr-2 h-4 w-4" />{t('back')}</Button>} />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={pkt.status} />
        {pkt.is_mixed ? <StatusBadge status="mixed" /> : null}
        {pkt.qc_status && pkt.qc_status !== 'none' ? <StatusBadge status={pkt.qc_status} /> : null}
        <span className="text-sm text-muted-foreground">{L('कारीगर', 'Karigar')}: {karigarMap[pkt.karigar_id]?.name || '-'}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          {(pkt.photos || []).length > 0 ? <PhotoThumb id={pkt.photos[pkt.photos.length - 1]} /> : <PhotoThumb id={null} />}
          <div className="grid grid-cols-3 gap-3">
            <MetricTile k="balance" labelEn="Metal" value={fmtG(pkt.metal_weight_g)} tone="primary" testId="pkt-metal" />
            <MetricTile labelHi="नग / वज़न" labelEn="Stones" value={`${pkt.stone_count || 0} · ${fmtG(pkt.stone_weight_g)}`} />
            <MetricTile labelHi="पीस" labelEn="Pieces" value={String(pkt.pieces || 0)} tone="success" />
          </div>
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
          {isActive ? (
            <Card className="flex flex-wrap gap-2 p-3" data-testid="packet-actions">
              <MoveDialog pkt={pkt} steps={steps} karigars={karigars} limit={limit} canApprove={canManage} onDone={load} />
              <RepackDialog pkt={pkt} onDone={load} />
              <SplitDialog pkt={pkt} onDone={load} />
              <QCDialog pkt={pkt} steps={steps} onDone={load} />
              <HandoverDialog pkt={pkt} karigars={karigars} onDone={load} />
            </Card>
          ) : <Card className="p-3 text-sm text-muted-foreground">{L('यह पैकेट अब सक्रिय नहीं है', 'This packet is no longer active')} ({pkt.status}).</Card>}

          <Card className="p-4">
            <p className="mb-3 font-semibold">{L('गतिविधि', 'Movement Timeline')}</p>
            {movements.length === 0 ? <p className="text-sm text-muted-foreground">{t('no_data')}</p> : (
              <ol className="relative ml-3 border-l border-border" data-testid="packet-movement-timeline">
                {movements.map((m) => {
                  const pending = m.status === 'pending_approval';
                  const rejected = m.status === 'rejected';
                  const prev = m.previous_weight_g ?? m.metal_in_g;
                  const receipt = m.receipt_weight_g ?? m.metal_in_g;
                  const output = m.output_weight_g ?? m.metal_out_g;
                  const openingDiff = m.opening_difference_g ?? 0;
                  const procLoss = m.process_loss_g ?? m.loss_g ?? 0;
                  return (
                    <li key={m.id} className="mb-5 ml-4" data-testid="packet-movement-timeline-item">
                      <span className={`absolute -left-[7px] mt-1 h-3 w-3 rounded-full ${pending ? 'bg-[hsl(var(--warning))]' : rejected ? 'bg-destructive' : 'bg-primary'}`} />
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium">{stepName(m.from_step_id)} → {stepName(m.to_step_id)}</p>
                        <span className="text-xs text-muted-foreground">{fmtDateTime(m.created_at)}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <Badge variant="secondary" className="font-num">{L('पिछला', 'Prev')} {fmtG(prev)}</Badge>
                        <Badge variant="secondary" className="font-num">{L('प्राप्त', 'Receipt')} {fmtG(receipt)}</Badge>
                        <Badge variant="secondary" className="font-num">{L('निकला', 'Output')} {fmtG(output)}</Badge>
                        {Math.abs(openingDiff) > 1e-9 ? (
                          <Badge className={`border-0 font-num text-white ${m.exceeds_limit ? 'bg-destructive' : 'bg-[hsl(var(--jewel-magenta))]'}`}>{L('समायोजन', 'Adj')} {signed(openingDiff)}</Badge>
                        ) : null}
                        <Badge className="border-0 bg-[hsl(var(--warning))] font-num text-black">{L('प्रोसेस हानि', 'Process loss')} {fmtG(procLoss)}</Badge>
                        {pending ? <StatusBadge status="pending_approval" /> : null}
                        {rejected ? <StatusBadge status="rejected" /> : null}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {m.created_by_name ? `${L('दर्ज', 'By')}: ${m.created_by_name}` : ''}
                        {m.approved_by_name ? ` · ${L('मंज़ूरी', 'Approved')}: ${m.approved_by_name}` : ''}
                        {m.karigar_id && karigarMap[m.karigar_id] ? ` · ${karigarMap[m.karigar_id].name}` : ''}
                        {m.note ? ` · ${m.note}` : ''}
                      </div>
                      {pending && canApproveRow(canManage) ? (
                        <div className="mt-2 flex gap-2">
                          <Button size="sm" className="h-8 bg-[hsl(var(--success))] text-white hover:opacity-90" onClick={() => approve(m.id)} data-testid={`approve-move-${m.id}`}><Check className="mr-1 h-3 w-3" />{L('मंज़ूर करें', 'Approve')}</Button>
                          <Button size="sm" variant="outline" className="h-8 text-destructive" onClick={() => reject(m.id)} data-testid={`reject-move-${m.id}`}><X className="mr-1 h-3 w-3" />{L('अस्वीकार', 'Reject')}</Button>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
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

const canApproveRow = (canManage) => !!canManage;

/* --- Action dialogs --- */
function MoveDialog({ pkt, steps, karigars, limit, canApprove, onDone }) {
  const { t, L } = useApp();
  const [open, setOpen] = useState(false);
  const [toStep, setToStep] = useState('');
  const [receipt, setReceipt] = useState(String(pkt.metal_weight_g));
  const [output, setOutput] = useState(String(pkt.metal_weight_g));
  const [karigar, setKarigar] = useState(pkt.karigar_id || '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const previous = Number(pkt.metal_weight_g);
  const openingDiff = useMemo(() => Math.round((Number(receipt || 0) - previous) * 10000) / 10000, [receipt, previous]);
  const procLoss = useMemo(() => Math.round((Number(receipt || 0) - Number(output || 0)) * 10000) / 10000, [receipt, output]);
  const exceeds = Math.abs(openingDiff) > limit + 1e-9;
  const hasAdj = Math.abs(openingDiff) > 1e-9;

  const save = async () => {
    if (!toStep) { toast.error(L('चरण चुनें', 'Select a step')); return; }
    if (Number(output) > Number(receipt) + 1e-9) { toast.error(L('निकला वज़न प्राप्त वज़न से ज़्यादा नहीं हो सकता', 'Output cannot exceed receipt')); return; }
    setBusy(true);
    try {
      const { data } = await api.post(`/packets/${pkt.id}/move`, { to_step_id: toStep, receipt_weight_g: Number(receipt), output_weight_g: Number(output), karigar_id: karigar || null, note });
      if (data?.pending_approval) toast.warning(L('समायोजन मैनेजर की मंज़ूरी के लिए भेजा गया', 'Adjustment sent for manager approval'));
      else toast.success(L('आगे भेजा गया', 'Moved'));
      setOpen(false); onDone();
    } catch (e) { toast.error(apiError(e)); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="h-11" data-testid="move-btn"><ArrowRightCircle className="mr-2 h-4 w-4" />{t('move')}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('move')} · {pkt.packet_no}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg bg-muted p-3 text-sm" data-testid="move-previous">{L('पिछला दर्ज वज़न', 'Last posted weight')}: <span className="font-num font-semibold">{fmtG(previous)}</span></div>
          <div className="space-y-2"><Label>{L('किस चरण पर भेजें', 'Move to step')}</Label>
            <Select value={toStep} onValueChange={setToStep}><SelectTrigger data-testid="move-step"><SelectValue placeholder={L('चरण चुनें', 'Select step')} /></SelectTrigger>
              <SelectContent>{steps.map((s) => <SelectItem key={s.id} value={s.id}>{L(s.name_hi, s.name_en)}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>{L('तराज़ू पर प्राप्त वज़न (g)', 'Receipt weight (g)')}</Label><Input type="number" step="any" value={receipt} onChange={(e) => setReceipt(e.target.value)} className="h-11" data-testid="move-receipt" /></div>
            <div className="space-y-2"><Label>{L('प्रोसेस के बाद वज़न (g)', 'Output weight (g)')}</Label><Input type="number" step="any" value={output} onChange={(e) => setOutput(e.target.value)} className="h-11" data-testid="move-output" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className={`rounded-lg p-3 ${hasAdj ? (exceeds ? 'bg-destructive/15 text-destructive' : 'bg-[hsl(var(--jewel-magenta))]/15') : 'bg-muted'}`} data-testid="move-opening-diff">
              {L('ओपनिंग अंतर', 'Opening difference')}: <span className="font-num font-semibold">{signed(openingDiff)}</span>
              {hasAdj ? <div className="mt-1 text-xs">{exceeds ? L('सीमा से अधिक — मंज़ूरी ज़रूरी', 'Over limit — approval required') : L('मंज़ूरी ज़रूरी (सीमा के भीतर)', 'Approval required (within limit)')}</div> : null}
            </div>
            <div className="rounded-lg bg-[hsl(var(--warning))]/10 p-3" data-testid="move-loss-preview">{L('प्रोसेस हानि', 'Process loss')}: <span className="font-num font-semibold">{fmtG(procLoss)}</span></div>
          </div>
          {hasAdj && !canApprove ? <p className="text-xs text-muted-foreground">{L('यह समायोजन दर्ज होगा पर मैनेजर की मंज़ूरी तक स्टॉक नहीं बदलेगा।', 'This adjustment will be recorded but stock will not change until a manager approves it.')}</p> : null}
          <div className="space-y-2"><Label><BilingualLabel k="karigar" /></Label>
            <Select value={karigar} onValueChange={setKarigar}><SelectTrigger data-testid="move-karigar"><SelectValue placeholder={L('चुनें', 'Select')} /></SelectTrigger>
              <SelectContent>{karigars.map((k) => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label><BilingualLabel k="note" /></Label><Input value={note} onChange={(e) => setNote(e.target.value)} className="h-11" /></div>
        </div>
        <DialogFooter><Button onClick={save} disabled={busy} data-testid="move-save">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{t('confirm')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RepackDialog({ pkt, onDone }) {
  const { t, L } = useApp();
  const [open, setOpen] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [pieces, setPieces] = useState(String(pkt.pieces || 0));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { await api.post(`/packets/${pkt.id}/repack`, { photos, pieces: Number(pieces), note }); toast.success(L('रीपैक हुआ', 'Repacked')); setOpen(false); setPhotos([]); onDone(); }
    catch (e) { toast.error(apiError(e)); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" className="h-11" data-testid="repack-btn"><Camera className="mr-2 h-4 w-4" />{t('repack')}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('repack')} · {pkt.packet_no}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <PhotoUploader value={photos} onChange={setPhotos} testId="repack-photos" />
          <div className="space-y-2"><Label>{L('पीस की संख्या', 'Piece count')}</Label><Input type="number" step="1" value={pieces} onChange={(e) => setPieces(e.target.value)} className="h-11" data-testid="repack-pieces" /></div>
          <div className="space-y-2"><Label><BilingualLabel k="note" /></Label><Input value={note} onChange={(e) => setNote(e.target.value)} className="h-11" /></div>
        </div>
        <DialogFooter><Button onClick={save} disabled={busy} data-testid="repack-save">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{t('save')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SplitDialog({ pkt, onDone }) {
  const { t, L } = useApp();
  const [open, setOpen] = useState(false);
  const emptyRow = { metal_g: '', stone_count: '', stone_weight_g: '', pieces: '', label: '' };
  const [rows, setRows] = useState([{ ...emptyRow }, { ...emptyRow }]);
  const [busy, setBusy] = useState(false);

  const sum = (key) => rows.reduce((s, r) => s + Number(r[key] || 0), 0);
  const remMetal = Math.round((pkt.metal_weight_g - sum('metal_g')) * 10000) / 10000;
  const remStones = (pkt.stone_count || 0) - sum('stone_count');
  const remStoneW = Math.round(((pkt.stone_weight_g || 0) - sum('stone_weight_g')) * 10000) / 10000;
  const remPieces = (pkt.pieces || 0) - sum('pieces');
  const invalid = remMetal < -1e-9 || remStones < -1e-9 || remStoneW < -1e-9 || remPieces < -1e-9;

  const setRow = (i, k, v) => setRows((p) => p.map((r, idx) => idx === i ? { ...r, [k]: v } : r));
  const addRow = () => setRows((p) => [...p, { ...emptyRow }]);
  const delRow = (i) => setRows((p) => p.filter((_, idx) => idx !== i));

  const save = async () => {
    const children = rows
      .filter((r) => Number(r.metal_g) > 0 || Number(r.stone_count) > 0 || Number(r.pieces) > 0)
      .map((r) => ({ metal_g: Number(r.metal_g || 0), stone_count: Number(r.stone_count || 0), stone_weight_g: Number(r.stone_weight_g || 0), pieces: Number(r.pieces || 0), label: r.label }));
    if (children.length < 1) { toast.error(L('कम से कम एक पैकेट', 'At least one child packet')); return; }
    setBusy(true);
    try {
      const { data } = await api.post(`/packets/${pkt.id}/split`, { children });
      if (data?.remainder) toast.success(L(`बांटा गया · बचत ${fmtG(data.remainder.metal_weight_g)} रखी गई`, `Split · remainder ${fmtG(data.remainder.metal_weight_g)} kept`));
      else toast.success(L('बांटा गया', 'Split'));
      setOpen(false); onDone();
    } catch (e) { toast.error(apiError(e)); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" className="h-11" data-testid="split-btn"><SplitIcon className="mr-2 h-4 w-4" />{t('split')}</Button></DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{t('split')} · {fmtG(pkt.metal_weight_g)} · {pkt.stone_count || 0} {L('नग', 'stones')} · {pkt.pieces || 0} {L('पीस', 'pcs')}</DialogTitle></DialogHeader>
        <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
          {rows.map((r, i) => (
            <div key={i} className="rounded-lg border border-border p-3">
              <div className="mb-2 flex items-center justify-between">
                <Input placeholder={L('लेबल', 'Label')} value={r.label} onChange={(e) => setRow(i, 'label', e.target.value)} className="h-9 max-w-[160px]" />
                {rows.length > 1 ? <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => delRow(i)}><Trash2 className="h-4 w-4" /></Button> : null}
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div className="space-y-1"><Label className="text-xs">{L('धातु (g)', 'Metal (g)')}</Label><Input type="number" step="any" value={r.metal_g} onChange={(e) => setRow(i, 'metal_g', e.target.value)} className="h-10" data-testid={`split-metal-${i}`} /></div>
                <div className="space-y-1"><Label className="text-xs">{L('नग', 'Stones')}</Label><Input type="number" step="any" value={r.stone_count} onChange={(e) => setRow(i, 'stone_count', e.target.value)} className="h-10" data-testid={`split-stones-${i}`} /></div>
                <div className="space-y-1"><Label className="text-xs">{L('नग वज़न (g)', 'Stone wt (g)')}</Label><Input type="number" step="any" value={r.stone_weight_g} onChange={(e) => setRow(i, 'stone_weight_g', e.target.value)} className="h-10" /></div>
                <div className="space-y-1"><Label className="text-xs">{L('पीस', 'Pieces')}</Label><Input type="number" step="1" value={r.pieces} onChange={(e) => setRow(i, 'pieces', e.target.value)} className="h-10" data-testid={`split-pieces-${i}`} /></div>
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" className="w-full" onClick={addRow} data-testid="split-add-row"><Plus className="mr-2 h-4 w-4" />{L('और जोड़ें', 'Add row')}</Button>
          <div className={`rounded-lg p-3 text-sm ${invalid ? 'bg-destructive/15 text-destructive' : 'bg-[hsl(var(--success))]/10'}`} data-testid="split-remaining">
            <p className="font-semibold">{L('बची हुई मात्रा (स्टॉक में रहेगी)', 'Remainder (kept as stock)')}</p>
            <div className="mt-1 flex flex-wrap gap-3 font-num">
              <span>{L('धातु', 'Metal')}: {fmtG(remMetal)}</span>
              <span>{L('नग', 'Stones')}: {remStones}</span>
              <span>{L('नग वज़न', 'Stone wt')}: {fmtG(remStoneW)}</span>
              <span>{L('पीस', 'Pieces')}: {remPieces}</span>
            </div>
            {invalid ? <p className="mt-1 text-xs">{L('बच्चों का योग पैकेट से अधिक है', 'Children exceed the packet')}</p> : null}
          </div>
        </div>
        <DialogFooter><Button onClick={save} disabled={busy || invalid} data-testid="split-save">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{t('confirm')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QCDialog({ pkt, steps, onDone }) {
  const { t, L } = useApp();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState('pass');
  const [reworkStep, setReworkStep] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (result === 'fail' && !reworkStep) { toast.error(L('रीवर्क चरण चुनें', 'Select a rework step')); return; }
    setBusy(true);
    try { await api.post(`/packets/${pkt.id}/qc`, { result, rework_step_id: result === 'fail' ? reworkStep : null, note }); toast.success(L('QC दर्ज हुआ', 'QC recorded')); setOpen(false); onDone(); }
    catch (e) { toast.error(apiError(e)); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" className="h-11" data-testid="qc-btn"><CheckSquare className="mr-2 h-4 w-4" />{t('quality_check')}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('quality_check')} · {pkt.packet_no}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">{L('पास किए गए पीस ही शोरूम भेजे जा सकते हैं। फेल पीस दोबारा जांच तक प्रोसेस में लौटेंगे।', 'Only passed pieces can be dispatched to showroom. Failed pieces return to process until re-inspected.')}</p>
          <RadioGroup value={result} onValueChange={setResult} className="flex gap-4">
            <label className="flex items-center gap-2"><RadioGroupItem value="pass" data-testid="qc-pass" />{t('pass')}</label>
            <label className="flex items-center gap-2"><RadioGroupItem value="fail" data-testid="qc-fail" />{t('fail')}</label>
          </RadioGroup>
          {result === 'fail' ? (
            <div className="space-y-2"><Label>{L('रीवर्क चरण', 'Rework step')}</Label>
              <Select value={reworkStep} onValueChange={setReworkStep}><SelectTrigger data-testid="qc-rework-step"><SelectValue placeholder={L('चरण चुनें', 'Select step')} /></SelectTrigger>
                <SelectContent>{steps.map((s) => <SelectItem key={s.id} value={s.id}>{L(s.name_hi, s.name_en)}</SelectItem>)}</SelectContent></Select></div>
          ) : null}
          <div className="space-y-2"><Label><BilingualLabel k="note" /></Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} /></div>
        </div>
        <DialogFooter><Button onClick={save} disabled={busy} data-testid="qc-save">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{t('confirm')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HandoverDialog({ pkt, karigars, onDone }) {
  const { t, L } = useApp();
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!to) { toast.error(L('कारीगर चुनें', 'Select karigar')); return; }
    setBusy(true);
    try { await api.post(`/packets/${pkt.id}/handover`, { to_karigar_id: to, note }); toast.success(L('हैंडओवर दर्ज हुआ', 'Handover recorded')); setOpen(false); onDone(); }
    catch (e) { toast.error(apiError(e)); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" className="h-11" data-testid="handover-btn"><UserCheck className="mr-2 h-4 w-4" />{t('handover')}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('handover')} · {pkt.packet_no}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label>{L('किसको सौंपें', 'Hand over to')}</Label>
            <Select value={to} onValueChange={setTo}><SelectTrigger data-testid="handover-karigar"><SelectValue placeholder={L('चुनें', 'Select')} /></SelectTrigger>
              <SelectContent>{karigars.map((k) => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label><BilingualLabel k="note" /></Label><Input value={note} onChange={(e) => setNote(e.target.value)} className="h-11" /></div>
        </div>
        <DialogFooter><Button onClick={save} disabled={busy} data-testid="handover-save">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{t('confirm')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
