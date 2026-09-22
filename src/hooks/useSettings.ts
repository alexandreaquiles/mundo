import { useCallback, useEffect, useState } from 'react';
import { setSoundEnabled } from '../audio/sfx';

const KEY_SOUND = 'mundo:sound';
const KEY_NAME = 'mundo:name';

/** localStorage pode lançar em janela anônima; nunca deixe isso derrubar o jogo. */
function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* sem persistência, o jogo segue igual */
  }
}

export function useSettings() {
  const [sound, setSound] = useState(() => read(KEY_SOUND) !== 'off');
  const [reducedMotion, setReducedMotion] = useState(
    () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    setSoundEnabled(sound);
    write(KEY_SOUND, sound ? 'on' : 'off');
  }, [sound]);

  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return {
    sound,
    toggleSound: useCallback(() => setSound((s) => !s), []),
    reducedMotion,
    rememberedName: read(KEY_NAME) ?? '',
    rememberName: useCallback((name: string) => write(KEY_NAME, name), []),
  };
}
