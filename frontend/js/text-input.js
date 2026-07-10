/**
 * Composition-safe input binding.
 *
 * Voice-to-text (speech input) and IME keyboards emit `input` events during an
 * active composition session. Reacting to those mid-composition (e.g. autosave
 * reading .value repeatedly) can cause duplicated/"doubled" text. This helper
 * only commits AFTER a composition ends, never mutates the element value, and
 * debounces plain keyboard input.
 *
 * Use for every editable text field in the app.
 */
export function bindComposableInput(el, { onCommit, delay = 400 } = {}) {
  if (!el || typeof onCommit !== 'function') return () => {};

  let composing = false;
  let timer = null;

  const cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const commit = () => {
    cancel();
    onCommit();
  };

  const schedule = () => {
    cancel();
    timer = setTimeout(commit, delay);
  };

  const onCompositionStart = () => {
    composing = true;
  };
  const onCompositionEnd = () => {
    composing = false;
    // Let the browser finish inserting the composed text first.
    schedule();
  };
  const onInput = (event) => {
    if (composing || event.isComposing) return;
    schedule();
  };
  const onBlur = () => {
    composing = false;
    commit();
  };

  el.addEventListener('compositionstart', onCompositionStart);
  el.addEventListener('compositionend', onCompositionEnd);
  el.addEventListener('input', onInput);
  el.addEventListener('blur', onBlur);

  return () => {
    cancel();
    el.removeEventListener('compositionstart', onCompositionStart);
    el.removeEventListener('compositionend', onCompositionEnd);
    el.removeEventListener('input', onInput);
    el.removeEventListener('blur', onBlur);
  };
}
