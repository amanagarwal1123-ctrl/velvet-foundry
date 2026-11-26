import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Users, Trash2, Loader2, Wallet, IndianRupee } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { api, apiError } from '@/lib/api';
import { fmtRs, fmtDateTime } from '@/lib/format';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { BilingualLabel } from '@/components/common/BilingualLabel';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';

export default function Karigars() {
  const { t, L, metal, workspace } = useApp();
  const [list, setList] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [k, p] = await Promise.all([
        api.get('/karigars', { params: { workspace, metal } }),
        api.get('/payments', { params: { workspace, metal } }),
      ]);
      setList(k.data || []);
      setPayments(p.data || []);
    } catch (e) { toast.error(apiError(e)); } finally { setLoading(false); }
  }, [workspace, metal]);
  useEffect(() => { load(); }, [load]);

  const paidByKarigar = useMemo(() => {
    const m = {};
    payments.forEach((p) => { m[p.karigar_id] = (m[p.karigar_id] || 0) + Number(p.amount || 0); });
    return m;
  }, [payments]);

  const add = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try { await api.post('/karigars', { name: name.trim() }, { params: { workspace, metal } }); setName(''); await load(); toast.success(L('कारीगर जुड़ गया', 'Karigar added')); }
    catch (e) { toast.error(apiError(e)); } finally { setBusy(false); }
  };

  const remove = async (id) => {
    try { await api.delete(`/karigars/${id}`); setList((p) => p.filter((k) => k.id !== id)); }
    catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div className="space-y-6" data-testid="karigars-page">
      <PageHeader title={t('karigars')} subtitle={`${t(metal)} · ${t(workspace)}`} />
      <Card className="flex flex-wrap items-end gap-3 p-4">
        <div className="flex-1 min-w-[220px]">
          <p className="mb-1 text-sm font-medium">{L('नया कारीगर', 'New Karigar')} · {t(metal)}</p>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={L('नाम', 'Name')} className="h-11" data-testid="karigar-name" />
        </div>
        <Button onClick={add} className="h-11" disabled={busy} data-testid="karigar-add">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}{t('add')}</Button>
      </Card>

      {loading ? null : list.length === 0 ? (
        <EmptyState icon={Users} title={L('कोई कारीगर नहीं', 'No karigars')} subtitle={L('इस धातु के कारीगर जोड़ें।', 'Add karigars for this metal.')} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="karigars-list">
          {list.map((k) => (
            <Card key={k.id} className="flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-primary font-semibold">{(k.name || '?').charAt(0)}</span>
                  <div><p className="font-medium">{k.name}</p><p className="text-xs text-muted-foreground">{L('कुल भुगतान', 'Total paid')}: {fmtRs(paidByKarigar[k.id] || 0)}</p></div>
                </div>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => remove(k.id)} data-testid={`karigar-remove-${k.id}`}><Trash2 className="h-4 w-4" /></Button>
              </div>
              <PaymentDialog karigar={k} onDone={load} />
            </Card>
          ))}
        </div>
      )}

      {payments.length > 0 ? (
        <Card className="p-4">
          <p className="mb-3 font-semibold">{L('हाल के भुगतान', 'Recent payments')} · {t(metal)}</p>
          <div className="space-y-2" data-testid="payments-list">
            {payments.slice(0, 20).map((p) => {
              const kar = list.find((k) => k.id === p.karigar_id);
              return (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-2 text-sm">
                  <div>
                    <span className="font-medium">{kar?.name || '—'}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {p.salary_amount > 0 ? `${L('वेतन', 'Salary')} ${fmtRs(p.salary_amount)}` : ''}
                      {p.commission_amount > 0 ? ` ${p.salary_amount > 0 ? '+' : ''} ${L('कमीशन', 'Commission')} ${fmtRs(p.commission_amount)} (${p.commission_count}×${fmtRs(p.commission_rate)} ${L('प्रति', 'per')} ${p.commission_unit || ''})` : ''}
                    </span>
                  </div>
                  <span className="font-num font-semibold">{fmtRs(p.amount)} <span className="text-xs text-muted-foreground">· {fmtDateTime(p.created_at)}</span></span>
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function PaymentDialog({ karigar, onDone }) {
  const { t, L, metal, workspace } = useApp();
  const [open, setOpen] = useState(false);
  const [salary, setSalary] = useState('');
  const [commType, setCommType] = useState('none');
  const [count, setCount] = useState('');
  const [cRate, setCRate] = useState('');
  const [period, setPeriod] = useState('');
  const [busy, setBusy] = useState(false);

  const commAmount = commType !== 'none' ? Math.round(Number(count || 0) * Number(cRate || 0) * 100) / 100 : 0;
  const total = Math.round((Number(salary || 0) + commAmount) * 100) / 100;

  const save = async () => {
    if (total <= 0) { toast.error(L('वेतन या कमीशन दर्ज करें', 'Enter a salary and/or commission')); return; }
    setBusy(true);
    try {
      await api.post('/payments', {
        karigar_id: karigar.id,
        salary_amount: Number(salary || 0),
        commission_type: commType === 'none' ? null : commType,
        commission_count: Number(count || 0),
        commission_rate: Number(cRate || 0),
        period,
      }, { params: { workspace, metal } });
      toast.success(L('भुगतान दर्ज हुआ', 'Payment recorded'));
      setOpen(false); setSalary(''); setCommType('none'); setCount(''); setCRate(''); setPeriod(''); onDone();
    } catch (e) { toast.error(apiError(e)); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" className="h-10 w-full" data-testid={`pay-btn-${karigar.id}`}><Wallet className="mr-2 h-4 w-4" />{L('भुगतान दर्ज करें', 'Record payment')}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{L('भुगतान', 'Payment')} · {karigar.name}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label>{L('मूल वेतन (₹) — वैकल्पिक', 'Base salary (₹) — optional')}</Label><Input type="number" step="any" value={salary} onChange={(e) => setSalary(e.target.value)} className="h-11" data-testid="pay-salary" /></div>
          <div className="rounded-lg border border-border p-3">
            <p className="mb-2 text-sm font-medium">{L('कमीशन (वैकल्पिक)', 'Commission (optional)')}</p>
            <div className="space-y-2"><Label className="text-xs">{L('प्रकार', 'Type')}</Label>
              <Select value={commType} onValueChange={setCommType}><SelectTrigger data-testid="pay-comm-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{L('कोई नहीं', 'None')}</SelectItem>
                  <SelectItem value="per_stone">{L('प्रति नग सेट', 'Per stone set')}</SelectItem>
                  <SelectItem value="per_piece">{L('प्रति पीस (बफ़)', 'Per piece buffed')}</SelectItem>
                  <SelectItem value="per_tree">{L('प्रति ट्री (कास्ट)', 'Per tree cast')}</SelectItem>
                </SelectContent></Select></div>
            {commType !== 'none' ? (
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">{L('संख्या', 'Count')}</Label><Input type="number" step="any" value={count} onChange={(e) => setCount(e.target.value)} className="h-11" data-testid="pay-comm-count" /></div>
                <div className="space-y-1"><Label className="text-xs">{L('दर (₹)', 'Rate (₹)')}</Label><Input type="number" step="any" value={cRate} onChange={(e) => setCRate(e.target.value)} className="h-11" data-testid="pay-comm-rate" /></div>
              </div>
            ) : null}
          </div>
          <div className="space-y-2"><Label>{L('अवधि / नोट', 'Period / note')}</Label><Input value={period} onChange={(e) => setPeriod(e.target.value)} className="h-11" placeholder={L('जैसे नवंबर 2026', 'e.g. November 2026')} /></div>
          <div className="flex items-center justify-between rounded-lg bg-accent/40 p-3 text-sm" data-testid="pay-total">
            <span><IndianRupee className="mr-1 inline h-4 w-4" />{L('कुल', 'Total')}</span>
            <span className="font-num text-lg font-semibold">{fmtRs(total)}</span>
          </div>
        </div>
        <DialogFooter><Button onClick={save} disabled={busy || total <= 0} data-testid="pay-save">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{t('confirm')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
