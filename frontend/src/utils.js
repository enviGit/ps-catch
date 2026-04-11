export const REGIONS = {
  US: { label: "USD (United States)", currency: "USD", maxSlider: 150, step: 1 },
  GB: { label: "GBP (United Kingdom)", currency: "GBP", maxSlider: 120, step: 1 },
  DE: { label: "EUR (Europe)", currency: "EUR", maxSlider: 150, step: 1 },
  PL: { label: "PLN (Poland)", currency: "PLN", maxSlider: 500, step: 5 },
};

export const ALPHABET = ["All", "#", ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i))];

export const parsePrice = (priceStr) => {
  if (!priceStr || priceStr === "Free" || priceStr === "Bezpłatne") return 0;
  const numStr = priceStr.replace(/[^0-9,.]/g, "").replace(",", ".");
  return parseFloat(numStr) || 0;
};

export const calculateDiscount = (basePrice, currentPrice) => {
  if (basePrice === 0 || basePrice === currentPrice) return 0;
  return Math.round((1 - currentPrice / basePrice) * 100);
};

export const getSortPriority = (title) => {
  const cleanTitle = title.replace(/^['"\[\]\s\-]+/, ''); 
  const firstChar = cleanTitle.charAt(0).toUpperCase();
  if (/[A-Z]/.test(firstChar)) return 1;
  if (/[0-9]/.test(firstChar)) return 2;
  return 3;
};

export const customSort = (gamesList) => {
  return gamesList.sort((a, b) => {
    const priorityA = getSortPriority(a.title);
    const priorityB = getSortPriority(b.title);
    
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    
    const cleanA = a.title.replace(/^['"\[\]\s\-]+/, '');
    const cleanB = b.title.replace(/^['"\[\]\s\-]+/, '');
    return cleanA.localeCompare(cleanB);
  });
};