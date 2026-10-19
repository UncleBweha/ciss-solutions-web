'use client'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { CalendarClock, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { deleteOccasionAction, saveOccasionAction, setThemeOverrideAction, syncOccasionDatesAction, type OccasionInput } from '@/actions/admin/occasions'
import { Panel } from '@/components/admin/admin-ui'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/dialog'
import { Checkbox, Field, FormMessage, Input, Select } from '@/components/ui/form'
import { useToast } from '@/components/ui/toast'
import type { Occasion, OccasionDecoration, OccasionKind, ThemeOverride, ThemeOverrideMode } from '@/lib/occasions/types'
import { cn } from '@/lib/utils'

const KIND_LABELS: Record<OccasionKind, string> = {
  kenyan_national: 'Kenyan national days',
  international: 'International and seasonal',
  religious: 'Religious',
}

const DECORATION_LABELS: Record<OccasionDecoration, string> = {
  snow_lights_tree: 'Snow, lights and tree',
  fireworks_confetti: 'Fireworks and confetti',
  flag_bunting: 'Kenyan flag bunting',
  hearts: 'Floating hearts',
  flowers_hearts: 'Flowers',
  crescent_lanterns: 'Crescent moon and lanterns',
  diwali_lights: 'Diwali lamps',
  none: 'Poster only',
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const dateLabel = (m: number, d: number) => `${d} ${MONTHS[m - 1]}`

function rangeLabel(o: Occasion) {
  const single = o.startMonth === o.endMonth && o.startDay === o.endDay
  return single ? dateLabel(o.startMonth, o.startDay) : `${dateLabel(o.startMonth, o.startDay)} to ${dateLabel(o.endMonth, o.endDay)}`
}

const toInput = (o: Occasion | null): OccasionInput =>
  o
    ? {
        name: o.name,
        kind: o.kind,
        startMonth: o.startMonth,
        startDay: o.startDay,
        endMonth: o.endMonth,
        endDay: o.endDay,
        decoration: o.decoration,
        accentColor: o.accentColor,
        bannerHeadline: o.bannerHeadline,
        bannerSubhead: o.bannerSubhead,
        pickKeyword: o.pickKeyword,
        isEnabled: o.isEnabled,
        sortOrder: o.sortOrder,
      }
    : {
        name: '',
        kind: 'international',
        startMonth: 1,
        startDay: 1,
        endMonth: 1,
        endDay: 1,
        decoration: 'none',
        accentColor: '#1d6fd8',
        bannerHeadline: '',
        bannerSubhead: null,
        pickKeyword: null,
        isEnabled: true,
        sortOrder: 50,
      }

/* ---- What the store shows ------------------------------------------------- */

function ThemeControl({ occasions, override, active }: { occasions: Occasion[]; override: ThemeOverride; active: Occasion | null }) {
  const router = useRouter()
  const toast = useToast()
  const [mode, setMode] = useState<ThemeOverrideMode>(override.mode)
  const [forced, setForced] = useState(override.forcedOccasionSlug ?? '')
  const [saving, startSave] = useTransition()
  const [syncing, startSync] = useTransition()
  const dirty = mode !== override.mode || (mode === 'forced' && forced !== (override.forcedOccasionSlug ?? ''))

  const save = () =>
    startSave(async () => {
      const r = await setThemeOverrideAction(mode, mode === 'forced' ? forced : null)
      toast(r.ok ? r.message ?? 'Saved' : r.message, r.ok ? 'success' : 'error')
      if (r.ok) router.refresh()
    })

  const sync = () =>
    startSync(async () => {
      const r = await syncOccasionDatesAction()
      toast(r.ok ? r.message ?? 'Done' : r.message, r.ok ? 'success' : 'error')
      if (r.ok) router.refresh()
    })

  return (
    <Panel title="What the store is showing">
      <p className="text-sm text-fg-secondary">
        Today: <strong className="text-fg">{active ? active.name : 'no occasion (the everyday store)'}</strong>
      </p>
      <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Occasions mode">
        {(
          [
            ['auto', 'Follow the calendar'],
            ['forced', 'Show one now'],
            ['off', 'Off'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={mode === value}
            onClick={() => setMode(value)}
            className={cn(
              'h-10 rounded-full border px-4 text-sm font-semibold transition-colors',
              mode === value ? 'border-primary bg-primary/15 text-primary-light' : 'border-border text-fg-secondary hover:border-border-strong hover:text-fg',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === 'forced' ? (
        <Field label="Occasion to show every visitor" htmlFor="forced-occasion" className="mt-3 max-w-sm" hint="This is also how you preview one: it goes live for everyone straight away. Switch back to Follow the calendar when you are done.">
          <Select id="forced-occasion" value={forced} onChange={(e) => setForced(e.target.value)}>
            <option value="" disabled>
              Choose an occasion
            </option>
            {occasions
              .filter((o) => o.isEnabled)
              .map((o) => (
                <option key={o.slug} value={o.slug}>
                  {o.name}
                </option>
              ))}
          </Select>
        </Field>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button onClick={save} loading={saving} disabled={!dirty || (mode === 'forced' && !forced)}>
          Save
        </Button>
        <Button variant="glass" onClick={sync} loading={syncing}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" /> Sync movable dates now
        </Button>
      </div>
      <p className="mt-2 text-xs text-fg-muted">Easter, Ramadan, Eid, Diwali, Mazingira Day, Mother&rsquo;s and Father&rsquo;s Day re-date themselves every day; the button does it now.</p>
    </Panel>
  )
}

/* ---- Add / edit ------------------------------------------------------------- */

function OccasionDialog({ occasion, onClose }: { occasion: Occasion | 'new'; onClose: () => void }) {
  const router = useRouter()
  const toast = useToast()
  const existing = occasion === 'new' ? null : occasion
  const [input, setInput] = useState<OccasionInput>(toInput(existing))
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const set = <K extends keyof OccasionInput>(key: K, value: OccasionInput[K]) => setInput((prev) => ({ ...prev, [key]: value }))
  const autoDated = Boolean(existing?.calendarSource || existing?.dateFormula)

  const save = () =>
    start(async () => {
      setError(null)
      const r = await saveOccasionAction(existing?.slug ?? null, input)
      if (!r.ok) return setError(r.message)
      toast(r.message ?? 'Saved')
      onClose()
      router.refresh()
    })

  const monthSelect = (key: 'startMonth' | 'endMonth', label: string) => (
    <Select aria-label={label} value={String(input[key])} onChange={(e) => set(key, Number(e.target.value))}>
      {MONTHS.map((m, i) => (
        <option key={m} value={i + 1}>
          {m}
        </option>
      ))}
    </Select>
  )
  const dayInput = (key: 'startDay' | 'endDay', label: string) => (
    <Input aria-label={label} type="number" min={1} max={31} value={String(input[key])} onChange={(e) => set(key, Number(e.target.value))} />
  )

  return (
    <Modal open onClose={onClose} title={existing ? `Edit ${existing.name}` : 'Add an occasion'}>
      <div className="space-y-3">
        {error ? <FormMessage>{error}</FormMessage> : null}
        <Field label="Name" htmlFor="oc-name" required>
          <Input id="oc-name" value={input.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Boxing Day" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Kind" htmlFor="oc-kind">
            <Select id="oc-kind" value={input.kind} onChange={(e) => set('kind', e.target.value)}>
              {Object.entries(KIND_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Decoration" htmlFor="oc-decoration">
            <Select id="oc-decoration" value={input.decoration} onChange={(e) => set('decoration', e.target.value)}>
              {Object.entries(DECORATION_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-fg-secondary">Dates (every year)</legend>
          <div className="grid grid-cols-[1fr_5rem] gap-2 sm:grid-cols-[1fr_5rem_1fr_5rem]">
            {monthSelect('startMonth', 'Start month')}
            {dayInput('startDay', 'Start day')}
            {monthSelect('endMonth', 'End month')}
            {dayInput('endDay', 'End day')}
          </div>
          <p className="mt-1 text-xs text-fg-muted">
            {autoDated ? 'These dates are kept current automatically every day.' : 'For a single day, make the start and end the same.'}
          </p>
        </fieldset>
        <Field label="Banner headline" htmlFor="oc-headline" required hint="“Happy …” or “Merry …” is set in script above the rest">
          <Input id="oc-headline" value={input.bannerHeadline} onChange={(e) => set('bannerHeadline', e.target.value)} placeholder="e.g. Happy Boxing Day" maxLength={120} />
        </Field>
        <Field label="Banner message" htmlFor="oc-subhead" hint="Optional. Leave empty to use the occasion's own message.">
          <Input id="oc-subhead" value={input.bannerSubhead ?? ''} onChange={(e) => set('bannerSubhead', e.target.value || null)} maxLength={300} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Products to show first" htmlFor="oc-keyword" hint="A word in product names or categories, e.g. photo">
            <Input id="oc-keyword" value={input.pickKeyword ?? ''} onChange={(e) => set('pickKeyword', e.target.value || null)} maxLength={60} />
          </Field>
          <Field label="Accent colour" htmlFor="oc-colour">
            <div className="flex gap-2">
              <input
                type="color"
                aria-label="Accent colour picker"
                value={input.accentColor}
                onChange={(e) => set('accentColor', e.target.value)}
                className="h-11 w-14 shrink-0 cursor-pointer rounded-md border border-border bg-transparent"
              />
              <Input id="oc-colour" value={input.accentColor} onChange={(e) => set('accentColor', e.target.value)} maxLength={7} />
            </div>
          </Field>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <Field label="Priority" htmlFor="oc-sort" hint="Higher wins if two overlap" className="w-36">
            <Input id="oc-sort" type="number" value={String(input.sortOrder)} onChange={(e) => set('sortOrder', Number(e.target.value))} />
          </Field>
          <label className="mb-7 flex items-center gap-2 text-sm">
            <Checkbox checked={input.isEnabled} onChange={(e) => set('isEnabled', e.target.checked)} /> Enabled
          </label>
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={save} loading={pending} disabled={!input.name.trim() || !input.bannerHeadline.trim()}>
          {existing ? 'Save occasion' : 'Add occasion'}
        </Button>
      </div>
    </Modal>
  )
}

/* ---- The list ------------------------------------------------------------- */

export function OccasionManager({ occasions, override, active }: { occasions: Occasion[]; override: ThemeOverride; active: Occasion | null }) {
  const router = useRouter()
  const toast = useToast()
  const [editing, setEditing] = useState<Occasion | 'new' | null>(null)
  const [deleting, startDelete] = useTransition()

  const remove = (o: Occasion) => {
    if (!confirm(`Delete ${o.name}? This cannot be undone.`)) return
    startDelete(async () => {
      const r = await deleteOccasionAction(o.slug)
      toast(r.ok ? r.message ?? 'Deleted' : r.message, r.ok ? 'success' : 'error')
      if (r.ok) router.refresh()
    })
  }

  return (
    <div className="grid max-w-5xl gap-4">
      <ThemeControl occasions={occasions} override={override} active={active} />
      <Panel
        title="All occasions"
        actions={
          <Button size="sm" onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Add occasion
          </Button>
        }
      >
        <div className="space-y-5">
          {(Object.keys(KIND_LABELS) as OccasionKind[]).map((kind) => {
            const rows = occasions.filter((o) => o.kind === kind)
            if (!rows.length) return null
            return (
              <section key={kind}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">{KIND_LABELS[kind]}</h3>
                <ul className="mt-1.5 divide-y divide-border rounded-lg border border-border">
                  {rows.map((o) => (
                    <li key={o.slug} className="flex items-center gap-3 px-3 py-2.5">
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: o.accentColor }} aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 text-sm">
                          <span className={cn('font-semibold', o.isEnabled ? 'text-fg' : 'text-fg-muted line-through')}>{o.name}</span>
                          {active?.slug === o.slug ? <Badge tone="success">Showing now</Badge> : null}
                          {o.calendarSource || o.dateFormula ? (
                            <Badge>
                              <CalendarClock className="h-3 w-3" aria-hidden="true" /> Auto-dated
                            </Badge>
                          ) : null}
                        </p>
                        <p className="mt-0.5 text-xs text-fg-muted">
                          {rangeLabel(o)} · {DECORATION_LABELS[o.decoration]}
                        </p>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(o)} aria-label={`Edit ${o.name}`}>
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-danger" onClick={() => remove(o)} disabled={deleting} aria-label={`Delete ${o.name}`}>
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      </Panel>
      {editing ? <OccasionDialog occasion={editing} onClose={() => setEditing(null)} /> : null}
    </div>
  )
}
