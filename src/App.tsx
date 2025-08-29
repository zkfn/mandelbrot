import GridViewer from "@comp/GridViewer";

function App() {
	return (
		<GridViewer
			plane={{
				center: [-0.5, 0],
				side: 4,
			}}
		/>
	);
}

export default App;
