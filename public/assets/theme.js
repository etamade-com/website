// Set the chosen theme before CSS paints. No identifiers or analytics.
(() => {
  try {
    const value = localStorage.getItem('etamade-appearance');
    if (value === 'light' || value === 'dark') document.documentElement.dataset.theme = value;
  } catch { /* Storage is optional; the operating-system preference still works. */ }
})();
