import type { Property } from './properties';
export function propertyCosts(property: Property) {
  const currency = property.currency ?? 'USD';
  const expensesCurrency = property.expensesCurrency ?? currency;
  const depositCurrency = property.depositCurrency ?? currency;
  const expensesKnown = property.expenses !== undefined;
  const monthly =
    property.operation === 'Alquilar' &&
    expensesKnown &&
    expensesCurrency === currency
      ? property.price + property.expenses!
      : null;
  const entry =
    monthly !== null &&
    property.deposit !== undefined &&
    depositCurrency === currency
      ? monthly + property.deposit
      : null;
  return { currency, expensesCurrency, depositCurrency, monthly, entry };
}
