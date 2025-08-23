import GridViewer from "./GridViewer";

function App() {
	return (
		<GridViewer
			cplaneBounds={{
				maxX: +2,
				minX: -2,
				maxY: +2,
				minY: -2,
			}}
		/>
	);
}

export default App;
