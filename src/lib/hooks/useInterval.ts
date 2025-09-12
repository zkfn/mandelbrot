import { useEffect } from "react";

const useInterval = (
	fn: () => void,
	timeout: number,
	dependencyList: any[],
) => {
	useEffect(() => {
		const id = setInterval(fn, timeout);
		return () => clearInterval(id);
	}, dependencyList);
};

export default useInterval;
