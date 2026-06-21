import { useState, useEffect, useRef } from 'react';

export function useCountUp(target, duration = 900) {
    const [value, setValue] = useState(0);
    const prev = useRef(0);

    useEffect(() => {
        const start = prev.current;
        const end   = Number(target) || 0;
        if (start === end) return;

        const startTime = performance.now();
        const step = (now) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // ease-out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            setValue(Math.round(start + (end - start) * eased));
            if (progress < 1) requestAnimationFrame(step);
            else prev.current = end;
        };
        requestAnimationFrame(step);
    }, [target, duration]);

    return value;
}
