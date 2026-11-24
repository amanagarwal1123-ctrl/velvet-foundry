import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Boxes, GitMerge, Loader2 } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { api, apiError } from '@/lib/api';
import { fmtG } from '@/lib/format';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/PageHeader';
import { StatusBadge } from '@/components/common/StatusBadge';
import { EmptyState } from '@/components/common/EmptyState';
import { RowsSkeleton } from '@/components/common/Loading';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BilingualLabel } from '@/components/common/BilingualLabel';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';

const stepName = (map, id) => (map[id] ? `${map[id].name_hi} / ${map[id].name_en}` : '-');

export default function Packets() {
  const { t, metal, workspace } = useApp();
  const navigate = useNavigate();
  const [packets, setPackets] = useState([]);
  const [steps, setSteps] = useState([]);
  const [stepMap, setStepMap] = useState({});
  const [karigars, setKarigars] = useState({});
  const [loading, setLoading] = useState(true);
  const [stepFilter, setStepFilter] = useState('all');
  const [selected, setSelected] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { workspace, metal, status: 'active' };
      if (stepFilter !== 'all') params.step_id = stepFilter;
      const [p, s, k] = await Promise.all([
        api.get('/packets', { params }),
        api.get('/steps', { params: { workspace } }),
        api.get('/karigars', { params: { workspace } }),
      ]);
      setPackets(p.data || []);
      setSteps(s.data || []);
      setStepMap(Object.fromEntries((s.data || []).map((x) => [x.id, x])));
      setKarigars(Object.fromEntries((k.data || []).map((x) => [x.id, x])));
    } catch (e) { toast.error(apiError(e)); } finally { setLoading(false); }
  }, [workspace, metal, stepFilter]);

  useEffect(() => { load(); setSelected([]); }, [load]);

  const toggle = (id) => setSelected((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  return (
    <div className="space-y-6" data-testid="packets-page">
      <PageHeader titleHi={t('packets')} titleEn="Packets" subtitle={`${t(metal)} · ${t(workspace)}`}
        actions={<MergeDialog selected={selected} steps={steps} karigars={Object.values(karigars)} onDone={() => { setSelected([]); load(); }} />} />

      <Card className="flex flex-wrap items-center gap-3 p-3">
        <Select value={stepFilter} onValueChange={setStepFilter}>
          <SelectTrigger className="w-[220px]" data-testid="packet-step-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('all')} स्टेप</SelectItem>
            {steps.map((s) => <SelectItem key={s.id} value={s.id}>{s.name_hi} / {s.name_en}</SelectItem>)}
          </SelectContent>
        </Select>
        {selected.length > 0 ? <span className="text-sm text-muted-foreground">{selected.length} selected</span> : null}
      </Card>

      {loading ? <RowsSkeleton /> : packets.length === 0 ? (
        <EmptyState icon={Boxes} title="कोई सक्रिय पैकेट नहीं" subtitle="No active packets in this step." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {packets.map((p) => (
            <Card key={p.id} className="p-4" data-testid={`packet-card-${p.packet_no}`}>
              <div className="flex items-start justify-between">
                <label className="flex items-center gap-2">
                  <Checkbox checked={selected.includes(p.id)} onCheckedChange={() => toggle(p.id)} data-testid={`select-packet-${p.packet_no}`} />
                  <div className="leading-tight"><p className="font-semibold">{p.packet_no}</p><p className="text-xs text-muted-foreground">{stepName(stepMap, p.current_step_id)}</p></div>
                </label>
                <div className="flex flex-col items-end gap-1">{p.is_mixed ? <StatusBadge status="mixed" /> : null}{p.qc_status === 'fail' ? <StatusBadge status="fail" /> : null}</div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                <div className="rounded-lg bg-muted px-2 py-2"><p className="text-[11px] text-muted-foreground">धातु</p><p className="font-num text-sm font-semibold">{fmtG(p.metal_weight_g)}</p></div>
                <div className="rounded-lg bg-muted px-2 py-2"><p className="text-[11px] text-muted-foreground">कारीगर</p><p className="text-sm font-medium">{karigars[p.karigar_id]?.name || '-'}</p></div>
              </div>
              <Button variant="outline" className="mt-3 h-10 w-full" onClick={() => navigate(`/packets/${p.id}`)} data-testid={`open-packet-${p.packet_no}`}>{t('open')}</Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function MergeDialog({ selected, steps, karigars, onDone }) {
  const { metal, workspace, t } = useApp();
  const [open, setOpen] = useState(false);
  const [stepId, setStepId] = useState('');
  const [karigar, setKarigar] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (selected.length < 2) { toast.error('Select at least two packets'); return; }
    setBusy(true);
    try {
      await api.post('/packets/merge', { packet_ids: selected, to_step_id: stepId || null, karigar_id: karigar || null }, { params: { workspace, metal } });
      toast.success('पैकेट मिलाए / Merged');
      setOpen(false); onDone();
    } catch (e) { toast.error(apiError(e)); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="h-11" disabled={selected.length < 2} data-testid="merge-btn"><GitMerge className="mr-2 h-4 w-4" />{t('merge')} ({selected.length})</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('merge')} · {selected.length} packets</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Packets from different bags become a traceable mixed packet.</p>
          <div className="space-y-2"><Label><BilingualLabel k="step" /></Label>
            <Select value={stepId} onValueChange={setStepId}><SelectTrigger data-testid="merge-step"><SelectValue placeholder="Keep current" /></SelectTrigger>
              <SelectContent>{steps.map((s) => <SelectItem key={s.id} value={s.id}>{s.name_hi} / {s.name_en}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label><BilingualLabel k="karigar" /></Label>
            <Select value={karigar} onValueChange={setKarigar}><SelectTrigger data-testid="merge-karigar"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{karigars.map((k) => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}</SelectContent></Select></div>
        </div>
        <DialogFooter><Button onClick={save} disabled={busy} data-testid="merge-save">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{t('confirm')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
