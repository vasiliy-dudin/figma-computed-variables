import { UI } from "@common/networkSides";
import { UI_CHANNEL } from "@ui/app.network";
import { Networker } from "monorepo-networker";
import { render } from "preact";
import { h } from "preact";
import "./styles.css";

async function bootstrap() {
	Networker.initialize(UI, UI_CHANNEL);

	const App = (await import("./app")).default;

	const rootElement = document.getElementById("root") as HTMLElement;

	render(<App />, rootElement);
}

bootstrap();
