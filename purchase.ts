//
// Purchases.
//
// Purchases are a subtype of modifier that can be bought in the game. They provide
// information about costing that can be used to prioritise what to buy next.
//

abstract class Purchase extends Modifier {
	constructor(sim: Simulator, name: string) {
		super(sim, name);
	}

	abstract get price(): number;
	abstract purchase(): void;
	abstract get isAvailable(): boolean;

	get purchaseTime(): number {
		return this.price / this.sim.effectiveCps();
	}

	get pbr(): number {
		return this.benefit / this.price;
	}

	get pvr(): number {
		return this.value / this.price;
	}
}
