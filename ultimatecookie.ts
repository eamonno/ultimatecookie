/// <reference path="strategy.ts" />
/// <reference path="ticker.ts" />
/// <reference path="building.ts" />

// General purpose constants
const REINDEER_DURATION = 4;				// Length a reindeer lasts before upgrades
const GOLDEN_COOKIE_DURATION = 13;			// Golden cookies last 13 seconds by default
const GOLDEN_COOKIE_MIN_INTERVAL = 60 * 5;	// Minimum time between golden cookies
const GOLDEN_COOKIE_MAX_INTERVAL = 60 * 15;	// Maximum time between golden cookies
const GOLDEN_COOKIE_AVG_INTERVAL = (GOLDEN_COOKIE_MIN_INTERVAL + GOLDEN_COOKIE_MAX_INTERVAL) / 2;
const LUCKY_COOKIE_CPS_SECONDS = 60 * 15;	// Lucky provides up to 15 minutes CpS based on bank
const LUCKY_COOKIE_FLAT_BONUS = 13;			// Lucky provides 13 additional seconds of CpS regardless
const LUCKY_COOKIE_BANK_LIMIT = 0.15;		// Lucky provides 0.15 times bank at most
const COOKIE_CHAIN_MULTIPLIER = 60 * 60 * 3;// Cookie chains cap out at 3 hours of cookies
const COOKIE_CHAIN_BANK_SCALE = 4;			// Bank needs 4 times the Cookie Chain limit to payout in full
const RESET_PAUSE_TIME = 1000;				// Time to pause so reset can complete correctly
const COOKIE_CLICKER_BIRTHDAY = new Date(2013, 7, 8);	// Used for birthday cookie

enum GrandmatriarchLevel {
	Appeased = 0,
	Awoken = 1,
	Displeased = 2,
	Angered = 3,
}

enum ModifierStatus {
	Locked = 0,
	Available = 1,
	Applied = 2
}

//
// MatchError 
//
// Simple interface for match errors. Contains a boolean indicating if a match occurred and
// a string describing the error if that happene. If there is an error a save can be added
// too for easier replication later.
//

interface MatchError {
	match: boolean
	error?: string
	save?: string
}

//
// UltimateCookie represents the app itself
//

class UltimateCookie {
	// Click rate tracking 
	clickCount: number = Game.cookieClicks;
	clickRate: number = 100;
	clickRates: number[] = [this.clickRate];
	clickRateTicker: Ticker = new Ticker(1000);

	// Purchase planning
	nextPurchase: Purchase = null;
	purchaseTicker: Ticker = new Ticker(1000);

	// Simulation and strategy
	sim: Simulator = new Simulator();
	strategy: Strategy = new Strategy("default");

	// Errors
	errors: MatchError[] = []

	constructor() {
		const AutoUpdateInterval = 1;

		this.sim.syncToGame();
		this.sim.strategy = this.strategy;

		this.nextPurchase = this.rankPurchases()[0];

		setInterval(() => this.update(), AutoUpdateInterval);
	}

	createPurchaseList(): Purchase[] {
		let purchases = [];

		// Add the buildings	
		for (let i = 0; i < this.sim.buildings.length; ++i) {
			purchases.push(this.sim.buildings[i]);
		}
		// Add the upgrades
		for (let i = 0; i < Game.UpgradesInStore.length; ++i) {
			let modifier = this.sim.getModifier(Game.UpgradesInStore[i].name);
			if (this.sim.toggles[modifier.name] == undefined) {
				// Dont consider toggles
				purchases.push(this.sim.getModifier(Game.UpgradesInStore[i].name));
			}
		}
		// Add Santa
		if (this.sim.santa.canBeLeveled) {
			purchases.push(this.sim.santa.nextLevel);
		}
		
		return purchases;
	}

	popShimmer(type: string): void {
		for (let i = 0; i < Game.shimmers.length; ++i) {
			if (Game.shimmers[i].type == type) {
				Game.shimmers[i].pop();
				return;		// Only pop one at a time since the pop func might alter the array
			}
		}
	}
	
	rankPurchases(): Purchase[] {
		// First pass, find the upgrade that offers the best price-benefit ratio
		let purchases: Purchase[] = this.createPurchaseList();
		purchases.sort(function(a, b) { return b.pvr - a.pvr; });
		
		// Second pass, find the fastest path to buying that upgrade
		let purchaseChains: PurchaseChain[] = [];
		purchaseChains[0] = new PurchaseChain(this.sim, [purchases[0]]);
		for (let i = 1; i < purchases.length; ++i) {
			purchaseChains[i] = new PurchaseChain(this.sim, [purchases[i], purchases[0]]);
		}
		purchaseChains.sort((a, b) => a.purchaseTime - b.purchaseTime);

		// Now just take the first item from each chain leaving a full ranked list of purchases
		purchases = purchaseChains.map(p => p.purchases[0]);

		// Accomodate season strategy		
		if (this.sim.season.lockedUpgrades == 0) {
			// Default to whatever the strategy prefers
			let seasonPref: string = this.strategy.preferredSeason;
			// Override for unlocking, unlock in the order valentines, christmas, halloween, easter
			if (this.strategy.unlockSeasonUpgrades) {
				if (this.sim.seasons["valentines"].lockedUpgrades > 0) {
					seasonPref = "valentines";
				} else if (this.sim.seasons["christmas"].lockedUpgrades > 0) {
					seasonPref = "christmas";
				} else if (this.sim.seasons["halloween"].lockedUpgrades > 0) {
					seasonPref = "halloween";
				} else if (this.sim.seasons["easter"].lockedUpgrades > 0) {
					seasonPref = "easter";
				}
			}
			// Now only change seasons if the season change costs less than the next purchase
			if (seasonPref != "" && Game.season != seasonPref) {
				if (this.sim.seasons[seasonPref].toggle.price <= purchases[0].price) {
					purchases.splice(0, 0, this.sim.seasons[seasonPref].toggle);
				}
			}
		}

		// Move Elder Pledge to the front if the current strategy calls for it
		let pledge: boolean = this.strategy.autoPledge;
		if (this.sim.season.name == "halloween") {
			if (this.strategy.unlockSeasonUpgrades && this.sim.season.lockedUpgrades != 0) {
				// Cant unlock halloween upgrades without popping wrinklers so dont pledge
				pledge = false;
			}
		}
		if (pledge) {
			let ep: Modifier = this.sim.modifiers["Elder Pledge"];
			let srp: Modifier = this.sim.modifiers["Sacrificial rolling pins"];
			for (let i = 0; i < Game.UpgradesInStore.length; ++i) {
				if (Game.UpgradesInStore[i].name == ep.name && Game.UpgradesInStore[i].bought == 0) {
					purchases.splice(0, 0, ep);
					for (let j = 0; j < Game.UpgradesInStore.length; ++j) {
						if (Game.UpgradesInStore[j].name == srp.name && Game.UpgradesInStore[j].bought == 0) {
							if (srp.price < ep.price)
								purchases.splice(0, 0, srp);
						}
					}
				}
			}
		}
		return purchases;
	}

	// reset(): void {
	// 	var now = new Date().getTime();
	// 	// if (upgradeFunctions.chocolateEgg.isAvailableToPurchase()) {
	// 	// 	for (var o in Game.ObjectsById) {
	// 	// 		Game.ObjectsById[o].sell(Game.ObjectsById[o].amount);
	// 	// 	}
	// 	// 	upgradeFunctions.chocolateEgg.purchase();
	// 	// }
	// 	var hcs = Game.HowMuchPrestige(Game.cookiesReset);
	// 	var resethcs = Game.HowMuchPrestige(Game.cookiesReset + Game.cookiesEarned);	
	// 	console.log("Resetting game. HCs now: " + hcs + ", HCs after reset: " + resethcs + ", time: " + now);
	// 	this.clickCount = 0;
	// 	this.sim.initialize();
	// 	this.autoBuy(RESET_PAUSE_TIME);
	// 	this.autoClick(RESET_PAUSE_TIME);
	// 	this.autoUpdate(RESET_PAUSE_TIME);
	// 	Game.Reset(1, 0);
	// }

	sortTest(): void {
		let purchases = this.rankPurchases();
		
		for (let i = 0; i < purchases.length; ++i) {
			console.log("" + (purchases[i].pvr).toFixed(20) + ": " + purchases[i].name);
		}	
	}

	update(): void {
		// Click the cookie
		if (this.strategy.autoClick) {
			Game.ClickCookie();
		}

		// Click any golden cookies
		if (this.strategy.autoClickGoldenCookies) {
			this.popShimmer("golden");
		}

		// Click any reindeer
		if (this.strategy.autoClickReindeer) {
			this.popShimmer("reindeer");
		}

		// Update the click rate
		if (this.clickRateTicker.ticked) {
			const MinClicksPerSecond = 0;
			const MaxClicksPerSecond = 1000;
			const ClickRateEstimateSamples = 120;

			// Clamp clicks to be between 0 and 1000, mitigates various bugs when loading
			let clicks: number = Math.max(MinClicksPerSecond, Math.min(Game.cookieClicks - this.clickCount, MaxClicksPerSecond));
			this.clickRates.push(clicks);
			while (this.clickRates.length > ClickRateEstimateSamples) {
				this.clickRates.shift();
			}
			let sum: number = this.clickRates.reduce((a, b) => a + b);
			this.clickRate = Math.floor(sum / this.clickRates.length);
			this.clickCount = Game.cookieClicks;
			this.sim.clickRate = this.strategy.clickRateOverride == -1 ? this.clickRate : this.strategy.clickRateOverride;
		}

		// Resync to the game if needed 
		if (Game.recalculateGains == 0 && (!floatEqual(this.sim.getCps(), Game.cookiesPs) || !floatEqual(this.sim.getCpc(), Game.mouseCps()))) {
			this.sim.syncToGame();
			// Log any errors errors if the sim doesnt match after resyncing 
			if (!this.sim.matchesGame() && this.sim.errorMessage != "" && this.errors[this.sim.errorMessage] == undefined) {
				this.errors[this.sim.errorMessage] = Game.WriteSave(1);
				console.log(this.sim.errorMessage);
			}
		}

		// Pop wrinklers during halloween if upgrades need unlocking
		if (this.sim.season.name == "halloween" && this.strategy.unlockSeasonUpgrades) {
			for (let w in Game.wrinklers) {
				if (Game.wrinklers[w].sucked > 0) {
					Game.wrinklers[w].hp = 0;
				}
			}
		}

		// Recheck the best purchase if purchaseTicker has ticked
		if (this.purchaseTicker.ticked) {
			this.nextPurchase = this.rankPurchases()[0];
		}

		// Do any purchasing. Dont purchase during 'Cursed finger'. The game freezes its CpS numbers while it is active so it will just desync
		if (this.strategy.autoBuy && !Game.hasBuff('Cursed finger')) {
			if (Game.cookies >= this.nextPurchase.price) {
				console.log("Purchasing: " + this.nextPurchase.name);
				this.nextPurchase.purchase();
				this.nextPurchase = this.rankPurchases()[0];
				this.purchaseTicker.restart();
			}
		}
	}
}

//
// Modifier.
//
// The modifier is a base class for anything that modifies a Simulation. Any
// modifier can be applied to or revoked from a Simulation.
//

class Modifier {
	sim: Simulator
	status: ModifierStatus
	name: string

	constructor(sim, name) {
		this.sim = sim;
		this.name = name;
		this.appliers = [];
		this.revokers = [];
		this.reset();
	}

	// REFACTOR - ADD ERROR CHECK TO PREVENT DOUBLE REPLY
	apply() {
		var i;
		for (i = 0; i < this.appliers.length; ++i)
			this.appliers[i](this.sim);
		this.revokeStatus = this.status;
		this.status = ModifierStatus.Applied;
	}

	reset() {
		this.status = ModifierStatus.Locked;
	}

	// REFACTOR - ADD ERROR CHECK TO PREVENT FAULTY REVOKE
	revoke() {
		var i;
		for (i = this.revokers.length - 1; i >= 0; --i)
			this.revokers[i](this.sim);
		this.status = this.revokeStatus;
	}

	addApplier(func) {
		this.appliers.push(func);
	}

	addRevoker(func) {
		this.revokers.push(func);
	}

	addLock(modifier) {
		if (this.locks == undefined)
			this.locks = [];
		this.locks.push(modifier);
	}

	isUnsupported() {
		this.unsupported = true;
	}

	requires(modifier) {
		var required = this.sim.modifiers[modifier];
		if (!required) {
			console.log("Missing requirement for " + this.name + ": " + modifier);
		} else {
			required.addLock(this);
		}
		return this;
	}

	requiresSeason(name) {
		var season = this.sim.seasons[name];
		if (!season) {
			console.log("Missing season for " + this.name + ": " + name);
		} else {
			season.addLock(this);
		}
		return this;
	}

	scalesBuildingPrice(scale) {
		this.addApplier(function(sim) { sim.buildingPriceScale *= scale; });
		this.addRevoker(function(sim) { sim.buildingPriceScale /= scale; });
		return this;
	}
	
	// The benefit is the exact amount of effective CpS that will be gained from applying this
	// modifier
	get benefit() {
		var cps = this.sim.effectiveCps();
		this.apply();
		cps = this.sim.effectiveCps() - cps;
		this.revoke();
		return cps;
	}

	// Value is slightly different to benefit. It lets items that might not provide any direct
	// benefit still be included in the purchase rankings and also provides a slight boost to
	// the purchase order of things like discounts etc. Basically if a measurable benefit is 
	// available it is used, if not, just treat it as a lump of coal.
	get value() {
		var ben = this.benefit;
		if (ben > 0 || this.name == "Chocolate egg") 
			return ben;
		var cps = this.sim.effectiveCps();
		this.sim.productionScale *= 1.01;
		cps = this.sim.effectiveCps() - cps;
		this.sim.productionScale /= 1.01;
		return cps;
	}
}

//
// Buffs.
//
// Buffs are temporary modifications to the game, often giving very large increases in
// throughput for a short duration.
//

class Buff extends Modifier {
	constructor(sim, name, duration) {
		super(sim, name);
		this.duration = duration;
	}

	cursesFinger() {
		this.addApplier(function(sim) { sim.cursedFinger = true; });
		this.addRevoker(function(sim) { sim.cursedFinger = false; });
		return this;
	}

	scalesClickFrenzyMultiplier(scale) {
		this.addApplier(function(sim) { sim.clickFrenzyMultiplier *= scale; });
		this.addRevoker(function(sim) { sim.clickFrenzyMultiplier /= scale; });
		return this;
	}

	scalesFrenzyMultiplier(scale) {
		this.addApplier(function(sim) { sim.frenzyMultiplier *= scale; });
		this.addRevoker(function(sim) { sim.frenzyMultiplier /= scale; });
		return this;
	}

	scalesFrenzyMultiplierPerBuilding(index) {
		this.addApplier(function(sim) { sim.frenzyMultiplier *= (1 + sim.buildings[index].quantity * 0.1); });
		this.addRevoker(function(sim) { sim.frenzyMultiplier /= (1 + sim.buildings[index].quantity * 0.1); });
		return this;
	}

	scalesReindeerBuffMultiplier(scale) {
		this.addApplier(function(sim) { sim.reindeerBuffMultiplier *= scale; });
		this.addRevoker(function(sim) { sim.reindeerBuffMultiplier /= scale; });
		return this;
	}

	shrinksFrenzyMultiplierPerBuilding(index) {
		this.addApplier(function(sim) { sim.frenzyMultiplier /= (1 + sim.buildings[index].quantity * 0.1); });
		this.addRevoker(function(sim) { sim.frenzyMultiplier *= (1 + sim.buildings[index].quantity * 0.1); });
		return this;
	}

}

//
// Purchases.
//
// Purchases are a subtype of modifier that can be bought in the game. They provide
// information about costing that can be used to prioritise what to buy next.
//

abstract class Purchase extends Modifier {
	constructor(sim, name) {
		super(sim, name);
	}

	abstract get price(): number;

	get purchaseTime() {
		return this.price / this.sim.effectiveCps();
	}

	get pbr() {
		return this.benefit / this.price;
	}

	get pvr() {
		return this.value / this.price;
	}
}

//
// Building.
//
// Represents one of the building types in the game.

class Building extends Purchase {
	quantity: number

	constructor(sim, index, name, basePrice, baseCps) {
		super(sim, name);
		this.index = index;
		this._basePrice = basePrice;
		this._baseCps = baseCps;
		if (this.index == BuildingIndex.Cursor) {
			this.addApplier(function(sim) { sim.buildings[index].quantity += 1; sim.recalculateUpgradePriceCursorScale(); });
			this.addRevoker(function(sim) { sim.buildings[index].quantity -= 1; sim.recalculateUpgradePriceCursorScale(); });
		} else {
			this.addApplier(function(sim) { sim.buildings[index].quantity += 1; });
			this.addRevoker(function(sim) { sim.buildings[index].quantity -= 1; });				
		}
		this.reset();
	}

	purchase() {
		//do {
			Game.ObjectsById[this.index].buy(1);
			this.apply();
		//} while (this.price <= Game.cookies && this.price <= this.sim.getCps());
	}

	reset() {
		super.reset();
		this.quantity = 0;
		this.free = 0;
		this.multiplier = 1;
		this.synergies = [];
		this.perBuildingFlatCpcBoostCounter = new BuildingCounter();
		this.perBuildingFlatCpsBoostCounter = new BuildingCounter();
		this.buildingScaler = new BuildingCounter();
		this.scaleCounter = new BuildingCounter();
	}

	get price() {
		return Math.ceil(this.sim.buildingPriceScale * this._basePrice * Math.pow(1.15, Math.max(0, this.quantity - this.free)));
	}
	
	get cps() {
		return this.quantity * this.individualCps;
	}

	get individualCps() {
		return this.perBuildingFlatCpsBoostCounter.getCount(this.sim.buildings) + this._baseCps * (1 + this.scaleCounter.getCount(this.sim.buildings)) * this.synergyMultiplier * (1 + this.buildingScaler.getCount(this.sim.buildings)) * this.multiplier;
	}

	get synergyMultiplier() {
		var scale = 1;
		var i;
		for (i = 0; i < this.synergies.length; ++i) {
			scale *= 1 + this.sim.buildings[this.synergies[i][0]].quantity * this.synergies[i][1];
		}
		return scale;
	}

	addSynergy(index, scale) {
		this.synergies.push([index, scale]);
	}

	removeSynergy(index, scale) {
		var i;
		for (i = this.synergies.length - 1; i >= 0; --i) {
			if (this.synergies[i][0] == index && this.synergies[i][1] == scale) {
				this.synergies.splice(i, 1);
				return;
			}
		}
	}

	matchesGame(equalityFunction) {
		var error = "";

		var gameObj = Game.ObjectsById[this.index];
		if (gameObj) {
			if (this.name != gameObj.name)
				error += "Building Name " + this.name + " does not match " + gameObj.name + ".\n";			
			if (!equalityFunction(this.price, gameObj.getPrice()))
				error += "Building Cost " + this.name + " - Predicted: " + this.price + ", Actual: " + gameObj.getPrice() + ".\n";
			if (!equalityFunction(this.individualCps, gameObj.cps(gameObj)))
				error += "Building CpS " + this.name + " - Predicted: " + this.individualCps + ", Actual: " + gameObj.cps(gameObj) + ".\n";
		} else {
			error += "Building Index " + this.index + " doesn't match any building.\n";
		}
		return { match: error == "" ? true : false, error: error };
	}
	// DELETE THESE AS SOON AS SORT WORKS WITHOUT THEM

	getCps() {
		return this.cps;
	}
}

//
// SantaLevel
//
// Purchase representation of the one level for the in game Santa system. These should
// only be created by a Santa object, they are not intended for use as a standalone
// class.
//

class SantaLevel extends Purchase {
	constructor(santa, num, name) {
		super(santa.sim, name);
		this.santa = santa;
		this.num = num;
		this.addApplier(function(sim) { sim.santa.level++; });
		this.addRevoker(function(sim) { sim.santa.level--; });
	}

	purchase() {
		Game.specialTab = "santa";
		Game.UpgradeSanta();
		this.apply();
	}

	get price() {
		return Math.pow(this.num + 1, this.num + 1);
	}
}

//
// Santa
//
// Santa incorporates everything to do with the in game santa system surprisingly enough.
//

class Santa {
	constructor(sim) {
		this.sim = sim;
		this.levels = [];
		this.randomRewards = [];

		var santa = this;
		function level(num, name) {
			var level =  new SantaLevel(santa, num, name)
			if (num > 0) {
				level.requires(santa.levels[num - 1].name);
			}
			santa.levels[num] = level;
			santa.sim.modifiers[level.name] = level;
			return level;
		}

		level( 0, "Festive test tube"	);
		level( 1, "Festive ornament"	);
		level( 2, "Festive wreath"		);
		level( 3, "Festive tree"		);
		level( 4, "Festive present"		);
		level( 5, "Festive elf fetus"	);
		level( 6, "Elf toddler"			);
		level( 7, "Elfling"				);
		level( 8, "Young elf"			);
		level( 9, "Bulky elf"			);
		level(10, "Nick"				);
		level(11, "Santa Claus"			);
		level(12, "Elder Santa"			);
		level(13, "True Santa"			);
		level(14, "Final Claus"			);
	}

	randomRewardCost(level) {
		return Math.pow(3, level) * 2525;
	}

	reset() {
		this.level = 0;		
		this.power = 0;
	}

	get canBeLeveled() {
		return Game.Has("A festive hat") && this.level < 14;
	}

	get nextLevel() {
		return this.levels[this.level + 1];
	}
}

//
// PurchaseChain
//
// Looking ahead multiple purchases can give better results. This class is designed to represent
// those chains of purchases.
//

class PurchaseChain extends Purchase {
	purchases: Purchase[]

	constructor(sim: Simulator, purchases: Purchase[]) {
		super(sim, purchases.map(p => p.name).join(" -> "));
		this.purchases = purchases;
	}

	apply() {
		var i;
		for (i = 0; i < this.purchases.length; ++i) {
			this.purchases[i].apply();
		}
	}

	revoke() {
		var i;
		for (i = this.purchases.length - 1; i >= 0; --i) {
			this.purchases[i].revoke();
		}
	}

	get purchaseTime() {
		var time = 0;
		var i;
		for (i = 0; i < this.purchases.length; ++i) {
			time += this.purchases[i].purchaseTime;
			this.purchases[i].apply();
		}
		this.revoke();
		return time;
	}

	get price() {
		var price = 0;
		var i;
		for (i = 0; i < this.purchases.length; ++i) {
			price += this.purchases[i].price;
			this.purchases[i].apply();
		}
		this.revoke();
		return price;
	}
}

//
// Upgrades. 
//
// The way these work is pretty simple, each Upgrade has a list of functions
// that are used to apply or revoke the upgrade from a CCSimulation. Creating
// an Upgrade involves declaring it by name then using the builder function to
// chain all the different things it does one after the other. Each creation
// adds an applyFunction and a revokeFunction. If both are called on a 
// Simulation the resulting simulation should be unchanged overall. 
//
// While the naming on these isn't entirely consistent (sometimes things just
// work in weird ways and it's hard to come up with a name that is specific 
// without being overly verbose) there are some words that I try to keep to a
// special meaning.
//
// Flat - A flat increase is added on its own and doesn't scale with anything.
// Base - A base increases is added to the baseline output and scales with any
//        scaling factors that also affect that.
// Boost - A boost is added to another scaling factor to increase that scaling.
// Scale - A scale is multiplied with another scaling factor to increase that
//         scaling.
// 

class Upgrade extends Purchase {
	constructor(sim, name, supported) {
		super(sim, name);

		var gameUpgrade = Game.Upgrades[name];
		if (gameUpgrade) {
			this._basePrice = gameUpgrade.basePrice;
		} else {
			console.log("Upgrade not found: " + name);
		}
	}

	get price() {
		var p = this._basePrice;
		if (this.name == "Elder Pledge")
			p = Math.pow(8, Math.min(Game.pledges + 2, 14));
		else if (this.isSantaReward)
			p = this.sim.santa.randomRewardCost(this.sim.santa.level);
		else if (this.isRareEgg)
			p = Math.pow(3, this.sim.eggCount) * 999;
		else if (this.isEgg)
			p = Math.pow(2, this.sim.eggCount) * 999;
		else if (this.isSeasonChanger)
			p = this._basePrice * Math.pow(2, this.sim.seasonChanges);
		else if (this.isGoldenSwitch)
			p = this.sim.getCps() * 60 * 60;
		if (this.isCookie)
			p *= this.sim.cookieUpgradePriceMultiplier;
		if (this.isSynergy)
			p *= this.sim.synergyUpgradePriceMultiplier;
		return Math.ceil(p * this.sim.upgradePriceScale * this.sim.upgradePriceCursorScale);
	}

	matchesGame(equalityFunction) {
		if (!this.unsupported) {
			var gameObj = Game.Upgrades[this.name];
			if (!gameObj)
				return { match: false, error: "Upgrade Name " + this.name + " has no corresponding match in store.\n" };
			if (!equalityFunction(this.price, gameObj.getPrice()))
				return { match: false, error: "Upgrade Cost " + this.name + " - Predicted: " + this.price + ", Actual: " + gameObj.getPrice() + ".\n" };
		}
		return { match: true, error: "" };
	}

	//
	// Implementation of the various upgrades themselves
	//

	angersGrandmas() {
		this.addApplier(function(sim) { sim.grandmatriarchStatus++; });
		this.addRevoker(function(sim) { sim.grandmatriarchStatus--; });
		return this;
	}

	boostsBaseCps(amount) {
		this.addApplier(function(sim) { sim.baseCps += amount; });
		this.addRevoker(function(sim) { sim.baseCps -= amount; });
		return this;
	}

	scalesCenturyMultiplier(scale) {
		this.addApplier(function(sim) { sim.centuryMultiplier *= scale; });
		this.addRevoker(function(sim) { sim.centuryMultiplier /= scale; });
		return this;
	}

	boostsClickCps(amount) {
		this.addApplier(function(sim) { sim.cpcCpsMultiplier += amount; });
		this.addRevoker(function(sim) { sim.cpcCpsMultiplier -= amount; });
		return this;
	}

	boostsMaxWrinklers(amount) {
		this.addApplier(function(sim) { sim.maxWrinklers += amount; });
		this.addRevoker(function(sim) { sim.maxWrinklers -= amount; });
		return this;
	}

	boostsSantaPower(amount) {
		this.addApplier(function(sim) { sim.santa.power += amount; });
		this.addRevoker(function(sim) { sim.santa.power -= amount; });
		return this;
	}

	calmsGrandmas() {
		this.beginsElderPledge = true;
		return this;
	}
	
	doublesElderPledge() {
		return this;
	}

	enablesUpgradePriceCursorScale() {
		this.addApplier(function(sim) { sim.upgradePriceCursorScaleEnabled = true; sim.recalculateUpgradePriceCursorScale(); })
		this.addRevoker(function(sim) { sim.upgradePriceCursorScaleEnabled = false; sim.recalculateUpgradePriceCursorScale(); })
		return this;
	}

	givesHeartCookie() {
		this.addApplier(function(sim) { sim.heartCookieCount++; });
		this.addRevoker(function(sim) { sim.heartCookieCount--; });
		return this;
	}

	isACookie() {
		this.isCookie = true;
		return this;
	}

	isAGoldenSwitch() {
		this.isGoldenSwitch = true;
		return this;
	}

	isAnEgg() {
		this.isEgg = true;
		this.addApplier(function(sim) { sim.eggCount++; });
		this.addRevoker(function(sim) { sim.eggCount--; });
		return this;
	}

	isARareEgg() {
		this.isRareEgg = true;
		this.addApplier(function(sim) { sim.eggCount++; });
		this.addRevoker(function(sim) { sim.eggCount--; });
		return this;		
	}

	isASynergy() {
		this.isSynergy = true;
		return this;
	}

	isRandomSantaReward() {
		this.isSantaReward = true;
		this.sim.santa.randomRewards.push(this);
		return this;
	}

	purchase() {
		Game.Upgrades[this.name].buy(1);
		this.apply();
	}

	scalesBaseClicking(scale) {
		this.addApplier(function(sim) { sim.cpcBaseMultiplier *= scale; });
		this.addRevoker(function(sim) { sim.cpcBaseMultiplier /= scale; });
		return this;
	}

	scalesBuildingCps(index, scale) {
		this.addApplier(function(sim) { sim.buildings[index].multiplier *= scale; });
		this.addRevoker(function(sim) { sim.buildings[index].multiplier /= scale; });
		return this;
	}

	scalesClicking(scale) {
		this.addApplier(function(sim) { sim.cpcMultiplier *= scale; });
		this.addRevoker(function(sim) { sim.cpcMultiplier /= scale; });
		return this;
	}

	scalesCookieUpgradePrice(scale) {
		this.addApplier(function(sim) { sim.cookieUpgradePriceMultiplier *= scale; });
		this.addRevoker(function(sim) { sim.cookieUpgradePriceMultiplier /= scale; });
		return this;
	}

	scalesGoldenCookieDuration(scale) {
		this.addApplier(function(sim) { sim.goldenCookieDuration *= scale; });
		this.addRevoker(function(sim) { sim.goldenCookieDuration /= scale; });
		return this;
	}

	scalesGoldenCookieEffectDuration(scale) {
		this.addApplier(function(sim) { sim.goldenCookieEffectDurationMultiplier *= scale; });
		this.addRevoker(function(sim) { sim.goldenCookieEffectDurationMultiplier /= scale; });
		return this;
	}

	scalesGoldenCookieFrequency(scale) {
		this.addApplier(function(sim) { sim.goldenCookieTime /= scale; });
		this.addRevoker(function(sim) { sim.goldenCookieTime *= scale; });
		return this;
	}

	scalesHeartCookies(scale) {
		this.addApplier(function(sim) { sim.heartCookieScale *= scale; });
		this.addRevoker(function(sim) { sim.heartCookieScale /= scale; });
		return this;
	}

	scalesMilk(scale) {
		this.addApplier(function(sim) { sim.milkMultiplier *= scale; });
		this.addRevoker(function(sim) { sim.milkMultiplier /= scale; });
		return this;
	}
	
	scalesPrestige(scale)	{
		this.addApplier(function(sim) { sim.prestigeScale *= scale; });
		this.addRevoker(function(sim) { sim.prestigeScale /= scale; });
		return this;
	}

	scalesProduction(scale)	{
		this.addApplier(function(sim) { sim.productionScale *= scale; });
		this.addRevoker(function(sim) { sim.productionScale /= scale; });
		return this;
	}

	scalesProductionByAge(scale) {
		var age = Math.floor((Date.now() - COOKIE_CLICKER_BIRTHDAY) / (365 * 24 * 60 * 60 * 1000));
		this.addApplier(function(sim) { sim.productionScale *= (1 + scale * age); });
		this.addRevoker(function(sim) { sim.productionScale /= (1 + scale * age); });
		return this;
	}

	scalesRandomDropFrequency(scale) {
		// Does nothing really measurable
		return this;
	}

	scalesReindeer(scale) {
		this.addApplier(function(sim) { sim.reindeerMultiplier *= scale; });
		this.addRevoker(function(sim) { sim.reindeerMultiplier /= scale; });
		return this;
	}

	scalesReindeerDuration(scale) {
		this.addApplier(function(sim) { sim.reindeerDuration *= scale; });
		this.addRevoker(function(sim) { sim.reindeerDuration /= scale; });
		return this;
	}

	scalesReindeerFrequency(scale) {
		this.addApplier(function(sim) { sim.reindeerTime /= scale; });
		this.addRevoker(function(sim) { sim.reindeerTime *= scale; });
		return this;
	}

	scalesSeasonalGoldenCookieFrequency(season, scale) {
		this.addApplier(function(sim) { sim.seasons[season].goldenCookieFrequencyScale *= scale; });
		this.addRevoker(function(sim) { sim.seasons[season].goldenCookieFrequencyScale /= scale; });
		return this;
	}

	scalesSynergyUpgradePrice(scale) {
		this.addApplier(function(sim) { sim.synergyUpgradePriceMultiplier *= scale; });
		this.addRevoker(function(sim) { sim.synergyUpgradePriceMultiplier /= scale; });
		return this;
	}

	scalesUpgradePrice(scale)	{
		this.addApplier(function(sim) { sim.upgradePriceScale *= scale; });
		this.addRevoker(function(sim) { sim.upgradePriceScale /= scale; });
		return this;
	}

	setsSeason(name) {
		this.isSeasonChanger = true;
		this.addApplier(function(sim) { sim.pushSeason(sim.seasons[name]); sim.seasons[name].apply(); });
		this.addRevoker(function(sim) { sim.seasons[name].revoke(); sim.popSeason(); });
		return this;
	}

	givesBuildingPerBuildingFlatCpsBoost(receiver, excludes, amount) {
		this.addApplier(function(sim) { sim.buildings[receiver].perBuildingFlatCpsBoostCounter.addCountMost(excludes, amount); });
		this.addRevoker(function(sim) { sim.buildings[receiver].perBuildingFlatCpsBoostCounter.subtractCountMost(excludes, amount); });
		return this;
	}

	givesSynergy(receiver, from, amount, reverse=0) {
		this.addApplier(function(sim) { sim.buildings[receiver].addSynergy(from, amount); });
		this.addRevoker(function(sim) { sim.buildings[receiver].removeSynergy(from, amount); });
		if (reverse) {
			this.addApplier(function(sim) { sim.buildings[from].addSynergy(receiver, reverse); });
			this.addRevoker(function(sim) { sim.buildings[from].removeSynergy(receiver, reverse); });				
		}
		return this;		
	}

	givesPerBuildingBoost(receiver, source, amount) {
		this.addApplier(function(sim) { sim.buildings[receiver].scaleCounter.addCountOne(source, amount); });
		this.addRevoker(function(sim) { sim.buildings[receiver].scaleCounter.subtractCountOne(source, amount); });
		return this;
	}

	givesPerBuildingFlatCpcBoost(excludes, amount) {
		this.addApplier(function(sim) { sim.perBuildingFlatCpcBoostCounter.addCountMost(excludes, amount); });
		this.addRevoker(function(sim) { sim.perBuildingFlatCpcBoostCounter.subtractCountMost(excludes, amount); });
		return this;
	}

	unlocksMilk(amount, tier=0) {
		this.addApplier(function(sim) { sim.milkUnlocks[tier].push(amount); sim.milkUnlocks[tier].sort(); });
		this.addRevoker(function(sim) { sim.milkUnlocks[tier].splice(sim.milkUnlocks[tier].indexOf(amount), 1); });
		return this;		
	}

	unlocksPrestige(amount) {
		this.addApplier(function(sim) { sim.prestigeUnlocked += amount; });
		this.addRevoker(function(sim) { sim.prestigeUnlocked -= amount; });
		return this;		
	}
}

Upgrade.prototype.isAvailableToPurchase = function() {
	if (this.buildsIndex != undefined)
		return true;
	else
		return Game.Upgrades[this.name].unlocked == 1 && Game.Upgrades[this.name].bought == 0;

}

//
// Seasons
//
// Seasons are a class of modifier that make pretty big changes to the game, often enabling
// new shimmers, new buffs and a bunch of lockable items to unlock. 
//

class Season extends Modifier {
	toggle?: Upgrade

	constructor(sim, name, toggle) {
		super(sim, name);
		if (toggle) {
			this.toggle = new Upgrade(sim, toggle);
			this.toggle.setsSeason(name);
		}
		this.reset();
	}

	reset() {
		super.reset();
		this.goldenCookieFrequencyScale = 1;
	}

	get lockedUpgrades() {
		if (this.locks) {
			let  locked = 0;
			for (let i = 0; i < this.locks.length; ++i)
				if (this.locks[i].status == ModifierStatus.Locked)
					locked++
			return locked;
		}
		return 0;
	}
}

//
// Simulator
//
// Simulates the cookie clicker Game allowing for the calculations of the CpS values etc. of the
// game. Simulation is not compete, this doesn't actually generate cookies or act over time but
// it does accurately simulate the effects any upgrades, building purchases, buffs etc have and 
// as such can be used to calculate the optimal purchase strategy
//

class Simulator {
	strategy: Strategy
	buildings: Building[] = []
	modifiers: { [index: string]: Modifier } = {}
	toggles: { [index: string]: Upgrade } = {}
	seasons: { [index: string]: Season } = {}
	santa: Santa = new Santa(this)

	constructor() {
		this.upgrades = {};
		this.prestiges = {};
		this.buffs = {};
	
		var sim = this;

		// Add a new Buff to the Simulation
		function buff(name, duration) {
			var buff = new Buff(sim, name, duration);
			sim.modifiers[name] = buff;
			sim.buffs[name] = buff;
			return buff;
		}

		// Add a new Building upgrade to the Simulation
		function building(index, name, cost, cps) {
			var building = new Building(sim, index, name, cost, cps);
			sim.buildings.push(building);
			return building;
		}

		// Add a new prestige upgrade to the Simulation
		function prestige(name) {
			var prestige = new Upgrade(sim, name);
			sim.modifiers[name] = prestige;
			sim.prestiges[name] = prestige;
			return prestige;
		}

		// Add a new Season to the Simulation
		function season(name, toggle) {
			var season = new Season(sim, name, toggle);
			if (season.toggle) {
				sim.modifiers[toggle] = season.toggle;
				sim.toggles[toggle] = season.toggle;
			}
			sim.seasons[name] = season;
			return season;
		}

		// Add a new Toggle to the Simulation
		function toggle(name) {
			var toggle = new Upgrade(sim, name);
			sim.modifiers[name] = toggle;
			sim.toggles[name] = toggle;
			return toggle;
		}

		// Add a new Upgrade to the Simulation
		function upgrade(name) {
			var upgrade = new Upgrade(sim, name);
			sim.modifiers[name] = upgrade;
			sim.upgrades[name] = upgrade;
			return upgrade;
		}

		function cookie(name) {
			return upgrade(name).isACookie();
		}

		function synergy(name) {
			return upgrade(name).isASynergy();
		}

		// Create all the buildings - the order matters, dont shuffle these!
		building( 0, 'Cursor',			   	         	  15,           0.1);
		building( 1, 'Grandma',			 	        	 100,           1.0);
		building( 2, 'Farm',					   	    1100,           8.0);
		building( 3, 'Mine',				      	   12000,          47.0);
		building( 4, 'Factory',			    	 	  130000,         260.0);
		building( 5, 'Bank',						 1400000,        1400.0);
		building( 6, 'Temple',				   	    20000000,        7800.0);
		building( 7, 'Wizard tower',		  	   330000000,       44000.0);
		building( 8, 'Shipment',			 	  5100000000,      260000.0);
		building( 9, 'Alchemy lab',				 75000000000,     1600000.0);
		building(10, 'Portal',			  	   1000000000000,    10000000.0);
		building(11, 'Time machine',	  	  14000000000000,    65000000.0);
		building(12, 'Antimatter condenser', 170000000000000,   430000000.0);
		building(13, 'Prism',				2100000000000000,  2900000000.0);
		building(14, 'Chancemaker',		   26000000000000000, 21000000000.0);

		//
		// Create all the seasons
		//

		season(""								);	// Default season								
		season("christmas",	"Festive biscuit"	);	// Christmas season
		season("fools",		"Fool's biscuit"	);	// Business Day
		season("valentines","Lovesick biscuit"	);	// Valentines Day
		season("easter",	"Bunny biscuit"		);	// Easter
		season("halloween",	"Ghostly biscuit"	);	// Halloween
		
		//
		// Create all the buffs
		//

		buff('Clot'					).scalesFrenzyMultiplier(0.5);
		buff('Frenzy'				).scalesFrenzyMultiplier(7).scalesReindeerBuffMultiplier(0.75);
		buff('Elder frenzy'			).scalesFrenzyMultiplier(666).scalesReindeerBuffMultiplier(0.5);
		buff('Click frenzy'			).scalesClickFrenzyMultiplier(777);
		buff('High-five',			30).scalesFrenzyMultiplierPerBuilding(BuildingIndex.Cursor);
		buff('Congregation',		30).scalesFrenzyMultiplierPerBuilding(BuildingIndex.Grandma);
		buff('Luxuriant harvest',	30).scalesFrenzyMultiplierPerBuilding(BuildingIndex.Farm);
		buff('Ore vein',			30).scalesFrenzyMultiplierPerBuilding(BuildingIndex.Mine);
		buff('Oiled-up',			30).scalesFrenzyMultiplierPerBuilding(BuildingIndex.Factory);
		buff('Juicy profits',		30).scalesFrenzyMultiplierPerBuilding(BuildingIndex.Bank);
		buff('Fervent adoration',	30).scalesFrenzyMultiplierPerBuilding(BuildingIndex.Temple);
		buff('Manabloom',			30).scalesFrenzyMultiplierPerBuilding(BuildingIndex.WizardTower);
		buff('Delicious lifeforms',	30).scalesFrenzyMultiplierPerBuilding(BuildingIndex.Shipment);
		buff('Breakthrough',		30).scalesFrenzyMultiplierPerBuilding(BuildingIndex.AlchemyLab);
		buff('Righteous cataclysm',	30).scalesFrenzyMultiplierPerBuilding(BuildingIndex.Portal);
		buff('Golden ages',			30).scalesFrenzyMultiplierPerBuilding(BuildingIndex.TimeMachine);
		buff('Extra cycles',		30).scalesFrenzyMultiplierPerBuilding(BuildingIndex.AntimatterCondenser);
		buff('Solar flare',			30).scalesFrenzyMultiplierPerBuilding(BuildingIndex.Prism);
		buff('Winning streak',		30).scalesFrenzyMultiplierPerBuilding(BuildingIndex.Chancemaker);
		buff('Slap to the face',	30).shrinksFrenzyMultiplierPerBuilding(BuildingIndex.Cursor);
		buff('Senility',			30).shrinksFrenzyMultiplierPerBuilding(BuildingIndex.Grandma);
		buff('Locusts',				30).shrinksFrenzyMultiplierPerBuilding(BuildingIndex.Farm);
		buff('Cave-in',				30).shrinksFrenzyMultiplierPerBuilding(BuildingIndex.Mine);
		buff('Jammed machinery',	30).shrinksFrenzyMultiplierPerBuilding(BuildingIndex.Factory);
		buff('Recession',			30).shrinksFrenzyMultiplierPerBuilding(BuildingIndex.Bank);
		buff('Crisis of faith',		30).shrinksFrenzyMultiplierPerBuilding(BuildingIndex.Temple);
		buff('Magivores',			30).shrinksFrenzyMultiplierPerBuilding(BuildingIndex.WizardTower);
		buff('Black holes',			30).shrinksFrenzyMultiplierPerBuilding(BuildingIndex.Shipment);
		buff('Lab disaster',		30).shrinksFrenzyMultiplierPerBuilding(BuildingIndex.AlchemyLab);
		buff('Dimensional calamity',30).shrinksFrenzyMultiplierPerBuilding(BuildingIndex.Portal);
		buff('Time jam',			30).shrinksFrenzyMultiplierPerBuilding(BuildingIndex.TimeMachine);
		buff('Predictable tragedy',	30).shrinksFrenzyMultiplierPerBuilding(BuildingIndex.AntimatterCondenser);
		buff('Eclipse',				30).shrinksFrenzyMultiplierPerBuilding(BuildingIndex.Prism);
		buff('Dry spell',			30).shrinksFrenzyMultiplierPerBuilding(BuildingIndex.Chancemaker);
		buff('Everything must go',	 8).scalesBuildingPrice(0.95);
		buff('Cursed finger', 		10).cursesFinger();	
		buff('Cookie storm',		 7);		// Spawns a lot of golden cookies
		
		//
		// Create all the prestige upgrades
		//

		prestige("Legacy"						);	// Unlocks heavenly power
		prestige("Persistent memory"			).requires("Legacy");	// Future research is 10 times faster
		prestige("How to bake your dragon"		).requires("Legacy");	// Unlocks the dragon egg

		// Permanant upgrade slots
		prestige("Permanent upgrade slot I"		).requires("Legacy");
		prestige("Permanent upgrade slot II"	).requires("Permanent upgrade slot I");
		prestige("Permanent upgrade slot III"	).requires("Permanent upgrade slot II");
		prestige("Permanent upgrade slot IV"	).requires("Permanent upgrade slot III");
		prestige("Permanent upgrade slot V"		).requires("Permanent upgrade slot IV");
		
		// Heavenly cookies branch
		prestige("Heavenly cookies"				).requires("Legacy").scalesProduction(1.10);
		prestige("Tin of butter cookies"		).requires("Heavenly cookies");
		prestige("Tin of british tea biscuits"	).requires("Heavenly cookies");
		prestige("Box of brand biscuits"		).requires("Heavenly cookies");
		prestige("Box of macarons"				).requires("Heavenly cookies");
		prestige("Starter kit"					).requires("Tin of butter cookies").requires("Tin of british tea biscuits").requires("Box of brand biscuits").requires("Box of macarons");	// You start with 10 cursors
		prestige("Halo gloves"					).requires("Starter kit").scalesClicking(1.10);
		prestige("Starter kitchen"				).requires("Starter kit");		// You start with 5 grandmas
		prestige("Unholy bait"					).requires("Starter kitchen");	// Wrinklers appear 5 times as fast
		prestige("Elder spice"					).requires("Unholy bait").boostsMaxWrinklers(2);
		prestige("Sacrilegious corruption"		).requires("Unholy bait");		// Wrinklers regurgitate 5% more cookies
		prestige("Wrinkly cookies"				).requires("Elder spice").requires("Sacrilegious corruption").scalesProduction(1.10);
		prestige("Stevia Caelestis"				).requires("Wrinkly cookies");	// Sugar lumps ripen an hour sooner
		
		// Season switcher branch
		prestige("Season switcher"				).requires("Legacy");
		prestige("Starsnow"						).requires("Season switcher").scalesReindeerFrequency(1.05);//.increasesChristmasCookieDropChance(5%);
		prestige("Starlove"						).requires("Season switcher").scalesSeasonalGoldenCookieFrequency("valentines", 1.02).scalesHeartCookies(1.5);
		prestige("Starterror"					).requires("Season switcher").scalesSeasonalGoldenCookieFrequency("halloween", 1.02);	// spooky cookies appear 10% more often, golden cookies 2% more often during halloween
		prestige("Startrade"					).requires("Season switcher").scalesSeasonalGoldenCookieFrequency("fools", 1.05);
		prestige("Starspawn"					).requires("Season switcher").scalesSeasonalGoldenCookieFrequency("easter", 1.02);	// egg drops 10% more often

		// Heavenly luck branch
		prestige("Heavenly luck"				).requires("Legacy").scalesGoldenCookieFrequency(1.05);
		prestige("Lasting fortune"				).requires("Heavenly luck").scalesGoldenCookieEffectDuration(1.10);
		prestige("Golden switch"				).requires("Heavenly luck");	// Unlocks the golden switch which boosts passive cps 50% but stops golden cookies
		prestige("Lucky digit"					).requires("Heavenly luck").scalesPrestige(1.01).scalesGoldenCookieDuration(1.01).scalesGoldenCookieEffectDuration(1.01);
		prestige("Lucky number"					).requires("Lucky digit").scalesPrestige(1.01).scalesGoldenCookieDuration(1.01).scalesGoldenCookieEffectDuration(1.01);
		prestige("Lucky payout"					).requires("Lucky payout").scalesPrestige(1.01).scalesGoldenCookieDuration(1.01).scalesGoldenCookieEffectDuration(1.01);
		prestige("Decisive fate"				).requires("Lasting fortune").scalesGoldenCookieDuration(1.05);
		prestige("Golden cookie alert sound"	).requires("Golden switch").requires("Decisive fate");	// Does nothing useful
		prestige("Residual luck"				).requires("Golden switch");	// While golden switch is on you gain 10% extra cps per golden cookie upgrade owned
		prestige("Divine discount"				).requires("Decisive fate").scalesBuildingPrice(0.99);
		prestige("Divine sales"					).requires("Decisive fate").scalesUpgradePrice(0.99);
		prestige("Divine bakeries"				).requires("Divine discount").requires("Divine sales").scalesCookieUpgradePrice(0.2);
		prestige("Distilled essence of redoubled luck").requires("Residual luck").requires("Divine bakeries");	// Golden cookies have a 1% chance of being doubled

		// Twin Gates of Transcendence branch
		prestige("Twin Gates of Transcendence"	).requires("Legacy");	// Retain 5% of regular CpS for 1 hour while closed, 90% reduction to 0.5% beyond that
		prestige("Belphegor"					).requires("Twin Gates of Transcendence");	// Doubles retention time to 2 hours
		prestige("Mammon"						).requires("Belphegor");					// Doubles retention time to 4 hours
		prestige("Abaddon"						).requires("Mammon");						// Doubles retention time to 8 hours
		prestige("Five-finger discount"			).requires("Abaddon").requires("Halo gloves").enablesUpgradePriceCursorScale();
		prestige("Satan"						).requires("Abaddon");						// Doubles retention time to 16 hours
		prestige("Asmodeus"						).requires("Satan");						// Doubles retention time to 1 day 8 hours
		prestige("Beelzebub"					).requires("Asmodeus");						// Doubles retention time to 2 days 16 hours
		prestige("Lucifer"						).requires("Beelzebub");					// Doubles retention time to 5 days 8 hours
		prestige("Diabetica Daemonicus"			).requires("Stevia Caelestis").requires("Lucifer");	// Sugar lumps mature an hour sooner
		prestige("Sucralosia Inutilis"			).requires("Diabetica Daemonicus");			// Bifurcated sugar lumps appear 5% more often and are 5% more likely to drop two sugar lumps
		
		prestige("Angels"						).requires("Twin Gates of Transcendence");	// Retain an extra 10% total 15%
		prestige("Archangels"					).requires("Angels");						// Retain an extra 10% total 25%
		prestige("Virtues"						).requires("Archangels");					// Retain an extra 10% total 35%
		prestige("Dominions"					).requires("Virtues");						// Retain an extra 10% total 45%
		prestige("Cherubim"						).requires("Dominions");					// Retain an extra 10% total 55%
		prestige("Seraphim"						).requires("Cherubim");						// Retain an extra 10% total 65%
		prestige("God"							).requires("Seraphim");						// Retain an extra 10% total 75%
		
		prestige("Chimera"						).requires("Lucifer").requires("God").scalesSynergyUpgradePrice(0.98);		// also retain an extra 5% total 80%, redain for 2 more days

		prestige("Kitten angels"				).requires("Dominions").unlocksMilk(0.1, 1);
		prestige("Synergies Vol. I"				).requires("Satan").requires("Dominions");	// Unlocks first tier of synergy upgrades
		prestige("Synergies Vol. II"			).requires("Beelzebub").requires("Seraphim").requires("Synergies Vol. I");	// Unlocks second tier of synergy upgrades

		// Classic Dairy Selection branch, these are all just cosmetic so they do nothing
		prestige("Classic dairy selection"		).requires("Legacy");
		prestige("Basic wallpaper assortment"	).requires("Classic dairy selection");
		prestige("Fanciful dairy selection"		).requires("Classic dairy selection");
		
		//
		// Create all the regular upgrades
		//

		// Upgrades that double the productivity of a type of building
		upgrade("Forwards from grandma"			).scalesBuildingCps(BuildingIndex.Grandma, 2);
		upgrade("Steel-plated rolling pins"		).scalesBuildingCps(BuildingIndex.Grandma, 2);
		upgrade("Lubricated dentures"			).scalesBuildingCps(BuildingIndex.Grandma, 2);
		upgrade("Double-thick glasses"			).scalesBuildingCps(BuildingIndex.Grandma, 2);
		upgrade("Prune juice"					).scalesBuildingCps(BuildingIndex.Grandma, 2);
		upgrade("Aging agents"					).scalesBuildingCps(BuildingIndex.Grandma, 2);
		upgrade("Xtreme walkers"				).scalesBuildingCps(BuildingIndex.Grandma, 2);
		upgrade("The Unbridling"				).scalesBuildingCps(BuildingIndex.Grandma, 2);
		upgrade("Reverse dementia"				).scalesBuildingCps(BuildingIndex.Grandma, 2);
		upgrade("Farmer grandmas"				).scalesBuildingCps(BuildingIndex.Grandma, 2).givesSynergy(BuildingIndex.Farm, BuildingIndex.Grandma, 0.01);
		upgrade("Miner grandmas"				).scalesBuildingCps(BuildingIndex.Grandma, 2).givesSynergy(BuildingIndex.Mine, BuildingIndex.Grandma, 0.01 / 2);
		upgrade("Worker grandmas"				).scalesBuildingCps(BuildingIndex.Grandma, 2).givesSynergy(BuildingIndex.Factory, BuildingIndex.Grandma, 0.01 / 3);
		upgrade("Banker grandmas"				).scalesBuildingCps(BuildingIndex.Grandma, 2).givesSynergy(BuildingIndex.Bank, BuildingIndex.Grandma, 0.01 / 4);
		upgrade("Priestess grandmas"			).scalesBuildingCps(BuildingIndex.Grandma, 2).givesSynergy(BuildingIndex.Temple, BuildingIndex.Grandma, 0.01 / 5);
		upgrade("Witch grandmas"				).scalesBuildingCps(BuildingIndex.Grandma, 2).givesSynergy(BuildingIndex.WizardTower, BuildingIndex.Grandma, 0.01 / 6);
		upgrade("Cosmic grandmas"				).scalesBuildingCps(BuildingIndex.Grandma, 2).givesSynergy(BuildingIndex.Shipment, BuildingIndex.Grandma, 0.01 / 7);
		upgrade("Transmuted grandmas"			).scalesBuildingCps(BuildingIndex.Grandma, 2).givesSynergy(BuildingIndex.AlchemyLab, BuildingIndex.Grandma, 0.01 / 8);
		upgrade("Altered grandmas"				).scalesBuildingCps(BuildingIndex.Grandma, 2).givesSynergy(BuildingIndex.Portal, BuildingIndex.Grandma, 0.01 / 9);
		upgrade("Grandmas' grandmas"			).scalesBuildingCps(BuildingIndex.Grandma, 2).givesSynergy(BuildingIndex.TimeMachine, BuildingIndex.Grandma, 0.01 / 10);
		upgrade("Antigrandmas"					).scalesBuildingCps(BuildingIndex.Grandma, 2).givesSynergy(BuildingIndex.AntimatterCondenser, BuildingIndex.Grandma, 0.01 / 11);
		upgrade("Rainbow grandmas"				).scalesBuildingCps(BuildingIndex.Grandma, 2).givesSynergy(BuildingIndex.Prism, BuildingIndex.Grandma, 0.01 / 12);
		upgrade("Lucky grandmas"				).scalesBuildingCps(BuildingIndex.Grandma, 2).givesSynergy(BuildingIndex.Chancemaker, BuildingIndex.Grandma, 0.01 / 13);
		upgrade("Cheap hoes"					).scalesBuildingCps(BuildingIndex.Farm, 2);
		upgrade("Fertilizer"					).scalesBuildingCps(BuildingIndex.Farm, 2);
		upgrade("Cookie trees"					).scalesBuildingCps(BuildingIndex.Farm, 2);
		upgrade("Genetically-modified cookies"	).scalesBuildingCps(BuildingIndex.Farm, 2);
		upgrade("Gingerbread scarecrows"		).scalesBuildingCps(BuildingIndex.Farm, 2);
		upgrade("Pulsar sprinklers"				).scalesBuildingCps(BuildingIndex.Farm, 2);
		upgrade("Fudge fungus"					).scalesBuildingCps(BuildingIndex.Farm, 2);
		upgrade("Wheat triffids"				).scalesBuildingCps(BuildingIndex.Farm, 2);
		upgrade("Humane pesticides"				).scalesBuildingCps(BuildingIndex.Farm, 2);
		upgrade("Sugar gas"						).scalesBuildingCps(BuildingIndex.Mine, 2);
		upgrade("Megadrill"						).scalesBuildingCps(BuildingIndex.Mine, 2);
		upgrade("Ultradrill"					).scalesBuildingCps(BuildingIndex.Mine, 2);
		upgrade("Ultimadrill"					).scalesBuildingCps(BuildingIndex.Mine, 2);
		upgrade("H-bomb mining"					).scalesBuildingCps(BuildingIndex.Mine, 2);
		upgrade("Coreforge"						).scalesBuildingCps(BuildingIndex.Mine, 2);
		upgrade("Planetsplitters"				).scalesBuildingCps(BuildingIndex.Mine, 2);
		upgrade("Canola oil wells"				).scalesBuildingCps(BuildingIndex.Mine, 2);
		upgrade("Mole people"					).scalesBuildingCps(BuildingIndex.Mine, 2);
		upgrade("Sturdier conveyor belts"		).scalesBuildingCps(BuildingIndex.Factory, 2);
		upgrade("Child labor"					).scalesBuildingCps(BuildingIndex.Factory, 2);
		upgrade("Sweatshop"						).scalesBuildingCps(BuildingIndex.Factory, 2);
		upgrade("Radium reactors"				).scalesBuildingCps(BuildingIndex.Factory, 2);
		upgrade("Recombobulators"				).scalesBuildingCps(BuildingIndex.Factory, 2);
		upgrade("Deep-bake process"				).scalesBuildingCps(BuildingIndex.Factory, 2);
		upgrade("Cyborg workforce"				).scalesBuildingCps(BuildingIndex.Factory, 2);
		upgrade("78-hour days"					).scalesBuildingCps(BuildingIndex.Factory, 2);
		upgrade("Machine learning"				).scalesBuildingCps(BuildingIndex.Factory, 2);
		upgrade("Taller tellers"				).scalesBuildingCps(BuildingIndex.Bank, 2);
		upgrade("Scissor-resistant credit cards").scalesBuildingCps(BuildingIndex.Bank, 2);
		upgrade("Acid-proof vaults"				).scalesBuildingCps(BuildingIndex.Bank, 2);
		upgrade("Chocolate coins"				).scalesBuildingCps(BuildingIndex.Bank, 2);
		upgrade("Exponential interest rates"	).scalesBuildingCps(BuildingIndex.Bank, 2);
		upgrade("Financial zen"					).scalesBuildingCps(BuildingIndex.Bank, 2);
		upgrade("Way of the wallet"				).scalesBuildingCps(BuildingIndex.Bank, 2);
		upgrade("The stuff rationale"			).scalesBuildingCps(BuildingIndex.Bank, 2);
		upgrade("Edible money"					).scalesBuildingCps(BuildingIndex.Bank, 2);
		upgrade("Golden idols"					).scalesBuildingCps(BuildingIndex.Temple, 2);
		upgrade("Sacrifices"					).scalesBuildingCps(BuildingIndex.Temple, 2);
		upgrade("Delicious blessing"			).scalesBuildingCps(BuildingIndex.Temple, 2);
		upgrade("Sun festival"					).scalesBuildingCps(BuildingIndex.Temple, 2);
		upgrade("Enlarged pantheon"				).scalesBuildingCps(BuildingIndex.Temple, 2);
		upgrade("Great Baker in the sky"		).scalesBuildingCps(BuildingIndex.Temple, 2);
		upgrade("Creation myth"					).scalesBuildingCps(BuildingIndex.Temple, 2);
		upgrade("Theocracy"						).scalesBuildingCps(BuildingIndex.Temple, 2);
		upgrade("Sick rap prayers"				).scalesBuildingCps(BuildingIndex.Temple, 2);
		upgrade("Pointier hats"					).scalesBuildingCps(BuildingIndex.WizardTower, 2);
		upgrade("Beardlier beards"				).scalesBuildingCps(BuildingIndex.WizardTower, 2);
		upgrade("Ancient grimoires"				).scalesBuildingCps(BuildingIndex.WizardTower, 2);
		upgrade("Kitchen curses"				).scalesBuildingCps(BuildingIndex.WizardTower, 2);
		upgrade("School of sorcery"				).scalesBuildingCps(BuildingIndex.WizardTower, 2);
		upgrade("Dark formulas"					).scalesBuildingCps(BuildingIndex.WizardTower, 2);
		upgrade("Cookiemancy"					).scalesBuildingCps(BuildingIndex.WizardTower, 2);
		upgrade("Rabbit trick"					).scalesBuildingCps(BuildingIndex.WizardTower, 2);
		upgrade("Deluxe tailored wands"			).scalesBuildingCps(BuildingIndex.WizardTower, 2);
		upgrade("Vanilla nebulae"				).scalesBuildingCps(BuildingIndex.Shipment, 2);
		upgrade("Wormholes"						).scalesBuildingCps(BuildingIndex.Shipment, 2);
		upgrade("Frequent flyer"				).scalesBuildingCps(BuildingIndex.Shipment, 2);
		upgrade("Warp drive"					).scalesBuildingCps(BuildingIndex.Shipment, 2);
		upgrade("Chocolate monoliths"			).scalesBuildingCps(BuildingIndex.Shipment, 2);
		upgrade("Generation ship"				).scalesBuildingCps(BuildingIndex.Shipment, 2);
		upgrade("Dyson sphere"					).scalesBuildingCps(BuildingIndex.Shipment, 2);
		upgrade("The final frontier"			).scalesBuildingCps(BuildingIndex.Shipment, 2);
		upgrade("Autopilot"						).scalesBuildingCps(BuildingIndex.Shipment, 2);
		upgrade("Antimony"						).scalesBuildingCps(BuildingIndex.AlchemyLab, 2);
		upgrade("Essence of dough"				).scalesBuildingCps(BuildingIndex.AlchemyLab, 2);
		upgrade("True chocolate"				).scalesBuildingCps(BuildingIndex.AlchemyLab, 2);
		upgrade("Ambrosia"						).scalesBuildingCps(BuildingIndex.AlchemyLab, 2);
		upgrade("Aqua crustulae"				).scalesBuildingCps(BuildingIndex.AlchemyLab, 2);
		upgrade("Origin crucible"				).scalesBuildingCps(BuildingIndex.AlchemyLab, 2);
		upgrade("Theory of atomic fluidity"		).scalesBuildingCps(BuildingIndex.AlchemyLab, 2);
		upgrade("Beige goo"						).scalesBuildingCps(BuildingIndex.AlchemyLab, 2);
		upgrade("The advent of chemistry"		).scalesBuildingCps(BuildingIndex.AlchemyLab, 2);
		upgrade("Ancient tablet"				).scalesBuildingCps(BuildingIndex.Portal, 2);
		upgrade("Insane oatling workers"		).scalesBuildingCps(BuildingIndex.Portal, 2);
		upgrade("Soul bond"						).scalesBuildingCps(BuildingIndex.Portal, 2);
		upgrade("Sanity dance"					).scalesBuildingCps(BuildingIndex.Portal, 2);
		upgrade("Brane transplant"				).scalesBuildingCps(BuildingIndex.Portal, 2);
		upgrade("Deity-sized portals"			).scalesBuildingCps(BuildingIndex.Portal, 2);
		upgrade("End of times back-up plan"		).scalesBuildingCps(BuildingIndex.Portal, 2);
		upgrade("Maddening chants"				).scalesBuildingCps(BuildingIndex.Portal, 2);
		upgrade("The real world"				).scalesBuildingCps(BuildingIndex.Portal, 2);
		upgrade("Flux capacitors"				).scalesBuildingCps(BuildingIndex.TimeMachine, 2);
		upgrade("Time paradox resolver"			).scalesBuildingCps(BuildingIndex.TimeMachine, 2);
		upgrade("Quantum conundrum"				).scalesBuildingCps(BuildingIndex.TimeMachine, 2);
		upgrade("Causality enforcer"			).scalesBuildingCps(BuildingIndex.TimeMachine, 2);
		upgrade("Yestermorrow comparators"		).scalesBuildingCps(BuildingIndex.TimeMachine, 2);
		upgrade("Far future enactment"			).scalesBuildingCps(BuildingIndex.TimeMachine, 2);
		upgrade("Great loop hypothesis"			).scalesBuildingCps(BuildingIndex.TimeMachine, 2);
		upgrade("Cookietopian moments of maybe"	).scalesBuildingCps(BuildingIndex.TimeMachine, 2);
		upgrade("Second seconds"				).scalesBuildingCps(BuildingIndex.TimeMachine, 2);
		upgrade("Sugar bosons"					).scalesBuildingCps(BuildingIndex.AntimatterCondenser, 2);
		upgrade("String theory"					).scalesBuildingCps(BuildingIndex.AntimatterCondenser, 2);
		upgrade("Large macaron collider"		).scalesBuildingCps(BuildingIndex.AntimatterCondenser, 2);
		upgrade("Big bang bake"					).scalesBuildingCps(BuildingIndex.AntimatterCondenser, 2);
		upgrade("Reverse cyclotrons"			).scalesBuildingCps(BuildingIndex.AntimatterCondenser, 2);
		upgrade("Nanocosmics"					).scalesBuildingCps(BuildingIndex.AntimatterCondenser, 2);
		upgrade("The Pulse"						).scalesBuildingCps(BuildingIndex.AntimatterCondenser, 2);
		upgrade("Some other super-tiny fundamental particle? Probably?"	).scalesBuildingCps(BuildingIndex.AntimatterCondenser, 2);
		upgrade("Quantum comb"					).scalesBuildingCps(BuildingIndex.AntimatterCondenser, 2);
		upgrade("Gem polish"					).scalesBuildingCps(BuildingIndex.Prism, 2);
		upgrade("9th color"						).scalesBuildingCps(BuildingIndex.Prism, 2);
		upgrade("Chocolate light"				).scalesBuildingCps(BuildingIndex.Prism, 2);
		upgrade("Grainbow"						).scalesBuildingCps(BuildingIndex.Prism, 2);
		upgrade("Pure cosmic light"				).scalesBuildingCps(BuildingIndex.Prism, 2);
		upgrade("Glow-in-the-dark"				).scalesBuildingCps(BuildingIndex.Prism, 2);
		upgrade("Lux sanctorum"					).scalesBuildingCps(BuildingIndex.Prism, 2);
		upgrade("Reverse shadows"				).scalesBuildingCps(BuildingIndex.Prism, 2);
		upgrade("Crystal mirrors"				).scalesBuildingCps(BuildingIndex.Prism, 2);
		upgrade("Your lucky cookie"				).scalesBuildingCps(BuildingIndex.Chancemaker, 2);
		upgrade('"All Bets Are Off" magic coin' ).scalesBuildingCps(BuildingIndex.Chancemaker, 2);
		upgrade("Winning lottery ticket" 		).scalesBuildingCps(BuildingIndex.Chancemaker, 2);
		upgrade("Four-leaf clover field" 		).scalesBuildingCps(BuildingIndex.Chancemaker, 2);
		upgrade("A recipe book about books"		).scalesBuildingCps(BuildingIndex.Chancemaker, 2);
		upgrade("Leprechaun village"			).scalesBuildingCps(BuildingIndex.Chancemaker, 2);
		upgrade("Improbability drive"			).scalesBuildingCps(BuildingIndex.Chancemaker, 2);
		upgrade("Antisuperstistronics"			).scalesBuildingCps(BuildingIndex.Chancemaker, 2);
		upgrade("Bunnypedes"					).scalesBuildingCps(BuildingIndex.Chancemaker, 2);
		
		// Upgrades that increase cookie production
		cookie("Plain cookies"							).scalesProduction(1.01);
		cookie("Sugar cookies"							).scalesProduction(1.01);
		cookie("Oatmeal raisin cookies"					).scalesProduction(1.01);
		cookie("Peanut butter cookies"					).scalesProduction(1.01);
		cookie("Coconut cookies"						).scalesProduction(1.01);
		cookie("White chocolate cookies"				).scalesProduction(1.02);
		cookie("Macadamia nut cookies"					).scalesProduction(1.02);
		cookie("Double-chip cookies"					).scalesProduction(1.02);
		cookie("White chocolate macadamia nut cookies"	).scalesProduction(1.02);
		cookie("All-chocolate cookies"					).scalesProduction(1.02);
		cookie("Dark chocolate-coated cookies"			).scalesProduction(1.04);
		cookie("White chocolate-coated cookies"			).scalesProduction(1.04);
		cookie("Eclipse cookies"						).scalesProduction(1.02);
		cookie("Zebra cookies"							).scalesProduction(1.02);
		cookie("Snickerdoodles"							).scalesProduction(1.02);
		cookie("Stroopwafels"							).scalesProduction(1.02);
		cookie("Macaroons"								).scalesProduction(1.02);
		cookie("Empire biscuits"						).scalesProduction(1.02);
		cookie("Madeleines"								).scalesProduction(1.02);
		cookie("Palmiers"								).scalesProduction(1.02);
		cookie("Palets"									).scalesProduction(1.02);
		cookie("Sabl&eacute;s"							).scalesProduction(1.02);
		cookie("Gingerbread men"						).scalesProduction(1.02);
		cookie("Gingerbread trees"						).scalesProduction(1.02);
		cookie("Pure black chocolate cookies"			).scalesProduction(1.04);
		cookie("Pure white chocolate cookies"			).scalesProduction(1.04);
		cookie("Ladyfingers"							).scalesProduction(1.03);
		cookie("Tuiles"									).scalesProduction(1.03);
		cookie("Chocolate-stuffed biscuits"				).scalesProduction(1.03);
		cookie("Checker cookies"						).scalesProduction(1.03);
		cookie("Butter cookies"							).scalesProduction(1.03);
		cookie("Cream cookies"							).scalesProduction(1.03);
		cookie("Gingersnaps"							).scalesProduction(1.04);
		cookie("Cinnamon cookies"						).scalesProduction(1.04);
		cookie("Vanity cookies"							).scalesProduction(1.04);
		cookie("Cigars"									).scalesProduction(1.04);
		cookie("Pinwheel cookies"						).scalesProduction(1.04);
		cookie("Fudge squares"							).scalesProduction(1.04);
		cookie("Shortbread biscuits"					).scalesProduction(1.04);
		cookie("Millionaires' shortbreads"				).scalesProduction(1.04);
		cookie("Caramel cookies"						).scalesProduction(1.04);
		cookie("Pecan sandies"							).scalesProduction(1.04);
		cookie("Moravian spice cookies"					).scalesProduction(1.04);
		cookie("Milk chocolate butter biscuit"			).scalesProduction(1.10);
		cookie("Anzac biscuits"							).scalesProduction(1.04);
		cookie("Buttercakes"							).scalesProduction(1.04);
		cookie("Ice cream sandwiches"					).scalesProduction(1.04);
		cookie("Dragon cookie"							).scalesProduction(1.05);
		cookie("Dark chocolate butter biscuit"			).scalesProduction(1.10);
		cookie("White chocolate butter biscuit"			).scalesProduction(1.10);
		cookie("Ruby chocolate butter biscuit"			).scalesProduction(1.10);
		cookie("Lavender chocolate butter biscuit"		).scalesProduction(1.10);
		cookie("Birthday cookie"						).scalesProductionByAge(0.01);

		// Golden cookie upgrade functions
		upgrade("Lucky day"						).scalesGoldenCookieFrequency(2).scalesGoldenCookieDuration(2);
		upgrade("Serendipity"					).scalesGoldenCookieFrequency(2).scalesGoldenCookieDuration(2);
		upgrade("Get lucky"						).scalesGoldenCookieEffectDuration(2);

		// Research centre related upgrades
		upgrade("Bingo center/Research facility").scalesBuildingCps(BuildingIndex.Grandma, 4);
		upgrade("Specialized chocolate chips"	).scalesProduction(1.01);
		upgrade("Designer cocoa beans"			).scalesProduction(1.02);
		upgrade("Ritual rolling pins"			).scalesBuildingCps(BuildingIndex.Grandma, 2);
		upgrade("Underworld ovens"				).scalesProduction(1.03);
		upgrade("One mind"						).givesPerBuildingBoost(BuildingIndex.Grandma, BuildingIndex.Grandma, 0.02).angersGrandmas();
		upgrade("Exotic nuts"					).scalesProduction(1.04);
		upgrade("Communal brainsweep"			).givesPerBuildingBoost(BuildingIndex.Grandma, BuildingIndex.Grandma, 0.02).angersGrandmas();
		upgrade("Arcane sugar"					).scalesProduction(1.05);
		upgrade("Elder Pact"					).givesPerBuildingBoost(BuildingIndex.Grandma, BuildingIndex.Portal, 0.05).angersGrandmas();
		upgrade("Sacrificial rolling pins"		).doublesElderPledge();

		// Assorted cursor / clicking upgrades
		upgrade("Reinforced index finger"		).scalesBaseClicking(2).scalesBuildingCps(BuildingIndex.Cursor, 2);
		upgrade("Carpal tunnel prevention cream").scalesBaseClicking(2).scalesBuildingCps(BuildingIndex.Cursor, 2);
		upgrade("Ambidextrous"					).scalesBaseClicking(2).scalesBuildingCps(BuildingIndex.Cursor, 2);
		upgrade("Thousand fingers"				).givesBuildingPerBuildingFlatCpsBoost(BuildingIndex.Cursor, [BuildingIndex.Cursor], 0.1).givesPerBuildingFlatCpcBoost([BuildingIndex.Cursor], 0.1);
		upgrade("Million fingers"				).givesBuildingPerBuildingFlatCpsBoost(BuildingIndex.Cursor, [BuildingIndex.Cursor], 0.5).givesPerBuildingFlatCpcBoost([BuildingIndex.Cursor], 0.5);
		upgrade("Billion fingers"				).givesBuildingPerBuildingFlatCpsBoost(BuildingIndex.Cursor, [BuildingIndex.Cursor], 5).givesPerBuildingFlatCpcBoost([BuildingIndex.Cursor], 5);
		upgrade("Trillion fingers"				).givesBuildingPerBuildingFlatCpsBoost(BuildingIndex.Cursor, [BuildingIndex.Cursor], 50).givesPerBuildingFlatCpcBoost([BuildingIndex.Cursor], 50);
		upgrade("Quadrillion fingers"			).givesBuildingPerBuildingFlatCpsBoost(BuildingIndex.Cursor, [BuildingIndex.Cursor], 500).givesPerBuildingFlatCpcBoost([BuildingIndex.Cursor], 500);
		upgrade("Quintillion fingers"			).givesBuildingPerBuildingFlatCpsBoost(BuildingIndex.Cursor, [BuildingIndex.Cursor], 5000).givesPerBuildingFlatCpcBoost([BuildingIndex.Cursor], 5000);
		upgrade("Sextillion fingers"			).givesBuildingPerBuildingFlatCpsBoost(BuildingIndex.Cursor, [BuildingIndex.Cursor], 50000).givesPerBuildingFlatCpcBoost([BuildingIndex.Cursor], 50000);
		upgrade("Septillion fingers"			).givesBuildingPerBuildingFlatCpsBoost(BuildingIndex.Cursor, [BuildingIndex.Cursor], 500000).givesPerBuildingFlatCpcBoost([BuildingIndex.Cursor], 500000);
		upgrade("Octillion fingers"				).givesBuildingPerBuildingFlatCpsBoost(BuildingIndex.Cursor, [BuildingIndex.Cursor], 5000000).givesPerBuildingFlatCpcBoost([BuildingIndex.Cursor], 5000000);
		upgrade("Plastic mouse"					).boostsClickCps(0.01);
		upgrade("Iron mouse"					).boostsClickCps(0.01);
		upgrade("Titanium mouse"				).boostsClickCps(0.01);
		upgrade("Adamantium mouse"				).boostsClickCps(0.01);
		upgrade("Unobtainium mouse"				).boostsClickCps(0.01);
		upgrade("Unobtainium mouse"				).boostsClickCps(0.01);
		upgrade("Eludium mouse"					).boostsClickCps(0.01);
		upgrade("Wishalloy mouse"				).boostsClickCps(0.01);
		upgrade("Fantasteel mouse"				).boostsClickCps(0.01);
		upgrade("Nevercrack mouse"				).boostsClickCps(0.01);
		upgrade("Armythril mouse"				).boostsClickCps(0.01);

		// Milk increases
		upgrade("Kitten helpers"							).unlocksMilk(0.1);
		upgrade("Kitten workers"							).unlocksMilk(0.125);
		upgrade("Kitten engineers"							).unlocksMilk(0.15);
		upgrade("Kitten overseers"							).unlocksMilk(0.175);
		upgrade("Kitten managers"							).unlocksMilk(0.2);
		upgrade("Kitten accountants"						).unlocksMilk(0.2);
		upgrade("Kitten specialists"						).unlocksMilk(0.2);
		upgrade("Kitten experts"							).unlocksMilk(0.2);
		upgrade("Kitten consultants"						).unlocksMilk(0.2);
		upgrade("Kitten assistants to the regional manager"	).unlocksMilk(0.2);

		// Prestige power unlocks
		upgrade("Heavenly chip secret"	).unlocksPrestige(0.05);
		upgrade("Heavenly cookie stand"	).unlocksPrestige(0.20);
		upgrade("Heavenly bakery"		).unlocksPrestige(0.25);
		upgrade("Heavenly confectionery").unlocksPrestige(0.25);
		upgrade("Heavenly key"			).unlocksPrestige(0.25);

		// Dragon unlock
		upgrade("A crumbly egg"			).requires("How to bake your dragon");

		// Christmas season
		upgrade("A festive hat"				).requiresSeason("christmas");
		upgrade("Naughty list"				).requiresSeason("christmas").isRandomSantaReward().scalesBuildingCps(BuildingIndex.Grandma, 2);
		upgrade("A lump of coal"			).requiresSeason("christmas").isRandomSantaReward().scalesProduction(1.01);
		upgrade("An itchy sweater"			).requiresSeason("christmas").isRandomSantaReward().scalesProduction(1.01);
		upgrade("Improved jolliness"		).requiresSeason("christmas").isRandomSantaReward().scalesProduction(1.15);
		upgrade("Increased merriness"		).requiresSeason("christmas").isRandomSantaReward().scalesProduction(1.15);
		upgrade("Toy workshop"				).requiresSeason("christmas").isRandomSantaReward().scalesUpgradePrice(0.95);
		upgrade("Santa's helpers"			).requiresSeason("christmas").isRandomSantaReward().scalesClicking(1.1);
		upgrade("Santa's milk and cookies"	).requiresSeason("christmas").isRandomSantaReward().scalesMilk(1.05);
		upgrade("Santa's legacy"			).requiresSeason("christmas").isRandomSantaReward().boostsSantaPower(0.03);
		upgrade("Season savings"			).requiresSeason("christmas").isRandomSantaReward().scalesBuildingPrice(0.99);
		upgrade("Ho ho ho-flavored frosting").requiresSeason("christmas").isRandomSantaReward().scalesReindeer(2);
		upgrade("Weighted sleighs"			).requiresSeason("christmas").isRandomSantaReward().scalesReindeerDuration(2);
		upgrade("Reindeer baking grounds"	).requiresSeason("christmas").isRandomSantaReward().scalesReindeerFrequency(2);
		upgrade("Santa's bottomless bag"	).requiresSeason("christmas").isRandomSantaReward().scalesRandomDropFrequency(1.1);
		upgrade("Santa's dominion"			).requiresSeason("christmas").requires("Final Claus").scalesProduction(1.20).scalesBuildingPrice(0.99).scalesUpgradePrice(0.98);
		this.santa.levels[0].requires("A festive hat");

		// Easter season
		upgrade("Chicken egg"				).requiresSeason("easter").isAnEgg().scalesProduction(1.01);
		upgrade("Duck egg"					).requiresSeason("easter").isAnEgg().scalesProduction(1.01);
		upgrade("Turkey egg"				).requiresSeason("easter").isAnEgg().scalesProduction(1.01);
		upgrade("Robin egg"					).requiresSeason("easter").isAnEgg().scalesProduction(1.01);
		upgrade("Cassowary egg"				).requiresSeason("easter").isAnEgg().scalesProduction(1.01);
		upgrade("Ostrich egg"				).requiresSeason("easter").isAnEgg().scalesProduction(1.01);
		upgrade("Quail egg"					).requiresSeason("easter").isAnEgg().scalesProduction(1.01);
		upgrade("Salmon roe"				).requiresSeason("easter").isAnEgg().scalesProduction(1.01);
		upgrade("Frogspawn"					).requiresSeason("easter").isAnEgg().scalesProduction(1.01);
		upgrade("Shark egg"					).requiresSeason("easter").isAnEgg().scalesProduction(1.01);
		upgrade("Turtle egg"				).requiresSeason("easter").isAnEgg().scalesProduction(1.01);
		upgrade("Ant larva"					).requiresSeason("easter").isAnEgg().scalesProduction(1.01);
		upgrade("Golden goose egg"			).requiresSeason("easter").isARareEgg().scalesGoldenCookieFrequency(1.05);
		upgrade("Cookie egg"				).requiresSeason("easter").isARareEgg().scalesClicking(1.1);
		upgrade("Faberge egg"				).requiresSeason("easter").isARareEgg().scalesBuildingPrice(0.99).scalesUpgradePrice(0.99);
		upgrade("\"egg\""					).requiresSeason("easter").isARareEgg().boostsBaseCps(9);
		upgrade("Century egg"				).requiresSeason("easter").isARareEgg().scalesCenturyMultiplier(1.1);
		upgrade("Omelette"					).requiresSeason("easter").isARareEgg();	// Other eggs appear 10% more often
		upgrade("Wrinklerspawn"				).requiresSeason("easter").isARareEgg();	// Wrinklers explode 5% more cookies
		upgrade("Chocolate egg"				).requiresSeason("easter").isARareEgg();	// Spawns a lot of cookies
		
		// Halloween season
		cookie("Bat cookies"				).requiresSeason("halloween").scalesProduction(1.02);
		cookie("Eyeball cookies"			).requiresSeason("halloween").scalesProduction(1.02);
		cookie("Ghost cookies"				).requiresSeason("halloween").scalesProduction(1.02);
		cookie("Pumpkin cookies"			).requiresSeason("halloween").scalesProduction(1.02);
		cookie("Skull cookies"				).requiresSeason("halloween").scalesProduction(1.02);
		cookie("Slime cookies"				).requiresSeason("halloween").scalesProduction(1.02);
		cookie("Spider cookies"				).requiresSeason("halloween").scalesProduction(1.02);
		
		// Valentines Day season
		cookie("Pure heart biscuits"		).requiresSeason("valentines").givesHeartCookie();
		cookie("Ardent heart biscuits"		).requiresSeason("valentines").givesHeartCookie();
		cookie("Sour heart biscuits"		).requiresSeason("valentines").givesHeartCookie();
		cookie("Weeping heart biscuits"		).requiresSeason("valentines").givesHeartCookie();
		cookie("Golden heart biscuits"		).requiresSeason("valentines").givesHeartCookie();
		cookie("Eternal heart biscuits"		).requiresSeason("valentines").givesHeartCookie();
		
		// Biscuits from clicking reindeer
		cookie("Christmas tree biscuits"	).requiresSeason("christmas").scalesProduction(1.02);
		cookie("Snowflake biscuits"			).requiresSeason("christmas").scalesProduction(1.02);
		cookie("Snowman biscuits"			).requiresSeason("christmas").scalesProduction(1.02);
		cookie("Holly biscuits"				).requiresSeason("christmas").scalesProduction(1.02);
		cookie("Candy cane biscuits"		).requiresSeason("christmas").scalesProduction(1.02);
		cookie("Bell biscuits"				).requiresSeason("christmas").scalesProduction(1.02);
		cookie("Present biscuits"			).requiresSeason("christmas").scalesProduction(1.02);

		// Unlocks from "Tin of butter cookies"
		cookie("Butter horseshoes"	).requires("Tin of butter cookies").scalesProduction(1.04);
		cookie("Butter pucks"		).requires("Tin of butter cookies").scalesProduction(1.04);
		cookie("Butter knots"		).requires("Tin of butter cookies").scalesProduction(1.04);
		cookie("Butter slabs"		).requires("Tin of butter cookies").scalesProduction(1.04);
		cookie("Butter swirls"		).requires("Tin of butter cookies").scalesProduction(1.04);

		// Unlocks from "Tin of british tea biscuits"
		cookie("British tea biscuits"									).requires("Tin of british tea biscuits").scalesProduction(1.02);
		cookie("Chocolate british tea biscuits"							).requires("Tin of british tea biscuits").scalesProduction(1.02);
		cookie("Round british tea biscuits"								).requires("Tin of british tea biscuits").scalesProduction(1.02);
		cookie("Round chocolate british tea biscuits"					).requires("Tin of british tea biscuits").scalesProduction(1.02);
		cookie("Round british tea biscuits with heart motif"			).requires("Tin of british tea biscuits").scalesProduction(1.02);
		cookie("Round chocolate british tea biscuits with heart motif"	).requires("Tin of british tea biscuits").scalesProduction(1.02);

		// Unlocks from "Box of brand biscuits"
		cookie("Fig gluttons"		).requires("Box of brand biscuits").scalesProduction(1.02);
		cookie("Loreols"			).requires("Box of brand biscuits").scalesProduction(1.02);
		cookie("Grease's cups"		).requires("Box of brand biscuits").scalesProduction(1.02);
		cookie("Jaffa cakes"		).requires("Box of brand biscuits").scalesProduction(1.02);
		cookie("Digits"				).requires("Box of brand biscuits").scalesProduction(1.02);
		cookie("Caramoas"			).requires("Box of brand biscuits").scalesProduction(1.03);
		cookie("Sagalongs"			).requires("Box of brand biscuits").scalesProduction(1.03);
		cookie("Shortfoils"			).requires("Box of brand biscuits").scalesProduction(1.03);
		cookie("Win mints"			).requires("Box of brand biscuits").scalesProduction(1.03);
		cookie("Lombardia cookies"	).requires("Box of brand biscuits").scalesProduction(1.03);
		cookie("Bastenaken cookies"	).requires("Box of brand biscuits").scalesProduction(1.03);

		// Unlocks from "Box of macarons"
		cookie("Rose macarons"		).requires("Box of macarons").scalesProduction(1.03);
		cookie("Lemon macarons"		).requires("Box of macarons").scalesProduction(1.03);
		cookie("Chocolate macarons"	).requires("Box of macarons").scalesProduction(1.03);
		cookie("Pistachio macarons"	).requires("Box of macarons").scalesProduction(1.03);
		cookie("Violet macarons"	).requires("Box of macarons").scalesProduction(1.03);
		cookie("Hazelnut macarons"	).requires("Box of macarons").scalesProduction(1.03);
		cookie("Caramel macarons"	).requires("Box of macarons").scalesProduction(1.03);
		cookie("Licorice macarons"	).requires("Box of macarons").scalesProduction(1.03);

		// Synergies Vol. I
		synergy("Seismic magic"					).requires("Synergies Vol. I").givesSynergy(BuildingIndex.Mine, BuildingIndex.WizardTower, 0.05, 0.001);
		synergy("Fossil fuels"					).requires("Synergies Vol. I").givesSynergy(BuildingIndex.Mine, BuildingIndex.Shipment, 0.05, 0.001);
		synergy("Primordial ores"				).requires("Synergies Vol. I").givesSynergy(BuildingIndex.Mine, BuildingIndex.AlchemyLab, 0.05, 0.001);
		synergy("Arcane knowledge"				).requires("Synergies Vol. I").givesSynergy(BuildingIndex.WizardTower, BuildingIndex.AlchemyLab, 0.05, 0.001);
		synergy("Infernal crops"				).requires("Synergies Vol. I").givesSynergy(BuildingIndex.Farm, BuildingIndex.Portal, 0.05, 0.001);
		synergy("Contracts from beyond"			).requires("Synergies Vol. I").givesSynergy(BuildingIndex.Bank, BuildingIndex.Portal, 0.05, 0.001);
		synergy("Paganism"						).requires("Synergies Vol. I").givesSynergy(BuildingIndex.Temple, BuildingIndex.Portal, 0.05, 0.001);
		synergy("Future almanacs"				).requires("Synergies Vol. I").givesSynergy(BuildingIndex.Farm, BuildingIndex.TimeMachine, 0.05, 0.001);
		synergy("Relativistic parsec-skipping"	).requires("Synergies Vol. I").givesSynergy(BuildingIndex.Shipment, BuildingIndex.TimeMachine, 0.05, 0.001);
		synergy("Quantum electronics"			).requires("Synergies Vol. I").givesSynergy(BuildingIndex.Factory, BuildingIndex.AntimatterCondenser, 0.05, 0.001);
		synergy("Extra physics funding"			).requires("Synergies Vol. I").givesSynergy(BuildingIndex.Bank, BuildingIndex.AntimatterCondenser, 0.05, 0.001);
		synergy("Light magic"					).requires("Synergies Vol. I").givesSynergy(BuildingIndex.WizardTower, BuildingIndex.Prism, 0.05, 0.001);
		synergy("Gemmed talismans"				).requires("Synergies Vol. I").givesSynergy(BuildingIndex.Mine, BuildingIndex.Chancemaker, 0.05, 0.001);

		// Synergies Vol. II
		synergy("Printing presses"				).requires("Synergies Vol. II").givesSynergy(BuildingIndex.Factory, BuildingIndex.Bank, 0.05, 0.001);
		synergy("Rain prayer"					).requires("Synergies Vol. II").givesSynergy(BuildingIndex.Farm, BuildingIndex.Temple, 0.05, 0.001);
		synergy("Magical botany"				).requires("Synergies Vol. II").givesSynergy(BuildingIndex.Farm, BuildingIndex.WizardTower, 0.05, 0.001);
		synergy("Asteroid mining"				).requires("Synergies Vol. II").givesSynergy(BuildingIndex.Mine, BuildingIndex.Shipment, 0.05, 0.001);
		synergy("Shipyards"						).requires("Synergies Vol. II").givesSynergy(BuildingIndex.Factory, BuildingIndex.Shipment, 0.05, 0.001);
		synergy("Gold fund"						).requires("Synergies Vol. II").givesSynergy(BuildingIndex.Bank, BuildingIndex.AlchemyLab, 0.05, 0.001);
		synergy("Temporal overclocking"			).requires("Synergies Vol. II").givesSynergy(BuildingIndex.Factory, BuildingIndex.TimeMachine, 0.05, 0.001);
		synergy("God particle"					).requires("Synergies Vol. II").givesSynergy(BuildingIndex.Temple, BuildingIndex.AntimatterCondenser, 0.05, 0.001);
		synergy("Chemical proficiency"			).requires("Synergies Vol. II").givesSynergy(BuildingIndex.AlchemyLab, BuildingIndex.AntimatterCondenser, 0.05, 0.001);
		synergy("Mystical energies"				).requires("Synergies Vol. II").givesSynergy(BuildingIndex.Temple, BuildingIndex.Prism, 0.05, 0.001);
		synergy("Abysmal glimmer"				).requires("Synergies Vol. II").givesSynergy(BuildingIndex.Portal, BuildingIndex.Prism, 0.05, 0.001);
		synergy("Primeval glow"					).requires("Synergies Vol. II").givesSynergy(BuildingIndex.TimeMachine, BuildingIndex.Prism, 0.05, 0.001);
		synergy("Charm quarks"					).requires("Synergies Vol. II").givesSynergy(BuildingIndex.AntimatterCondenser, BuildingIndex.Chancemaker, 0.05, 0.001);

		// Elder pledge and other toggles
		toggle("Elder Pledge"					).calmsGrandmas();
		toggle("Elder Covenant"					).calmsGrandmas().scalesProduction(0.95);
		toggle("Revoke Elder Covenant"			);  // Revokes Elder Covenant, just do nothing
		toggle("Background selector"			);	// Does nothing we care about
		toggle("Milk selector"					);	// Also does nothing we care about
		toggle("Golden cookie sound selector"	);
		toggle("Golden switch [on]"				).isAGoldenSwitch();
		toggle("Golden switch [off]"			).isAGoldenSwitch();
		
		// Just query all upgrades, gives a dump of those not supported
		var ukeys = Object.keys(Game.Upgrades);
		for (var key in ukeys) {
			if (Game.Upgrades[ukeys[key]].pool != "debug")
				this.getModifier(ukeys[key]);
		}

		this.reset();
	}

	pushSeason(season) {
		this.seasonStack.push(season);
	}

	popSeason() {
		this.seasonStack.pop();
	}

	reset() {
		var i = 0;

		// Reset anything that needs resetting
		for (i = 0; i < this.buildings.length; ++i)
			this.buildings[i].reset();
		for (var key in this.modifiers)
			this.modifiers[key].reset();
		for (var key in this.seasons)
			this.seasons[key].reset();
		this.santa.reset();
			
		// When the session started
		this.sessionStartTime = new Date().getTime();
		this.currentTime = new Date().getTime();

		// Mouse click information
		this.clickRate = 0;
		this.cpcMultiplier = 1;
		this.cpcBaseMultiplier = 1;
		this.cpcCpsMultiplier = 0;
		this.perBuildingFlatCpcBoostCounter = new BuildingCounter();

		// Production multiplier
		this.baseCps = 0;
		this.productionScale = 1;
		this.centuryMultiplier = 1;

		// Heavenly chips
		this.heavenlyChips = 0;

		// Prestige
		this.prestige = 0;
		this.prestigeScale = 1;
		this.prestigeUnlocked = 0;

		// Milk scaling
		this.milkAmount = 0;
		this.milkMultiplier = 1;
		this.milkUnlocks = [[],[]];

		// Game status indicators
		this.clickFrenzyMultiplier = 1;
		this.cursedFinger = false;

		// Golden cookie stuff information
		this.frenzyDuration = 77;
		this.goldenCookieTime = GOLDEN_COOKIE_AVG_INTERVAL;
		this.goldenCookieDuration = GOLDEN_COOKIE_DURATION;
		this.goldenCookieEffectDurationMultiplier = 1;

		// Reindeer stuff
		this.reindeerDuration = REINDEER_DURATION;
		this.reindeerTime = 180;
		this.reindeerMultiplier = 1;
		this.reindeerBuffMultiplier = 1;

		// Grandmatriarch stuff
		this.grandmatriarchStatus = GrandmatriarchLevel.Appeased;
		this.wrinklerMultiplier = 1;
		this.maxWrinklers = 10;

		// Easter eggs
		this.eggCount = 0;

		// Valentines day
		this.heartCookieScale = 1;
		this.heartCookieCount = 0;

		// Price reductions
		this.buildingPriceScale = 1;
		this.upgradePriceScale = 1;
		this.upgradePriceCursorScale = 1;
		this.cookieUpgradePriceMultiplier = 1;
		this.synergyUpgradePriceMultiplier = 1;
		this.upgradePriceCursorScaleEnabled = false;

		// Current season
		this.seasonChanges = 0;
		this.seasonStack = [this.seasons[""]];	// Default to no season

		this.errorMessage = "";
	}

	recalculateUpgradePriceCursorScale() {
		if (this.upgradePriceCursorScaleEnabled) {
			this.upgradePriceCursorScale = Math.pow(0.99, this.buildings[BuildingIndex.Cursor].quantity / 100);
		} else {
			this.upgradePriceCursorScale = 1;
		}
	}

	get season() {
		return this.seasonStack[0];
	}

	//
	// Effective CpS - boil down all the buffs and everything else to a single expected CpS value
	//

	effectiveCpsWithBuffs(buffs) {
		var eCps = this.getCps() + this.getCpc() * this.clickRate;
		return eCps;
	}

	effectiveCps() {
		// Bit over simplistic for now, assumes golden cookies alternate between multiply cookies and frenzy

		// Calculate baseline cps, passive + clicking
		var totalTime = this.goldenCookieTime * 2 / this.season.goldenCookieFrequencyScale;
		var frenzyTime = this.frenzyDuration * this.goldenCookieEffectDurationMultiplier;
		var normalTime = totalTime - frenzyTime;
		var regularCps = (normalTime * this.effectiveCpsWithBuffs([]) + frenzyTime * this.effectiveCpsWithBuffs(['Frenzy']) ) / totalTime;
		
		// Calculate reindeer cps
		var normalReindeerTime = normalTime - this.reindeerDuration;
		var frenzyReindeerTime = frenzyTime + this.reindeerDuration;
		var averageReindeer = (normalReindeerTime * this.cookiesPerReindeerWithBuffs([]) + frenzyReindeerTime * this.cookiesPerReindeerWithBuffs(['Frenzy'])) / totalTime;
		var averageReindeerCps = averageReindeer / this.reindeerTime;

		// Calculate golden cookie cps
		var normalLuckyTime = normalTime - this.goldenCookieDuration;
		var frenzyLuckyTime = frenzyTime + this.goldenCookieDuration;
		var averageLucky = (normalLuckyTime * this.cookiesPerLuckyWithBuffs([]) + frenzyLuckyTime * this.cookiesPerLuckyWithBuffs(['Frenzy'])) / totalTime;
		var averageLuckyCps = averageLucky / totalTime;

		return regularCps + averageReindeerCps + averageLuckyCps;
	}

	//
	// Reindeer stuff
	//

	cookiesPerReindeerWithBuffs(buffs) {
		var cpr = this.cookiesPerReindeer();
		return cpr;
	}

	cookiesPerReindeer(): number {
		const ReindeerCpsSeconds = 60;
		const ReindeerMinCookies = 25;

		let cookies: number = this.getCps() * ReindeerCpsSeconds * this.reindeerBuffMultiplier;
		return Math.max(ReindeerMinCookies, cookies) * this.reindeerMultiplier;
	}

	//
	// Lucky cookies
	//

	cookiesPerLuckyWithBuffs(buffs) {
		return this.cookiesPerLucky();
	}

	cookiesPerLucky() {
		// If we dont click them, they don't work
		if (!this.strategy.autoClickGoldenCookies) {
			return 0;
		}

		var cookies1 = this.getCps() * LUCKY_COOKIE_CPS_SECONDS;
		var cookies2 = cookies1; // cookieBank * 0.15;

		return Math.min(cookies1, cookies2) + LUCKY_COOKIE_FLAT_BONUS;
	}

	getModifier(name: string): Modifier {
		let upgrade = this.modifiers[name];
		if (!upgrade) {
			console.log("Unsupported upgrade: " + name);
			upgrade = new Upgrade(this, name); 
			upgrade.isUnsupported();
			this.modifiers[name] = upgrade;
		}
		return upgrade;
	}

	syncToGame(): void {
		const AchievementsPerMilk = 25;

		this.reset();
		for (let i = 0; i < Game.ObjectsById.length && i < this.buildings.length; ++i) {
			this.buildings[i].quantity = Game.ObjectsById[i].amount;
			this.buildings[i].free = Game.ObjectsById[i].free;
		}
		for (let i = 0; i < Game.UpgradesById.length; ++i) {
			if (Game.UpgradesById[i].bought == 1) {
				this.getModifier(Game.UpgradesById[i].name).apply();
			} else if (Game.UpgradesById[i].unlocked == 1) {
				this.getModifier(Game.UpgradesById[i].name).status = ModifierStatus.Available;
			}
		}
		this.heavenlyChips = Game.heavenlyChips;
		this.prestige = Game.prestige;
		this.milkAmount = Game.AchievementsOwned / AchievementsPerMilk;
		this.frenzyMultiplier = 1;
		this.clickFrenzyMultiplier = 1;
		this.seasonChanges = Game.seasonUses;
		for (let key in Game.buffs) {
			if (this.buffs[key]) {
				this.buffs[key].apply();
			} else {
				console.log("Unknown buff: " + key);
			}
		}
		this.seasonStack = [this.seasons[Game.season]];
		this.santa.level = Game.santaLevel;
		this.sessionStartTime = Game.startDate;
		this.currentTime = new Date().getTime();
	}
}

// Check that the values in the Simulator match those of the game, for debugging use
Simulator.prototype.matchesGame = function(equalityFunction=floatEqual) {
	var errMsg = "";
	// Check that Cps matches the game
	var cps = this.getCps();
	if (!equalityFunction(cps, Game.cookiesPs)) {
		errMsg += "- CpS - Predicted: " + this.getCps() + ", Actual: " + Game.cookiesPs + "\n";
	}
	// Check the Cpc matches the game
	var cpc = this.getCpc();
	var gcpc = Game.mouseCps();
	if (!equalityFunction(cpc, gcpc)) {
		errMsg += "- CpC - Predicted: " + cpc + ", Actual: " + gcpc + "\n";
	}
	// Check the building costs match the game
	var i;
	for (i = 0; i < this.buildings.length; ++i) {
		let { match, error } = this.buildings[i].matchesGame(equalityFunction);
		if (match == false) 
			errMsg += error;
	}

	// Check that all buildings are supported
	if (this.buildings.length != Game.ObjectsById.length)
		errMsg += "- Building getCount " + this.buildings.length + " does not match " + Game.ObjectsById.length + "\n";

	// Check that all available upgrade costs match those of similar upgrade functions
	for (i = 0; i < Game.UpgradesInStore.length; ++i) {
		let { match, error } = this.modifiers[Game.UpgradesInStore[i].name].matchesGame(equalityFunction);
		if (match == false)
			errMsg += error;
	}

	// Check that the season matches
	if (this.season.name != Game.season) {
		errMsg += "- Simulator season \"" + this.season.name + "\" does not match Game.season \"" + Game.season + "\"\n";
	}

	if (errMsg != "") {
		errMsg = "Simulator Mismatch:\n" + errMsg;
		for (var key in Game.buffs) {
			errMsg += "- Buff Active: " + key + "\n";
		}
	}
	this.errorMessage = errMsg;

	return this.errorMessage == "";
}

// Get the current cookies per click amount
Simulator.prototype.getCpc = function(ignoreCursedFinger = false) {
	// Add the per building flat boost first
	var cpc = this.perBuildingFlatCpcBoostCounter.getCount(this.buildings);
	
	// Add percentage of recular CpS
	cpc += this.getCps(true) * this.cpcCpsMultiplier;

	// Scale with normal CpC multipliers
	cpc += 1 * this.cpcBaseMultiplier;			// Base cpc

	// Scale with click multiplier
	cpc *= this.cpcMultiplier;

	// Scale with click frenzy
	cpc *= this.clickFrenzyMultiplier;
	
	if (ignoreCursedFinger || !this.cursedFinger)
		return cpc;
	return this.getCps(true) * this.buffs['Cursed finger'].duration * this.goldenCookieEffectDurationMultiplier;
}

// Calculate the total Cps generated by the game in this state
Simulator.prototype.getCps = function(ignoreCursedFinger = false) {
	var i;
	var j;

	var cps = this.baseCps;
	// Get the cps from buildings - start at 1, cursors generate clicks
	for (i = 0; i < this.buildings.length; ++i) {
		cps += this.buildings[i].cps;
	}

	// Scale it for production and heavely chip multipliers
	var santaScale = 1 + (this.santa.level + 1) * this.santa.power;
	var prestigeScale = this.prestige * this.prestigeScale * this.prestigeUnlocked * 0.01;
	var heartScale = Math.pow(1 + 0.02 * this.heartCookieScale, this.heartCookieCount);

	var scale = this.productionScale * heartScale * santaScale * (1 + prestigeScale);

	// Scale it for milk, two tiers to deal with ordering and minimise floating point errors
	for (i = 0; i < this.milkUnlocks.length; ++i) {
		for (j = 0; j < this.milkUnlocks[i].length; ++j) {
			scale *= (1 + this.milkUnlocks[i][j] * this.milkAmount * this.milkMultiplier);
		}
	}

	// Scale it for global production
	var sessionDays = Math.min(Math.floor((this.currentTime - this.sessionStartTime) / 1000 / 10) * 10 / 60 / 60 / 24, 100);
	var centuryMult = 1 + ((1 - Math.pow(1 - sessionDays / 100, 3)) * (this.centuryMultiplier - 1));

	scale *= centuryMult;
	scale *= this.frenzyMultiplier;

	cps *= scale;

	if (ignoreCursedFinger || !this.cursedFinger)
		return cps;
	return 0;
}

Simulator.prototype.getCookieChainMax = function(frenzy) {
	return this.getFrenziedCps(frenzy) * COOKIE_CHAIN_MULTIPLIER;
}

//
// Utility stuff and starting the app off
//

// Compare floats with an epsilon value
function floatEqual(a, b) {
	var eps = Math.abs(a - b) * 1000000000000.0;
	return eps <= Math.abs(a) && eps <= Math.abs(b);
}

console.log("Ultimate Cookie starting at " + new Date());

// Create the upgradeInfo and Ultimate Cookie instances
var uc = new UltimateCookie();
