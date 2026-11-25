(() => {
  const root = document.documentElement;
  const allowed = ['auto', 'light', 'dark'];
  let stored;
  try {
    stored = localStorage.getItem('autuswing-appearance');
    if (!stored) {
      const legacy = localStorage.getItem('sunna-appearance');
      if (allowed.includes(legacy)) { stored = legacy; localStorage.setItem('autuswing-appearance', legacy); }
    }
  } catch {}
  const mode = allowed.includes(stored) ? stored : (allowed.includes(root.dataset.mode) ? root.dataset.mode : 'auto');
  root.dataset.mode = mode;
  root.dataset.theme = mode === 'auto' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : mode;
})();
