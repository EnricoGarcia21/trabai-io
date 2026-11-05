(() => {
  const top = document.querySelector('.topo');
  const filters = document.querySelector('.filtros, #filters');
  if (!top) return;
  function measure() {
    document.documentElement.style.setProperty('--altura-topo', `${top.getBoundingClientRect().height}px`);
    const height = filters && !filters.hidden && getComputedStyle(filters).position === 'sticky' ? filters.getBoundingClientRect().height : 0;
    document.documentElement.style.setProperty('--altura-filtros', `${height}px`);
  }
  const observer = new ResizeObserver(measure);
  observer.observe(top);
  if (filters) observer.observe(filters);
  window.addEventListener('resize', measure);
  measure();
})();
