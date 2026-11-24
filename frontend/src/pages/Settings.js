import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Loader2, Trash2, ArrowUp, ArrowDown, RotateCcw, Save } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { api, apiError } from '@/lib/api';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/PageHeader';
import { BilingualLabel } from '@/components/common/BilingualLabel';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

export default function Settings() {
  const { t, workspace } = useApp();
  return (
    <div className="space-y-6" data-testid="settings-page">
      <PageHeader titleHi={t('settings')} titleEn="Settings" subtitle={t(workspace)} />
      <Tabs defaultValue="steps">
        <TabsList>
          <TabsTrigger value="steps" data-testid="tab-steps">स्टेप / Steps</TabsTrigger>
          <TabsTrigger value="rates" data-testid="tab-rates">रेट / Rates</TabsTrigger>
          <TabsTrigger value="categories" data-testid="tab-categories">श्रेणी / Categories</TabsTrigger>
          <TabsTrigger value="demo" data-testid="tab-demo">डेमो / Demo</TabsTrigger>
        </TabsList>
        <TabsContent value="steps" className="mt-4"><StepsSettings /></TabsContent>
        <TabsContent value="rates" className="mt-4"><RatesSettings /></TabsContent>
        <TabsContent value="categories" className="mt-4"><CategoriesSettings /></TabsContent>
        <TabsContent value="demo" className="mt-4"><DemoSettings /></TabsContent>
      </Tabs>
    </div>
  );
}

function StepsSettings() {
  const { workspace, t } = useApp();
  const [steps, setSteps] = useState([]);
  const [hi, setHi] = useState('');
  const [en, setEn] = useState('');
  const [isQc, setIsQc] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { const { data } = await api.get('/steps', { params: { workspace } }); setSteps(data || []); } catch (e) { toast.error(apiError(e)); }
  }, [workspace]);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!hi.trim() || !en.trim()) { toast.error('Both names required'); return; }
    setBusy(true);
    try { await api.post('/steps', { name_hi: hi.trim(), name_en: en.trim(), is_qc: isQc }, { params: { workspace } }); setHi(''); setEn(''); setIsQc(false); await load(); toast.success('जुड़ा / Added'); }
    catch (e) { toast.error(apiError(e)); } finally { setBusy(false); }
  };
  const del = async (id) => { try { await api.delete(`/steps/${id}`); load(); } catch (e) { toast.error(apiError(e)); } };
  const move = async (idx, dir) => {
    const arr = [...steps];
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    setSteps(arr);
    try { await api.post('/steps/reorder', { ordered_ids: arr.map((s) => s.id) }); } catch (e) { toast.error(apiError(e)); load(); }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
          <div className="space-y-1"><Label className="text-xs">हिंदी नाम</Label><Input value={hi} onChange={(e) => setHi(e.target.value)} className="h-11" data-testid="step-hi" /></div>
          <div className="space-y-1"><Label className="text-xs">English name</Label><Input value={en} onChange={(e) => setEn(e.target.value)} className="h-11" data-testid="step-en" /></div>
          <label className="flex h-11 items-center gap-2 px-1"><Checkbox checked={isQc} onCheckedChange={setIsQc} data-testid="step-isqc" /><span className="text-sm">QC</span></label>
          <Button onClick={add} className="h-11" disabled={busy} data-testid="step-add"><Plus className="mr-2 h-4 w-4" />{t('add')}</Button>
        </div>
      </Card>
      <Card className="p-4">
        <ul className="space-y-2" data-testid="steps-list">
          {steps.map((s, i) => (
            <li key={s.id} className="flex items-center justify-between rounded-lg border border-border p-2">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-semibold">{i + 1}</span>
                <span className="text-sm font-medium">{s.name_hi} / {s.name_en}</span>
                {s.is_qc ? <Badge variant="secondary">QC</Badge> : null}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => move(i, -1)} data-testid={`step-up-${i}`}><ArrowUp className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => move(i, 1)} data-testid={`step-down-${i}`}><ArrowDown className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => del(s.id)} data-testid={`step-del-${i}`}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function RatesSettings() {
  const { workspace } = useApp();
  const [rates, setRates] = useState({ silver: '', gold: '' });
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try { const { data } = await api.get('/settings', { params: { workspace } }); setRates({ silver: data?.labour_rates?.silver ?? 0, gold: data?.labour_rates?.gold ?? 0 }); } catch (e) { toast.error(apiError(e)); }
  }, [workspace]);
  useEffect(() => { load(); }, [load]);
  const save = async () => {
    setBusy(true);
    try { await api.put('/settings', { labour_rates: { silver: Number(rates.silver || 0), gold: Number(rates.gold || 0) } }, { params: { workspace } }); toast.success('सेव हुआ / Saved'); }
    catch (e) { toast.error(apiError(e)); } finally { setBusy(false); }
  };
  return (
    <Card className="max-w-lg space-y-4 p-5">
      <p className="text-sm text-muted-foreground">Main labour/manufacturing rate in ₹ per kg of finished gross jewellery (stones included).</p>
      <div className="space-y-2"><Label><BilingualLabel hi="चांदी ₹/kg" en="Silver labour rate" /></Label><Input type="number" step="any" value={rates.silver} onChange={(e) => setRates((p) => ({ ...p, silver: e.target.value }))} className="h-11" data-testid="rate-silver" /></div>
      <div className="space-y-2"><Label><BilingualLabel hi="सोना ₹/kg" en="Gold labour rate" /></Label><Input type="number" step="any" value={rates.gold} onChange={(e) => setRates((p) => ({ ...p, gold: e.target.value }))} className="h-11" data-testid="rate-gold" /></div>
      <Button onClick={save} disabled={busy} className="h-11" data-testid="rates-save">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save</Button>
    </Card>
  );
}

function CategoriesSettings() {
  const { workspace } = useApp();
  const [cats, setCats] = useState([]);
  const [hi, setHi] = useState('');
  const [en, setEn] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try { const { data } = await api.get('/settings', { params: { workspace } }); setCats(data?.expense_categories || []); } catch (e) { toast.error(apiError(e)); }
  }, [workspace]);
  useEffect(() => { load(); }, [load]);
  const persist = async (next) => {
    setBusy(true);
    try { await api.put('/settings', { expense_categories: next }, { params: { workspace } }); setCats(next); toast.success('सेव / Saved'); }
    catch (e) { toast.error(apiError(e)); } finally { setBusy(false); }
  };
  const add = () => { if (!hi.trim() || !en.trim()) return; persist([...cats, { hi: hi.trim(), en: en.trim() }]); setHi(''); setEn(''); };
  const remove = (i) => persist(cats.filter((_, idx) => idx !== i));
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="space-y-1"><Label className="text-xs">हिंदी</Label><Input value={hi} onChange={(e) => setHi(e.target.value)} className="h-11" data-testid="cat-hi" /></div>
          <div className="space-y-1"><Label className="text-xs">English</Label><Input value={en} onChange={(e) => setEn(e.target.value)} className="h-11" data-testid="cat-en" /></div>
          <Button onClick={add} className="h-11" disabled={busy} data-testid="cat-add"><Plus className="mr-2 h-4 w-4" />Add</Button>
        </div>
      </Card>
      <Card className="p-4">
        <div className="flex flex-wrap gap-2" data-testid="cats-list">
          {cats.map((c, i) => (
            <span key={i} className="flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-sm">{c.hi} / {c.en}<button onClick={() => remove(i)} className="text-destructive" data-testid={`cat-del-${i}`}><Trash2 className="h-3.5 w-3.5" /></button></span>
          ))}
        </div>
      </Card>
    </div>
  );
}

function DemoSettings() {
  const { t } = useApp();
  const [busy, setBusy] = useState(false);
  const reset = async () => {
    setBusy(true);
    try { await api.post('/demo/reset'); toast.success('डेमो रीसेट / Demo reset'); }
    catch (e) { toast.error(apiError(e)); } finally { setBusy(false); }
  };
  return (
    <Card className="max-w-xl space-y-4 p-5">
      <p className="font-semibold">डेमो डेटा / Demo Data</p>
      <p className="text-sm text-muted-foreground">Demo data lives in a separate workspace. Resetting restores fresh demo samples and never touches real factory records.</p>
      <AlertDialog>
        <AlertDialogTrigger asChild><Button variant="destructive" className="h-11" disabled={busy} data-testid="demo-reset-btn">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}{t('demo_reset')}</Button></AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t('demo_reset')}?</AlertDialogTitle><AlertDialogDescription>This clears all demo-workspace records and restores the sample data. Real factory data is not affected.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>{t('cancel')}</AlertDialogCancel><AlertDialogAction onClick={reset} data-testid="demo-reset-confirm">{t('confirm')}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
