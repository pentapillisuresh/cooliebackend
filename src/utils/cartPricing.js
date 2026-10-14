const GST_RATE = 0.18;

/** Compute unit price for a cart line from a Service row. */
const calculateUnitPrice = (service, details = {}) => {
  const calc = service?.metadata?.priceCalculation || { type: 'fixed' };
  const base = parseFloat(service?.basePrice || 0);

  if (calc.type === 'fixed') return base;

  // Example: per-unit pricing keyed off a form field (e.g. bathrooms)
  if (calc.type === 'per_unit' && calc.field) {
    const n = parseInt(details[calc.field], 10) || 1;
    return base * n;
  }

  // Example: base + hourly
  if (calc.type === 'hourly') {
    const hours = parseFloat(details.hours) || 1;
    return base + (parseFloat(calc.hourlyRate) || 0) * hours;
  }

  return base;
};

/** Recompute and persist cart totals from its items. */
const recalcCartTotals = (cart, items) => {
  const subtotal = items.reduce(
    (sum, it) => sum + parseFloat(it.lineTotal || 0),
    0,
  );

  const discount = parseFloat(cart.discountAmount || 0);
  const taxable = Math.max(0, subtotal - discount);
  const gst = +(taxable * GST_RATE).toFixed(2);
  const convenience = parseFloat(cart.convenienceCharges || 0);
  const total = +(taxable + gst + convenience).toFixed(2);

  return {
    subtotal: +subtotal.toFixed(2),
    gstAmount: gst,
    totalAmount: total,
  };
};

module.exports = { calculateUnitPrice, recalcCartTotals, GST_RATE };