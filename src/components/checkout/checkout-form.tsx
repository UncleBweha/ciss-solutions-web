'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { useForm, type FieldPath } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Banknote, Building2, Check, Lock, Pencil, ShoppingCart, Smartphone } from 'lucide-react'
import { placeOrderAction } from '@/actions/checkout'
import { useCart } from '@/components/cart/cart-provider'
import { OrderSummary } from '@/components/cart/order-summary'
import { useQuote } from '@/components/cart/use-quote'
import { ProductImage } from '@/components/product/product-image'
import { Button, LinkButton } from '@/components/ui/button'
import { Checkbox, Field, FormMessage, Input, Select, Textarea } from '@/components/ui/form'
import { EmptyState } from '@/components/ui/misc'
import { track } from '@/lib/analytics'
import { KENYA_COUNTIES, formatKenyanPhone } from '@/lib/ecommerce/kenya'
import { formatKES } from '@/lib/ecommerce/money'
import { checkoutFormSchema, type CheckoutFormValues } from '@/lib/validation/checkout'
import type { PaymentMethodsSettings } from '@/types/catalog'
import { cn } from '@/lib/utils'

type Zone = { name: string; counties: string[]; fee: number; isDefault: boolean; estimate: string; freeOver: number | null }
type Address = { id: string; full_name: string; phone: string; county: string; town: string; address_line: string; instructions: string | null }

const STEPS = [
  { title: 'Customer details', fields: ['fullName', 'email', 'phone'] },
  { title: 'Delivery', fields: ['county', 'town', 'address', 'instructions'] },
  { title: 'Payment', fields: ['paymentMethod', 'mpesaPhone'] },
] as const

export function CheckoutForm({
  signedIn,
  defaults,
  addresses,
  zones,
  methods,
  codCounties,
  bank,
}: {
  signedIn: boolean
  defaults: { fullName: string; email: string; phone: string }
  addresses: Address[]
  zones: Zone[]
  methods: Record<'mpesa' | 'bank_transfer' | 'cash_on_delivery' | 'card', boolean>
  codCounties: string[]
  bank: PaymentMethodsSettings['bank_transfer']
}) {
  const router = useRouter()
  const { items, ready, clear } = useCart()
  const [step, setStep] = useState(0)
  const [couponInput, setCouponInput] = useState('')
  const [coupon, setCoupon] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [placing, startPlacing] = useTransition()

  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutFormSchema),
    mode: 'onTouched',
    defaultValues: {
      fullName: defaults.fullName,
      email: defaults.email,
      phone: defaults.phone,
      county: '',
      town: '',
      address: '',
      instructions: '',
      paymentMethod: methods.mpesa ? 'mpesa' : methods.bank_transfer ? 'bank_transfer' : 'cash_on_delivery',
      mpesaPhone: defaults.phone,
      notes: '',
      saveAddress: signedIn,
    },
  })
  const { register, watch, setValue, trigger, formState, setError } = form
  const errors = formState.errors
  const county = watch('county')
  const method = watch('paymentMethod')
  const phone = watch('phone')
  const codAllowed = methods.cash_on_delivery && (!codCounties.length || codCounties.includes(county))

  const { quote, loading } = useQuote({ county: county || null, couponCode: coupon })

  useEffect(() => {
    if (ready && items.length) track('begin_checkout', { value: quote?.subtotal })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  // Keep the M-Pesa number in step with the contact number until the customer edits it.
  useEffect(() => {
    if (!form.getFieldState('mpesaPhone').isDirty) setValue('mpesaPhone', phone)
  }, [phone, setValue, form])

  useEffect(() => {
    if (method === 'cash_on_delivery' && county && !codAllowed) setValue('paymentMethod', methods.mpesa ? 'mpesa' : 'bank_transfer')
  }, [county, codAllowed, method, methods.mpesa, setValue])

  if (!ready) return <div className="skeleton h-96 rounded-[var(--radius-card)]" />
  if (!items.length) {
    return (
      <EmptyState
        icon={<ShoppingCart className="h-8 w-8" />}
        title="Your cart is empty."
        description="Add some products before checking out."
        action={<LinkButton href="/shop">Start Shopping</LinkButton>}
      />
    )
  }

  const next = async (index: number) => {
    const ok = await trigger(STEPS[index].fields as unknown as FieldPath<CheckoutFormValues>[])
    if (ok) setStep(index + 1)
  }

  const submit = form.handleSubmit((values) => {
    setServerError(null)
    track('add_payment_info', { payment_type: values.paymentMethod, value: quote?.total })
    startPlacing(async () => {
      const result = await placeOrderAction({
        ...values,
        couponCode: coupon ?? undefined,
        items: items.map(({ productId, variantId, quantity }) => ({ productId, variantId, quantity })),
      })
      if (result.ok) {
        clear()
        router.push(result.redirectTo)
        return
      }
      setServerError(result.message)
      for (const [field, message] of Object.entries(result.errors ?? {})) {
        if (field === 'couponCode') setCoupon(null)
        else setError(field as FieldPath<CheckoutFormValues>, { message })
      }
      const firstFieldStep = STEPS.findIndex((s) => s.fields.some((f) => result.errors?.[f]))
      if (firstFieldStep >= 0) setStep(firstFieldStep)
    })
  })

  const zoneForCounty = county ? zones.find((z) => z.counties.includes(county)) ?? zones.find((z) => z.isDefault) : null
  const values = watch()

  const stepHeader = (index: number) => (
    <div className="flex items-center justify-between gap-4">
      <h2 className="flex items-center gap-3 text-lg font-bold">
        <span
          className={cn(
            'grid h-8 w-8 place-items-center rounded-full text-sm',
            step > index ? 'bg-success text-white' : step === index ? 'bg-primary-strong text-white' : 'bg-surface text-fg-muted',
          )}
        >
          {step > index ? <Check className="h-4 w-4" aria-hidden="true" /> : index + 1}
        </span>
        {STEPS[index].title}
      </h2>
      {step > index ? (
        <button type="button" onClick={() => setStep(index)} className="flex items-center gap-1 text-sm font-semibold text-primary-light hover:text-fg">
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Edit
        </button>
      ) : null}
    </div>
  )

  return (
    <form onSubmit={submit} noValidate className="grid items-start gap-8 lg:grid-cols-[1fr_26rem]">
      <div className="space-y-4">
        {!signedIn ? (
          <p className="text-sm text-fg-secondary">
            Have an account?{' '}
            <Link href="/login?next=/checkout" className="font-semibold text-primary-light underline">
              Sign in
            </Link>{' '}
            for faster checkout. You can also check out as a guest.
          </p>
        ) : null}

        {/* Step 1 */}
        <section className="glass-flat rounded-[var(--radius-card)] p-5 sm:p-6" aria-current={step === 0 ? 'step' : undefined}>
          {stepHeader(0)}
          {step === 0 ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Full name" htmlFor="fullName" error={errors.fullName?.message} required className="sm:col-span-2">
                <Input id="fullName" autoComplete="name" aria-invalid={Boolean(errors.fullName)} {...register('fullName')} />
              </Field>
              <Field label="Phone number" htmlFor="phone" error={errors.phone?.message} hint="For delivery updates" required>
                <Input id="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="0712 345 678" aria-invalid={Boolean(errors.phone)} {...register('phone')} />
              </Field>
              <Field label="Email" htmlFor="email" error={errors.email?.message} hint="We send your receipt here" required>
                <Input id="email" type="email" autoComplete="email" aria-invalid={Boolean(errors.email)} {...register('email')} />
              </Field>
              <div className="sm:col-span-2">
                <Button onClick={() => next(0)}>Continue to delivery</Button>
              </div>
            </div>
          ) : step > 0 ? (
            <p className="mt-3 text-sm text-fg-secondary">
              {values.fullName} · {values.phone} · {values.email}
            </p>
          ) : null}
        </section>

        {/* Step 2 */}
        <section className="glass-flat rounded-[var(--radius-card)] p-5 sm:p-6" aria-current={step === 1 ? 'step' : undefined}>
          {stepHeader(1)}
          {step === 1 ? (
            <div className="mt-5 space-y-4">
              {addresses.length ? (
                <fieldset>
                  <legend className="mb-2 text-sm font-medium text-fg-secondary">Saved addresses</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {addresses.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => {
                          setValue('county', a.county, { shouldValidate: true })
                          setValue('town', a.town, { shouldValidate: true })
                          setValue('address', a.address_line, { shouldValidate: true })
                          setValue('instructions', a.instructions ?? '')
                          setValue('saveAddress', false)
                        }}
                        className="rounded-md border border-border p-3 text-left text-sm hover:border-primary/60"
                      >
                        <span className="font-semibold">{a.town}, {a.county}</span>
                        <span className="block text-fg-muted">{a.address_line}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="County" htmlFor="county" error={errors.county?.message} required>
                  <Select id="county" autoComplete="address-level1" aria-invalid={Boolean(errors.county)} {...register('county')}>
                    <option value="">Select county</option>
                    {KENYA_COUNTIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Town / City" htmlFor="town" error={errors.town?.message} required>
                  <Input id="town" autoComplete="address-level2" aria-invalid={Boolean(errors.town)} {...register('town')} />
                </Field>
                <Field label="Delivery address" htmlFor="address" error={errors.address?.message} hint="Building, street, floor/office and a landmark" required className="sm:col-span-2">
                  <Input id="address" autoComplete="street-address" aria-invalid={Boolean(errors.address)} {...register('address')} />
                </Field>
                <Field label="Additional instructions" htmlFor="instructions" error={errors.instructions?.message} className="sm:col-span-2">
                  <Textarea id="instructions" rows={2} className="min-h-0" placeholder="e.g. Call on arrival, gate code" {...register('instructions')} />
                </Field>
              </div>
              {zoneForCounty ? (
                <p className="rounded-md bg-primary/10 px-4 py-3 text-sm text-primary-light">
                  <strong>{zoneForCounty.name}</strong> delivery: {zoneForCounty.estimate} · {zoneForCounty.fee ? formatKES(zoneForCounty.fee) : 'Free'}
                  {zoneForCounty.freeOver ? ` (free over ${formatKES(zoneForCounty.freeOver)})` : ''}
                </p>
              ) : null}
              {signedIn ? (
                <label className="flex items-center gap-2 text-sm text-fg-secondary">
                  <Checkbox {...register('saveAddress')} /> Save this address to my account
                </label>
              ) : null}
              <Button onClick={() => next(1)}>Continue to payment</Button>
            </div>
          ) : step > 1 ? (
            <p className="mt-3 text-sm text-fg-secondary">
              {values.address}, {values.town}, {values.county}
            </p>
          ) : null}
        </section>

        {/* Step 3 */}
        <section className="glass-flat rounded-[var(--radius-card)] p-5 sm:p-6" aria-current={step === 2 ? 'step' : undefined}>
          {stepHeader(2)}
          {step === 2 ? (
            <div className="mt-5 space-y-4">
              <fieldset>
                <legend className="sr-only">Payment method</legend>
                <div className="space-y-2">
                  {methods.mpesa ? (
                    <PaymentOption value="mpesa" register={register} checked={method === 'mpesa'} icon={<Smartphone className="h-5 w-5" />} title="M-Pesa" description="Pay instantly with an STK push to your phone" />
                  ) : null}
                  {methods.bank_transfer ? (
                    <PaymentOption value="bank_transfer" register={register} checked={method === 'bank_transfer'} icon={<Building2 className="h-5 w-5" />} title="Bank transfer" description="Transfer to our account; we dispatch once funds clear" />
                  ) : null}
                  {methods.cash_on_delivery ? (
                    <PaymentOption
                      value="cash_on_delivery"
                      register={register}
                      checked={method === 'cash_on_delivery'}
                      disabled={!codAllowed}
                      icon={<Banknote className="h-5 w-5" />}
                      title="Cash on delivery"
                      description={codAllowed ? 'Pay cash or M-Pesa when your order arrives' : `Available in ${codCounties.join(', ')} only`}
                    />
                  ) : null}
                </div>
                {errors.paymentMethod ? <p className="mt-2 text-xs text-danger">{errors.paymentMethod.message}</p> : null}
              </fieldset>

              {method === 'mpesa' ? (
                <Field label="M-Pesa phone number" htmlFor="mpesaPhone" error={errors.mpesaPhone?.message} hint="You will receive a prompt on this phone to enter your M-Pesa PIN">
                  <Input id="mpesaPhone" type="tel" inputMode="tel" {...register('mpesaPhone')} />
                </Field>
              ) : null}
              {method === 'bank_transfer' ? (
                <div className="rounded-md border border-border p-4 text-sm text-fg-secondary">
                  <p className="font-semibold text-fg">Bank details are shown after you place the order.</p>
                  <p className="mt-1">{bank.instructions}</p>
                </div>
              ) : null}

              <Field label="Order notes (optional)" htmlFor="notes">
                <Textarea id="notes" rows={2} className="min-h-0" {...register('notes')} />
              </Field>
            </div>
          ) : null}
        </section>
      </div>

      <div className="space-y-4 lg:sticky lg:top-[calc(var(--header-height)+1rem)]">
        <OrderSummary
          subtotal={quote?.subtotal ?? 0}
          discount={quote?.discount ?? 0}
          deliveryFee={county && quote ? quote.deliveryFee : null}
          deliveryLabel={quote?.zone ? `${quote.zone.name} · ${quote.zone.estimate}` : null}
          total={quote?.total ?? 0}
          couponCode={quote?.coupon?.code}
          loading={loading || !quote}
        >
          <ul className="max-h-60 space-y-3 overflow-y-auto pr-1">
            {(quote?.lines ?? []).map((l) => (
              <li key={`${l.productId}:${l.variantId}`} className="flex items-center gap-3 text-sm">
                <span className="product-stage relative h-12 w-12 shrink-0 overflow-hidden rounded-lg">
                  <ProductImage src={l.imageUrl} alt="" fill sizes="48px" className="object-contain p-1" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-1 font-medium">{l.name}</span>
                  <span className="text-xs text-fg-muted">
                    {l.variantName ? `${l.variantName} · ` : ''}Qty {l.quantity}
                  </span>
                </span>
                <span className="font-semibold">{formatKES(l.lineTotal)}</span>
              </li>
            ))}
          </ul>

          <div>
            <label htmlFor="coupon" className="mb-1.5 block text-sm font-medium text-fg-secondary">
              Coupon code
            </label>
            <div className="flex gap-2">
              <Input id="coupon" value={couponInput} onChange={(e) => setCouponInput(e.target.value.toUpperCase())} placeholder="e.g. CISS10" className="h-10" />
              <Button variant="glass" size="sm" className="h-10" onClick={() => setCoupon(couponInput.trim() || null)} disabled={!couponInput.trim()}>
                Apply
              </Button>
            </div>
            {coupon && quote?.couponMessage ? (
              <p role="alert" className="mt-1.5 text-xs text-warning">
                {quote.couponMessage}
              </p>
            ) : null}
            {quote?.coupon ? (
              <p className="mt-1.5 flex items-center justify-between text-xs text-success">
                {quote.coupon.code} applied
                <button type="button" className="underline" onClick={() => { setCoupon(null); setCouponInput('') }}>
                  Remove
                </button>
              </p>
            ) : null}
          </div>

          {quote?.issues.length ? (
            <FormMessage>
              Some items changed: {quote.issues.map((i) => i.message).join(' ')}{' '}
              <Link href="/cart" className="underline">
                Review cart
              </Link>
            </FormMessage>
          ) : null}
          {serverError ? <FormMessage>{serverError}</FormMessage> : null}

          {step < 2 ? (
            <Button size="lg" className="w-full" onClick={() => next(step)}>
              Continue
            </Button>
          ) : (
            <Button type="submit" size="lg" className="w-full" loading={placing} disabled={!quote || Boolean(quote.issues.length)}>
              <Lock className="h-4 w-4" aria-hidden="true" />
              {method === 'mpesa' ? `Pay ${quote ? formatKES(quote.total) : ''} with M-Pesa` : 'Place order'}
            </Button>
          )}
          <p className="text-center text-xs text-fg-muted">
            Prices and delivery are confirmed by our server when you place the order. Contact number: {phone ? formatKenyanPhone(phone) : '—'}
          </p>
        </OrderSummary>
      </div>
    </form>
  )
}

function PaymentOption({
  value,
  register,
  checked,
  disabled,
  icon,
  title,
  description,
}: {
  value: CheckoutFormValues['paymentMethod']
  register: ReturnType<typeof useForm<CheckoutFormValues>>['register']
  checked: boolean
  disabled?: boolean
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-4 rounded-md border p-4 transition-colors',
        checked ? 'border-primary bg-primary/10' : 'border-border hover:border-border-strong',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <input type="radio" value={value} disabled={disabled} className="h-4 w-4 accent-[var(--primary)]" {...register('paymentMethod')} />
      <span className="grid h-10 w-10 place-items-center rounded-lg bg-surface text-primary-light" aria-hidden="true">
        {icon}
      </span>
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-fg-muted">{description}</span>
      </span>
    </label>
  )
}
