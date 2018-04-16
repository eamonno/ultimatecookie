/// <reference path="strategy.ts" />
/// <reference path="ticker.ts" />
/// <reference path="purchase.ts" />
/// <reference path="building.ts" />
/// <reference path="upgrade.ts" />

enum GrandmatriarchLevel {
	Appeased = 0,
	Awoken = 1,
	Displeased = 2,
	Angered = 3,
}

class SyncError {
	count: number
	message: string

	constructor(uc: UltimateCookie, matchErrors: string[], public save: string) {
		const PurchasesToLog = 5;
		const Separator = "\n - ";

		this.count = 1;
		this.message = "Error:" + Separator
			+ matchErrors.join(Separator) + "\n"
			+ "Previous Purchases:" + Separator
			+ uc.purchaseOrder.slice(-PurchasesToLog).join(Separator);
	}
}

class Spell {
    constructor(public name: string) {
	}
	
	cast(): void {
		Game.ObjectsById[BuildingIndex.WizardTower].minigame.castSpell(Game.ObjectsById[BuildingIndex.WizardTower].minigame.spells[this.name], null);
	}
}

//
// UltimateCookie plays the game.
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

	// Sugar lump ticker
	sugarTicker: Ticker = new Ticker(1000);

	// Simulation and strategy
	sim: Simulator = new Simulator(Strategy.Default);

	// Timers for various complex calculations
	auraTicker: Ticker = new Ticker(5000);
	spellTicker: Ticker = new Ticker(1000);

	// Ascension stuff
	ascensionFlag: boolean = false;
	ascensionTicker: Ticker = new Ticker(5000);
	
	// Errors
	errorArray: SyncError[] = [];
	errorDict: { [index: string]: SyncError } = {};
	purchaseOrder: string[] = []

	// Cached values - values that are recalculated occasionally
	cachedTargetAscendPrestige: number = -1;

	constructor() {
		const AutoUpdateInterval = 1;

		this.sync();
		this.nextPurchase = this.rankPurchases()[0];
		setInterval(() => this.update(), AutoUpdateInterval);
	}

	clearErrors(): void {
		this.errorArray = [];
		this.errorDict = {};
	}

	dumpErrors(start = 0): void {
		const Divider = "==================================================\n";
		
		let errors = this.errorArray.slice(start);
		console.log(Divider);
		for (let error of errors)
			console.log(error.message + '\nThis error occured ' + error.count + ' times.\n' + Divider);
		console.log("Listed " + errors.length + " of " + this.errorArray.length + " total errors.\n" + Divider);
	}

	createPurchaseList(): Purchase[] {
		let purchases = [];

		// Add the buildings	
		for (let i = 0; i < this.sim.buildings.length; ++i) {
			purchases.push(this.sim.buildings[i]);
		}
		// Add the upgrades
		for (let key in this.sim.upgrades) {
			if (this.sim.upgrades[key].isAvailable && this.sim.toggles[key] == undefined) {
				purchases.push(this.sim.upgrades[key]);
			}
		}
		// Add Santa
		if (this.sim.santa.canBeLeveled) {
			purchases.push(this.sim.santa.nextLevel);
		}
		// Add Dragon
		if (this.sim.dragon.canBeLeveled) {
			purchases.push(this.sim.dragon.nextLevel);
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
	
	rankPurchases(excess: number = Game.cookies): Purchase[] {
		// First pass, find the upgrade that offers the best price-benefit ratio
		let purchases: Purchase[] = this.createPurchaseList();
		
		purchases.sort(function(a, b) { return b.pvr - a.pvr; });

		// If there is a sufficient cookies to instantly purchase the next best purchase
		// then see if there are enough cookies could to buy something better instead
		if (excess > purchases[0].price) {
			let filtered = purchases.filter((p) => p.price < excess);
			filtered.sort((a, b) => { return b.benefit - a.benefit; });
			return filtered;
		}
		
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
			let seasonPref: string = this.sim.strategy.preferredSeason;
			// Override for unlocking, unlock in the order valentines, christmas, halloween, easter
			if (this.sim.strategy.unlockSeasonUpgrades) {
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
				let toggle = this.sim.toggles[this.sim.seasons[seasonPref].toggleName];
				if (toggle && toggle.price <= purchases[0].price) {
					purchases.splice(0, 0, toggle);
				}
			}
		}

		// Move Elder Pledge to the front if the current strategy calls for it
		let pledge: boolean = this.sim.strategy.autoPledge;
		if (this.sim.season.name == "halloween") {
			if (this.sim.strategy.unlockSeasonUpgrades && this.sim.season.lockedUpgrades != 0) {
				// Cant unlock halloween upgrades without popping wrinklers so dont pledge
				pledge = false;
			}
		}
		if (pledge) {
			let ep: Upgrade = this.sim.toggles["Elder Pledge"];
			let srp: Upgrade = this.sim.upgrades["Sacrificial rolling pins"];
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

	chooseAuras(): void {
		if (this.sim.strategy.dragonAura1 != null) {
			if (this.sim.dragonAura1.name != this.sim.strategy.dragonAura1) {
				
			}
		}
		if (this.sim.strategy.dragonAura2 != null) {
			if (this.sim.dragonAura2.name != this.sim.strategy.dragonAura2) {
				
			}
		}
		// Add Dragon auras
		//for (let aura in this.sim.dragonAuras) {
		//	if (this.sim.dragonAuras[aura].canBePurchased) {
		//		purchases.push(this.sim.dragonAuras[aura]);
		//	}
		//}
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

	allBuildingRefundValue(): number {
		let earthShatterer = this.sim.dragonAuras["Earth Shatterer"];	// Buildings refund 85% of price

		let refund = 0;
		for (let i = 0; i < BuildingIndex.NumBuildings; ++i) {
			refund += this.sim.buildings[i].refundValue();
		}
		return refund;
	}

	get currentAscendPrestige(): number {
		const ChocolateEggMultiplier = 0.05;

		let chocolateEgg = this.sim.upgrades["Chocolate egg"];
		let earthShatterer = this.sim.dragonAuras["Earth Shatterer"];
		let prestigeCookies = Game.cookiesEarned;
	
		if (earthShatterer.isAvailable) {
			let refundBank = Game.cookies;
			let revokeEarthShatterer = false;

			if (earthShatterer.isAvailableToPurchase) {
				refundBank -= earthShatterer.price();
				earthShatterer.apply();
				revokeEarthShatterer = true;
			}
			for (let b of this.sim.buildings)
				refundBank += b.refundValue();
			if (revokeEarthShatterer)
				earthShatterer.revoke();
			prestigeCookies += refundBank * ChocolateEggMultiplier;
		}
		return Game.prestige + Game.HowMuchPrestige(prestigeCookies);
	}

	get targetAscendPrestige(): number {
		if (this.currentAscendPrestige > this.cachedTargetAscendPrestige)
			this.cachedTargetAscendPrestige = this.calculateTargetAscendPrestige;
		return this.cachedTargetAscendPrestige;
	}

	get calculateTargetAscendPrestige(): number {
		// TODO: Calculate reset scale instead of just targetting a 10% increase
		const LuckyDigitEnding = 7;
		const LuckyNumberEnding = 777;
		const LuckyPayoutEnding = 777777;
		const LuckyUnlockMultiplier = 20;
		const MinimumResetMultiplier = 1.1;

		let currentScale = 1 + Game.prestige * 0.01;
		let targetScale = currentScale * MinimumResetMultiplier;
		let targetPrestige = Math.ceil((((1 + Game.prestige * 0.01) * MinimumResetMultiplier) - 1) * 100);
		let ending = 0;
		let elen = 0;

		if (this.currentAscendPrestige > targetPrestige)
			targetPrestige = this.currentAscendPrestige;

		if (Game.prestige > LuckyPayoutEnding * LuckyUnlockMultiplier && !Game.Has("Lucky payout")) {
			ending = LuckyPayoutEnding;
			elen = 6;
		} else if (Game.prestige > LuckyNumberEnding * LuckyUnlockMultiplier && !Game.Has("Lucky number")) {
			ending = LuckyNumberEnding;
			elen = 3;
		} else if (Game.prestige > LuckyDigitEnding * LuckyUnlockMultiplier && !Game.Has("Lucky digit")) {
			ending = LuckyDigitEnding;
			elen = 1;
		}

		if (ending) {
			let mod = Math.pow(10, elen);
			let currentEnding = targetPrestige % mod;
			if (currentEnding > ending)
				targetPrestige += mod;
			targetPrestige += ending - currentEnding;
		}
		return targetPrestige;
	}

	sellAllBuildings(): void {
		for (let i = 0; i < BuildingIndex.NumBuildings; ++i) {
			Game.ObjectsById[i].sell(Game.ObjectsById[i].amount);
		}
	}

	sortTest(): void {
		let purchases = this.rankPurchases();
		
		for (let i = 0; i < purchases.length; ++i) {
			console.log("PVR: " + (purchases[i].pvr).toExponential(8) + ", B: " + (purchases[i].benefit).toExponential(8) + " :: " + purchases[i].name);
		}	
	}

	spendMagic(): void {
		const handOfFate: Spell = new Spell("hand of fate");

		let hasFrenzy = Game.hasBuff("Frenzy");
		let hasBuildingBuff = false;
		for (let buff in Game.buffs) {
			if (Game.buffs[buff].type.name == "building buff")
				hasBuildingBuff = true;
		}
		if (hasFrenzy && hasBuildingBuff) {
			handOfFate.cast();
		}
	}

	spendSugar(): void {
		const SugarAchievementLevel = 10;

		// Unlock the minigames first, then level all buildings to 10 to unlock the
		// achievements, beyond that just level based on best return
		let sugarPurchases = [];
		if (this.sim.buildings[BuildingIndex.WizardTower].level == 0) {
			sugarPurchases.push(new BuildingLevel(this.sim, BuildingIndex.WizardTower));			
		} else if (this.sim.buildings[BuildingIndex.Temple].level == 0) {
			sugarPurchases.push(new BuildingLevel(this.sim, BuildingIndex.Temple));
		} else {
			// If any building is at the point where the next level gives an achievement, get that
			for (let i = 0; i < BuildingIndex.NumBuildings; ++i)
				if (this.sim.buildings[i].level == SugarAchievementLevel - 1)
					sugarPurchases.push(new BuildingLevel(this.sim, i));
			if (sugarPurchases.length == 0) {
				// Consider only buildings with locked achievements
				for (let i = 0; i < BuildingIndex.NumBuildings; ++i)
					if (this.sim.buildings[i].level < SugarAchievementLevel)
						sugarPurchases.push(new BuildingLevel(this.sim, i));
				// Finally consider all buildings
				if (sugarPurchases.length == 0)
					for (let i = 0; i < BuildingIndex.NumBuildings; ++i)
						sugarPurchases.push(new BuildingLevel(this.sim, i));
			}
			sugarPurchases.sort((a, b) => b.pvr - a.pvr);
		}

		if (sugarPurchases[0].price <= Game.lumps) {
			this.purchaseOrder.push(sugarPurchases[0].longName);
			sugarPurchases[0].purchase();
		}
	}

	doClicking() {
		// Click the cookie
		if (this.sim.strategy.autoClick) 
			Game.ClickCookie();

		// Click any golden cookies
		if (this.sim.strategy.autoClickGoldenCookies)
			this.popShimmer("golden");

		// Click any reindeer
		if (this.sim.strategy.autoClickReindeer)
			this.popShimmer("reindeer");

		// Click the sugar lump - the ticker is needed as it is possible to get multiple lumps
		// if you spam this just as it ripens.
		if (this.sugarTicker.ticked && Game.time - Game.lumpT > Game.lumpRipeAge)
			Game.clickLump();

		// Pop wrinklers during halloween if upgrades need unlocking
		if (this.sim.season.name == "halloween" && this.sim.strategy.unlockSeasonUpgrades)
			for (let w in Game.wrinklers)
				if (Game.wrinklers[w].sucked > 0)
					Game.wrinklers[w].hp = 0;

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
			this.sim.clickRate = this.sim.strategy.clickRateOverride == -1 ? this.clickRate : this.sim.strategy.clickRateOverride;
		}
	}

	doSyncing(): void {
		// Resync to the game if needed
		if (Game.recalculateGains == 0) {
			this.syncBuffs();
			this.syncSeason();
			this.syncStore();
			let errors: string[] = this.syncErrors;
			if (errors.length > 0) {
				let error = new SyncError(this, errors, Game.WriteSave(1));
				if (this.errorDict[error.message]) {
					this.errorDict[error.message].count++;
				} else {
					this.errorDict[error.message] = error;
					this.errorArray.push(error);
				}
				this.sync();
			}
		}
	}

	doPurchasing(): void {
		// Recheck the best purchase if purchaseTicker has ticked
		if (this.purchaseTicker.ticked)
			this.nextPurchase = this.rankPurchases()[0];

		// Do any purchasing. Dont purchase during 'Cursed finger'. The game freezes its CpS numbers while it is active so it will just desync
		if (this.sim.strategy.autoBuy && !Game.hasBuff('Cursed finger')) {
			if (Game.cookies >= this.nextPurchase.price) {
				this.purchaseOrder.push(this.nextPurchase.longName);
				this.nextPurchase.purchase();
				this.nextPurchase = this.rankPurchases()[0];
				this.purchaseTicker.restart();
			}
		}
	}

	//
	// Update Functions
	//

	update: () => void = this.updateFarm;

	// Normal farming, most of the time this should be what's going on
	updateFarm(): void {
		this.doClicking();
		this.doSyncing();
		this.doPurchasing();

		if (this.auraTicker.ticked)
			this.chooseAuras();

		if (this.spellTicker.ticked)
			this.spendMagic();

		if (this.sim.strategy.autoAscend && this.currentAscendPrestige == this.currentAscendPrestige) {
			console.log("Prestige target hit. Starting Ascending.");
			this.update = this.updateAscend;
		}
	}

	// Still farming but with checks to see if the prestige target for this ascension has been hit
	updateAscend(): void {
		// Buy the dragon aura that refunds more cookies
		let chocolateEgg = this.sim.upgrades["Chocolate egg"];

		if (chocolateEgg.isAvailable) {
			let earthShatterer = this.sim.dragonAuras['Earth Shatterer'];
			if (earthShatterer.isAvailableToPurchase) {
				earthShatterer.purchase();
			}
		}
		this.updateFarm();	// For now just keep farming
	}

	updateSpendHeavenlyChips(): void {
		this.updateFarm();	// For now just keep farming
	}

	updateReset(): void {
		this.updateFarm();	// For now just keep farming
	}

	//
	// Syncronisation functions
	//

	sync(): void {
		const AchievementsPerMilk = 25;

		// Sync without any logging
		this.sim.reset();
		for (let i = 0; i < Game.ObjectsById.length && i < this.sim.buildings.length; ++i) {
			this.sim.buildings[i].quantity = Game.ObjectsById[i].amount;
			this.sim.buildings[i].applicationCount = Game.ObjectsById[i].amount;
			this.sim.buildings[i].free = Game.ObjectsById[i].free;
			this.sim.buildings[i].level = Game.ObjectsById[i].level;
		}
		this.syncUpgrades();
		this.sim.recalculateUpgradePriceCursorScale();
		this.sim.heavenlyChips = Game.heavenlyChips;
		this.sim.prestige = Game.prestige;
		this.sim.milkAmount = Game.AchievementsOwned / AchievementsPerMilk;
		this.sim.frenzyMultiplier = 1;
		this.sim.clickFrenzyMultiplier = 1;
		this.syncBuffs();
		this.syncSeason();
		this.sim.santa.level = Game.santaLevel;
		this.sim.dragon.level = Game.dragonLevel;
		if (Game.dragonAura > 0) {
			this.sim.dragonAura1 = this.sim.dragonAuras[Game.dragonAura];
			this.sim.dragonAura1.apply();
		}
		if (Game.dragonAura2 > 0) {
			this.sim.dragonAura2 = this.sim.dragonAuras[Game.dragonAura2];
			this.sim.dragonAura2.apply();
		}
		this.sim.sessionStartTime = Game.startDate;
		this.sim.updateCenturyMultiplier();
		this.sim.lumps = Game.lumps;
	}

	syncBuffs(): void {
		// Sync the games buffs
		if (Object.keys(Game.buffs).length != this.sim.buffCount) {
			for (let key in this.sim.buffs) {
				if (this.sim.buffs[key].isApplied) {
					this.sim.buffs[key].revoke();
				}
				this.sim.buffs[key].reset();
			}
			for (let key in Game.buffs) {
				if (this.sim.buffs[key]) {
					this.sim.buffs[key].cachedScale = Game.buffs[key].multCpS;
					this.sim.buffs[key].apply();
				} else {
					console.log("Unknown buff: " + key);
				}
			}
		}
	}

	syncSeason(): void {
		// Sync the season, needs to be done because the season buffs expire eventually
		this.sim.seasonChanges = Game.seasonUses;
		this.sim.seasonStack = ["", Game.season];
	}

	syncStore(): void {
		// Like syncUpgrades but only checkes upgrades that are in the store, used to 
		// quickly spot new upgrades as they unlock for purchase
		for (let gameUpgrade of Game.UpgradesInStore) {
			this.syncUpgrade(gameUpgrade);
		}
	}

	syncUpgrade(gameUpgrade: Game.Upgrade) {
		if (gameUpgrade.pool != "debug") {
			let upgrade = this.sim.upgrades[gameUpgrade.name] || this.sim.toggles[gameUpgrade.name] || this.sim.prestiges[gameUpgrade.name];
			if (upgrade) {
				if (gameUpgrade.unlocked != 0)
					upgrade.isUnlocked = true;
				if (gameUpgrade.bought != 0 && !upgrade.isApplied)
					upgrade.apply();
				if (gameUpgrade.bought == 0 && upgrade.isApplied)
					upgrade.revoke();
			} else {
				console.log("Can't find upgrade " + gameUpgrade.name + " to apply.");
				this.sim.upgrades[gameUpgrade.name] = new Upgrade(this.sim, gameUpgrade.name, UpgradeFlags.Unsupported);
			}
		}
	}

	syncUpgrades(): void {
		for (let gameUpgrade of Game.UpgradesById) {
			this.syncUpgrade(gameUpgrade);
		}
	}

	get syncErrors(): string[] {
		let errors: string[] = [];
		// Check that Cps matches the game
		let cps: number = this.sim.cps;
		if (!floatEqual(cps, Game.cookiesPs)) {
			// The century multiplier gets out of sync once every 10 seconds, fix it here since
			// it can often save a full resync and avoids a whole bunch of error spam when
			// running for a long time
			if (this.sim.centuryMultiplier != 1) {
				this.sim.updateCenturyMultiplier();
				cps = this.sim.cps;
			}
			if (!floatEqual(cps, Game.cookiesPs)) {
				errors.push("CpS - Predicted: " + cps + ", Actual: " + Game.cookiesPs);
			}
		}
		// Check the Cpc matches the game
		let cpc: number = this.sim.cpc;
		let gcpc: number = Game.mouseCps();
		if (!floatEqual(cpc, gcpc)) {
			errors.push("CpC - Predicted: " + cpc + ", Actual: " + gcpc);
		}
		// Check the building costs match the game
		for (let i = 0; i < this.sim.buildings.length; ++i) {
			errors = errors.concat(this.sim.buildings[i].matchErrors)
		}

		// Check that all buildings are supported
		if (this.sim.buildings.length != Game.ObjectsById.length) {
			errors.push("Building getCount " + this.sim.buildings.length + " does not match " + Game.ObjectsById.length);
		}

		// Check that all available upgrade costs match those of similar upgrade functions
		for (let i in this.sim.upgrades) {
			errors = errors.concat(this.sim.upgrades[i].matchErrors);
		}

		// Check that the season matches
		if (this.sim.season.name != Game.season) {
			errors.push("Simulator season \"" + this.sim.season.name + "\" does not match Game.season \"" + Game.season + '"');
		}

		// Check that dragon and santa levels
		if (this.sim.dragon.level != Game.dragonLevel) {
			errors.push("Dragon level \"" + this.sim.dragon.level + "\" does not match Game.dragonLevel \"" + Game.dragonLevel + '"');
		}
		if (this.sim.santa.level != Game.santaLevel) {
			errors.push("Santa level \"" + this.sim.santa.level + "\" does not match Game.santaLevel \"" + Game.santaLevel + '"');
		}

		// Check the dragon auras match
		let daindex: number = this.sim.dragonAura1 ? this.sim.dragonAura1.index : 0;
		if (daindex != Game.dragonAura) {
			errors.push("Dragon aura one " + daindex + " doesn't match Game.dragonAura " + Game.dragonAura);
		}
		daindex = this.sim.dragonAura2 ? this.sim.dragonAura2.index : 0;
		if (daindex != Game.dragonAura2) {
			errors.push("Dragon aura two " + daindex + " doesn't match Game.dragonAura2 " + Game.dragonAura2);
		}

		if (errors.length != 0) {
			for (let key in Game.buffs) {
				errors.push("Buff Active: " + key);
			}
		}

		return errors;
	}
}

//
// Buffs.
//
// Buffs are temporary modifications to the game, often giving very large increases in
// throughput for a short duration.
//

enum BuffFlags {
	BuildingScaler = 0x1,
	BuildingShrinker = 0x2,
	GoldenCookieBuff = 0x4,
}

class Buff extends Modifier {
	flags: BuffFlags = 0
	buildingIndex: number
	cachedScale?: number

	constructor(sim: Simulator, public name: string, public baseDuration: number) {
		super(sim);
		this.addBooster("buffCount", 1);
	}

	get buildingScale(): number {
		if (this.cachedScale)
			return this.cachedScale;
		if (this.flags & BuffFlags.BuildingScaler)
			return 1 + this.sim.buildings[this.buildingIndex].quantity * 0.1;
		if (this.flags & BuffFlags.BuildingShrinker)
			return 1 / (1 + this.sim.buildings[this.buildingIndex].quantity * 0.1);
		return 1;
	}

	get duration(): number {
		if (this.flags & BuffFlags.GoldenCookieBuff) {
			return this.baseDuration * this.sim.goldenCookieEffectDurationMultiplier;
		}
		return this.duration;
	}

	apply() {
		this.sim.frenzyMultiplier *= this.buildingScale;
		super.apply();
	}

	revoke() {
		super.revoke();
		this.sim.frenzyMultiplier *= this.buildingScale;
	}

	isGoldenCookieBuff(): this {
		this.flags |= BuffFlags.GoldenCookieBuff;
		return this;
	}

	scalesFrenzyMultiplierPerBuilding(index: number): this {
		this.flags |= BuffFlags.BuildingScaler;
		this.buildingIndex = index;
		return this;
	}

	shrinksFrenzyMultiplierPerBuilding(index: number): this {
		this.flags |= BuffFlags.BuildingShrinker;
		this.buildingIndex = index;
		return this;
	}

	reset(): void {
		super.reset();
		this.cachedScale = null;
	}
}

//
//
// SantaLevel
//
// Purchase representation of the one level for the in game Santa system. These should
// only be created by a Santa object, they are not intended for use as a standalone
// class.
//

class SantaLevel extends Purchase {
	constructor(public santa: Santa, public num: number, public name: string) {
		super(santa.sim);
		this.addNestedBooster("santa", "level", 1);
	}

	get isAvailable(): boolean {
		return this.santa.level == this.num;
	}

	purchase(): void {
		Game.specialTab = "santa";
		Game.UpgradeSanta();
		this.apply();
	}

	get price(): number {
		return Math.pow(this.num + 1, this.num + 1);
	}
}

//
// Santa
//
// Santa incorporates everything to do with the in game santa system surprisingly enough.
//

class Santa {
	level: number
	levels: SantaLevel[]
	randomRewards: Upgrade[]
	power: number

	constructor(public sim: Simulator) {
		this.levels = [];
		this.randomRewards = [];

		let santa = this;
		function level(num: number, name: string) {
			let level: SantaLevel =  new SantaLevel(santa, num, name)
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

	randomRewardCost(level: number): number {
		return Math.pow(3, level) * 2525;
	}

	reset(): void {
		this.level = 0;		
		this.power = 0;
	}

	get canBeLeveled(): boolean {
		return Game.Has("A festive hat") && this.level < 14;
	}

	get nextLevel(): SantaLevel {
		return this.levels[this.level + 1];
	}
}

//
// Seasons
//
// Seasons make pretty big changes to the game, often enabling new shimmers, new buffs 
// and a bunch of lockable items to unlock. This class represents them in game.
//

class Season {
	goldenCookieFrequencyScale: number
	locks: Upgrade[]

	constructor(sim: Simulator, public name: string, public toggleName?: string) {
		this.reset();
	}

	reset(): void {
		this.goldenCookieFrequencyScale = 1;
	}

	addLock(upgrade: Upgrade): void {
		if (this.locks == undefined)
			this.locks = [];
		this.locks.push(upgrade);
	}

	get lockedUpgrades(): number {
		if (this.locks) {
			let  locked = 0;
			for (let i = 0; i < this.locks.length; ++i)
				if (!this.locks[i].isUnlocked)
					locked++
			return locked;
		}
		return 0;
	}
}

//
// Simulator
//
// The Simulator class is used to simulate the game. It can sync to the game, has representations for
// the current state of all in-game entities and can use that state to calculate CpC, CpS etc.
//

class Simulator {
	// State variables
	baseCps: number
	buffCount: number
	buildingPriceScale: number
	buildingRefundRate: number
	centuryMultiplier: number
	clickFrenzyMultiplier: number
	clickRate: number
	cookieUpgradePriceMultiplier: number
	cpcBaseMultiplier: number
	cpcCpsMultiplier: number
	cpcMultiplier: number
	cursedFingerCount: number
	dragonAura1?: DragonAura
	dragonAura2?: DragonAura
	elderPledgeDurationScale: number
	eggCount: number
	frenzyMultiplier: number
	goldenCookieDuration: number
	goldenCookieEffectDurationMultiplier: number
	goldenCookieTime: number
	grandmatriarchLevel: GrandmatriarchLevel
	heartCookieCount: number
	heartCookieScale: number
	heavenlyChips: number
	lumps: number
	lumpScale: number
	lumpScaleLimit: number
	maxWrinklers: number
	milkAmount: number
	milkMultiplier: number
	milkUnlocks: number[][]
	perBuildingFlatCpcBoostCounter: BuildingCounter = new BuildingCounter();
	prestige: number
	prestigeScale: number
	prestigeUnlocked: number
	productionScale: number
	reindeerBuffMultiplier: number
	reindeerDuration : number
	reindeerMultiplier: number
	reindeerTime: number
	seasonChanges: number
	seasonStack: string[]
	synergyUpgradePriceMultiplier: number
	upgradePriceScale: number
	upgradePriceCursorScale: number
	upgradePriceCursorScaleEnables: number
	wrinklerMultiplier: number

	// Time and century multiplier cache
	currentTime: number
	sessionStartTime: number
	cachedCenturyMultiplier: number

	// Representations of Game entities
	buildings: Building[] = []
	dragonAuras: { [index: number]: DragonAura } = {}
	buffs: { [index: string]: Buff } = {}
	prestiges: { [index: string]: Upgrade } = {}
	modifiers: { [index: string]: Modifier } = {}
	upgrades: { [index: string]: Upgrade } = {}
	toggles: { [index: string]: Upgrade } = {}
	seasons: { [index: string]: Season } = {}
	santa: Santa = new Santa(this)
	dragon: Dragon = new Dragon(this)

	constructor(public strategy: Strategy) {
		populate_simulator(this);
		this.reset();
	}

	reset(): void {
		const GoldenCookieDuration = 13;
		const GoldenCookieMinInterval = 60 * 5;
		const GoldenCookieMaxInterval = 60 * 15;
		const GoldenCookieAverageInterval = (GoldenCookieMinInterval + GoldenCookieMaxInterval) / 2;
		const ReindeerDuration = 4;

		// Reset anything that needs resetting
		for (let i = 0; i < this.buildings.length; ++i)
			this.buildings[i].reset();
		for (let key in this.modifiers)
			this.modifiers[key].reset();		
		for (let key in this.seasons)
			this.seasons[key].reset();
		for (let key in this.dragonAuras)
			this.dragonAuras[key].reset();
		this.santa.reset();
		this.dragon.reset();
		// When the session started
		this.sessionStartTime = new Date().getTime();

		this.buffCount = 0;			

		// Mouse click information
		this.clickRate = 0;
		this.cpcMultiplier = 1;
		this.cpcBaseMultiplier = 1;
		this.cpcCpsMultiplier = 0;
		this.perBuildingFlatCpcBoostCounter.clear();

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
		this.cursedFingerCount = 0;

		// Golden cookie stuff information
		this.goldenCookieTime = GoldenCookieAverageInterval;
		this.goldenCookieDuration = GoldenCookieDuration;
		this.goldenCookieEffectDurationMultiplier = 1;

		// Reindeer stuff
		this.reindeerDuration = ReindeerDuration;
		this.reindeerTime = 180;
		this.reindeerMultiplier = 1;
		this.reindeerBuffMultiplier = 1;

		// Grandmatriarch stuff
		this.elderPledgeDurationScale = 1;
		this.grandmatriarchLevel = GrandmatriarchLevel.Appeased;
		this.wrinklerMultiplier = 1;
		this.maxWrinklers = 10;

		// Easter eggs
		this.eggCount = 0;

		// Valentines day
		this.heartCookieScale = 1;
		this.heartCookieCount = 0;

		// Dragon auras
		this.dragonAura1 = null
		this.dragonAura2 = null

		// Price reductions
		this.buildingPriceScale = 1;
		this.buildingRefundRate = 0.5;
		this.upgradePriceScale = 1;
		this.upgradePriceCursorScale = 1;
		this.cookieUpgradePriceMultiplier = 1;
		this.synergyUpgradePriceMultiplier = 1;
		this.upgradePriceCursorScaleEnables = 0;

		// Current season
		this.seasonChanges = 0;
		this.seasonStack = [""];	// Default to no season

		// Sugar lumps
		this.lumps = 0;
		this.lumpScale = 0;
		this.lumpScaleLimit = 0;
	}

	get cpc(): number {
		if (this.cursedFingerCount > 0) {
			return this.preCurseCps * this.buffs['Cursed finger'].duration * this.goldenCookieEffectDurationMultiplier;
		}
		return this.preCurseCpc;
	}

	get cps(): number {
		return this.cursedFingerCount > 0 ? 0 : this.preCurseCps;
	}

	// Get the current cookies per click amount
	get preCurseCpc(): number {
		// Add the per building flat boost first
		let cpc: number = this.perBuildingFlatCpcBoostCounter.count(this.buildings);
		
		// Add percentage of recular CpS
		cpc += this.preCurseCps * this.cpcCpsMultiplier;

		// Scale with normal CpC multipliers
		cpc += 1 * this.cpcBaseMultiplier;			// Base cpc

		return cpc * this.cpcMultiplier * this.clickFrenzyMultiplier;
	}

	get preCurseCps(): number {
		let cps: number = this.baseCps;
		// Get the cps from buildings - start at 1, cursors generate clicks
		for (let i = 0; i < this.buildings.length; ++i) {
			cps += this.buildings[i].cps;
		}

		// Scale it for production and heavely chip multipliers
		let santaScale: number = 1 + (this.santa.level + 1) * this.santa.power;
		let prestigeScale: number = this.prestige * this.prestigeScale * this.prestigeUnlocked * 0.01;
		let heartScale: number = Math.pow(1 + 0.02 * this.heartCookieScale, this.heartCookieCount);
		let scale: number = this.productionScale * heartScale * santaScale * (1 + prestigeScale);

		// Scale it for milk, two tiers to deal with ordering and minimise floating point errors
		for (let i = 0; i < this.milkUnlocks.length; ++i) {
			for (let j = 0; j < this.milkUnlocks[i].length; ++j) {
				scale *= (1 + this.milkUnlocks[i][j] * this.milkAmount * this.milkMultiplier);
			}
		}

		// Scale it for global production
		scale *= this.cachedCenturyMultiplier;
		scale *= this.frenzyMultiplier;

		// Scale it for lumps
		scale *= 1 + (this.lumpScale + Math.max(this.lumpScaleLimit, this.lumps) * this.lumpScale);

		return cps * scale;
	}
	
	updateCenturyMultiplier(): void {
		this.currentTime = new Date().getTime();
		let sessionDays: number = Math.min(Math.floor((this.currentTime - this.sessionStartTime) / 1000 / 10) * 10 / 60 / 60 / 24, 100);
		this.cachedCenturyMultiplier = 1 + ((1 - Math.pow(1 - sessionDays / 100, 3)) * (this.centuryMultiplier - 1));
	}

	recalculateUpgradePriceCursorScale(): void {
		if (this.upgradePriceCursorScaleEnables > 0) {
			this.upgradePriceCursorScale = Math.pow(0.99, this.buildings[BuildingIndex.Cursor].quantity / 100);
		} else {
			this.upgradePriceCursorScale = 1;
		}
	}

	get season(): Season {
		return this.seasons[this.seasonStack[this.seasonStack.length - 1]];
	}

	//
	// Effective CpS - boil down all the buffs and everything else to a single expected CpS value
	//

	// REFACTOR: THIS DOESNT DO ANYTHING
	effectiveCpsWithBuffs(buffs: string[]): number {
		var eCps = this.cps + this.cpc * this.clickRate;
		return eCps;
	}

	// REFACTOR: DOESNT WORK WITH VARIOUS UNLOCKED BUFFS
	effectiveCps(): number {
		// Bit over simplistic for now, assumes golden cookies alternate between multiply cookies and frenzy

		// Calculate baseline cps, passive + clicking
		let totalTime = this.goldenCookieTime * 2 / this.season.goldenCookieFrequencyScale;
		let frenzyTime = this.buffs['Frenzy'].duration * this.goldenCookieEffectDurationMultiplier;
		let normalTime = totalTime - frenzyTime;
		let regularCps = (normalTime * this.effectiveCpsWithBuffs([]) + frenzyTime * this.effectiveCpsWithBuffs(['Frenzy']) ) / totalTime;
		
		// Calculate reindeer cps
		let normalReindeerTime = normalTime - this.reindeerDuration;
		let frenzyReindeerTime = frenzyTime + this.reindeerDuration;
		let averageReindeer = (normalReindeerTime * this.cookiesPerReindeerWithBuffs([]) + frenzyReindeerTime * this.cookiesPerReindeerWithBuffs(['Frenzy'])) / totalTime;
		let averageReindeerCps = averageReindeer / this.reindeerTime;

		// Calculate golden cookie cps
		let normalLuckyTime = normalTime - this.goldenCookieDuration;
		let frenzyLuckyTime = frenzyTime + this.goldenCookieDuration;
		let averageLucky = (normalLuckyTime * this.cookiesPerLuckyWithBuffs([]) + frenzyLuckyTime * this.cookiesPerLuckyWithBuffs(['Frenzy'])) / totalTime;
		let averageLuckyCps = averageLucky / totalTime;

		return regularCps + averageReindeerCps + averageLuckyCps;
	}

	//
	// Reindeer stuff
	//

	// REFACTOR: THIS DOESNT WORK
	cookiesPerReindeerWithBuffs(buffs: string[]): number {
		var cpr = this.cookiesPerReindeer();
		return cpr;
	}

	cookiesPerReindeer(): number {
		const ReindeerCpsSeconds = 60;
		const ReindeerMinCookies = 25;

		let cookies: number = this.cps * ReindeerCpsSeconds * this.reindeerBuffMultiplier;
		return Math.max(ReindeerMinCookies, cookies) * this.reindeerMultiplier;
	}

	// REFACTOR: THIS DOESNT WORK
	cookiesPerLuckyWithBuffs(buffs: string[]): number {
		return this.cookiesPerLucky();
	}

	// REFACTOR: THIS IS PROBABLY WRONG
	cookiesPerLucky(): number {
		const LuckyCookieCpsSeconds = 60 * 15;
		const LuckyCookieFlatBonus = 13;

		// If we dont click them, they don't work
		if (!this.strategy.autoClickGoldenCookies) {
			return 0;
		}

		let cookies1 = this.cps * LuckyCookieCpsSeconds;
		let cookies2 = cookies1; // cookieBank * 0.15;

		return Math.min(cookies1, cookies2) + LuckyCookieFlatBonus;
	}

	// getCookieChainMax() {
	// 	const CookieChainMultiplier = 60 * 60 * 3;	// Verify this
	// 	return this.preCurseCps * CookieChainMultiplier;
	// }
}

// Compare floats with an epsilon value
function floatEqual(a: number, b: number): boolean {
	let eps = Math.abs(a - b) * 1000000000000.0;
	return eps <= Math.abs(a) && eps <= Math.abs(b);
}

console.log("Ultimate Cookie starting at " + new Date());

// Create the upgradeInfo and Ultimate Cookie instances
var uc = new UltimateCookie();
