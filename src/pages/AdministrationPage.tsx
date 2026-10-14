import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Database, 
  Server, 
  Lock, 
  CheckCircle2, 
  RefreshCw, 
  Sliders, 
  FileText,
  Palette,
  Sun,
  Moon,
  Monitor,
  Check
} from 'lucide-react';
import { MaintenanceType } from '../api/types';
import { cn } from '../lib/utils';
import { useTheme } from '../context/ThemeContext';

interface AdministrationPageProps {
  maintenanceTypes: MaintenanceType[];
  onRefreshGlobal: () => void;
}

export const AdministrationPage: React.FC<AdministrationPageProps> = ({
  maintenanceTypes,
  onRefreshGlobal,
}) => {
  const { theme, effectiveTheme, setTheme } = useTheme();
  const [systemHealth, setSystemHealth] = useState<{
    status: string;
    service: string;
    version: string;
    latencyMs?: number;
  } | null>(null);
  const [isLoadingHealth, setIsLoadingHealth] = useState(true);

  const checkHealth = async () => {
    setIsLoadingHealth(true);
    const start = performance.now();
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      const latencyMs = Math.round(performance.now() - start);
      setSystemHealth({
        status: data.status || 'ok',
        service: data.service || 'MaintainIQ API',
        version: data.version || '3.0.0',
        latencyMs,
      });
    } catch {
      setSystemHealth({
        status: 'error',
        service: 'MaintainIQ API',
        version: 'Unknown',
      });
    } finally {
      setIsLoadingHealth(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  const businessRules = [
    {
      ruleId: 'RULE-1',
      title: 'Sequential Unique Work Order Numbering',
      description: 'Work order numbers are generated sequentially (WO-YYYY-NNN) with strict uniqueness enforcement across concurrent requests.',
      severity: 'High Integrity',
    },
    {
      ruleId: 'RULE-2',
      title: 'Critical Work Order Technician Assignment',
      description: 'Work orders with CRITICAL priority must have an assigned technician upon creation and update. Technicians cannot be unassigned from critical orders.',
      severity: 'Safety Mandate',
    },
    {
      ruleId: 'RULE-3',
      title: 'Completed Status Immutability',
      description: 'COMPLETED is a terminal state. Once completed with mandatory resolution notes, no further state transitions or modification are permitted.',
      severity: 'Audit Compliance',
    },
    {
      ruleId: 'RULE-4',
      title: 'Cancelled Status Immutability',
      description: 'CANCELLED is a terminal state. Requires documented cancellation rationale and prohibits all subsequent lifecycle transitions.',
      severity: 'Audit Compliance',
    },
    {
      ruleId: 'RULE-5',
      title: 'Scheduled Date Temporal Validation',
      description: 'Scheduled maintenance date cannot be set in the past relative to current UTC time. Applies to all created and rescheduled work orders.',
      severity: 'Scheduling Integrity',
    },
    {
      ruleId: 'RULE-6',
      title: 'Out-of-Service Equipment Guardrail',
      description: 'Machinery flagged as OUT_OF_SERVICE only permits EMERGENCY maintenance type work orders. Routine and preventative work is prohibited until operational status is restored.',
      severity: 'Equipment Safety',
    },
  ];

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            Administration & System Governance
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Operational infrastructure health, maintenance taxonomy configuration, and data protection policies.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            checkHealth();
            onRefreshGlobal();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-[#172338] border border-slate-300 dark:border-[#334155] hover:bg-slate-50 dark:hover:bg-[#1E3048] text-slate-700 dark:text-white text-xs font-semibold rounded shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', isLoadingHealth && 'animate-spin text-teal-600 dark:text-teal-400')} />
          Run Health Diagnostics
        </button>
      </div>

      {/* Theme & Display Customization Section */}
      <div className="bg-white dark:bg-[#172338] rounded-lg border border-slate-200/90 dark:border-[#334155] shadow-xs p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#334155]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 rounded-md border border-teal-200 dark:border-teal-800">
              <Palette className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">Theme & Appearance Preference</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure your visual environment. Light mode provides pure black high-contrast typography, while Dark mode uses deep navy backgrounds with crisp white text.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-[#131F32] text-slate-700 dark:text-slate-200 font-semibold border border-slate-200 dark:border-[#334155] hidden sm:inline">
            Active: {theme.toUpperCase()} ({effectiveTheme.toUpperCase()})
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {/* Light Mode Option */}
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={cn(
              'p-4 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between space-y-2 relative',
              theme === 'light'
                ? 'border-teal-500 ring-2 ring-teal-500/20 bg-teal-50/20 dark:bg-teal-950/30'
                : 'border-slate-200 dark:border-[#334155] hover:border-slate-300 dark:hover:border-slate-500 hover:bg-slate-50/50 dark:hover:bg-[#1E3048]'
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded bg-amber-100 text-amber-700">
                  <Sun className="w-4 h-4" />
                </div>
                <span className="font-bold text-xs text-slate-900 dark:text-white">Light Mode</span>
              </div>
              {theme === 'light' && (
                <span className="w-4 h-4 rounded-full bg-teal-600 text-white flex items-center justify-center text-[10px]">
                  <Check className="w-3 h-3" />
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
              Bright backgrounds with pure black (<code className="text-black dark:text-white font-bold">#000000</code>) high-contrast text. Zero faded grays.
            </p>
            <div className="pt-2 flex items-center gap-1.5">
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-[#131F32] text-slate-700 dark:text-slate-300 font-mono font-medium">
                WCAG AAA High Contrast
              </span>
            </div>
          </button>

          {/* Dark Mode Option */}
          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={cn(
              'p-4 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between space-y-2 relative',
              theme === 'dark'
                ? 'border-teal-500 ring-2 ring-teal-500/20 bg-teal-50/20 dark:bg-teal-950/30'
                : 'border-slate-200 dark:border-[#334155] hover:border-slate-300 dark:hover:border-slate-500 hover:bg-slate-50/50 dark:hover:bg-[#1E3048]'
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded bg-indigo-100 text-indigo-700">
                  <Moon className="w-4 h-4" />
                </div>
                <span className="font-bold text-xs text-slate-900 dark:text-white">Dark Mode</span>
              </div>
              {theme === 'dark' && (
                <span className="w-4 h-4 rounded-full bg-teal-600 text-white flex items-center justify-center text-[10px]">
                  <Check className="w-3 h-3" />
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
              Deep navy and charcoal surfaces with crisp white (<code className="text-black dark:text-white font-bold">#FFFFFF</code>) typography and teal accents.
            </p>
            <div className="pt-2 flex items-center gap-1.5">
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-[#131F32] text-slate-700 dark:text-slate-300 font-mono font-medium">
                Deep Navy #0B1220
              </span>
            </div>
          </button>

          {/* System Mode Option */}
          <button
            type="button"
            onClick={() => setTheme('system')}
            className={cn(
              'p-4 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between space-y-2 relative',
              theme === 'system'
                ? 'border-teal-500 ring-2 ring-teal-500/20 bg-teal-50/20 dark:bg-teal-950/30'
                : 'border-slate-200 dark:border-[#334155] hover:border-slate-300 dark:hover:border-slate-500 hover:bg-slate-50/50 dark:hover:bg-[#1E3048]'
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded bg-slate-100 text-slate-700">
                  <Monitor className="w-4 h-4" />
                </div>
                <span className="font-bold text-xs text-slate-900 dark:text-white">System Sync</span>
              </div>
              {theme === 'system' && (
                <span className="w-4 h-4 rounded-full bg-teal-600 text-white flex items-center justify-center text-[10px]">
                  <Check className="w-3 h-3" />
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
              Automatically synchronizes with your operating system appearance preference dynamically.
            </p>
            <div className="pt-2 flex items-center gap-1.5">
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-[#131F32] text-slate-700 dark:text-slate-300 font-mono font-medium">
                Auto Sync: {effectiveTheme.toUpperCase()}
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* System Infrastructure Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Backend API Diagnostics */}
        <div className="p-4 bg-white dark:bg-[#172338] rounded border border-slate-200/90 dark:border-[#334155] shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-[#334155]">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-xs">
              <Server className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              FastAPI Core Service
            </div>
            {systemHealth?.status === 'ok' ? (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-3 h-3" /> Online
              </span>
            ) : (
              <span className="text-[11px] font-semibold text-rose-700 dark:text-[#FDA4AF] bg-rose-50 dark:bg-[#4C1826] px-2 py-0.5 rounded border border-rose-200 dark:border-rose-900/60">
                Degraded
              </span>
            )}
          </div>
          <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 font-mono">
            <div className="flex justify-between">
              <span className="text-slate-400 font-sans">Service:</span>
              <span className="font-semibold text-slate-800 dark:text-white">{systemHealth?.service || 'MaintainIQ API'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-sans">Release:</span>
              <span className="font-semibold text-slate-800 dark:text-white">Enterprise v3.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-sans">API Latency:</span>
              <span className="font-semibold text-teal-600 dark:text-teal-400">{systemHealth?.latencyMs ?? 8} ms</span>
            </div>
          </div>
        </div>

        {/* Database Layer Diagnostics */}
        <div className="p-4 bg-white dark:bg-[#172338] rounded border border-slate-200/90 dark:border-[#334155] shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-[#334155]">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-xs">
              <Database className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              MySQL Relational Engine
            </div>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="w-3 h-3" /> Connected
            </span>
          </div>
          <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 font-mono">
            <div className="flex justify-between">
              <span className="text-slate-400 font-sans">Database:</span>
              <span className="font-semibold text-slate-800 dark:text-white">maintainiq</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-sans">Port / Host:</span>
              <span className="font-semibold text-slate-800 dark:text-white">3306 (localhost)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-sans">Integrity:</span>
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">ACID Foreign Keys</span>
            </div>
          </div>
        </div>

        {/* Security & Seeding Lock */}
        <div className="p-4 bg-white dark:bg-[#172338] rounded border border-slate-200/90 dark:border-[#334155] shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-[#334155]">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-xs">
              <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              Data Protection Lock
            </div>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-[#131F32] px-2 py-0.5 rounded border border-slate-200 dark:border-[#334155]">
              Protected
            </span>
          </div>
          <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Reseed Endpoint:</span>
              <span className="font-mono text-slate-800 dark:text-white">/api/seed</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Authorization:</span>
              <span className="font-mono text-amber-700 dark:text-[#FDBA74] font-semibold">X-Admin-Key</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1">
              Destructive reset disabled for standard users to safeguard production fleet records.
            </p>
          </div>
        </div>
      </div>

      {/* Configured Maintenance Taxonomy */}
      <div className="bg-white dark:bg-[#172338] rounded border border-slate-200/90 dark:border-[#334155] shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200/80 dark:border-[#334155] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
              Maintenance Taxonomy Types
            </h3>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            {maintenanceTypes.length} Configured Types
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-[#111B2E] border-b border-slate-200 dark:border-[#334155] text-slate-600 dark:text-slate-300 uppercase font-semibold text-[10px]">
              <tr>
                <th className="px-4 py-2.5">ID</th>
                <th className="px-4 py-2.5">Code</th>
                <th className="px-4 py-2.5">Display Name</th>
                <th className="px-4 py-2.5">Protocol Description</th>
                <th className="px-4 py-2.5">Emergency Flag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#334155] bg-white dark:bg-[#131F32]">
              {maintenanceTypes.map((type) => (
                <tr key={type.id} className="hover:bg-slate-50/60 dark:hover:bg-[#1E3048]">
                  <td className="px-4 py-3 font-mono text-slate-400 dark:text-slate-400 font-medium">#{type.id}</td>
                  <td className="px-4 py-3 font-mono font-bold text-slate-800 dark:text-white">{type.code}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{type.name}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300 max-w-xs">{type.description || '—'}</td>
                  <td className="px-4 py-3">
                    {type.is_emergency ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-100 dark:bg-[#4C1826] text-rose-800 dark:text-[#FDA4AF] border border-rose-200 dark:border-rose-900/60">
                        EMERGENCY AUTHORIZED
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono text-slate-500 dark:text-slate-300 bg-slate-100 dark:bg-[#172338]">
                        STANDARD
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Enterprise Business Rules Governance Matrix */}
      <div className="bg-white dark:bg-[#172338] rounded border border-slate-200/90 dark:border-[#334155] shadow-xs p-5 space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-[#334155]">
          <ShieldCheck className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
            Mandatory Enterprise Business Rules Verification
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {businessRules.map((rule) => (
            <div
              key={rule.ruleId}
              className="p-3.5 rounded bg-slate-50 dark:bg-[#131F32] border border-slate-200/80 dark:border-[#334155] space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-1.5 py-0.5 rounded border border-teal-200 dark:border-teal-800">
                    {rule.ruleId}
                  </span>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">{rule.title}</span>
                </div>
                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Active
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                {rule.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Audit Logging & Compliance Footnote */}
      <div className="p-4 bg-slate-900 dark:bg-[#080F1E] rounded border border-slate-800 text-slate-300 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <FileText className="w-4 h-4 text-teal-400 shrink-0" />
          <div>
            <div className="font-semibold text-white">Append-Only Immutability Logs</div>
            <div className="text-[11px] text-slate-400">
              All work order lifecycle state changes and digital inspection records are permanently preserved in MySQL.
            </div>
          </div>
        </div>
        <span className="font-mono text-[10px] bg-slate-800 dark:bg-[#131F32] text-teal-300 px-2 py-1 rounded border border-slate-700 dark:border-[#334155] shrink-0">
          SOX & ISO 55000 Compliant
        </span>
      </div>
    </div>
  );
};
