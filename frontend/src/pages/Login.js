import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Gem, Loader2, ShieldCheck, KeyRound } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { apiError } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

export default function Login() {
  const { loginAdmin, loginCode, t, L, token } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  // Already signed in — go straight to the app (declarative, reliable).
  if (token) return <Navigate to="/" replace />;

  const doAdmin = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await loginAdmin(email.trim().toLowerCase(), password);
      toast.success(L('स्वागत है', 'Welcome'));
      navigate('/');
    } catch (err) {
      toast.error(apiError(err, 'Login failed'));
    } finally {
      setBusy(false);
    }
  };

  const doCode = async (e) => {
    e.preventDefault();
    if (code.length < 6) return;
    setBusy(true);
    try {
      await loginCode(code);
      toast.success(L('स्वागत है', 'Welcome'));
      navigate('/');
    } catch (err) {
      toast.error(apiError(err, 'Invalid code'));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between bg-gradient-to-br from-[hsl(265_45%_12%)] via-[hsl(300_40%_22%)] to-[hsl(43_80%_34%)] p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15"><Gem className="h-6 w-6" /></span>
          <div>
            <p className="text-lg font-semibold">{t('app_name')}</p>
            <p className="text-sm text-white/70">{t('app_tagline')}</p>
          </div>
        </div>
        <div>
          <h1 className="text-4xl font-semibold leading-tight">{L('चांदी और सोने का', 'Complete silver & gold')}<br/>{L('पूरा हिसाब', 'casting accounts')}</h1>
          <p className="mt-4 max-w-md text-white/80">{L('हर बैग, पैकेट, वज़न, नुकसान और रिकवरी — जारी से शोरूम डिलीवरी तक फोटो के साथ ट्रैक।', 'Every bag, packet, weight, loss and recovery — tracked with photos from issue to showroom delivery.')}</p>
        </div>
        <p className="text-sm text-white/60">© {new Date().getFullYear()} {t('app_name')}</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Gem className="h-5 w-5" /></span>
            <div><p className="font-semibold">{t('app_name')}</p><p className="text-xs text-muted-foreground">{t('app_tagline')}</p></div>
          </div>
          <Tabs defaultValue="staff">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="staff" data-testid="tab-staff"><KeyRound className="mr-2 h-4 w-4" />{t('staff_login')}</TabsTrigger>
              <TabsTrigger value="admin" data-testid="tab-admin"><ShieldCheck className="mr-2 h-4 w-4" />{t('admin_login')}</TabsTrigger>
            </TabsList>

            <TabsContent value="staff">
              <form onSubmit={doCode} className="mt-6 space-y-5">
                <div className="leading-tight">
                  <p className="text-sm font-medium">{L('सुपरवाइज़र का कोड', "Supervisor's code")}</p>
                  <p className="text-xs text-muted-foreground">{t('code_login_hint')}</p>
                </div>
                <div className="flex justify-center">
                  <InputOTP maxLength={6} value={code} onChange={setCode} data-testid="otp-input">
                    <InputOTPGroup>
                      {[0,1,2,3,4,5].map((i) => <InputOTPSlot key={i} index={i} className="h-12 w-12 text-lg" />)}
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <Button type="submit" className="h-12 w-full text-base" disabled={busy || code.length < 6} data-testid="otp-submit-button">
                  {busy ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}{t('sign_in')}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="admin">
              <form onSubmit={doAdmin} className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email"><span className="text-sm font-medium">{L('ईमेल', 'Email')}</span></Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@gmail.com" className="h-12" required data-testid="admin-email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password"><span className="text-sm font-medium">{L('पासवर्ड', 'Password')}</span></Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12" required data-testid="admin-password" />
                </div>
                <Button type="submit" className="h-12 w-full text-base" disabled={busy} data-testid="admin-submit-button">
                  {busy ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}{t('sign_in')}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
