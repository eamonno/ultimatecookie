/// <reference path="strategy.ts" />
/// <reference path="ticker.ts" />
/// <reference path="purchase.ts" />
/// <reference path="building.ts" />
/// <reference path="upgrade.ts" />

// General purpose constants
const REINDEER_DURATION = 4;				// Length a reindeer lasts before upgrades
const GOLDEN_COOKIE_DURATION = 13;			// Golden cookies last 13 seconds by default
const GOLDEN_COOKIE_MIN_INTERVAL = 60 * 5;	// Minimum time between golden cookies
const GOLDEN_COOKIE_MAX_INTERVAL = 60 * 15;	// Maximum time between golden cookies
const GOLDEN_COOKIE_AVG_INTERVAL = (GOLDEN_COOKIE_MIN_INTERVAL + GOLDEN_COOKIE_MAX_INTERVAL) / 2;
const LUCKY_COOKIE_CPS_SECONDS = 60 * 15;	// Lucky provides up to 15 minutes CpS based on bank
const LUCKY_COOKIE_FLAT_BONUS = 13;			// Lucky provides 13 additional seconds of CpS regardless
const LUCKY_COOKIE_BANK_LIMIT = 0.15;		// Lucky provides 0.15 times bank at most
const COOKIE_CHAIN_BANK_SCALE = 4;			// Bank needs 4 times the Cookie Chain limit to payout in full
const RESET_PAUSE_TIME = 1000;				// Time to pause so reset can complete correctly

enum GrandmatriarchLevel {
	Appeased = 0,
	Awoken = 1,
	Displeased = 2,
	Angered = 3,
}

enum UltimateCookieState {
	Farming = 0,
	StartAscending = 1,
	SpendPrestige = 2,
	Reset = 3,
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
	
	// Errors and State
	state: UltimateCookieState = UltimateCookieState.Farming;
	errorArray: SyncError[] = [];
	errorDict: { [index: string]: SyncError } = {};
	purchaseOrder: string[] = []

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

	ascend(): void {
		// Ascension stages
		// 0 - Waiting for decision to ascend
		// 1 - Decision made, waiting for right amount of prestige
		// 2 - Prestige - buying prestige upgrades
		// 3 - Prestige bought - waiting for counter to hit zero to avoid bugging out
		// 0 - Back to zero again

		if (this.state == UltimateCookieState.Farming) {
			// Buy the dragon aura that refunds more cookies
			if (this.sim.upgrades["Chocolate egg"].isAvailable) {
				if (this.sim.dragonAuras['Earth Shatterer'].isAvailableToPurchase) {
					this.sim.dragonAuras['Earth Shatterer'].purchase();
				}
			}
			
			const LuckyDigitEnding = 7;
			const LuckyNumberEnding = 777;
			const LuckyPayoutEnding = 777777;
			const LuckyUnlockMultiplier = 20;
			
			let ending = 0;
			if (Game.prestige > LuckyPayoutEnding * LuckyUnlockMultiplier && !Game.Has("Lucky payout")) {
				ending = LuckyPayoutEnding;
			} else if (Game.prestige > LuckyNumberEnding * LuckyUnlockMultiplier && !Game.Has("Lucky number")) {
				ending = LuckyNumberEnding;
			} else if (Game.prestige > LuckyDigitEnding * LuckyUnlockMultiplier && !Game.Has("Lucky digit")) {
				ending = LuckyDigitEnding;
			}
		}
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
		if (this.sim.strategy.autoClick) {
			Game.ClickCookie();
		}

		// Click any golden cookies
		if (this.sim.strategy.autoClickGoldenCookies) {
			this.popShimmer("golden");
		}

		// Click any reindeer
		if (this.sim.strategy.autoClickReindeer) {
			this.popShimmer("reindeer");
		}

		// Click the sugar lump - the ticker is needed as it is possible to get multiple lumps
		// if you spam this just as it ripens.
		if (this.sugarTicker.ticked && Game.time - Game.lumpT > Game.lumpRipeAge) {
			Game.clickLump();
		}

		// Pop wrinklers during halloween if upgrades need unlocking
		if (this.sim.season.name == "halloween" && this.sim.strategy.unlockSeasonUpgrades) {
			for (let w in Game.wrinklers) {
				if (Game.wrinklers[w].sucked > 0) {
					Game.wrinklers[w].hp = 0;
				}
			}
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
		if (this.purchaseTicker.ticked) {
			this.nextPurchase = this.rankPurchases()[0];
		}

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

	update(): void {
		switch (this.state) {
			case UltimateCookieState.Farming:
				this.updateFarm();
				if (this.currentAscendPrestige == this.currentAscendPrestige) {
					console.log("Prestige target hit. Starting Ascending.");
					this.state = UltimateCookieState.StartAscending;
				}
			case UltimateCookieState.StartAscending:
				this.updateFarm();
			case UltimateCookieState.SpendPrestige:
				this.updateAscendPurchase();
			case UltimateCookieState.Reset:
				this.updateReset();
		}
	}

	// Normal farming, most of the time this should be what's going on
	updateFarm(): void {
		this.doClicking();
		this.doSyncing();
		this.doPurchasing();

		// Choose which auras to apply
		if (this.auraTicker.ticked) {
			this.chooseAuras();
		}

		// Cast spells
		if (this.spellTicker.ticked) {
			this.spendMagic();
		}
	}

	// Still farming but with checks to see if the prestige target for this ascension has been hit
	updateAscendWait(): void {
		this.updateFarm();	// For now just keep farming
	}

	updateAscendPurchase(): void {
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
// Dragon related stuff
//

class DragonAura extends Purchase {
	constructor(sim: Simulator, public index: number, public name: string) {
		super(sim);
	}

	get sacrificialBuildingIndex(): BuildingIndex {
		let index: BuildingIndex = -1;
		for (let i = 0; i < BuildingIndex.NumBuildings; ++i)
			if (this.sim.buildings[i].quantity > 0)
				index = i;
		return index;
	}

	get price(): number {
		let index: BuildingIndex = this.sacrificialBuildingIndex;
		return index == -1 ? 0 : this.sim.buildings[index].nthPrice(this.sim.buildings[index].quantity - 1);
	}

	get isAvailable(): boolean {
		const firstDragonAuraLevel = 5;
		if ((this.sim.dragonAura1 && this.sim.dragonAura1.index == this.index) || (this.sim.dragonAura2 && this.sim.dragonAura2.index == this.index))
			return false;
		return this.index >= this.sim.dragon.level - firstDragonAuraLevel;
	}

	purchase(): void {
		Game.dragonAura = this.index;
		let index: BuildingIndex = this.sacrificialBuildingIndex;
		if (index != -1) {
			Game.ObjectsById[index].sacrifice(1);
			this.sim.buildings[index].quantity--;
		}
		this.apply();
	}

	get benefit(): number {
		return this.replaceBenefit(this.sim.dragonAura1);
	}

	replaceBenefit(aura: DragonAura): number {
		if (aura == null) {
			return super.benefit;
		}
		if (!this.isApplied) {
			console.log("Error: evaluating replaceBenefit for aura that isn't applied " + this.name + ", " + aura.name);
		}
		let cps: number = this.sim.effectiveCps();
		aura.revoke();
		this.apply();
		let newCps: number = this.sim.effectiveCps();
		this.revoke();
		aura.apply();
		return newCps - cps;
	}

	get value(): number {
		// Override the minor benefit default for auras
		return this.benefit;
	}

	get canBePurchased(): boolean {
		return this.index + 4 <= this.sim.dragon.level && !this.isApplied;
	}
}

class DragonLevel extends Purchase {
	constructor(public dragon: Dragon, public num: number, public name: string) {
		super(dragon.sim);
		this.addNestedBooster("dragon", "level", 1);
	}

	get isAvailable() {
		return this.sim.dragon.level == this.num;
	}

	get price(): number {
		if (this.num <= 4) {
			return 1000000 * Math.pow(2, this.num);
		} else if (this.num <= 4 + BuildingIndex.NumBuildings) {
			// Cost of 100 of a given building
			let cost: number = 0;
			let index: BuildingIndex = this.num - 4;
			for (let i = 1; i <= 100; ++i)
				cost += this.dragon.sim.buildings[index].nthPrice(this.dragon.sim.buildings[index].quantity - i);
			return cost * 0.5;	// 50% refund
		} else if (this.num == 5 + BuildingIndex.NumBuildings) {
			// 50 of each building
			let cost: number = 0;
			for (let index: BuildingIndex = 0; index < BuildingIndex.NumBuildings; ++index)
				for (let i = 1; i <= 50; ++i)
					cost += this.dragon.sim.buildings[index].nthPrice(this.dragon.sim.buildings[index].quantity - i);
			return cost * 0.5;	// 50% refund
		} else if (this.num == 6 + BuildingIndex.NumBuildings) {
			// 100 of each building 
			let cost: number = 0;
			for (let index: BuildingIndex = 0; index < BuildingIndex.NumBuildings; ++index)
				for (let i = 1; i <= 100; ++i)
					cost += this.dragon.sim.buildings[index].nthPrice(this.dragon.sim.buildings[index].quantity - i);
			return cost * 0.5;	// 50% refund
		} else {
			console.log("Invalid dragon level " + this.num + " " + this.name);
			return 0;
		}
	}

	get longName(): string {
		return "Dragon level " + this.num + " " + this.name;
	}

	purchase(): void {
		Game.specialTab = "dragon";
		Game.UpgradeDragon();
		if (this.num > 4) {
			if (this.num <= 4 + BuildingIndex.NumBuildings) {
				// Cost of 100 of a given building
				this.sim.buildings[this.num - 5].quantity -= 100;
			} else if (this.num == 5 + BuildingIndex.NumBuildings) {
				// 50 of each building 
				for (let building of this.sim.buildings)
					building.quantity -= 50;
			} else if (this.num == 6 + BuildingIndex.NumBuildings) {
				// 100 of each building 
				for (let building of this.sim.buildings)
					building.quantity -= 100;
			}
		}
		this.apply();
	}
}

class Dragon {
	level: number
	levels: DragonLevel[] = []

	constructor(public sim: Simulator) {
		this.levels = [];

		let dragon = this;
		function level(num, name) {
			let level =  new DragonLevel(dragon, num, name)
			dragon.levels[num] = level;
			return level;
		}

		// Declare all the levels
		for (let i = 0; i < 3; ++i)
			level(i, "Dragon egg");
		level(3, "Shivering dragon egg");
		for (let i = 4; i < 7; ++i)
			level(i, "Krumblor, cookie hatchling");
		for (let i = 7; i < 22; ++i)
			level(i, "Krumblor, cookie dragon");
		
		this.reset();
	}

	get canBeLeveled(): boolean {
		return Game.Has('A crumbly egg') && Game.dragonLevel <= 4;
	}

	get nextLevel(): DragonLevel {
		return this.levels[this.level];
	}

	reset() {
		this.level = 0;
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

class BuildingLevel extends Purchase {
	readonly name: string
	constructor(sim: Simulator, public index: BuildingIndex) {
		super(sim);
		this.name = sim.buildings[index].name + " level";
	}

	get isAvailable(): boolean { return true; }

	get longName() {
		return this.name + " " + (this.sim.buildings[this.index].level + 1);
	}

	get price() {
		return this.sim.buildings[this.index].level + 1;
	}

	apply() {
		this.sim.buildings[this.index].level++;
		this.sim.lumps -= this.sim.buildings[this.index].level;
		super.apply();
	}

	purchase() {
		Game.ObjectsById[this.index].levelUp();
		this.apply();
	}

	revoke() {
		this.sim.lumps += this.sim.buildings[this.index].level;
		this.sim.buildings[this.index].level--;
		super.revoke();
	}
}

//
// Seasons
//
// Seasons are a class of modifier that make pretty big changes to the game, often enabling
// new shimmers, new buffs and a bunch of lockable items to unlock. 
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
// BaseSimulator
//
// The BaseSimulator class is the foundation for all simulators. It knows nothing about the various
// upgrades, buffs etc. but contains all the various state variables that would be required to perform
// the necessary CpC and CpS calculations
//

class BaseSimulator {
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
	modifiers: { [index: string]: Modifier } = {}
	prestiges: { [index: string]: Upgrade } = {}
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
		this.goldenCookieTime = GOLDEN_COOKIE_AVG_INTERVAL;
		this.goldenCookieDuration = GOLDEN_COOKIE_DURATION;
		this.goldenCookieEffectDurationMultiplier = 1;

		// Reindeer stuff
		this.reindeerDuration = REINDEER_DURATION;
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
		// If we dont click them, they don't work
		if (!this.strategy.autoClickGoldenCookies) {
			return 0;
		}

		let cookies1 = this.cps * LUCKY_COOKIE_CPS_SECONDS;
		let cookies2 = cookies1; // cookieBank * 0.15;

		return Math.min(cookies1, cookies2) + LUCKY_COOKIE_FLAT_BONUS;
	}

	// getCookieChainMax() {
	// 	const CookieChainMultiplier = 60 * 60 * 3;	// Verify this
	// 	return this.preCurseCps * CookieChainMultiplier;
	// }
}

//
// Simulator
//
// The Simulator class extends on the BaseSimulator by containing definitions for all of the
// various upgrades that exist in the cookie clicker game. 
//

class Simulator extends BaseSimulator {
	constructor(strategy: Strategy) {
		super(strategy);
	}
}

//class SyncedSimulator extends Simulator

function populate_simulator(sim: Simulator): void {
	const GoldenCookieBirthday = new Date(2013, 7, 8).getTime();

	// Add a new Buff to the Simulation
	function buff(name: string, duration: number): Buff {
		let buff = new Buff(sim, name, duration);
		sim.modifiers[name] = buff;
		sim.buffs[name] = buff;
		return buff;
	}

	// Add a new Building upgrade to the Simulation
	function building(index: BuildingIndex, name: string, cost: number, cps: number): Building {
		let building = new Building(sim, index, name, cost, cps);
		sim.buildings.push(building);
		return building;
	}

	// Add a new Dragon aura to the Simulation
	function dragonAura(index: number, name: string): DragonAura {
		let aura = new DragonAura(sim, index, name);
		sim.dragonAuras[index] = aura;
		return aura;
	}

	// Add a new prestige upgrade to the Simulation
	function prestige(name: string, extraFlags: UpgradeFlags = 0): Upgrade {
		let prestige = new Upgrade(sim, name, UpgradeFlags.Prestige | extraFlags);
		sim.modifiers[name] = prestige;
		sim.prestiges[name] = prestige;
		return prestige;
	}

	// Add a new Season to the Simulation
	function season(name: string, toggle?: string): Season {
		let season = new Season(sim, name, toggle);
		sim.seasons[name] = season;
		return season;
	}

	// Add a new Toggle to the Simulation
	function toggle(name: string, extraFlags: UpgradeFlags = 0): Upgrade {
		let toggle = upgrade(name, UpgradeFlags.Toggle | extraFlags);
		sim.toggles[name] = toggle;
		return toggle;
	}

	// Add a new Upgrade to the Simulation
	function upgrade(name: string, flags: UpgradeFlags = 0): Upgrade {
		let upgrade = new Upgrade(sim, name, flags);
		sim.modifiers[name] = upgrade;
		sim.upgrades[name] = upgrade;
		return upgrade;
	}

	function cookie(name: string, extraFlags: UpgradeFlags = 0): Upgrade {
		return upgrade(name, UpgradeFlags.Cookie | extraFlags);
	}

	function synergy(name: string, extraFlags: UpgradeFlags = 0): Upgrade {
		return upgrade(name, UpgradeFlags.Synergy | extraFlags);
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
	// Create all the dragon auras
	//

	dragonAura( 0, "No Dragon Aura"			);	// Do nothing default dragon aura
	dragonAura( 1, "Breath of Milk"			).scalesMilk(1.05);
	dragonAura( 2, "Dragon Cursor"			).scalesClicking(1.05);
	dragonAura( 3, "Elder Battalion"		);	// Grandmas gain +1% cps for every non-grandma building
	dragonAura( 4, "Reaper of Fields"		);	// Golden cookies may trigger a Dragon Harvest
	dragonAura( 5, "Earth Shatterer"		).scalesBuildingRefundRate(1.7);
	dragonAura( 6, "Master of the Armory"	).scalesUpgradePrice(0.98);
	dragonAura( 7, "Fierce Hoarder"			).scalesBuildingPrice(0.98);
	dragonAura( 8, "Dragon God"				).scalesPrestige(1.05);
	dragonAura( 9, "Arcane Aura"			).scalesGoldenCookieFrequency(1.05);
	dragonAura(10, "Dragonflight"			);	// Golden cookies may trigger a dragonflight
	dragonAura(11, "Ancestral Metamorphosis");	// Golden cookies give 10% more cookies
	dragonAura(12, "Unholy Dominion"		);	// Wrath cookies give 10% more cookies
	dragonAura(13, "Epoch Manipulator"		).scalesGoldenCookieEffectDuration(1.05);
	dragonAura(14, "Mind Over Matter"		);	// +25% random drops
	dragonAura(15, "Radiant Appetite"		).scalesProduction(2);
	dragonAura(16, "Dragon's Fortune"		);	// +111% CpS per golden-cookie on screen

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

	buff('Clot',					   66).isGoldenCookieBuff().scalesFrenzyMultiplier(0.5);
	buff('Frenzy',					   77).isGoldenCookieBuff().scalesFrenzyMultiplier(7).scalesReindeerBuffMultiplier(0.75);
	buff('Elder frenzy',		 	    6).isGoldenCookieBuff().scalesFrenzyMultiplier(666).scalesReindeerBuffMultiplier(0.5);
	buff('Click frenzy',			   13).isGoldenCookieBuff().scalesClickFrenzyMultiplier(777);
	buff('High-five',				   30).isGoldenCookieBuff().scalesFrenzyMultiplierPerBuilding(BuildingIndex.Cursor);
	buff('Congregation',			   30).isGoldenCookieBuff().scalesFrenzyMultiplierPerBuilding(BuildingIndex.Grandma);
	buff('Luxuriant harvest',		   30).isGoldenCookieBuff().scalesFrenzyMultiplierPerBuilding(BuildingIndex.Farm);
	buff('Ore vein',				   30).isGoldenCookieBuff().scalesFrenzyMultiplierPerBuilding(BuildingIndex.Mine);
	buff('Oiled-up',				   30).isGoldenCookieBuff().scalesFrenzyMultiplierPerBuilding(BuildingIndex.Factory);
	buff('Juicy profits',			   30).isGoldenCookieBuff().scalesFrenzyMultiplierPerBuilding(BuildingIndex.Bank);
	buff('Fervent adoration',		   30).isGoldenCookieBuff().scalesFrenzyMultiplierPerBuilding(BuildingIndex.Temple);
	buff('Manabloom',				   30).isGoldenCookieBuff().scalesFrenzyMultiplierPerBuilding(BuildingIndex.WizardTower);
	buff('Delicious lifeforms',		   30).isGoldenCookieBuff().scalesFrenzyMultiplierPerBuilding(BuildingIndex.Shipment);
	buff('Breakthrough',			   30).isGoldenCookieBuff().scalesFrenzyMultiplierPerBuilding(BuildingIndex.AlchemyLab);
	buff('Righteous cataclysm',		   30).isGoldenCookieBuff().scalesFrenzyMultiplierPerBuilding(BuildingIndex.Portal);
	buff('Golden ages',				   30).isGoldenCookieBuff().scalesFrenzyMultiplierPerBuilding(BuildingIndex.TimeMachine);
	buff('Extra cycles',			   30).isGoldenCookieBuff().scalesFrenzyMultiplierPerBuilding(BuildingIndex.AntimatterCondenser);
	buff('Solar flare',				   30).isGoldenCookieBuff().scalesFrenzyMultiplierPerBuilding(BuildingIndex.Prism);
	buff('Winning streak',			   30).isGoldenCookieBuff().scalesFrenzyMultiplierPerBuilding(BuildingIndex.Chancemaker);
	buff('Slap to the face',		   30).isGoldenCookieBuff().shrinksFrenzyMultiplierPerBuilding(BuildingIndex.Cursor);
	buff('Senility',				   30).isGoldenCookieBuff().shrinksFrenzyMultiplierPerBuilding(BuildingIndex.Grandma);
	buff('Locusts',					   30).isGoldenCookieBuff().shrinksFrenzyMultiplierPerBuilding(BuildingIndex.Farm);
	buff('Cave-in',					   30).isGoldenCookieBuff().shrinksFrenzyMultiplierPerBuilding(BuildingIndex.Mine);
	buff('Jammed machinery',		   30).isGoldenCookieBuff().shrinksFrenzyMultiplierPerBuilding(BuildingIndex.Factory);
	buff('Recession',				   30).isGoldenCookieBuff().shrinksFrenzyMultiplierPerBuilding(BuildingIndex.Bank);
	buff('Crisis of faith',			   30).isGoldenCookieBuff().shrinksFrenzyMultiplierPerBuilding(BuildingIndex.Temple);
	buff('Magivores',				   30).isGoldenCookieBuff().shrinksFrenzyMultiplierPerBuilding(BuildingIndex.WizardTower);
	buff('Black holes',				   30).isGoldenCookieBuff().shrinksFrenzyMultiplierPerBuilding(BuildingIndex.Shipment);
	buff('Lab disaster',			   30).isGoldenCookieBuff().shrinksFrenzyMultiplierPerBuilding(BuildingIndex.AlchemyLab);
	buff('Dimensional calamity',	   30).isGoldenCookieBuff().shrinksFrenzyMultiplierPerBuilding(BuildingIndex.Portal);
	buff('Time jam',				   30).isGoldenCookieBuff().shrinksFrenzyMultiplierPerBuilding(BuildingIndex.TimeMachine);
	buff('Predictable tragedy',		   30).isGoldenCookieBuff().shrinksFrenzyMultiplierPerBuilding(BuildingIndex.AntimatterCondenser);
	buff('Eclipse',					   30).isGoldenCookieBuff().shrinksFrenzyMultiplierPerBuilding(BuildingIndex.Prism);
	buff('Dry spell',				   30).isGoldenCookieBuff().shrinksFrenzyMultiplierPerBuilding(BuildingIndex.Chancemaker);
	buff('Cursed finger', 			   10).isGoldenCookieBuff().cursesFinger();	
	buff('Cookie storm',				7).isGoldenCookieBuff();		// Spawns a lot of golden cookies
	buff('Dragonflight', 			   10).scalesClickFrenzyMultiplier(1111);	
	buff('Dragon harvest', 			   60).scalesFrenzyMultiplier(15);	
	buff('Everything must go',		    8).scalesBuildingPrice(0.95);
	buff('Sugar blessing',	 24 * 60 * 60).scalesGoldenCookieFrequency(1.1);
	// Grimoire spell buffs - the duration of these doesn't scale
	buff("Crafty pixies",		 30).scalesBuildingPrice(0.98);
	buff("Nasty goblins",		 30).scalesBuildingPrice(1.02);
	buff("Haggler's Luck",		 30).scalesUpgradePrice(0.98);
	buff("Haggler's Misery",	 30).scalesUpgradePrice(1.02);
	buff("Magic adept",			300);		// Spells backfire 10 times less for five minutes

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
	
	// Sugar lump scaling added in 2.045
	prestige("Sugar baking"					).requires("Stevia Caelestis").boostsLumpScale(0.01).boostsLumpScaleLimit(100);
	prestige("Sugar craving"				).requires("Sugar baking");										// Unlocks sugar frenzy
	prestige("Sugar aging process"			).requires("Sugar craving").requires("Diabetica Daemonicus");	// Each grandma makes sugar lumps ripen 6 seconds sooner
	
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
	cookie("Birthday cookie"						).scalesProduction(1 + (0.01 * Math.floor((Date.now() - GoldenCookieBirthday) / (365 * 24 * 60 * 60 * 1000))));
	cookie("Pink biscuits"							).scalesProduction(1.04);
	cookie("Whole-grain cookies"					).scalesProduction(1.04);
	cookie("Candy cookies"							).scalesProduction(1.04);
	cookie("Big chip cookies"						).scalesProduction(1.04);
	cookie("One chip cookies"						).scalesProduction(1.01);
	cookie("Sprinkles cookies"						).scalesProduction(1.04);
	cookie("Peanut butter blossoms"					).scalesProduction(1.04);
	cookie("No-bake cookies"						).scalesProduction(1.04);
	cookie("Florentines"							).scalesProduction(1.04);
	cookie("Chocolate crinkles"						).scalesProduction(1.04);
	cookie("Maple cookies"							).scalesProduction(1.04);


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
	upgrade("One mind"						).givesBuildingPerBuildingBoost(BuildingIndex.Grandma, BuildingIndex.Grandma, 0.02).angersGrandmas();
	upgrade("Exotic nuts"					).scalesProduction(1.04);
	upgrade("Communal brainsweep"			).givesBuildingPerBuildingBoost(BuildingIndex.Grandma, BuildingIndex.Grandma, 0.02).angersGrandmas();
	upgrade("Arcane sugar"					).scalesProduction(1.05);
	upgrade("Elder Pact"					).givesBuildingPerBuildingBoost(BuildingIndex.Grandma, BuildingIndex.Portal, 0.05).angersGrandmas();
	upgrade("Sacrificial rolling pins"		).scalesElderPledgeDuration(2);

	// Assorted cursor / clicking upgrades
	upgrade("Reinforced index finger"		).scalesBaseClicking(2).scalesBuildingCps(BuildingIndex.Cursor, 2);
	upgrade("Carpal tunnel prevention cream").scalesBaseClicking(2).scalesBuildingCps(BuildingIndex.Cursor, 2);
	upgrade("Ambidextrous"					).scalesBaseClicking(2).scalesBuildingCps(BuildingIndex.Cursor, 2);
	upgrade("Thousand fingers"				).givesBuildingPerBuildingFlatCpsBoost(BuildingIndex.Cursor, BuildingIndex.Cursor, 0.1).givesPerBuildingFlatCpcBoost(BuildingIndex.Cursor, 0.1);
	upgrade("Million fingers"				).givesBuildingPerBuildingFlatCpsBoost(BuildingIndex.Cursor, BuildingIndex.Cursor, 0.5).givesPerBuildingFlatCpcBoost(BuildingIndex.Cursor, 0.5);
	upgrade("Billion fingers"				).givesBuildingPerBuildingFlatCpsBoost(BuildingIndex.Cursor, BuildingIndex.Cursor, 5).givesPerBuildingFlatCpcBoost(BuildingIndex.Cursor, 5);
	upgrade("Trillion fingers"				).givesBuildingPerBuildingFlatCpsBoost(BuildingIndex.Cursor, BuildingIndex.Cursor, 50).givesPerBuildingFlatCpcBoost(BuildingIndex.Cursor, 50);
	upgrade("Quadrillion fingers"			).givesBuildingPerBuildingFlatCpsBoost(BuildingIndex.Cursor, BuildingIndex.Cursor, 500).givesPerBuildingFlatCpcBoost(BuildingIndex.Cursor, 500);
	upgrade("Quintillion fingers"			).givesBuildingPerBuildingFlatCpsBoost(BuildingIndex.Cursor, BuildingIndex.Cursor, 5000).givesPerBuildingFlatCpcBoost(BuildingIndex.Cursor, 5000);
	upgrade("Sextillion fingers"			).givesBuildingPerBuildingFlatCpsBoost(BuildingIndex.Cursor, BuildingIndex.Cursor, 50000).givesPerBuildingFlatCpcBoost(BuildingIndex.Cursor, 50000);
	upgrade("Septillion fingers"			).givesBuildingPerBuildingFlatCpsBoost(BuildingIndex.Cursor, BuildingIndex.Cursor, 500000).givesPerBuildingFlatCpcBoost(BuildingIndex.Cursor, 500000);
	upgrade("Octillion fingers"				).givesBuildingPerBuildingFlatCpsBoost(BuildingIndex.Cursor, BuildingIndex.Cursor, 5000000).givesPerBuildingFlatCpcBoost(BuildingIndex.Cursor, 5000000);
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

	// Season setters
	upgrade("Festive biscuit",	UpgradeFlags.SeasonChanger).setsSeason("christmas");
	upgrade("Fool's biscuit",	UpgradeFlags.SeasonChanger).setsSeason("fools");
	upgrade("Lovesick biscuit",	UpgradeFlags.SeasonChanger).setsSeason("valentines");
	upgrade("Bunny biscuit",	UpgradeFlags.SeasonChanger).setsSeason("easter");
	upgrade("Ghostly biscuit",	UpgradeFlags.SeasonChanger).setsSeason("halloween");
	
	// Christmas season
	upgrade("A festive hat"			).requiresSeason("christmas");
	upgrade("Naughty list",					UpgradeFlags.SantaReward).requiresSeason("christmas").scalesBuildingCps(BuildingIndex.Grandma, 2);
	upgrade("A lump of coal",				UpgradeFlags.SantaReward).requiresSeason("christmas").scalesProduction(1.01);
	upgrade("An itchy sweater",				UpgradeFlags.SantaReward).requiresSeason("christmas").scalesProduction(1.01);
	upgrade("Improved jolliness",			UpgradeFlags.SantaReward).requiresSeason("christmas").scalesProduction(1.15);
	upgrade("Increased merriness",			UpgradeFlags.SantaReward).requiresSeason("christmas").scalesProduction(1.15);
	upgrade("Toy workshop",					UpgradeFlags.SantaReward).requiresSeason("christmas").scalesUpgradePrice(0.95);
	upgrade("Santa's helpers",				UpgradeFlags.SantaReward).requiresSeason("christmas").scalesClicking(1.1);
	upgrade("Santa's milk and cookies",		UpgradeFlags.SantaReward).requiresSeason("christmas").scalesMilk(1.05);
	upgrade("Santa's legacy",				UpgradeFlags.SantaReward).requiresSeason("christmas").boostsSantaPower(0.03);
	upgrade("Season savings",				UpgradeFlags.SantaReward).requiresSeason("christmas").scalesBuildingPrice(0.99);
	upgrade("Ho ho ho-flavored frosting",	UpgradeFlags.SantaReward).requiresSeason("christmas").scalesReindeer(2);
	upgrade("Weighted sleighs",				UpgradeFlags.SantaReward).requiresSeason("christmas").scalesReindeerDuration(2);
	upgrade("Reindeer baking grounds",		UpgradeFlags.SantaReward).requiresSeason("christmas").scalesReindeerFrequency(2);
	upgrade("Santa's bottomless bag",		UpgradeFlags.SantaReward).requiresSeason("christmas").scalesRandomDropFrequency(1.1);
	upgrade("Santa's dominion",				UpgradeFlags.SantaReward).requiresSeason("christmas").requires("Final Claus").scalesProduction(1.20).scalesBuildingPrice(0.99).scalesUpgradePrice(0.98);
	sim.santa.levels[0].requires("A festive hat");

	// Easter season
	upgrade("Chicken egg",		UpgradeFlags.Egg	).requiresSeason("easter").scalesProduction(1.01);
	upgrade("Duck egg",			UpgradeFlags.Egg	).requiresSeason("easter").scalesProduction(1.01);
	upgrade("Turkey egg",		UpgradeFlags.Egg	).requiresSeason("easter").scalesProduction(1.01);
	upgrade("Robin egg",		UpgradeFlags.Egg	).requiresSeason("easter").scalesProduction(1.01);
	upgrade("Cassowary egg",	UpgradeFlags.Egg	).requiresSeason("easter").scalesProduction(1.01);
	upgrade("Ostrich egg",		UpgradeFlags.Egg	).requiresSeason("easter").scalesProduction(1.01);
	upgrade("Quail egg",		UpgradeFlags.Egg	).requiresSeason("easter").scalesProduction(1.01);
	upgrade("Salmon roe",		UpgradeFlags.Egg	).requiresSeason("easter").scalesProduction(1.01);
	upgrade("Frogspawn",		UpgradeFlags.Egg	).requiresSeason("easter").scalesProduction(1.01);
	upgrade("Shark egg",		UpgradeFlags.Egg	).requiresSeason("easter").scalesProduction(1.01);
	upgrade("Turtle egg",		UpgradeFlags.Egg	).requiresSeason("easter").scalesProduction(1.01);
	upgrade("Ant larva",		UpgradeFlags.Egg	).requiresSeason("easter").scalesProduction(1.01);
	upgrade("Golden goose egg",	UpgradeFlags.RareEgg).requiresSeason("easter").scalesGoldenCookieFrequency(1.05);
	upgrade("Cookie egg",		UpgradeFlags.RareEgg).requiresSeason("easter").scalesClicking(1.1);
	upgrade("Faberge egg",		UpgradeFlags.RareEgg).requiresSeason("easter").scalesBuildingPrice(0.99).scalesUpgradePrice(0.99);
	upgrade("\"egg\"",			UpgradeFlags.RareEgg).requiresSeason("easter").boostsBaseCps(9);
	upgrade("Century egg",		UpgradeFlags.RareEgg).requiresSeason("easter").scalesCenturyMultiplier(1.1);
	upgrade("Omelette",			UpgradeFlags.RareEgg).requiresSeason("easter");	// Other eggs appear 10% more often
	upgrade("Wrinklerspawn",	UpgradeFlags.RareEgg).requiresSeason("easter");	// Wrinklers explode 5% more cookies
	upgrade("Chocolate egg",	UpgradeFlags.RareEgg).requiresSeason("easter");	// Spawns a lot of cookies
	
	// Halloween season
	cookie("Bat cookies"				).requiresSeason("halloween").scalesProduction(1.02);
	cookie("Eyeball cookies"			).requiresSeason("halloween").scalesProduction(1.02);
	cookie("Ghost cookies"				).requiresSeason("halloween").scalesProduction(1.02);
	cookie("Pumpkin cookies"			).requiresSeason("halloween").scalesProduction(1.02);
	cookie("Skull cookies"				).requiresSeason("halloween").scalesProduction(1.02);
	cookie("Slime cookies"				).requiresSeason("halloween").scalesProduction(1.02);
	cookie("Spider cookies"				).requiresSeason("halloween").scalesProduction(1.02);
	
	// Valentines Day season
	cookie("Pure heart biscuits",		UpgradeFlags.HeartCookie).requiresSeason("valentines");
	cookie("Ardent heart biscuits",		UpgradeFlags.HeartCookie).requiresSeason("valentines");
	cookie("Sour heart biscuits",		UpgradeFlags.HeartCookie).requiresSeason("valentines");
	cookie("Weeping heart biscuits",	UpgradeFlags.HeartCookie).requiresSeason("valentines");
	cookie("Golden heart biscuits",		UpgradeFlags.HeartCookie).requiresSeason("valentines");
	cookie("Eternal heart biscuits",	UpgradeFlags.HeartCookie).requiresSeason("valentines");
	
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
	toggle("Golden switch [on]", UpgradeFlags.GoldenSwitch);
	toggle("Golden switch [off]", UpgradeFlags.GoldenSwitch);
	upgrade("Sugar frenzy"					);	// 
}

//
// Utility stuff and starting the app off
//

// Compare floats with an epsilon value
function floatEqual(a: number, b: number): boolean {
	let eps = Math.abs(a - b) * 1000000000000.0;
	return eps <= Math.abs(a) && eps <= Math.abs(b);
}

console.log("Ultimate Cookie starting at " + new Date());

// Create the upgradeInfo and Ultimate Cookie instances
var uc = new UltimateCookie();
