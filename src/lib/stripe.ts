import Stripe from "stripe";

let client: Stripe | null = null;

export const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY);

export function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY in your environment.");
  }
  if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY, { typescript: true });
  return client;
}

export const automaticTaxEnabled = process.env.STRIPE_AUTOMATIC_TAX === "true";

export const shippingCountries = (process.env.SHIPPING_COUNTRIES || "US")
  .split(",")
  .map((c) => c.trim().toUpperCase())
  .filter(Boolean) as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[];
