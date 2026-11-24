import React, { useCallback, useEffect, useState } from 'react';
import { Recycle, Loader2 } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { api, apiError } from '@/lib/api';
import { fmtG, fmtDateTime } from '@/lib/format';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/PageHeader';
import { MetricTile } from '@/components/common/KpiTile';
import { BilingualLabel } from '@/components/common/BilingualLabel';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';

export default function Recovery() {
  const { t, metal, workspace } = useApp();
  const [eligible, setEligible] = useState([]);
  const [total, setTotal] = useState(0);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [e, h] = await Promise.all([
        api.get('/recovery/eligible', { params: { workspace, metal } }),
        api.get('/recovery', { params: { workspace, metal } }),
      ]);
      setEligible(e.data.eligible || []);
      setTotal(e.data.total_outstanding_g || 0);
      setHistory(h.data || []);
    } catch (err) { toast.error(apiError(err)); } finally { setLoading(false); }
  }, [workspace, metal]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6" data-testid="recovery-page">
      <PageHeader titleHi={t('recovery')} titleEn="Recovery" subtitle={`${t(metal)} · ${t(workspace)}`}
        actions={<RecoveryDialog onDone={load} disabled={total <= 0} />} />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricTile k="outstanding_loss" labelEn="Total Outstanding" value={fmtG(total)} tone="danger" testId="recovery-total" />
        <MetricTile labelHi="पात्र बैग" labelEn="Eligible Bags" value={eligible.length} />
      </div>

      <Card className="p-4">
        <p className="mb-3 font-semibold">बकाया नुकसान वाले बैग / Bags with outstanding loss</p>
        {loading ? <Loader2 className="mx-auto my-6 h-6 w-6 animate-spin text-primary" /> : eligible.length === 0 ? (
          <EmptyState icon={Recycle} title="कोई बकाया नहीं" subtitle="No bags currently have outstanding loss." />
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Bag</TableHead><TableHead>Design</TableHead><TableHead>Purity</TableHead><TableHead className="text-right">Outstanding</TableHead></TableRow></TableHeader>
            <TableBody>
              {eligible.map((b) => (
                <TableRow key={b.bag_id} data-testid={`eligible-${b.bag_no}`}>
                  <TableCell className="font-medium">{b.bag_no}</TableCell>
                  <TableCell>{b.design_name}</TableCell>
                  <TableCell>{b.purity}</TableCell>
                  <TableCell className="font-num text-right text-[hsl(var(--danger))]">{fmtG(b.outstanding_loss_g)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Card className="p-4">
        <p className="mb-3 font-semibold">पिछली रिकवरी / Past Recoveries</p>
        {history.length === 0 ? <p className="text-sm text-muted-foreground">{t('no_data')}</p> : (
          <ul className="space-y-3">
            {history.map((r) => (
              <li key={r.id} className="rounded-lg border border-border p-3" data-testid={`recovery-row-${r.id}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{fmtG(r.recovered_g)} <span className="text-sm text-muted-foreground">· {r.source || 'recovery'}</span></p>
                  <span className="text-xs text-muted-foreground">{fmtDateTime(r.created_at)}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {r.allocations.map((a) => <span key={a.bag_id} className="rounded-full bg-accent px-2 py-1">{a.bag_no}: {fmtG(a.amount_g)}</span>)}
                  {r.unallocated_g > 0 ? <span className="rounded-full bg-muted px-2 py-1">Unallocated: {fmtG(r.unallocated_g)}</span> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function RecoveryDialog({ onDone, disabled }) {
  const { t, metal, workspace } = useApp();
  const [open, setOpen] = useState(false);
  const [recovered, setRecovered] = useState('');
  const [source, setSource] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!recovered) return;
    setBusy(true);
    try {
      const { data } = await api.post('/recovery', { recovered_g: Number(recovered), source }, { params: { workspace, metal } });
      toast.success(`आवंटित / Allocated to ${data.allocations.length} bags`);
      setOpen(false); setRecovered(''); setSource(''); onDone();
    } catch (e) { toast.error(apiError(e)); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="h-11" disabled={disabled} data-testid="record-recovery-btn"><Recycle className="mr-2 h-4 w-4" />{t('record_recovery')}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('record_recovery')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Recovered metal is shared across eligible bags in proportion to their outstanding loss.</p>
          <div className="space-y-2"><Label><BilingualLabel k="recovered" en="Recovered metal (g)" /></Label><Input type="number" step="any" value={recovered} onChange={(e) => setRecovered(e.target.value)} className="h-11" data-testid="recovery-weight" /></div>
          <div className="space-y-2"><Label><BilingualLabel k="source" /></Label><Input value={source} onChange={(e) => setSource(e.target.value)} className="h-11" placeholder="Common casting dust" data-testid="recovery-source" /></div>
        </div>
        <DialogFooter><Button onClick={save} disabled={busy} data-testid="recovery-save">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{t('confirm')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
