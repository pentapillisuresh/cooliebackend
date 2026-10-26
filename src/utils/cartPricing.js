const GST_RATE = 0.18;

/** Compute unit price for a cart line from a Service row. */
// utils/cartPricing.js
const findOption = (field, value) =>
  field?.options?.find((o) => (o.value ?? o) === value);

const getFieldMeta = (metadata, key) =>
  metadata?.formFields?.find((f) => f.key === key);

const calculateUnitPrice = (service, details = {}) => {
  const calc = service?.metadata?.priceCalculation || { type: 'fixed' };
  const formFields = service?.metadata?.formFields || [];
  const base = parseFloat(service?.basePrice || 0);

  const optionPrice = (key) => {
    const field = formFields.find((f) => f.key === key);
    return findOption(field, details[key])?.price ?? 0;
  };

  switch (calc.type) {
    case 'fixed':
      return calc.basePrice ?? base;

    case 'from_option':
      return optionPrice(calc.field);

    case 'per_unit':
      return (parseFloat(calc.rate) || 0) * (parseFloat(details[calc.quantityField]) || 0);

    case 'per_sqft':
    case 'per_acre':
    case 'per_hour':
      return (parseFloat(calc.rate) || 0) * (parseFloat(details[calc.areaField || calc.hoursField]) || 0);

    case 'base_plus_addon':
      return optionPrice(calc.baseField) + optionPrice(calc.addonField);

    case 'base_plus_booleans': {
      let total = optionPrice(calc.baseField);
      for (const f of formFields) {
        if (f.type === 'boolean' && details[f.key] && f.price) total += f.price;
      }
      return total;
    }

    case 'base_plus': {
      let total = optionPrice(calc.baseField);
      for (const adj of calc.adjustments || []) {
        if (adj.fromOptions) total += optionPrice(adj.field);
        if (adj.multiplier) {
          total += adj.multiplier * (parseFloat(details[adj.field]) || 0);
        }
      }
      return total;
    }

    case 'per_sqft_from_option':
    case 'per_unit_from_option':
    case 'per_hour_from_option':
    case 'per_acre_from_option': {
      const rate = optionPrice(calc.optionField);
      const qty =
        parseFloat(
          details[calc.areaField || calc.quantityField || calc.hoursField],
        ) || 0;
      return rate * qty;
    }

    default:
      return base;
  }
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