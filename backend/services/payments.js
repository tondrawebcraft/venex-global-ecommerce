import Payment from '../models/Payment.js';

export function isProviderConfigured(provider) {
  if (provider === 'sslcommerz') return Boolean(process.env.SSLCOMMERZ_STORE_ID && process.env.SSLCOMMERZ_STORE_PASSWORD);
  if (provider === 'bkash') return Boolean(process.env.BKASH_APP_KEY && process.env.BKASH_APP_SECRET && process.env.BKASH_USERNAME && process.env.BKASH_PASSWORD);
  if (provider === 'nagad') return Boolean(process.env.NAGAD_MERCHANT_ID && process.env.NAGAD_MERCHANT_PRIVATE_KEY);
  return provider === 'cod';
}

export async function preparePayment(order, session) {
  const provider = order.paymentMethod;
  const [payment] = await Payment.create([{ order: order._id, provider, amount: order.total, status: provider === 'cod' ? 'pending' : 'initiated' }], session ? { session } : undefined);
  if (provider === 'cod') return { payment, activationRequired: false, message: 'Cash on delivery selected.' };
  if (!isProviderConfigured(provider)) return { payment, activationRequired: true, message: `${provider} is pending merchant credential setup. No payment was taken.` };
  // Provider calls are intentionally unavailable until merchant callback URLs and signing keys are configured.
  return { payment, activationRequired: true, message: `${provider} credentials are present, but verified gateway callbacks must be configured before activation.` };
}

