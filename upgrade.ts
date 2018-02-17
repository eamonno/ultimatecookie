class NewUpgrade {
	readonly modifier: NewModifier

	constructor(public sim: BaseSimulator, public name: string, components: NewModifier.Component[]) {
		this.modifier = new NewModifier(sim, components);
	}
}
