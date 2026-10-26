// utils/createDefaultMetadata.js
const normalizeOptions = (options = []) =>
    options.map((opt) =>
      typeof opt === 'string' ? { value: opt, price: 0 } : opt,
    );
  
  const createDefaultMetadata = (formFields = [], priceCalculation = { type: 'fixed' }) => ({
    formFields: formFields.map((f) => ({
      ...f,
      ...(f.options && { options: normalizeOptions(f.options) }),
    })),
    priceCalculation,
  });
  
  module.exports = createDefaultMetadata;