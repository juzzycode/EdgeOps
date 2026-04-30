import type { ReactNode } from 'react';
import { ArrowRight, BadgePlus, LoaderCircle, Pencil, Server, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { PageHeader } from '@/components/common/PageHeader';
import { Panel } from '@/components/common/Panel';
import { StatusBadge } from '@/components/common/StatusBadge';
import { SideDrawer } from '@/components/drawers/SideDrawer';
import { api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';
import type { Site } from '@/types/models';

interface SiteFormState {
  name: string;
  address: string;
  timezone: string;
  region: string;
  fortigateName: string;
  fortigateIp: string;
  fortigateApiKey: string;
  fortigateVdom: string;
  adminUsername: string;
  adminPassword: string;
  configBackupsToKeep: '0' | '10' | '30' | '90' | 'unlimited';
  siteAlertEmailEnabled: boolean;
  siteAlertEmailRecipients: string;
}

const defaultForm: SiteFormState = {
  name: '',
  address: '',
  timezone: 'America/Chicago',
  region: 'Central',
  fortigateName: '',
  fortigateIp: '',
  fortigateApiKey: '',
  fortigateVdom: 'root',
  adminUsername: '',
  adminPassword: '',
  configBackupsToKeep: '30',
  siteAlertEmailEnabled: false,
  siteAlertEmailRecipients: '',
};

export const SitesPage = () => {
  const role = useAppStore((state) => state.role);
  const [sites, setSites] = useState<Site[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<SiteFormState>(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingSiteId, setDeletingSiteId] = useState<string | null>(null);

  const canCreateSites = role === 'super_admin';
  const canEditSites = role !== 'read_only';
  const canDeleteSites = role === 'super_admin';

  const refreshSites = async () => {
    try {
      setError(null);
      setSites(await api.getSites());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load sites.');
      setSites([]);
    }
  };

  useEffect(() => {
    refreshSites();
  }, []);

  const handleChange = (field: keyof SiteFormState, value: string | boolean) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleCreateSite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await api.createSite({
        ...form,
        fortigateVdom: form.fortigateVdom.trim() || 'root',
        configBackupsToKeep: form.configBackupsToKeep === 'unlimited' ? null : Number(form.configBackupsToKeep),
      });
      setForm(defaultForm);
      setShowWizard(false);
      await refreshSites();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to create site.');
    } finally {
      setSubmitting(false);
    }
  };

  const beginEdit = (site: Site) => {
    setEditingSite(site);
    setForm({
      name: site.name,
      address: site.address,
      timezone: site.timezone,
      region: site.region,
      fortigateName: site.fortigateName || '',
      fortigateIp: site.fortigateIp || '',
      fortigateApiKey: '',
      fortigateVdom: site.fortigateVdom || 'root',
      adminUsername: '',
      adminPassword: '',
      siteAlertEmailEnabled: Boolean(site.siteAlertEmailEnabled),
      siteAlertEmailRecipients: site.siteAlertEmailRecipients || '',
      configBackupsToKeep:
        site.configBackupsToKeep === null || site.configBackupsToKeep === undefined
          ? 'unlimited'
          : String(site.configBackupsToKeep) as SiteFormState['configBackupsToKeep'],
    });
  };

  const handleUpdateSite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingSite) return;

    setSavingEdit(true);
    setError(null);

    try {
      await api.updateSite(editingSite.id, {
        ...form,
        fortigateApiKey: form.fortigateApiKey.trim() ? form.fortigateApiKey : undefined,
        fortigateVdom: form.fortigateVdom.trim() || 'root',
        adminUsername: form.adminUsername.trim() ? form.adminUsername : undefined,
        adminPassword: form.adminPassword.trim() ? form.adminPassword : undefined,
        configBackupsToKeep: form.configBackupsToKeep === 'unlimited' ? null : Number(form.configBackupsToKeep),
      });
      setEditingSite(null);
      setForm(defaultForm);
      await refreshSites();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to update site.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteSite = async (site: Site) => {
    if (!window.confirm(`Delete site "${site.name}"? This removes it from the live site database.`)) {
      return;
    }

    setDeletingSiteId(site.id);
    setError(null);

    try {
      await api.deleteSite(site.id);
      if (editingSite?.id === site.id) {
        setEditingSite(null);
        setForm(defaultForm);
      }
      await refreshSites();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to delete site.');
    } finally {
      setDeletingSiteId(null);
    }
  };

  if (sites === null) return <LoadingState label="Loading site inventory..." />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sites"
        title="Site Management"
        description="Add FortiGate-backed sites, capture location metadata, and manage live network inventory from one place."
        actions={
          <>
            {canCreateSites ? (
              <button
                className="focus-ring inline-flex items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3 text-sm font-medium text-text transition hover:bg-soft"
                onClick={() => setShowWizard((current) => !current)}
                type="button"
              >
                <BadgePlus className="h-4 w-4" />
                {showWizard ? 'Hide Add Site' : 'Add Site'}
              </button>
            ) : null}
          </>
        }
      />

      {error ? <ErrorState title="Site API unavailable" description={error} /> : null}

      {showWizard && canCreateSites ? (
        <Panel title="Add Site Wizard" subtitle="Create a site, store its metadata, and connect it to a FortiGate for live summary polling.">
          <form className="grid gap-4 lg:grid-cols-2" onSubmit={handleCreateSite}>
            <Field label="Site Name" required>
              <input className={inputClassName} onChange={(event) => handleChange('name', event.target.value)} placeholder="Denver Branch" value={form.name} />
            </Field>
            <Field label="Timezone" required>
              <input className={inputClassName} onChange={(event) => handleChange('timezone', event.target.value)} placeholder="America/Denver" value={form.timezone} />
            </Field>
            <Field className="lg:col-span-2" label="Address" required>
              <input className={inputClassName} onChange={(event) => handleChange('address', event.target.value)} placeholder="1801 California St, Denver, CO" value={form.address} />
            </Field>
            <Field label="Region" required>
              <select className={inputClassName} onChange={(event) => handleChange('region', event.target.value)} value={form.region}>
                <option>Central</option>
                <option>East</option>
                <option>Mountain</option>
                <option>West</option>
                <option>International</option>
              </select>
            </Field>
            <Field label="FortiGate Name">
              <input className={inputClassName} onChange={(event) => handleChange('fortigateName', event.target.value)} placeholder="DEN-BRANCH-FGT" value={form.fortigateName} />
            </Field>
            <Field label="FortiGate IP">
              <input className={inputClassName} onChange={(event) => handleChange('fortigateIp', event.target.value)} placeholder="192.0.2.14 or 192.0.2.14:8443" value={form.fortigateIp} />
            </Field>
            <Field label="FortiGate API Key">
              <input className={inputClassName} onChange={(event) => handleChange('fortigateApiKey', event.target.value)} placeholder="Paste the FortiGate REST API key" type="password" value={form.fortigateApiKey} />
            </Field>
            <Field label="VDOM">
              <input className={inputClassName} onChange={(event) => handleChange('fortigateVdom', event.target.value)} placeholder="root" value={form.fortigateVdom} />
            </Field>
            <Field label="Admin Username">
              <input className={inputClassName} onChange={(event) => handleChange('adminUsername', event.target.value)} placeholder="Optional local admin reference" value={form.adminUsername} />
            </Field>
            <Field label="Admin Password">
              <input className={inputClassName} onChange={(event) => handleChange('adminPassword', event.target.value)} placeholder="Optional local admin reference" type="password" value={form.adminPassword} />
            </Field>
            <Field className="lg:col-span-2" label="Config Backups To Keep">
              <div className="rounded-2xl border border-border bg-soft px-4 py-3">
                <select className={inputClassName} onChange={(event) => handleChange('configBackupsToKeep', event.target.value)} value={form.configBackupsToKeep}>
                  <option value="0">0 - Disable completely</option>
                  <option value="10">10</option>
                  <option value="30">30</option>
                  <option value="90">90</option>
                  <option value="unlimited">Unlimited</option>
                </select>
                <p className="mt-2 text-sm text-muted">Controls daily FortiGate config backups and how many archived snapshots are retained for this site.</p>
              </div>
            </Field>
            <Field className="lg:col-span-2" label="Site Alert Email">
              <div className="space-y-3 rounded-2xl border border-border bg-soft px-4 py-3">
                <label className="flex items-center justify-between gap-4 text-sm text-text">
                  <span>Email if this site fails the scheduled healthcheck and 2 retries</span>
                  <input
                    checked={form.siteAlertEmailEnabled}
                    className="h-5 w-5 rounded border-border bg-soft text-accent focus:ring-accent"
                    onChange={(event) => handleChange('siteAlertEmailEnabled', event.target.checked)}
                    type="checkbox"
                  />
                </label>
                <textarea
                  className={`${inputClassName} min-h-24 resize-y`}
                  onChange={(event) => handleChange('siteAlertEmailRecipients', event.target.value)}
                  placeholder="noc@example.com, admin@example.com"
                  value={form.siteAlertEmailRecipients}
                />
                <p className="text-sm text-muted">Separate multiple recipients with commas, semicolons, or new lines. Delivery is capped at 4 emails every 30 minutes across all sites.</p>
              </div>
            </Field>
            <div className="lg:col-span-2 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-soft px-4 py-3">
              <p className="text-sm text-muted">
                A shorthand site id such as <span className="font-semibold text-text">site-den</span> is generated automatically from the site name.
              </p>
              <button
                className="focus-ring inline-flex items-center gap-2 rounded-2xl bg-accent px-4 py-3 text-sm font-medium text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={submitting}
                type="submit"
              >
                {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Server className="h-4 w-4" />}
                Save Site
              </button>
            </div>
          </form>
        </Panel>
      ) : null}

      {!sites.length ? (
        <EmptyState
          title="No sites configured yet"
          description="Use Add Site to connect a FortiGate-backed location and start polling live inventory."
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <SummaryCard label="Configured Sites" value={String((sites ?? []).length)} hint="Using configured FortiGate metadata" />
            <SummaryCard
              label="Reachable APIs"
              value={String((sites ?? []).filter((site) => site.apiReachable).length)}
              hint="Sites with a successful FortiGate poll"
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {sites.map((site) => (
              <Panel key={site.id} className="flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-semibold text-text">{site.name}</h3>
                      <span className="rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                        {site.shorthandId ?? 'pending'}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-muted">{site.address}</p>
                  </div>
                  <StatusBadge value={site.status} />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {canEditSites ? (
                    <button className="focus-ring inline-flex items-center gap-2 rounded-2xl border border-border bg-surface px-3 py-2 text-sm text-text hover:bg-soft" onClick={() => beginEdit(site)} type="button">
                      <Pencil className="h-4 w-4" />
                      Edit
                    </button>
                  ) : null}
                  {canDeleteSites ? (
                    <button className="focus-ring inline-flex items-center gap-2 rounded-2xl border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger hover:bg-danger/15 disabled:opacity-60" disabled={deletingSiteId === site.id} onClick={() => handleDeleteSite(site)} type="button">
                      {deletingSiteId === site.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      Delete
                    </button>
                  ) : null}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <MiniStat label="Switches" value={site.switchCount} />
                  <MiniStat label="APs" value={site.apCount} />
                  <MiniStat label="Clients" value={site.clientCount} />
                </div>

                <div className="mt-4 space-y-3 rounded-3xl bg-soft p-4 text-sm">
                  <DetailRow label="FortiGate" value={site.fortigateName || 'Not named yet'} />
                  <DetailRow label="IP" value={site.fortigateIp || 'Not configured'} />
                  <DetailRow label="VDOM" value={site.fortigateVdom || 'root'} />
                  <DetailRow label="WAN IP" value={site.wanIp || 'Unavailable'} />
                  <DetailRow label="WAN" value={site.wanStatus} />
                  <DetailRow
                    label="Config Backups"
                    value={
                      site.configBackupsToKeep === 0
                        ? 'Disabled'
                        : site.configBackupsToKeep === null || site.configBackupsToKeep === undefined
                          ? 'Unlimited'
                          : String(site.configBackupsToKeep)
                    }
                  />
                  <DetailRow label="Alert Email" value={site.siteAlertEmailEnabled ? 'Enabled' : 'Disabled'} />
                </div>

                {site.lastSyncError ? (
                  <div className="mt-4 rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
                    {site.lastSyncError}
                  </div>
                ) : null}

                <Link className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline" to={`/sites/${site.id}`}>
                  Open site
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Panel>
            ))}
          </div>
        </>
      )}

      <SideDrawer
        open={Boolean(editingSite)}
        title={editingSite ? `Edit ${editingSite.name}` : ''}
        subtitle="Update site metadata or FortiGate connection settings without touching the SQLite file directly."
        onClose={() => {
          setEditingSite(null);
          setForm(defaultForm);
        }}
      >
        {editingSite ? (
          <form className="grid gap-4" onSubmit={handleUpdateSite}>
            <Field label="Site Name" required>
              <input className={inputClassName} onChange={(event) => handleChange('name', event.target.value)} value={form.name} />
            </Field>
            <Field label="Address" required>
              <input className={inputClassName} onChange={(event) => handleChange('address', event.target.value)} value={form.address} />
            </Field>
            <Field label="Timezone" required>
              <input className={inputClassName} onChange={(event) => handleChange('timezone', event.target.value)} value={form.timezone} />
            </Field>
            <Field label="Region" required>
              <select className={inputClassName} onChange={(event) => handleChange('region', event.target.value)} value={form.region}>
                <option>Central</option>
                <option>East</option>
                <option>Mountain</option>
                <option>West</option>
                <option>International</option>
              </select>
            </Field>
            <Field label="FortiGate Name">
              <input className={inputClassName} onChange={(event) => handleChange('fortigateName', event.target.value)} value={form.fortigateName} />
            </Field>
            <Field label="FortiGate IP">
              <input className={inputClassName} onChange={(event) => handleChange('fortigateIp', event.target.value)} placeholder="192.0.2.14 or 192.0.2.14:8443" value={form.fortigateIp} />
            </Field>
            <Field label="FortiGate API Key">
              <input className={inputClassName} onChange={(event) => handleChange('fortigateApiKey', event.target.value)} placeholder="Leave blank to keep the current key" type="password" value={form.fortigateApiKey} />
            </Field>
            <Field label="VDOM">
              <input className={inputClassName} onChange={(event) => handleChange('fortigateVdom', event.target.value)} placeholder="root" value={form.fortigateVdom} />
            </Field>
            <Field label="Admin Username">
              <input className={inputClassName} onChange={(event) => handleChange('adminUsername', event.target.value)} placeholder="Optional future SSH/CLI use" value={form.adminUsername} />
            </Field>
            <Field label="Admin Password">
              <input className={inputClassName} onChange={(event) => handleChange('adminPassword', event.target.value)} placeholder="Optional future SSH/CLI use" type="password" value={form.adminPassword} />
            </Field>
            <Field label="Config Backups To Keep">
              <div className="rounded-2xl border border-border bg-soft px-4 py-3">
                <select className={inputClassName} onChange={(event) => handleChange('configBackupsToKeep', event.target.value)} value={form.configBackupsToKeep}>
                  <option value="0">0 - Disable completely</option>
                  <option value="10">10</option>
                  <option value="30">30</option>
                  <option value="90">90</option>
                  <option value="unlimited">Unlimited</option>
                </select>
                <p className="mt-2 text-sm text-muted">Set how many daily snapshots to retain. Choosing 0 disables config backup and removes archived snapshots for this site.</p>
              </div>
            </Field>
            <Field label="Site Alert Email">
              <div className="space-y-3 rounded-2xl border border-border bg-soft px-4 py-3">
                <label className="flex items-center justify-between gap-4 text-sm text-text">
                  <span>Email if this site fails the scheduled healthcheck and 2 retries</span>
                  <input
                    checked={form.siteAlertEmailEnabled}
                    className="h-5 w-5 rounded border-border bg-soft text-accent focus:ring-accent"
                    onChange={(event) => handleChange('siteAlertEmailEnabled', event.target.checked)}
                    type="checkbox"
                  />
                </label>
                <textarea
                  className={`${inputClassName} min-h-24 resize-y`}
                  onChange={(event) => handleChange('siteAlertEmailRecipients', event.target.value)}
                  placeholder="noc@example.com, admin@example.com"
                  value={form.siteAlertEmailRecipients}
                />
                <p className="text-sm text-muted">Send one down email after the healthcheck and both retries fail, then one recovery email when the site responds again.</p>
              </div>
            </Field>
            <div className="rounded-2xl bg-soft px-4 py-3 text-sm text-muted">
              The generated shorthand id stays stable after creation so links and device ids do not churn when you rename a site.
            </div>
            <button className="focus-ring inline-flex items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3 text-sm font-medium text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70" disabled={savingEdit} type="submit">
              {savingEdit ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
              Save Changes
            </button>
          </form>
        ) : null}
      </SideDrawer>
    </div>
  );
};

const inputClassName =
  'focus-ring w-full rounded-2xl border border-border bg-soft px-4 py-3 text-sm text-text placeholder:text-muted';

const Field = ({
  children,
  label,
  required,
  className = '',
}: {
  children: ReactNode;
  label: string;
  required?: boolean;
  className?: string;
}) => (
  <label className={className}>
    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">
      {label}
      {required ? ' *' : ''}
    </span>
    {children}
  </label>
);

const SummaryCard = ({ label, value, hint }: { label: string; value: string; hint: string }) => (
  <Panel>
    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">{label}</p>
    <p className="mt-3 text-3xl font-semibold text-text">{value}</p>
    <p className="mt-2 text-sm text-muted">{hint}</p>
  </Panel>
);

const MiniStat = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-2xl bg-surface px-4 py-3">
    <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
    <p className="mt-2 text-xl font-semibold text-text">{value}</p>
  </div>
);

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between gap-4">
    <span className="text-muted">{label}</span>
    <span className="text-right font-medium capitalize text-text">{value}</span>
  </div>
);
