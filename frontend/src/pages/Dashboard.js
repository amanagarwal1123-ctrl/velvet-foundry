import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, AlertTriangle, CheckCircle2, Truck, Recycle, Plus, RefreshCw, KeyRound, Trash2, Loader2, ShieldCheck, Check, X } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { api, apiError } from '@/lib/api';
import { fmtG } from '@/lib/format';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/PageHeader';
import { KpiTile } from '@/components/common/KpiTile';
import { PhotoThumb } from '@/components/common/PhotoThumb';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { RowsSkeleton } from '@/components/common/Loading';

export default function Dashboard() {
  const { t, L, metal, workspace, canManage } = useApp();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState([]);
  const [codes, setCodes] = useState([]);
  const [staff, setStaff] = useState([]);
  const [pending, setPending] = useState([]);
  const [open, setOpen] = useState(false);
  const [staffChoice, setStaffChoice] = useState('new');
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [created, setCreated] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/dashboard', { params: { workspace, metal } });
      setData(data);
      const pm = await api.get('/movements/pending', { params: { workspace, metal } });
      setPending(pm.data || []);
    } catch (e) { toast.error(apiError(e)); } finally { setLoading(false); }
  }, [workspace, metal]);

  const loadCodes = useCallback(async () => {
    try {
      const r = await api.get('/auth/issuable-roles');
      setRoles(r.data.roles || []);
      if ((r.data.roles || []).length) {
        const [c, s] = await Promise.all([api.get('/codes'), api.get('/codes/staff')]);
        setCodes(c.data || []);
        setStaff(s.data || []);
      }
    } catch { /* non-blocking */ }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadCodes(); }, [loadCodes]);

  const createCode = async () => {
    const payload = staffChoice === 'new'
      ? { name: name.trim(), role }
      : { staff_id: staffChoice, role: staff.find((s) => s.id === staffChoice)?.role };
    if (staffChoice === 'new' && (!name.trim() || !role)) { toast.error(L('नाम और भूमिका ज़रूरी', 'Name and role required')); return; }
    setBusy(true);
    try {
      const { data } = await api.post('/codes', payload);
      setCreated(data);
      setName(''); setStaffChoice('new'); setRole('');
      await loadCodes();
      toast.success(L('कोड बन गया', 'Code created'));
    } catch (e) { toast.error(apiError(e)); } finally { setBusy(false); }
  };

  const clearCode = async (id) => {
    try { await api.delete(`/codes/${id}`); setCodes((p) => p.filter((c) => c.id !== id)); }
    catch (e) { toast.error(apiError(e)); }
  };

  const approve = async (id) => { try { await api.post(`/movements/${id}/approve`); toast.success(L('मंज़ूर हुआ', 'Approved')); load(); } catch (e) { toast.error(apiError(e)); } };
  const reject = async (id) => { try { await api.post(`/movements/${id}/reject`); toast.success(L('अस्वीकृत', 'Rejected')); load(); } catch (e) { toast.error(apiError(e)); } };

  const kpis = data?.kpis || {};

  return (
    <div className="space-y-6" data-testid="dashboard">
      <PageHeader title={t('dashboard')} subtitle={`${t(metal)} · ${t(workspace)}`}
        actions={<Button onClick={() => navigate('/bags/new')} className="h-11" data-testid="dashboard-new-bag"><Plus className="mr-2 h-4 w-4" />{t('new_bag')}</Button>} />

      {loading ? <RowsSkeleton count={2} /> : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiTile labelHi="खुले बैग" labelEn="Open Bags" value={kpis.open_bags ?? 0} icon={Package} testId="kpi-open-bags" />
          <KpiTile labelHi="QC में" labelEn="In QC" value={kpis.in_qc ?? 0} icon={CheckCircle2} tone="info" testId="kpi-in-qc" />
          <KpiTile labelHi="रीवर्क" labelEn="Rework" value={kpis.rework ?? 0} icon={AlertTriangle} tone="warning" testId="kpi-rework" />
          <KpiTile labelHi="आज डिलीवरी" labelEn="Delivered Today" value={kpis.delivered_today ?? 0} icon={Truck} tone="success" testId="kpi-delivered" />
        </div>
      )}

      {/* Pending adjustment approvals (managers/admin) */}
      {canManage && pending.length > 0 ? (
        <Card className="border-[hsl(var(--jewel-magenta))]/40 bg-[hsl(var(--jewel-magenta))]/10 p-4" data-testid="pending-approvals-panel">
          <div className="mb-3 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-[hsl(var(--jewel-magenta))]" /><p className="font-semibold">{L('मंज़ूरी बाकी समायोजन', 'Adjustments awaiting approval')} ({pending.length})</p></div>
          <ul className="space-y-2">
            {pending.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-2 text-sm" data-testid={`pending-${m.id}`}>
                <span className="font-num">{L('ओपनिंग अंतर', 'Opening diff')}: <span className={`font-semibold ${m.exceeds_limit ? 'text-destructive' : ''}`}>{m.opening_difference_g > 0 ? '+' : ''}{fmtG(m.opening_difference_g)}</span> · {L('प्रोसेस हानि', 'loss')} {fmtG(m.process_loss_g)}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" className="h-8" onClick={() => navigate(`/packets/${m.packet_id}`)}>{L('पैकेट देखें', 'View')}</Button>
                  <Button size="sm" className="h-8 bg-[hsl(var(--success))] text-white hover:opacity-90" onClick={() => approve(m.id)} data-testid={`db-approve-${m.id}`}><Check className="mr-1 h-3 w-3" />{L('मंज़ूर', 'Approve')}</Button>
                  <Button size="sm" variant="outline" className="h-8 text-destructive" onClick={() => reject(m.id)} data-testid={`db-reject-${m.id}`}><X className="mr-1 h-3 w-3" />{L('अस्वीकार', 'Reject')}</Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {/* Recovery pending */}
      {data?.recovery_pending_g > 0 ? (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/10 p-4" data-testid="recovery-pending-banner">
          <div className="flex items-center gap-3">
            <Recycle className="h-5 w-5 text-[hsl(var(--warning))]" />
            <div className="leading-tight">
              <p className="text-sm font-semibold">{L('रिकवरी बाकी', 'Recovery pending')}</p>
              <p className="text-xs text-muted-foreground">{data.recovery_pending_bags} {L('बैग', 'bags')} · {fmtG(data.recovery_pending_g)} {L('बाकी', 'outstanding')}</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => navigate('/recovery')} data-testid="go-recovery">{t('recovery')}</Button>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Access codes */}
        {roles.length > 0 ? (
          <Card className="p-4 lg:col-span-1" data-testid="supervisor-code-panel">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-primary" /><p className="font-semibold">{t('access_codes')}</p></div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={loadCodes} data-testid="refresh-codes"><RefreshCw className="h-4 w-4" /></Button>
                <Dialog open={open} onOpenChange={(v) => { setOpen(v); setCreated(null); }}>
                  <DialogTrigger asChild><Button size="sm" className="h-8" data-testid="give-code-btn"><Plus className="mr-1 h-4 w-4" />{t('give_code')}</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>{t('give_code')}</DialogTitle></DialogHeader>
                    {created ? (
                      <div className="space-y-2 text-center" data-testid="created-code-box">
                        <p className="text-sm text-muted-foreground">{t('code_hint')}</p>
                        <p className="font-num text-5xl font-bold tracking-widest text-primary">{created.code}</p>
                        <p className="text-sm">{created.name} · <span className="capitalize">{created.role}</span></p>
                        <Button className="mt-2 w-full" onClick={() => { setCreated(null); }}>{L('हो गया', 'Done')}</Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label><span className="text-sm font-medium">{L('कर्मचारी', 'Staff member')}</span></Label>
                          <Select value={staffChoice} onValueChange={setStaffChoice}>
                            <SelectTrigger data-testid="code-staff-select"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="new">{L('नया व्यक्ति', 'New person')}</SelectItem>
                              {staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} · <span className="capitalize">{s.role}</span></SelectItem>)}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">{L('एक ही नाम के दो लोग अलग रिकॉर्ड रखें — नया व्यक्ति चुनें।', 'Two people with the same name stay separate — pick New person.')}</p>
                        </div>
                        {staffChoice === 'new' ? (
                          <>
                            <div className="space-y-2">
                              <Label><span className="text-sm font-medium">{L('नाम', 'Name')}</span></Label>
                              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={L('जैसे रमेश', 'e.g. Ramesh')} data-testid="code-name-input" />
                            </div>
                            <div className="space-y-2">
                              <Label><span className="text-sm font-medium">{L('भूमिका', 'Role')}</span></Label>
                              <Select value={role} onValueChange={setRole}>
                                <SelectTrigger data-testid="code-role-select"><SelectValue placeholder={L('भूमिका चुनें', 'Select role')} /></SelectTrigger>
                                <SelectContent>{roles.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                          </>
                        ) : null}
                        <Button className="w-full" onClick={createCode} disabled={busy} data-testid="create-code-submit">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{t('confirm')}</Button>
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
              </div>
            </div>
            {codes.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">{t('no_data')}</p> : (
              <ul className="space-y-2" data-testid="codes-list">
                {codes.map((c) => (
                  <li key={c.id} className="flex items-center justify-between rounded-lg border border-border p-2">
                    <div><p className="font-num text-lg font-semibold tracking-widest">{c.code}</p><p className="text-xs text-muted-foreground">{c.name} · {c.role}</p></div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => clearCode(c.id)} data-testid={`clear-code-${c.id}`}><Trash2 className="h-4 w-4" /></Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : null}

        {/* Recent bags */}
        <Card className={`p-4 ${roles.length > 0 ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          <p className="mb-3 font-semibold">{L('हाल के बैग', 'Recent Bags')}</p>
          {(data?.recent_bags || []).length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">{t('no_data')}</p> : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {data.recent_bags.map((b) => (
                <button key={b.id} onClick={() => navigate(`/bags/${b.id}`)} className="rounded-lg border border-border p-2 text-left transition-colors hover:border-primary" data-testid={`recent-bag-${b.bag_no}`}>
                  <PhotoThumb id={b.photos?.[0]} />
                  <div className="mt-2 flex items-center justify-between">
                    <div className="leading-tight"><p className="text-sm font-semibold">{b.design_name}</p><p className="text-xs text-muted-foreground">{b.bag_no}</p></div>
                    <StatusBadge status={b.status} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
