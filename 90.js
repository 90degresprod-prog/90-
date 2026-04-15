// ═══ 90° — Shared JavaScript ═══

// ═══ EASTER EGG — tape "90" au clavier ═══
(function() {
  var flash = document.getElementById('easterFlash');
  var text = document.getElementById('easterText');
  if (!flash || !text) return;
  
  var buffer = '';
  var timeout;
  
  document.addEventListener('keydown', function(e) {
    buffer += e.key;
    clearTimeout(timeout);
    timeout = setTimeout(function() { buffer = ''; }, 1500);
    
    if (buffer.indexOf('90') !== -1) {
      buffer = '';
      flash.classList.remove('active');
      void flash.offsetWidth;
      flash.classList.add('active');
      text.classList.remove('active');
      void text.offsetWidth;
      text.classList.add('active');
      setTimeout(function() {
        flash.classList.remove('active');
        text.classList.remove('active');
      }, 1500);
    }
  });
})();
