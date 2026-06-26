// Tiny vanilla-JS islands: refresh, client-side table sort + filter. No deps.
(function () {
  const refresh = document.getElementById('refresh');
  if (refresh) refresh.addEventListener('click', () => location.reload());

  // sortable tables
  document.querySelectorAll('table.sortable').forEach((tbl) => {
    tbl.querySelectorAll('th[data-k]').forEach((th, col) => {
      th.addEventListener('click', () => {
        const tb = tbl.tBodies[0];
        const rows = [...tb.rows];
        const dir = th.dataset.dir === 'asc' ? -1 : 1;
        th.dataset.dir = dir === 1 ? 'asc' : 'desc';
        const numOf = (s) => parseFloat(String(s).replace(/[^0-9.\-]/g, ''));
        rows.sort((a, b) => {
          const x = a.cells[col].textContent.trim();
          const y = b.cells[col].textContent.trim();
          const nx = numOf(x);
          const ny = numOf(y);
          const both = !isNaN(nx) && !isNaN(ny) && x !== '' && y !== '';
          return both ? (nx - ny) * dir : x.localeCompare(y) * dir;
        });
        rows.forEach((r) => tb.appendChild(r));
      });
    });
  });

  // live filter inputs
  document.querySelectorAll('input.filter').forEach((inp) => {
    inp.addEventListener('input', () => {
      const tbl = document.getElementById(inp.dataset.target);
      if (!tbl) return;
      const q = inp.value.toLowerCase();
      [...tbl.tBodies[0].rows].forEach((r) => {
        r.style.display = r.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    });
  });
})();
