import 'server-only'

// Server-only secrets. Importing this file from a client component fails the build.
function optional(name: string) {
  return process.env[name]?.trim() || undefined
}

export const serverEnv = {
  serviceRoleKey: optional('SUPABASE_SERVICE_ROLE_KEY'),
  mpesa: {
    env: (optional('MPESA_ENV') ?? 'mock') as 'mock' | 'sandbox' | 'production',
    allowMockInProduction: optional('MPESA_ALLOW_MOCK') === 'true',
    consumerKey: optional('MPESA_CONSUMER_KEY'),
    consumerSecret: optional('MPESA_CONSUMER_SECRET'),
    shortcode: optional('MPESA_SHORTCODE'),
    passkey: optional('MPESA_PASSKEY'),
    transactionType: (optional('MPESA_TRANSACTION_TYPE') ?? 'CustomerPayBillOnline') as
      | 'CustomerPayBillOnline'
      | 'CustomerBuyGoodsOnline',
    partyB: optional('MPESA_PARTY_B'),
    callbackUrl: optional('MPESA_CALLBACK_URL'),
    callbackSecret: optional('MPESA_CALLBACK_SECRET'),
  },
  email: {
    provider: (optional('EMAIL_PROVIDER') ?? 'log') as 'log' | 'resend' | 'smtp',
    apiKey: optional('EMAIL_API_KEY'),
    // EMAIL_PROVIDER=smtp: send through a mailbox (for example the orders mailbox itself).
    smtp: {
      host: optional('SMTP_HOST'),
      port: Number(optional('SMTP_PORT') ?? 465),
      user: optional('SMTP_USER'),
      password: optional('SMTP_PASSWORD'),
    },
    from: optional('EMAIL_FROM') ?? 'CISS Solutions <orders@cisssolutions.co.ke>',
    // The orders mailbox: every new-order alert goes here, and customers' replies too.
    orders: optional('ORDERS_EMAIL') ?? 'orders@cisssolutions.co.ke',
    adminAlerts: (optional('ADMIN_ALERT_EMAILS') ?? '').split(',').map((s) => s.trim()).filter((s) => s.includes('@')),
  },
  google: {
    clientId: optional('GOOGLE_CLIENT_ID'),
    clientSecret: optional('GOOGLE_CLIENT_SECRET'),
  },
  cronSecret: optional('CRON_SECRET'),
}
