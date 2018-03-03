/// <reference path="modifier.ts" />

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

//
// PurchaseChain
//
// Looking ahead multiple purchases can give better results. This class is designed to represent
// those chains of purchases.
//

class PurchaseChain extends Purchase {
	constructor(sim: Simulator, public purchases: Purchase[]) {
		super(sim, purchases.map(p => p.name).join(" -> "));
	}

	get isAvailable(): boolean {
		return this.purchases.every(p => p.isAvailable);
	}

	apply(): void {
		for (let i = 0; i < this.purchases.length; ++i) {
			this.purchases[i].apply();
		}
	}

	revoke(): void {
		for (let i = this.purchases.length - 1; i >= 0; --i) {
			this.purchases[i].revoke();
		}
	}

	get longName(): string {
		return this.purchases.map(p => p.longName).join(" -> ");
	}

	get purchaseTime(): number {
		let time: number = 0;
		for (var i = 0; i < this.purchases.length; ++i) {
			time += this.purchases[i].purchaseTime;
			this.purchases[i].apply();
		}
		this.revoke();
		return time;
	}

	purchase(): void {
		console.log("Attempt to buy a PurchaseChain");
	}

	get price(): number {
		let price = 0;
		for (let i = 0; i < this.purchases.length; ++i) {
			price += this.purchases[i].price;
			this.purchases[i].apply();
		}
		this.revoke();
		return price;
	}
}

