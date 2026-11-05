(() => {
  const loading = document.getElementById('loading');
  function failure() {
    loading.replaceChildren();
    const message = document.createElement('p');
    message.setAttribute('role', 'alert');
    message.textContent = 'Não foi possível iniciar o Dashboard. Verifique se o servidor local está ativo e tente novamente.';
    const retry = document.createElement('button');
    retry.id = 'retry';
    retry.textContent = 'Tentar novamente';
    retry.onclick = () => location.reload();
    loading.append(message, retry);
  }
  const timer = setTimeout(failure, 15000);
  import('./app.mjs').then(module => {
    clearTimeout(timer);
    return module.init();
  }).catch(() => {
    clearTimeout(timer);
    failure();
  });
})();
