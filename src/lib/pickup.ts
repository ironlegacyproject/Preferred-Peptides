import "server-only";

/**
 * The pickup address is kept on the server and only shown on a customer's own
 * order page after they've sent an order request. It never appears on public pages.
 */
export const PICKUP_ADDRESS = process.env.PICKUP_ADDRESS || "21318 Hwy 30, Filer, ID";

export const pickupMapUrl = () =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(PICKUP_ADDRESS)}`;
