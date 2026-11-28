import { useEffect, useMemo, useState } from 'react';
import { createGyro } from '../../powercards/power-card.js';
import { Button } from '../ui.tsx';

/** Phone motion tilt for the holo cards. Only on touch devices; must start from a tap (iOS asks permission). */
export function GyroButton() {
  const [on, setOn] = useState(false);
  const [msg, setMsg] = useState('');
  const gyro = useMemo(() => createGyro({ onChange: setOn, onMessage: setMsg }), []);
  useEffect(() => () => gyro.stop(), [gyro]);
  if (!gyro.supported) return null;
  return (
    <div className="space-y-1">
      <Button size="sm" variant={on ? 'gold' : 'secondary'} onClick={gyro.toggle}>
        {on ? 'Motion tilt: on' : 'Enable motion tilt'}
      </Button>
      {msg && <p className="text-xs text-text-muted">{msg}</p>}
    </div>
  );
}

export const ICON_CREDIT = 'Icons: game-icons.net (CC BY 3.0)';
