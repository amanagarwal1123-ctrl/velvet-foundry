import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Package, Boxes, Recycle, Calculator, Truck, Users, Settings as SettingsIcon, Sun, Moon, LogOut, Gem } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';

const NAV = [
  { to: '/', key: 'dashboard', icon: LayoutDashboard, end: true },
  { to: '/bags', key: 'bags', icon: Package },
  { to: '/packets', key: 'packets', icon: Boxes },
  { to: '/recovery', key: 'recovery', icon: Recycle },
  { to: '/costing', key: 'costing', icon: Calculator },
  { to: '/deliveries', key: 'deliveries', icon: Truck },
  { to: '/karigars', key: 'karigars', icon: Users },
  { to: '/settings', key: 'settings', icon: SettingsIcon, manage: true },
];

export const TopBar = () => {
  const { t, metal, setMetal, workspace, setWorkspace, lang, setLang, theme, setTheme, user, logout, canManage } = useApp();
  const navigate = useNavigate();
  const initials = (user?.name || '?').trim().charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <button onClick={() => navigate('/')} className="flex items-center gap-2" data-testid="brand-home">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Gem className="h-5 w-5" /></span>
          <span className="hidden sm:block text-left leading-tight">
            <span className="block text-sm font-semibold">{t('app_name')}</span>
            <span className="block text-[11px] text-muted-foreground">{t('app_tagline')}</span>
          </span>
        </button>

        {/* Metal context switch */}
        <ToggleGroup type="single" value={metal} onValueChange={(v) => v && setMetal(v)} className="ml-1" data-testid="metal-context-switch">
          <ToggleGroupItem value="silver" className="h-9 px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground" data-testid="metal-silver">{t('silver')}</ToggleGroupItem>
          <ToggleGroupItem value="gold" className="h-9 px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground" data-testid="metal-gold">{t('gold')}</ToggleGroupItem>
        </ToggleGroup>

        {/* Workspace toggle */}
        <ToggleGroup type="single" value={workspace} onValueChange={(v) => v && setWorkspace(v)} data-testid="workspace-toggle">
          <ToggleGroupItem value="real" className="h-9 px-3 data-[state=on]:bg-secondary" data-testid="workspace-real">{t('real')}</ToggleGroupItem>
          <ToggleGroupItem value="demo" className="h-9 px-3 data-[state=on]:bg-[hsl(var(--warning))] data-[state=on]:text-black" data-testid="workspace-demo">{t('demo')}</ToggleGroupItem>
        </ToggleGroup>
        {workspace === 'demo' ? <Badge className="bg-[hsl(var(--warning))] text-black border-0">{t('demo')}</Badge> : null}

        <div className="ml-auto flex items-center gap-2">
          <ToggleGroup type="single" value={lang} onValueChange={(v) => v && setLang(v)} data-testid="language-toggle">
            <ToggleGroupItem value="hi" className="h-9 px-2 text-xs" data-testid="lang-hi">हिं</ToggleGroupItem>
            <ToggleGroupItem value="en" className="h-9 px-2 text-xs" data-testid="lang-en">EN</ToggleGroupItem>
          </ToggleGroup>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} data-testid="theme-toggle" aria-label="Toggle theme">
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-9 gap-2" data-testid="user-menu">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">{initials}</span>
                <span className="hidden sm:inline text-sm">{user?.name}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="capitalize">{user?.name} · {user?.role}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} data-testid="logout-btn"><LogOut className="mr-2 h-4 w-4" />{t('logout')}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex gap-1 overflow-x-auto px-2 pb-2 sm:px-4" data-testid="main-nav">
        {NAV.filter((n) => !n.manage || canManage).map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            data-testid={`nav-${n.key}`}
            className={({ isActive }) =>
              `flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`
            }
          >
            <n.icon className="h-4 w-4" />
            <span>{t(n.key)}</span>
          </NavLink>
        ))}
      </nav>
    </header>
  );
};
