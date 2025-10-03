import { useEffect, useRef } from "react";

export const useInterval = (fn: () => void, delay: number | null) => {
	const saved = useRef(fn);

	useEffect(() => {
		saved.current = fn;
	}, [fn]);

	useEffect(() => {
		if (delay == null) return;
		const id = setInterval(() => saved.current(), delay);
		return () => clearInterval(id);
	}, [delay]);
};

export default useInterval;
