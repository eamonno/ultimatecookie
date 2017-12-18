var Constants = {};
var Config = {};

Config.failHard = false;
Config.autoClick = true;
Config.autoClickGoldenCookies = true;
Config.autoClickReindeer = true;
Config.autoReset = false;
Config.autoBuy = true;
Config.autoSwitchSeasons = false;
Config.autoPledge = true;
Config.autoPopWrinklers = true;
Config.skipHalloween = false;
Config.resetLimit = 1.1;
Config.maintainCookieBank = false;
Config.clickRateForCalculations = 0;	// 0 to disable

// General purpose constants
Constants.SUPPORTED_VERSION = "2.0042";
Constants.VERSION_ERROR = "Warning: Ultimate Cookie only supports version " + Constants.SUPPORTED_VERSION + " of the game. Your mileage may vary.\n";
Constants.AUTO_BUY_MIN_INTERVAL = 1;
Constants.AUTO_BUY_MAX_INTERVAL = 1010;
Constants.AUTO_CLICK_INTERVAL = 1;
Constants.AUTO_UPDATE_INTERVAL = 1000;
Constants.CLICK_RATE_ESTIMATE_SAMPLES = 120;
Constants.SEASON_SWITCH_DELAY = 11000;			// Season changes dont register in game immediately, this stops rapid switching
Constants.CLOT_MULTIPLIER = 0.5;				// Clot halves CpS
Constants.FRENZY_MULTIPLIER = 7;				// Frenzy multiplies CpS by 7
Constants.CLICK_FRENZY_MULTIPLIER = 777;		// Click frenzies give 777x cookier per click
Constants.REINDEER_CPS_SECONDS = 60;			// Reindeer provide 60 seconds of CpS
Constants.REINDEER_MIN_COOKIES = 25;			// Reindeer give at least 25 cookies
Constants.REINDEER_ELDER_FRENZY_MULTIPLIER = 0.5;	// Reindeer dont get complete scaling with Elder Frenzy
Constants.REINDEER_FRENZY_MULTIPLIER = 0.75;	// Reindeer dont get complete scaling with Frenzy
Constants.REINDEER_DURATION = 4;				// Length a reindeer lasts before upgrades
Constants.GOLDEN_COOKIE_DURATION = 13;			// Golden cookies last 13 seconds by default
Constants.GOLDEN_COOKIE_MIN_INTERVAL = 60 * 5;	// Minimum time between golden cookies
Constants.GOLDEN_COOKIE_MAX_INTERVAL = 60 * 15;	// Maximum time between golden cookies
Constants.GOLDEN_COOKIE_AVG_INTERVAL = (Constants.GOLDEN_COOKIE_MIN_INTERVAL + Constants.GOLDEN_COOKIE_MAX_INTERVAL) / 2;
Constants.LUCKY_COOKIE_CPS_SECONDS = 60 * 15;	// Lucky provides up to 15 minutes CpS based on bank
Constants.LUCKY_COOKIE_FLAT_BONUS = 13;			// Lucky provides 13 additional seconds of CpS regardless
Constants.LUCKY_COOKIE_BANK_LIMIT = 0.15;		// Lucky provides 0.15 times bank at most
Constants.COOKIE_CHAIN_MULTIPLIER = 60 * 60 * 3;// Cookie chains cap out at 3 hours of cookies
Constants.COOKIE_CHAIN_BANK_SCALE = 4;			// Bank needs 4 times the Cookie Chain limit to payout in full
Constants.RESET_PAUSE_TIME = 1000;				// Time to pause so reset can complete correctly
Constants.COOKIE_CLICKER_BIRTHDAY = new Date(2013, 7, 8);	// Used for birthday cookie

// Indices into the buildings arrays
Constants.CURSOR_INDEX = 0;
Constants.GRANDMA_INDEX = 1;
Constants.FARM_INDEX = 2;
Constants.MINE_INDEX = 3;
Constants.FACTORY_INDEX = 4;
Constants.BANK_INDEX = 5;
Constants.TEMPLE_INDEX = 6;
Constants.WIZARD_TOWER_INDEX = 7;
Constants.SHIPMENT_INDEX = 8;
Constants.ALCHEMY_LAB_INDEX = 9;
Constants.PORTAL_INDEX = 10;
Constants.TIME_MACHINE_INDEX = 11;
Constants.ANTIMATTER_CONDENSER_INDEX = 12;
Constants.PRISM_INDEX = 13;
Constants.CHANCEMAKER_INDEX = 14;

// Elder Wrath levels
Constants.APPEASED = 0;
Constants.AWOKEN = 1;
Constants.DISPLEASED = 2;
Constants.ANGERED = 3;

// Season names
// Constants.NO_SEASON = "";
// Constants.BUSINESS_DAY = "fools";
Constants.CHRISTMAS = "christmas";
// Constants.EASTER = "easter";
// Constants.HALLOWEEN = "halloween";
// Constants.VALENTINES_DAY = "valentines";
Constants.MAX_SANTA_LEVEL = 14;

// var seasons = {};
// seasons[Constants.NO_SEASON] = {
// 	name: Constants.NO_SEASON,
// 	numUpgrades: 0,
// 	wrinklersDropUpgrades: false,
// };
// seasons[Constants.BUSINESS_DAY] = {
// 	name: Constants.BUSINESS_DAY,
// 	numUpgrades: 0,
// 	wrinklersDropUpgrades: false,
// };
// seasons[Constants.CHRISTMAS] = {
// 	name: Constants.CHRISTMAS,
// 	numUpgrades: 23,
// 	wrinklersDropUpgrades: false,
// };
// seasons[Constants.EASTER] = {
// 	name: Constants.EASTER,
// 	numUpgrades: 20,
// 	wrinklersDropUpgrades: true,
// };
// seasons[Constants.HALLOWEEN] = {
// 	name: Constants.HALLOWEEN,
// 	numUpgrades: 7,
// 	wrinklersDropUpgrades: true,
// };
// seasons[Constants.VALENTINES_DAY] = {
// 	name: Constants.VALENTINES_DAY,
// 	numUpgrades: 6,
// 	wrinklersDropUpgrades: false,
// };

//
// Periodical
//
// Periodicals are functions that execute on a set frequency. They can be 
// enabled or disbled and have various timings etc.
//

class Periodical {
	constructor(name, minInterval, maxInterval, callback) {
		this.name = name;
		this.minInterval = minInterval;
		this.maxInterval = maxInterval;
		this.interval = this.minInterval;
		this.callback = callback;
		this.nextTimeMillis = 0;
	}

	check(timeMillis) {
		if (timeMillis >= nextTimeMillis) {
			if (this.callback())
				interval = this.minInterval;
			else
				interval = Math.min(this.interval * 2, this.maxInterval);
			this.nextTimeMillis = timeMillis + this.interval;
		}
	}
}

// Periodical("Auto-Clicker", 1, 1, function() { return this.click(); });
// Periodical("Auto-Buyer", 1, 1000, function() { return this.buy(); });
// Periodical("Golden Cookie Auto-Clicker", 1, 1000, function() { return this.clickGoldenCookie(); });

//
// UltimateCookie represents the app itself
//

class UltimateCookie {
	constructor() {
		this.autoBuyInterval = Constants.AUTO_BUY_MIN_INTERVAL;
		this.lastDeterminedPurchase = "";
		this.lastPurchaseTime = new Date().getTime();
		this.lastClickRateCheckTime = this.lastPurchaseTime;
		this.lastClickCount = Game.cookieClicks;
		this.clickRates = [100];
		this.clickRate = 100;
		this.lockSeasons = false;
		this.lockSeasonsTimer = 0;
		this.matchError = "";
		this.sim = new Simulator();
		this.sim.syncToGame();
		this.needsResync = false;
		this.lastGameCps = Game.cookiesPs;
		this.lastGameCpc = Game.mouseCps();
		
		// Start off the automatic things
		this.autoClick(Constants.AUTO_CLICK_INTERVAL);
		this.autoUpdate(Constants.AUTO_UPDATE_INTERVAL);
		this.autoBuy(Constants.AUTO_BUY_MIN_INTERVAL);
	}
}

UltimateCookie.prototype.autoClick = function(interval) {
	clearInterval(this.autoClicker);
	if (interval == undefined) {
		if (Config.autoClick) {
			this.click();
		}
		interval = Constants.AUTO_CLICK_INTERVAL;
	}
	var t = this;
	this.autoClicker = setTimeout(function() { t.autoClick(); }, interval);
}

UltimateCookie.prototype.autoUpdate = function(interval) {
	clearInterval(this.autoUpdater);
	if (interval == undefined) {
		this.update();
		interval = Constants.AUTO_UPDATE_INTERVAL;
	}
	var t = this;
	this.autoUpdater = setTimeout(function() { t.autoUpdate(); }, interval);
}

UltimateCookie.prototype.autoBuy = function(interval) {
	clearInterval(this.autoBuyer);

	var lp = this.lastPurchaseTime;
	// Dont buy during 'Cursed finger'. The game freezes its CpS numbers while it is active so it will just desync
	if (Config.autoBuy && !Game.hasBuff('Cursed finger')) {
		this.buy();
	}
	if (lp != this.lastPurchaseTime) {	// Just bought something
		this.autoBuyInterval = Constants.AUTO_BUY_MIN_INTERVAL;
	} else {
		this.autoBuyInterval = Math.min(Constants.AUTO_BUY_MAX_INTERVAL, this.autoBuyInterval * 2);
	}
	interval = this.autoBuyInterval;

	var t = this;
	this.autoBuyer = setTimeout(function() { t.autoBuy(); }, interval);
}

UltimateCookie.prototype.rankPurchases = function(eval) {
	// Default to current game if no evaluator passed
	eval = eval ? eval : this.sim;

	var p1 = this.createPurchaseList();
	p1.sort( function(a, b) { return UltimateCookie.prototype.comparePurchases(eval, a, b); } );

	// Research booster is always higher priority than research starter. This can't be handled
	// in comparePurchases
	var booster;
	var i;
	for (i = p1.length - 1; i >= 0; --i) {
		if (booster && p1[i].isResearchStarter) {
			var tmp = p1[booster];
			p1.splice(booster, 1);	// remove booster
			p1.splice(i, 0, tmp);	// reinsert before the research starter
			booster = i;
		} else if (p1[i].isResearchBooster) {
			booster = i;
		}
	}
	return p1;
}

UltimateCookie.prototype.sortTest = function() {
	var e = new Evaluator();
	e.syncToGame();
	var p1 = this.rankPurchases(e);
	for (var p = p1.length - 1; p >= 0; --p) {
		console.log(p1[p].name + "(" + (p1[p].getValue(e) / p1[p].getCost()) + ")");
	}
	console.log("CpS diff: " + Math.round(e.getCps() - Game.cookiesPs) + ", next: " + this.lastDeterminedPurchase);
}

UltimateCookie.prototype.comparePurchases = function(eval, a, b) {
	// If autoPledge is active, Elder Pledge trumps all
	if (Config.autoPledge && Game.elderWrath > 0 && !(a.beginsElderPledge && b.beginsElderPledge)/* && (!seasons[eval.season].wrinklersDropUpgrades || eval.lockedSeasonUpgrades[eval.season] == 0)*/) {
		if (a.beginsElderPledge && !b.beginsElderPledge) {
			return -1;
		} else if (b.beginsElderPledge && !a.beginsElderPledge) {
			return 1;
		}
	}

	var eCps = eval.effectiveCps();
	var aCpsGain = a.getValue(eval);
	var bCpsGain = b.getValue(eval);

	// Get time to buy both starting with a
	var ta = a.getCost() / eCps + b.getCost() / (eCps + aCpsGain);
	var tb = b.getCost() / eCps + a.getCost() / (eCps + bCpsGain);

	// If times are equal (can happen late game with many order of magnitude differences in numbers)
	if (floatEqual(ta, tb)) {
		// Prioritise the higher cpsGain, if there is none sort alphabetically on name
		// so the results are consistent and repeatable and not dependant on order of a, b
		if (aCpsGain != bCpsGain) {
			return bCpsGain - aCpsGain;
		} else {
			return a.name < b.name ? -1 : (a.name > b.name ? 1 : 0);
		}
	}
	return ta - tb;
}

UltimateCookie.prototype.createPurchaseList = function() {
	var purchases = [];

	// Add the buildings
	var i;
	for (i = 0; i < Game.ObjectsById.length; ++i) {
		purchases.push(getUpgradeFunction(Game.ObjectsById[i].name));
	}
	// Add the upgrades
	for (i = 0; i < Game.UpgradesInStore.length; ++i) {
		purchases.push(getUpgradeFunction(Game.UpgradesInStore[i].name));
	}
	// Add santa 
	if (Game.season == Constants.CHRISTMAS && Game.santaLevel < Constants.MAX_SANTA_LEVEL && Game.Has("A festive hat")) {
		purchases.push(allPurchases["Santa Level"]);
	}
	return purchases;
}

// Work out what the optimal next purchase is for a given evaluator
UltimateCookie.prototype.determineNextPurchase = function(eval) {
	var purchases = this.rankPurchases(eval);
	var p = 0;
	if (Config.autoSwitchSeasons == false || this.lockSeasons == true) {
		while (purchases[p].setsSeason != undefined) {
			++p;
		}
	}

	if (purchases[p].name != this.lastDeterminedPurchase) {
		this.lastDeterminedPurchase = purchases[p].name;
		console.log("Clickrate: " + this.clickRate + ", CpS margin: " + Math.round(eval.getCps() - Game.cookiesPs) + ", CpC margin: " + Math.round(eval.getCpc() - Game.computedMouseCps) + ", next: " + this.lastDeterminedPurchase);
	}
	return purchases[p];
}

UltimateCookie.prototype.click = function() {
	Game.ClickCookie();
}

UltimateCookie.prototype.buy = function() {
	// Resync if the game has changed
	if (this.lastGameCps != Game.cookiesPs || this.lastGameCpc != Game.mouseCps())
		this.needsResync = true;

	// Get an Evaluator synced to the current game
	if (this.needsResync && Game.recalculateGains == 0) {
		this.sim.syncToGame();
		this.needsResync = false;
		this.lastGameCps = Game.cookiesPs;
		this.lastGameCpc = Game.mouseCps();
	} 

	// If Game.recalculateGains is 1 that means we are out of sync until the next
	// update which should be within a fraction of a second, just assume that sim
	// is correct until then. This allows for fast purchasing without stalling until the
	// game does a full update
	if (Game.recalculateGains == 1 || this.sim.matchesGame()) {
		var time = new Date().getTime();

		var nextPurchase = this.determineNextPurchase(this.sim);
		// Shutdown if out of sync
		var cookieBank = this.sim.getCookieBankSize();
		// Cap cookie bank at 5% of total cookies earned
		cookieBank = Math.min(Game.cookiesEarned / 20, cookieBank);
		if (Game.cookies - cookieBank > nextPurchase.getCost()) {
			this.lastPurchaseTime = time;
			if (!nextPurchase.setsSeason || !this.lockSeasons) {
				nextPurchase.purchase();
				this.needsResync = true;
			}
			if (nextPurchase.setsSeason) {
				this.lockSeasonsTimer = time + Constants.SEASON_SWITCH_DELAY;
			}
		}

		if (Config.autoPopWrinklers /* && seasons[this.sim.season].wrinklersDropUpgrades && this.sim.lockedSeasonUpgrades[this.sim.season] != 0 */) {
			for (var w in Game.wrinklers) {
				if (Game.wrinklers[w].sucked > 0) {
					Game.wrinklers[w].hp = 0;
				}
			}
		}
	} else {
		// Fail hard option, mostly used for debugging
		console.log(this.sim.matchError);
		if (Config.failHard) {
			Config.autoClick = false;
			Config.autoBuy = false;
			Config.autoClickGoldenCookies = false;
			Config.autoClickReindeer = false;
		} else {
			// Resync, something has gone wrong
			this.sim.syncToGame();
		}
	} 
}

UltimateCookie.prototype.popShimmer = function(type)
{
	for (var i = 0; i < Game.shimmers.length; ++i) {
		if (Game.shimmers[i].type == type) {
			Game.shimmers[i].pop();
			return;		// Only pop one at a time since the pop func might alter the array
		}
	}
}

UltimateCookie.prototype.update = function() {
	var now = new Date().getTime();

	if (now - this.lastClickRateCheckTime >= 1000) {
		var newClicks = Game.cookieClicks - this.lastClickCount;
		var newRate;
		if (newClicks >= 0) {
			newRate = newClicks * 1000 / (now - this.lastClickRateCheckTime);
		} else {
			// If the user imports a save Game.cookieClicks can go down, in that case just use
			// the current click rate instead of having a weird negative click rate
			newRate = this.clickRate;
		}
		this.clickRates.push(newRate);
		while (this.clickRates.length > Constants.CLICK_RATE_ESTIMATE_SAMPLES) {
			this.clickRates.shift();
		}
		var sum = 0;
		for (var i = 0; i < this.clickRates.length; ++i)
			sum += this.clickRates[i];
		this.clickRate = Math.floor(sum / this.clickRates.length);
		//console.log("Click rate - Last Second: " + Math.floor(newRate) +", Average: " + this.clickRate);
		this.lastClickCount = Game.cookieClicks;
		this.lastClickRateCheckTime = now;
		this.sim.clickRate = Config.clickRateForCalculations ? Config.clickRateForCalculations : this.clickRate;
	}
	if (Config.autoClickGoldenCookies) {
		this.popShimmer("golden");
		this.lastGoldenCookieTime = new Date().getTime();
	}
	if (Config.autoClickReindeer) {
		this.popShimmer("reindeer");
	}
	if (Config.autoReset) {
		// Wait until frenzy or clickFrenzyMultiplier is over to reset
		if (!Game.frenzy && !Game.clickFrenzy) {
			var hcs = Game.HowMuchPrestige(Game.cookiesReset);
			var resethcs = Game.HowMuchPrestige(Game.cookiesReset + Game.cookiesEarned);

			var scaleNow = 1 + hcs * 0.02;
			var scaleReset = 1 + resethcs * 0.02;

			if (scaleReset / scaleNow >= Config.resetLimit) {
				this.reset();
			}
		}
	}
}

UltimateCookie.prototype.reset = function() {
	var now = new Date().getTime();
	if (upgradeFunctions.chocolateEgg.isAvailableToPurchase()) {
		for (var o in Game.ObjectsById) {
			Game.ObjectsById[o].sell(Game.ObjectsById[o].amount);
		}
		upgradeFunctions.chocolateEgg.purchase();
	}
	var hcs = Game.HowMuchPrestige(Game.cookiesReset);
	var resethcs = Game.HowMuchPrestige(Game.cookiesReset + Game.cookiesEarned);

	console.log("Resetting game. HCs now: " + hcs + ", HCs after reset: " + resethcs + ", time: " + now);
	this.lastPurchaseTime = now;
	this.lastClickCount = 0;
	this.sim.initialize();
	this.autoBuy(Constants.RESET_PAUSE_TIME);
	this.autoClick(Constants.RESET_PAUSE_TIME);
	this.autoUpdate(Constants.RESET_PAUSE_TIME);
	Game.Reset(1, 0);
}


//
// Counts all the buildings with a scaling factor for each building type
//
function BuildingCounter() {
	// One per building type
	this.scales = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
}

BuildingCounter.prototype.getCount = function(buildings) {
	var count = 0;
	var i;
	for (i = 0; i < this.scales.length; ++i) {
		count += this.scales[i] * buildings[i].quantity;
	}
	return count;
}

BuildingCounter.prototype.addCounter = function(counter) {
	var i;
	for (i = 0; i < this.scales.length; ++i) {
		this.scales[i] += counter.scales[i];
	}
	return this;
}

BuildingCounter.prototype.addCountOne = function(index, scale=1) {
	this.scales[index] += scale;
	return this;
}

BuildingCounter.prototype.addCountAll = function(scale=1) {
	var i;
	for (i = 0; i < this.scales.length; ++i) {
		this.scales[i] += amount;
	}
	return this;
}

BuildingCounter.prototype.addCountMost = function(excludes, scale=1) {
	var i;
	for (i = 0; i < this.scales.length; ++i) {
		if (excludes.indexOf(i) == -1)
			this.scales[i] += scale;
	}
	return this;
}

BuildingCounter.prototype.subtractCounter = function(counter) {
	var i;
	for (i = 0; i < this.scales.length; ++i) {
		this.scales[i] -= counter.scales[i];
	}
	return this;
}

BuildingCounter.prototype.subtractCountOne = function(index, scale=1) {
	return this.addCountOne(index, -scale);
}

BuildingCounter.prototype.subtractCountAll = function(scale=1) {
	return this.addCountAll(-scale);
}

BuildingCounter.prototype.subtractCountMost = function(excludes, scale=1) {
	return this.addCountMost(excludes, -scale);
}


//
// Building.
//
// Represents one of the building types in the game.

class Building {
	constructor(sim, name, baseCost, baseCps) {
		this.name = name;
		this.sim = sim;
		this.baseCost = baseCost;
		this.baseCps = baseCps;
		this.reset();
	}

	reset() {
		this.quantity = 0;
		this.free = 0;
		this.multiplier = 1;
		this.synergies = new BuildingCounter();
		this.perBuildingFlatCpcBoostCounter = new BuildingCounter();
		this.perBuildingFlatCpsBoostCounter = new BuildingCounter();
		this.buildingScaler = new BuildingCounter();
		this.scaleCounter = new BuildingCounter();
	}

	get cost() {
		return Math.ceil(this.sim.buildingCostScale * this.baseCost * Math.pow(1.15, this.quantity - this.free));
	}
	
	get cps() {
		return this.quantity * this.individualCps;
	}

	get individualCps() {
		return this.perBuildingFlatCpsBoostCounter.getCount(this.sim.buildings) + this.baseCps * (1 + this.scaleCounter.getCount(this.sim.buildings)) * this.synergyMultiplier * (1 + this.buildingScaler.getCount(this.sim.buildings)) * this.multiplier;
	}

	get synergyMultiplier() {
		var scale = 1;
		var i;
		for (i = 0; i < this.synergies.scales.length; ++i) {
			scale *= 1 + this.sim.buildings[i].quantity * this.synergies.scales[i];
		}
		return scale;
	}

	// DELETE THESE AS SOON AS SORT WORKS WITHOUT THEM

	getCps() {
		return this.cps;
	}

	getCost() {
		return this.cost;
	}
}

//
// Some class variables and containers for holding upgrades
//

var upgradeFunctions = {}
var upgradeIndex = {}
var upgradesSupported = 0;
var upgradeBuildingsSupported = 0;

//
// Modifier.
//
// The modifier is a base class for anything that modifies a Simulation. Any
// modifier can be applied to or revoked from a Simulation.
//
var allModifiers = {};

class Modifier {
	constructor(sim, name) {
		this.sim = sim;
		this.name = name;
		this.applied = false;
		this.appliers = [];
		this.revokers = [];
		allModifiers[name] = this;
	}

	// REFACTOR - ADD ERROR CHECK TO PREVENT DOUBLE REPLY
	apply() {
		var i;
		for (i = 0; i < this.appliers.length; ++i)
			this.appliers[i](this.sim);
		this.applied = true;
	}

	reset() {
		this.applied = false;
	}

	// REFACTOR - ADD ERROR CHECK TO PREVENT FAULTY REVOKE
	revoke() {
		var i;
		for (i = this.revokers.length - 1; i >= 0; --i)
			this.revokers[i](this.sim);
		this.applied = false;
	}

	// REFACTOR - DELETE
	applyTo(sim) {
		var i;
		for (i = 0; i < this.appliers.length; ++i)
			this.appliers[i](sim);
		this.applied = true;
	}

	// REFACTOR - DELETE
	revokeFrom(sim) {
		var i;
		for (i = this.revokers.length - 1; i >= 0; --i)
			this.revokers[i](sim);
		this.applied = false;
	}

	addApplier(func) {
		this.appliers.push(func);
	}

	addRevoker(func) {
		this.revokers.push(func);
	}

	requires(modifier) {
		// REFACTOR - REMOVE allModifiers COMPLETELY
		// REFACTOR - DONT JUST IGNORE BROKEN REQUIREMENTS
		var required;
		if (this.sim) {
			required = this.sim.modifiers[modifier];
		} else {
			required = allModifiers[modifier];
		}
		if (!required) {
			console.log("Missing requirement for " + this.name + ": " + modifier);
			return this;
		}
		if (required.locks == undefined) 
			required.locks = [];
		required.locks.push(this);
		return this;
	}

	// Calculate the amount of effective CpS this modifier adds directly
	// REFACTOR - TURN INTO A GETTER
	getEffectiveCps(sim) {
		var cps = sim.effectiveCps();
		this.applyTo(sim);
		cps = sim.effectiveCps() - cps;
		this.revokeFrom(sim);
		return cps;
	}
}

//
// Seasons
//
// Seasons are a class of modifier that make pretty big changes to the game, often enabling
// new shimmers, new buffs and a bunch of lockable items to unlock. 
//

class Season extends Modifier {
	constructor(sim, name) {
		super(sim, name);
		this.addApplier(function(sim) { sim.seasonStack.unshift(name); });
		this.addRevoker(function(sim) { sim.seasonStack.shift(); });
	}
}

//
// Buffs.
//
// Buffs are temporary modifications to the game, often giving very large increases in
// throughput for a short duration.
//

var allBuffs = {};

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
}

//
// Purchases.
//
// Purchases are a subtype of modifier that can be bought in the game. They provide
// information about costing that can be used to prioritise what to buy next.

allPurchases = {};

class Purchase extends Modifier {
	constructor(name) {
		super(null, name);
		// Seperate set of Appliers and Revokers to use in valuation, same idea as before
		// except these are applied to get a relative value rather than to get accurate CpS
		this.valuationAppliers = [];
		this.valuationRevokers = [];
		allPurchases[name] = this;
	}

	applyValueTo(sim) {
		var i;
		for (i = 0; i < this.valuationAppliers.length; ++i)
			this.valuationAppliers[i](sim);
	}

	revokeValueFrom(sim) {
		var i;
		for (i = this.valuationRevokers.length - 1; i >= 0; --i)
			this.valuationRevokers[i](sim);
	}
	
	addValueApplier(func) {
		this.valuationAppliers.push(func);
	}

	addValueRevoker(func) {
		this.valuationRevokers.push(func);
	}

	// Calculate the value of the Purchase. This may not relate directly to the actual CpS it adds
	// but instead is a number used to estimate when the purchase should be bought. For example an
	// upgrade that reduces building cost should return 0 from getEffectiveCps but a number proportional
	// to the cost reduction from getValue.
	getValue(sim) {
		var cps = sim.effectiveCps();
		this.applyValueTo(sim);
		this.applyTo(sim);
		var value = sim.effectiveCps() - cps;
		this.revokeFrom(sim);
		this.revokeValueFrom(sim);

		if (this.locks == undefined) {
			return value;	// If this doesn't unlock anything, its CpS is all it has to offer
		}
		//if (this.valueFromTotalCps)
		//	val += sim.getEffectiveCps() * this.valueFromTotalCps;
		// if (this.setsSeason == Constants.VALENTINES_DAY && eval.lockedSeasonUpgrades[Constants.VALENTINES_DAY] > 0) {
		// 	val = upgradeFunctions.pureHeartBiscuits.getValue(eval);
		// }
		// if (this.setsSeason == Constants.EASTER && eval.lockedSeasonUpgrades[Constants.EASTER] > 0) {
		// 	if (eval.grandmatriarchStatus >= Constants.AWOKEN) {
		// 		val = upgradeFunctions.chickenEgg.getValue(eval);
		// 	}
		// }
		// if (this.setsSeason == Constants.HALLOWEEN && eval.lockedSeasonUpgrades[Constants.HALLOWEEN] > 0) {
		// 	if (eval.grandmatriarchStatus >= Constants.AWOKEN && !Config.skipHalloween) {
		// 		val = upgradeFunctions.skullCookies.getValue(eval);
		// 	}
		// }
		
		// The next step is to look ahead in the unlock chain and find the best value there. If this 
		// Purchase unlocks something much more valuable then the effective value of this purchase needs to
		// be adjusted to account for that. This involves recursively working down through all the unlocks
		// that can be chained together and finding the one which offers the best value and adjusting this
		// upgrades value proportionally depending on that
		var cost = this.getCost();
		var best = -1;
		var bestValue = value / cost;
		var i;
		for (i = 0; i < this.locks.length; ++i) {
			var v = this.locks[i].getValue(sim) / this.locks[i].getCost();
			if (v > bestValue)
				bestValue = v;
		}
		return bestValue * cost;
	}
}

class SantaLevel extends Purchase {
	constructor() {
		super("Santa Level");
	}

	purchase() {
		Game.specialTab = "santa";	// Game bugs out if you don't do this
		Game.UpgradeSanta();
	}

	getCost() {
		return Math.pow(Game.santaLevel + 1, Game.santaLevel + 1);
	}

	getValue(sim) {
		// The value is the average value of whatever remains in the random pool
		var cost = this.getCost();
		var value = this.getEffectiveCps(sim);
		var randomValue = 0;
		var i;
		var p;
		for (i = 0; i < sim.randomSantaRewardsRemaining.length; ++i) {
			p = allPurchases[sim.randomSantaRewardsRemaining[i]];
			// Cost triples each level, so account for that here, the upgrade will
			// be three times as expensive as you think
			randomValue += (p.getValue(sim) / (p.getCost() * 3)) * cost;
		}
		// Factor in Santa's dominion too
		i++;
		p = allPurchases["Santa's dominion"];
		randomValue += (p.getValue(sim) / (p.getCost() + Math.pow(Constants.MAX_SANTA_LEVEL, Constants.MAX_SANTA_LEVEL))) * cost;
		
		return value + randomValue / i;
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

var allUpgrades = {};
var allRandomSantaRewards = [];

class Upgrade extends Purchase {
	constructor(name, supported) {
		super(name);
		if (supported) {
			upgradesSupported += 1;
		}
		allUpgrades[name] = this;
		this.addApplier(function(sim) { sim.upgrades[name] = true; });
		this.addRevoker(function(sim) { sim.upgrades[name] = false; });
	}

	get variableName() {
		var s = this.name;
		s = s.replace("9th", "ninth");
		s = s.replace("&eacute;", "e");
		s = s.replace("'", "");
		s = s.replace("\"", "");
		s = s.replace(/\W\w/g, function(s) { return s.toUpperCase(); } );
		s = s.replace(/\W+/g, "");
		s = s.replace(/^\w/g, function(s) { return s.toLowerCase(); } );
		return s;
	}
	
	//
	// Implementation of the various upgrades themselves
	//

	addValueScaling(scale) {
		// Used to just add some value in a case where impact cant really be measured, basically
		// a way to say "it's not worth much but buy it anyway"
		this.addValueApplier(function(sim) { sim.productionScale *= scale; });
		this.addValueRevoker(function(sim) { sim.productionScale /= scale; });
		return this;
	}

	angersGrandmas() {
		this.addApplier(function(sim) { sim.grandmatriarchStatus++; });
		this.addRevoker(function(sim) { sim.grandmatriarchStatus--; });
		return this;
	}

	builds(index, quantity) {
		upgradesSupported -= 1;
		upgradeBuildingsSupported += 1;
		this.addApplier(function(sim) { sim.buildings[index].quantity += quantity; });
		this.addRevoker(function(sim) { sim.buildings[index].quantity -= quantity; });
		this.purchase = function() { Game.ObjectsById[index].buy(quantity); };
		this.getCost = function() { return Game.ObjectsById[index].getPrice(); };
		return this;
	}

	boostsClickCps(amount) {
		this.addApplier(function(sim) { sim.cpcCpsMultiplier += amount; });
		this.addRevoker(function(sim) { sim.cpcCpsMultiplier -= amount; });
		return this;
	}

	boostsSantaPower(amount) {
		this.addApplier(function(sim) { sim.santaPower += amount; });
		this.addRevoker(function(sim) { sim.santaPower -= amount; });
		return this;
	}

	calmsGrandmas() {
		this.beginsElderPledge = true;
		return this;
	}
	
	doublesElderPledge() {
		this.getValue = function(sim) { return upgradeFunctions.elderPledge.getCost() / 3600; };
		return this;
	}

	getCost() {
		return Game.Upgrades[this.name].getPrice();
	}

	isRandomSantaReward() {
		allRandomSantaRewards.push(this.name);
		return this;
	}

	purchase() {
		return Game.Upgrades[this.name].buy(1);
	}

	scalesBaseClicking(scale) {
		this.addApplier(function(sim) { sim.cpcBaseMultiplier *= scale; });
		this.addRevoker(function(sim) { sim.cpcBaseMultiplier /= scale; });
		return this;
	}

	scalesBuildingCost(scale) {
		this.addApplier(function(sim) { sim.buildingCostScale *= scale; });
		this.addRevoker(function(sim) { sim.buildingCostScale /= scale; });
		this.addValueApplier(function(sim) { sim.productionScale /= scale; });
		this.addValueRevoker(function(sim) { sim.productionScale *= scale; });
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

	scalesUpgradeCost(scale)	{
		this.addValueApplier(function(sim) { sim.productionScale /= scale; });
		this.addValueRevoker(function(sim) { sim.productionScale *= scale; });
		return this;
	}

	scalesMilk(scale) {
		this.addApplier(function(sim) { sim.milkMultiplier *= scale; });
		this.addRevoker(function(sim) { sim.milkMultiplier /= scale; });
		return this;
	}
	
	scalesProduction(scale)	{
		this.addApplier(function(sim) { sim.productionScale *= scale; });
		this.addRevoker(function(sim) { sim.productionScale /= scale; });
		return this;
	}

	scalesProductionByAge(scale) {
		var age = Math.floor((Date.now() - Constants.COOKIE_CLICKER_BIRTHDAY) / (365 * 24 * 60 * 60 * 1000));
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

	startsResearch() {
		// Used in sorting to make sure that research boosters are bought before research starters.
		this.isResearchStarter = true;
		return this;
	}
	
	givesBuildingPerBuildingFlatCpsBoost(receiver, excludes, amount) {
		this.addApplier(function(sim) { sim.buildings[receiver].perBuildingFlatCpsBoostCounter.addCountMost(excludes, amount); });
		this.addRevoker(function(sim) { sim.buildings[receiver].perBuildingFlatCpsBoostCounter.subtractCountMost(excludes, amount); });
		return this;
	}

	givesSynergy(receiver, from, amount, reverse=0) {
		this.addApplier(function(sim) { sim.buildings[receiver].synergies.addCountOne(from, amount); });
		this.addRevoker(function(sim) { sim.buildings[receiver].synergies.subtractCountOne(from, amount); });
		if (reverse) {
			this.addApplier(function(sim) { sim.buildings[from].synergies.addCountOne(receiver, reverse); });
			this.addRevoker(function(sim) { sim.buildings[from].synergies.subtractCountOne(receiver, reverse); });				
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

// Upgrade.prototype.applyUpgrade = function(eval) {
// 	if (this.clickBoost != undefined)
// 		eval.cpcBase += this.clickBoost;
// 	if (this.baseCpsBoost != undefined)
// 		eval.baseCps += this.baseCpsBoost;
// 	if (this.centuryProductionBoost != undefined)
// 		eval.centuryProductionMultiplier += this.centuryProductionBoost;
// 	if (this.wrinklerScale != undefined)
// 		eval.wrinklerMultiplier *= this.wrinklerScale;
// }

// Upgrade.prototype.revokeUpgrade = function(eval) {
// 	if (this.clickBoost != undefined)
// 		eval.cpcBase -= this.clickBoost;
// 	if (this.baseCpsBoost != undefined)
// 		eval.baseCps -= this.baseCpsBoost;
// 	if (this.centuryProductionBoost != undefined)
// 		eval.centuryProductionMultiplier -= this.centuryProductionBoost;
// 	if (this.wrinklerScale != undefined)
// 		eval.wrinklerMultiplier /= this.wrinklerScale;
// }

// Upgrade.prototype.boostsResearch = function() {
// 	this.isResearchBooster = true;
// 	return this;
// }

// Upgrade.prototype.boostsClicking = function(amount) {
// 	this.clickBoost = amount;
// 	return this;
// }

// Upgrade.prototype.scalesBuildingCpsCost = function(scale) {
// 	this.valueFromTotalCps = (this.valueFromTotalCps ? this.valueFromTotalCps : 0) + (1 - scale);
// 	this.buildingCostScale = scale;
// 	return this;
// }

// Upgrade.prototype.unlocksSeasonSwitching = function() {
// 	this.valueFromTotalCps = (this.valueFromTotalCps ? this.valueFromTotalCps : 0) + 0.05;
// 	this.unlocksSeasons = true;
// 	return this;
// }

// Upgrade.prototype.boostsBaseCps = function(amount) {
// 	this.baseCpsBoost = amount;
// 	return this;
// }

// Upgrade.prototype.boostsCenturyProduction = function(amount) {
// 	this.centuryProductionBoost = amount;
// 	return this;
// }

// Upgrade.prototype.scalesWrinklers = function(scale) {
// 	this.valueFromTotalCps = (this.valueFromTotalCps ? this.valueFromTotalCps : 0) + 0.05;
// 	this.wrinklerScale = scale;
// 	return this;
// }

// Upgrade.prototype.increasesEggDropChance = function(amount) {
// 	this.valueFromTotalCps = (this.valueFromTotalCps ? this.valueFromTotalCps : 0) + 0.0001 * amount;
// 	return this;
// }

// Upgrade.prototype.scalesCookieBank = function(scale) {
// 	return this;
// }

upgrade = function(name, supported=1) {
	var u = new Upgrade(name, supported);
	upgradeIndex[name] = u;
	upgradeFunctions[u.variableName] = u;
	return u;
}

legacy = function(name, supported=0) {
	return upgrade(name, supported)
}

// Upgrades for the basic building types
upgrade("Cursor"				).builds(Constants.CURSOR_INDEX, 1);
upgrade("Grandma"				).builds(Constants.GRANDMA_INDEX, 1);
upgrade("Farm"					).builds(Constants.FARM_INDEX, 1);
upgrade("Mine"					).builds(Constants.MINE_INDEX, 1);
upgrade("Factory"				).builds(Constants.FACTORY_INDEX, 1);
upgrade("Bank"					).builds(Constants.BANK_INDEX, 1);
upgrade("Temple"				).builds(Constants.TEMPLE_INDEX, 1);
upgrade("Wizard tower"			).builds(Constants.WIZARD_TOWER_INDEX, 1);
upgrade("Shipment"				).builds(Constants.SHIPMENT_INDEX, 1);
upgrade("Alchemy lab"			).builds(Constants.ALCHEMY_LAB_INDEX, 1);
upgrade("Portal"				).builds(Constants.PORTAL_INDEX, 1);
upgrade("Time machine"			).builds(Constants.TIME_MACHINE_INDEX, 1);
upgrade("Antimatter condenser"	).builds(Constants.ANTIMATTER_CONDENSER_INDEX, 1);
upgrade("Prism"					).builds(Constants.PRISM_INDEX, 1);
upgrade("Chancemaker"			).builds(Constants.CHANCEMAKER_INDEX, 1);

// Upgrades that double the productivity of a type of building
upgrade("Forwards from grandma"			).scalesBuildingCps(Constants.GRANDMA_INDEX, 2);
upgrade("Steel-plated rolling pins"		).scalesBuildingCps(Constants.GRANDMA_INDEX, 2);
upgrade("Lubricated dentures"			).scalesBuildingCps(Constants.GRANDMA_INDEX, 2);
upgrade("Double-thick glasses"			).scalesBuildingCps(Constants.GRANDMA_INDEX, 2);
upgrade("Prune juice"					).scalesBuildingCps(Constants.GRANDMA_INDEX, 2);
upgrade("Aging agents"					).scalesBuildingCps(Constants.GRANDMA_INDEX, 2);
upgrade("Xtreme walkers"				).scalesBuildingCps(Constants.GRANDMA_INDEX, 2);
upgrade("The Unbridling"				).scalesBuildingCps(Constants.GRANDMA_INDEX, 2);
upgrade("Reverse dementia"				).scalesBuildingCps(Constants.GRANDMA_INDEX, 2);
upgrade("Farmer grandmas"				).scalesBuildingCps(Constants.GRANDMA_INDEX, 2).givesSynergy(Constants.FARM_INDEX, Constants.GRANDMA_INDEX, 0.01);
upgrade("Miner grandmas"				).scalesBuildingCps(Constants.GRANDMA_INDEX, 2).givesSynergy(Constants.MINE_INDEX, Constants.GRANDMA_INDEX, 0.01 / 2);
upgrade("Worker grandmas"				).scalesBuildingCps(Constants.GRANDMA_INDEX, 2).givesSynergy(Constants.FACTORY_INDEX, Constants.GRANDMA_INDEX, 0.01 / 3);
upgrade("Banker grandmas"				).scalesBuildingCps(Constants.GRANDMA_INDEX, 2).givesSynergy(Constants.BANK_INDEX, Constants.GRANDMA_INDEX, 0.01 / 4);
upgrade("Priestess grandmas"			).scalesBuildingCps(Constants.GRANDMA_INDEX, 2).givesSynergy(Constants.TEMPLE_INDEX, Constants.GRANDMA_INDEX, 0.01 / 5);
upgrade("Witch grandmas"				).scalesBuildingCps(Constants.GRANDMA_INDEX, 2).givesSynergy(Constants.WIZARD_TOWER_INDEX, Constants.GRANDMA_INDEX, 0.01 / 6);
upgrade("Cosmic grandmas"				).scalesBuildingCps(Constants.GRANDMA_INDEX, 2).givesSynergy(Constants.SHIPMENT_INDEX, Constants.GRANDMA_INDEX, 0.01 / 7);
upgrade("Transmuted grandmas"			).scalesBuildingCps(Constants.GRANDMA_INDEX, 2).givesSynergy(Constants.ALCHEMY_LAB_INDEX, Constants.GRANDMA_INDEX, 0.01 / 8);
upgrade("Altered grandmas"				).scalesBuildingCps(Constants.GRANDMA_INDEX, 2).givesSynergy(Constants.PORTAL_INDEX, Constants.GRANDMA_INDEX, 0.01 / 9);
upgrade("Grandmas' grandmas"			).scalesBuildingCps(Constants.GRANDMA_INDEX, 2).givesSynergy(Constants.TIME_MACHINE_INDEX, Constants.GRANDMA_INDEX, 0.01 / 10);
upgrade("Antigrandmas"					).scalesBuildingCps(Constants.GRANDMA_INDEX, 2).givesSynergy(Constants.ANTIMATTER_CONDENSER_INDEX, Constants.GRANDMA_INDEX, 0.01 / 11);
upgrade("Rainbow grandmas"				).scalesBuildingCps(Constants.GRANDMA_INDEX, 2).givesSynergy(Constants.PRISM_INDEX, Constants.GRANDMA_INDEX, 0.01 / 12);
upgrade("Lucky grandmas"				).scalesBuildingCps(Constants.GRANDMA_INDEX, 2).givesSynergy(Constants.CHANCEMAKER_INDEX, Constants.GRANDMA_INDEX, 0.01 / 13);
upgrade("Cheap hoes"					).scalesBuildingCps(Constants.FARM_INDEX, 2);
upgrade("Fertilizer"					).scalesBuildingCps(Constants.FARM_INDEX, 2);
upgrade("Cookie trees"					).scalesBuildingCps(Constants.FARM_INDEX, 2);
upgrade("Genetically-modified cookies"	).scalesBuildingCps(Constants.FARM_INDEX, 2);
upgrade("Gingerbread scarecrows"		).scalesBuildingCps(Constants.FARM_INDEX, 2);
upgrade("Pulsar sprinklers"				).scalesBuildingCps(Constants.FARM_INDEX, 2);
upgrade("Fudge fungus"					).scalesBuildingCps(Constants.FARM_INDEX, 2);
upgrade("Wheat triffids"				).scalesBuildingCps(Constants.FARM_INDEX, 2);
upgrade("Humane pesticides"				).scalesBuildingCps(Constants.FARM_INDEX, 2);
upgrade("Sugar gas"						).scalesBuildingCps(Constants.MINE_INDEX, 2);
upgrade("Megadrill"						).scalesBuildingCps(Constants.MINE_INDEX, 2);
upgrade("Ultradrill"					).scalesBuildingCps(Constants.MINE_INDEX, 2);
upgrade("Ultimadrill"					).scalesBuildingCps(Constants.MINE_INDEX, 2);
upgrade("H-bomb mining"					).scalesBuildingCps(Constants.MINE_INDEX, 2);
upgrade("Coreforge"						).scalesBuildingCps(Constants.MINE_INDEX, 2);
upgrade("Planetsplitters"				).scalesBuildingCps(Constants.MINE_INDEX, 2);
upgrade("Canola oil wells"				).scalesBuildingCps(Constants.MINE_INDEX, 2);
upgrade("Mole people"					).scalesBuildingCps(Constants.MINE_INDEX, 2);
upgrade("Sturdier conveyor belts"		).scalesBuildingCps(Constants.FACTORY_INDEX, 2);
upgrade("Child labor"					).scalesBuildingCps(Constants.FACTORY_INDEX, 2);
upgrade("Sweatshop"						).scalesBuildingCps(Constants.FACTORY_INDEX, 2);
upgrade("Radium reactors"				).scalesBuildingCps(Constants.FACTORY_INDEX, 2);
upgrade("Recombobulators"				).scalesBuildingCps(Constants.FACTORY_INDEX, 2);
upgrade("Deep-bake process"				).scalesBuildingCps(Constants.FACTORY_INDEX, 2);
upgrade("Cyborg workforce"				).scalesBuildingCps(Constants.FACTORY_INDEX, 2);
upgrade("78-hour days"					).scalesBuildingCps(Constants.FACTORY_INDEX, 2);
upgrade("Machine learning"				).scalesBuildingCps(Constants.FACTORY_INDEX, 2);
upgrade("Taller tellers"				).scalesBuildingCps(Constants.BANK_INDEX, 2);
upgrade("Scissor-resistant credit cards").scalesBuildingCps(Constants.BANK_INDEX, 2);
upgrade("Acid-proof vaults"				).scalesBuildingCps(Constants.BANK_INDEX, 2);
upgrade("Chocolate coins"				).scalesBuildingCps(Constants.BANK_INDEX, 2);
upgrade("Exponential interest rates"	).scalesBuildingCps(Constants.BANK_INDEX, 2);
upgrade("Financial zen"					).scalesBuildingCps(Constants.BANK_INDEX, 2);
upgrade("Way of the wallet"				).scalesBuildingCps(Constants.BANK_INDEX, 2);
upgrade("The stuff rationale"			).scalesBuildingCps(Constants.BANK_INDEX, 2);
upgrade("Edible money"					).scalesBuildingCps(Constants.BANK_INDEX, 2);
upgrade("Golden idols"					).scalesBuildingCps(Constants.TEMPLE_INDEX, 2);
upgrade("Sacrifices"					).scalesBuildingCps(Constants.TEMPLE_INDEX, 2);
upgrade("Delicious blessing"			).scalesBuildingCps(Constants.TEMPLE_INDEX, 2);
upgrade("Sun festival"					).scalesBuildingCps(Constants.TEMPLE_INDEX, 2);
upgrade("Enlarged pantheon"				).scalesBuildingCps(Constants.TEMPLE_INDEX, 2);
upgrade("Great Baker in the sky"		).scalesBuildingCps(Constants.TEMPLE_INDEX, 2);
upgrade("Creation myth"					).scalesBuildingCps(Constants.TEMPLE_INDEX, 2);
upgrade("Theocracy"						).scalesBuildingCps(Constants.TEMPLE_INDEX, 2);
upgrade("Pointier hats"					).scalesBuildingCps(Constants.WIZARD_TOWER_INDEX, 2);
upgrade("Beardlier beards"				).scalesBuildingCps(Constants.WIZARD_TOWER_INDEX, 2);
upgrade("Ancient grimoires"				).scalesBuildingCps(Constants.WIZARD_TOWER_INDEX, 2);
upgrade("Kitchen curses"				).scalesBuildingCps(Constants.WIZARD_TOWER_INDEX, 2);
upgrade("School of sorcery"				).scalesBuildingCps(Constants.WIZARD_TOWER_INDEX, 2);
upgrade("Dark formulas"					).scalesBuildingCps(Constants.WIZARD_TOWER_INDEX, 2);
upgrade("Cookiemancy"					).scalesBuildingCps(Constants.WIZARD_TOWER_INDEX, 2);
upgrade("Rabbit trick"					).scalesBuildingCps(Constants.WIZARD_TOWER_INDEX, 2);
upgrade("Vanilla nebulae"				).scalesBuildingCps(Constants.SHIPMENT_INDEX, 2);
upgrade("Wormholes"						).scalesBuildingCps(Constants.SHIPMENT_INDEX, 2);
upgrade("Frequent flyer"				).scalesBuildingCps(Constants.SHIPMENT_INDEX, 2);
upgrade("Warp drive"					).scalesBuildingCps(Constants.SHIPMENT_INDEX, 2);
upgrade("Chocolate monoliths"			).scalesBuildingCps(Constants.SHIPMENT_INDEX, 2);
upgrade("Generation ship"				).scalesBuildingCps(Constants.SHIPMENT_INDEX, 2);
upgrade("Dyson sphere"					).scalesBuildingCps(Constants.SHIPMENT_INDEX, 2);
upgrade("The final frontier"			).scalesBuildingCps(Constants.SHIPMENT_INDEX, 2);
upgrade("Antimony"						).scalesBuildingCps(Constants.ALCHEMY_LAB_INDEX, 2);
upgrade("Essence of dough"				).scalesBuildingCps(Constants.ALCHEMY_LAB_INDEX, 2);
upgrade("True chocolate"				).scalesBuildingCps(Constants.ALCHEMY_LAB_INDEX, 2);
upgrade("Ambrosia"						).scalesBuildingCps(Constants.ALCHEMY_LAB_INDEX, 2);
upgrade("Aqua crustulae"				).scalesBuildingCps(Constants.ALCHEMY_LAB_INDEX, 2);
upgrade("Origin crucible"				).scalesBuildingCps(Constants.ALCHEMY_LAB_INDEX, 2);
upgrade("Theory of atomic fluidity"		).scalesBuildingCps(Constants.ALCHEMY_LAB_INDEX, 2);
upgrade("Ancient tablet"				).scalesBuildingCps(Constants.PORTAL_INDEX, 2);
upgrade("Insane oatling workers"		).scalesBuildingCps(Constants.PORTAL_INDEX, 2);
upgrade("Soul bond"						).scalesBuildingCps(Constants.PORTAL_INDEX, 2);
upgrade("Sanity dance"					).scalesBuildingCps(Constants.PORTAL_INDEX, 2);
upgrade("Brane transplant"				).scalesBuildingCps(Constants.PORTAL_INDEX, 2);
upgrade("Deity-sized portals"			).scalesBuildingCps(Constants.PORTAL_INDEX, 2);
upgrade("End of times back-up plan"		).scalesBuildingCps(Constants.PORTAL_INDEX, 2);
upgrade("Flux capacitors"				).scalesBuildingCps(Constants.TIME_MACHINE_INDEX, 2);
upgrade("Time paradox resolver"			).scalesBuildingCps(Constants.TIME_MACHINE_INDEX, 2);
upgrade("Quantum conundrum"				).scalesBuildingCps(Constants.TIME_MACHINE_INDEX, 2);
upgrade("Causality enforcer"			).scalesBuildingCps(Constants.TIME_MACHINE_INDEX, 2);
upgrade("Yestermorrow comparators"		).scalesBuildingCps(Constants.TIME_MACHINE_INDEX, 2);
upgrade("Far future enactment"			).scalesBuildingCps(Constants.TIME_MACHINE_INDEX, 2);
upgrade("Great loop hypothesis"			).scalesBuildingCps(Constants.TIME_MACHINE_INDEX, 2);
upgrade("Sugar bosons"					).scalesBuildingCps(Constants.ANTIMATTER_CONDENSER_INDEX, 2);
upgrade("String theory"					).scalesBuildingCps(Constants.ANTIMATTER_CONDENSER_INDEX, 2);
upgrade("Large macaron collider"		).scalesBuildingCps(Constants.ANTIMATTER_CONDENSER_INDEX, 2);
upgrade("Big bang bake"					).scalesBuildingCps(Constants.ANTIMATTER_CONDENSER_INDEX, 2);
upgrade("Reverse cyclotrons"			).scalesBuildingCps(Constants.ANTIMATTER_CONDENSER_INDEX, 2);
upgrade("Nanocosmics"					).scalesBuildingCps(Constants.ANTIMATTER_CONDENSER_INDEX, 2);
upgrade("Gem polish"					).scalesBuildingCps(Constants.PRISM_INDEX, 2);
upgrade("9th color"						).scalesBuildingCps(Constants.PRISM_INDEX, 2);
upgrade("Chocolate light"				).scalesBuildingCps(Constants.PRISM_INDEX, 2);
upgrade("Grainbow"						).scalesBuildingCps(Constants.PRISM_INDEX, 2);
upgrade("Pure cosmic light"				).scalesBuildingCps(Constants.PRISM_INDEX, 2);
upgrade("Glow-in-the-dark"				).scalesBuildingCps(Constants.PRISM_INDEX, 2);
upgrade("Your lucky cookie"				).scalesBuildingCps(Constants.CHANCEMAKER_INDEX, 2);
upgrade('"All Bets Are Off" magic coin' ).scalesBuildingCps(Constants.CHANCEMAKER_INDEX, 2);
upgrade("Winning lottery ticket" 		).scalesBuildingCps(Constants.CHANCEMAKER_INDEX, 2);
upgrade("Four-leaf clover field" 		).scalesBuildingCps(Constants.CHANCEMAKER_INDEX, 2);
upgrade("A recipe book about books"		).scalesBuildingCps(Constants.CHANCEMAKER_INDEX, 2);
upgrade("Leprechaun village"			).scalesBuildingCps(Constants.CHANCEMAKER_INDEX, 2);

// Upgrades that increase cookie production
upgrade("Plain cookies"											).scalesProduction(1.01);
upgrade("Sugar cookies"											).scalesProduction(1.01);
upgrade("Oatmeal raisin cookies"								).scalesProduction(1.01);
upgrade("Peanut butter cookies"									).scalesProduction(1.01);
upgrade("Coconut cookies"										).scalesProduction(1.01);
upgrade("White chocolate cookies"								).scalesProduction(1.02);
upgrade("Macadamia nut cookies"									).scalesProduction(1.02);
upgrade("Double-chip cookies"									).scalesProduction(1.02);
upgrade("White chocolate macadamia nut cookies"					).scalesProduction(1.02);
upgrade("All-chocolate cookies"									).scalesProduction(1.02);
upgrade("Dark chocolate-coated cookies"							).scalesProduction(1.04);
upgrade("White chocolate-coated cookies"						).scalesProduction(1.04);
upgrade("Eclipse cookies"										).scalesProduction(1.02);
upgrade("Zebra cookies"											).scalesProduction(1.02);
upgrade("Snickerdoodles"										).scalesProduction(1.02);
upgrade("Stroopwafels"											).scalesProduction(1.02);
upgrade("Macaroons"												).scalesProduction(1.02);
upgrade("Empire biscuits"										).scalesProduction(1.02);
upgrade("Madeleines"											).scalesProduction(1.02);
upgrade("Palmiers"												).scalesProduction(1.02);
upgrade("Palets"												).scalesProduction(1.02);
upgrade("Sabl&eacute;s"											).scalesProduction(1.02);
upgrade("Gingerbread men"										).scalesProduction(1.02);
upgrade("Gingerbread trees"										).scalesProduction(1.02);
upgrade("Pure black chocolate cookies"							).scalesProduction(1.04);
upgrade("Pure white chocolate cookies"							).scalesProduction(1.04);
upgrade("Ladyfingers"											).scalesProduction(1.03);
upgrade("Tuiles"												).scalesProduction(1.03);
upgrade("Chocolate-stuffed biscuits"							).scalesProduction(1.03);
upgrade("Checker cookies"										).scalesProduction(1.03);
upgrade("Butter cookies"										).scalesProduction(1.03);
upgrade("Cream cookies"											).scalesProduction(1.03);
upgrade("Gingersnaps"											).scalesProduction(1.04);
upgrade("Cinnamon cookies"										).scalesProduction(1.04);
upgrade("Vanity cookies"										).scalesProduction(1.04);
upgrade("Cigars"												).scalesProduction(1.04);
upgrade("Pinwheel cookies"										).scalesProduction(1.04);
upgrade("Fudge squares"											).scalesProduction(1.04);
upgrade("Shortbread biscuits"									).scalesProduction(1.04);
upgrade("Millionaires' shortbreads"								).scalesProduction(1.04);
upgrade("Caramel cookies"										).scalesProduction(1.04);
upgrade("Pecan sandies"											).scalesProduction(1.04);
upgrade("Moravian spice cookies"								).scalesProduction(1.04);
upgrade("Milk chocolate butter biscuit"							).scalesProduction(1.10);
upgrade("Anzac biscuits"										).scalesProduction(1.04);
upgrade("Buttercakes"											).scalesProduction(1.04);
upgrade("Ice cream sandwiches"									).scalesProduction(1.04);
upgrade("Dark chocolate butter biscuit"							).scalesProduction(1.10);
upgrade("Birthday cookie"										).scalesProductionByAge(0.01);

// Golden cookie upgrade functions
upgrade("Lucky day"						).scalesGoldenCookieFrequency(2).scalesGoldenCookieDuration(2);
upgrade("Serendipity"					).scalesGoldenCookieFrequency(2).scalesGoldenCookieDuration(2);
upgrade("Get lucky"						).scalesGoldenCookieEffectDuration(2);

// Research centre related upgrades
upgrade("Bingo center/Research facility").startsResearch().scalesBuildingCps(Constants.GRANDMA_INDEX, 4);
upgrade("Specialized chocolate chips"	).startsResearch().scalesProduction(1.01);
upgrade("Designer cocoa beans"			).startsResearch().scalesProduction(1.02);
upgrade("Ritual rolling pins"			).startsResearch().scalesBuildingCps(Constants.GRANDMA_INDEX, 2);
upgrade("Underworld ovens"				).startsResearch().scalesProduction(1.03);
upgrade("One mind"						).startsResearch().givesPerBuildingBoost(Constants.GRANDMA_INDEX, Constants.GRANDMA_INDEX, 0.02).angersGrandmas();
upgrade("Exotic nuts"					).startsResearch().scalesProduction(1.04);
upgrade("Communal brainsweep"			).startsResearch().givesPerBuildingBoost(Constants.GRANDMA_INDEX, Constants.GRANDMA_INDEX, 0.02).angersGrandmas();
upgrade("Arcane sugar"					).startsResearch().scalesProduction(1.05);
upgrade("Elder Pact"					).givesPerBuildingBoost(Constants.GRANDMA_INDEX, Constants.PORTAL_INDEX, 0.05).angersGrandmas();
// upgrade("Persistent memory"				).boostsResearch();

// Elder pledge
upgrade("Elder Pledge", false			).calmsGrandmas();		// The false means this isn't one of the listed upgrades on the stats page
upgrade("Sacrificial rolling pins"		).doublesElderPledge();
upgrade("Elder Covenant", false			).calmsGrandmas().scalesProduction(0.95);

// Assorted cursor / clicking upgrades
upgrade("Reinforced index finger"		).scalesBaseClicking(2).scalesBuildingCps(Constants.CURSOR_INDEX, 2);
upgrade("Carpal tunnel prevention cream").scalesBaseClicking(2).scalesBuildingCps(Constants.CURSOR_INDEX, 2);
upgrade("Ambidextrous"					).scalesBaseClicking(2).scalesBuildingCps(Constants.CURSOR_INDEX, 2);
upgrade("Thousand fingers"				).givesBuildingPerBuildingFlatCpsBoost(Constants.CURSOR_INDEX, [Constants.CURSOR_INDEX], 0.1).givesPerBuildingFlatCpcBoost([Constants.CURSOR_INDEX], 0.1);
upgrade("Million fingers"				).givesBuildingPerBuildingFlatCpsBoost(Constants.CURSOR_INDEX, [Constants.CURSOR_INDEX], 0.5).givesPerBuildingFlatCpcBoost([Constants.CURSOR_INDEX], 0.5);
upgrade("Billion fingers"				).givesBuildingPerBuildingFlatCpsBoost(Constants.CURSOR_INDEX, [Constants.CURSOR_INDEX], 5).givesPerBuildingFlatCpcBoost([Constants.CURSOR_INDEX], 5);
upgrade("Trillion fingers"				).givesBuildingPerBuildingFlatCpsBoost(Constants.CURSOR_INDEX, [Constants.CURSOR_INDEX], 50).givesPerBuildingFlatCpcBoost([Constants.CURSOR_INDEX], 50);
upgrade("Quadrillion fingers"			).givesBuildingPerBuildingFlatCpsBoost(Constants.CURSOR_INDEX, [Constants.CURSOR_INDEX], 500).givesPerBuildingFlatCpcBoost([Constants.CURSOR_INDEX], 500);
upgrade("Quintillion fingers"			).givesBuildingPerBuildingFlatCpsBoost(Constants.CURSOR_INDEX, [Constants.CURSOR_INDEX], 5000).givesPerBuildingFlatCpcBoost([Constants.CURSOR_INDEX], 5000);
upgrade("Sextillion fingers"			).givesBuildingPerBuildingFlatCpsBoost(Constants.CURSOR_INDEX, [Constants.CURSOR_INDEX], 50000).givesPerBuildingFlatCpcBoost([Constants.CURSOR_INDEX], 50000);
upgrade("Septillion fingers"			).givesBuildingPerBuildingFlatCpsBoost(Constants.CURSOR_INDEX, [Constants.CURSOR_INDEX], 500000).givesPerBuildingFlatCpcBoost([Constants.CURSOR_INDEX], 500000);
upgrade("Octillion fingers"				).givesBuildingPerBuildingFlatCpsBoost(Constants.CURSOR_INDEX, [Constants.CURSOR_INDEX], 5000000).givesPerBuildingFlatCpcBoost([Constants.CURSOR_INDEX], 5000000);
upgrade("Plastic mouse"					).boostsClickCps(0.01);
upgrade("Iron mouse"					).boostsClickCps(0.01);
upgrade("Titanium mouse"				).boostsClickCps(0.01);
upgrade("Adamantium mouse"				).boostsClickCps(0.01);
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

// Season switcher and season changers
// upgrade("Season switcher"	).unlocksSeasonSwitching();
// upgrade("Lovesick biscuit"	).changesSeason(Constants.VALENTINES_DAY);
// upgrade("Ghostly biscuit"	).changesSeason(Constants.HALLOWEEN);
// upgrade("Festive biscuit"	).changesSeason(Constants.CHRISTMAS);
// upgrade("Fool's biscuit"	).changesSeason(Constants.BUSINESS_DAY);
// upgrade("Bunny biscuit"		).changesSeason(Constants.EASTER);

// Valentines day season upgrades
// upgrade("Pure heart biscuits"	).scalesProduction(25).forSeason(Constants.VALENTINES_DAY);
// upgrade("Ardent heart biscuits"	).scalesProduction(25).forSeason(Constants.VALENTINES_DAY);
// upgrade("Sour heart biscuits"	).scalesProduction(25).forSeason(Constants.VALENTINES_DAY);
// upgrade("Weeping heart biscuits").scalesProduction(25).forSeason(Constants.VALENTINES_DAY);
// upgrade("Golden heart biscuits"	).scalesProduction(25).forSeason(Constants.VALENTINES_DAY);
// upgrade("Eternal heart biscuits").scalesProduction(25).forSeason(Constants.VALENTINES_DAY);

// Halloween season upgrades
// upgrade("Skull cookies"		).scalesProduction(20).forSeason(Constants.HALLOWEEN);
// upgrade("Ghost cookies"		).scalesProduction(20).forSeason(Constants.HALLOWEEN);
// upgrade("Bat cookies"		).scalesProduction(20).forSeason(Constants.HALLOWEEN);
// upgrade("Slime cookies"		).scalesProduction(20).forSeason(Constants.HALLOWEEN);
// upgrade("Pumpkin cookies"	).scalesProduction(20).forSeason(Constants.HALLOWEEN);
// upgrade("Eyeball cookies"	).scalesProduction(20).forSeason(Constants.HALLOWEEN);
// upgrade("Spider cookies"	).scalesProduction(20).forSeason(Constants.HALLOWEEN);

// Christmas season
upgrade("A festive hat"				).requires("christmas");
upgrade("Naughty list"				).requires("christmas").isRandomSantaReward().scalesBuildingCps(Constants.GRANDMA_INDEX, 2);
upgrade("A lump of coal"			).requires("christmas").isRandomSantaReward().scalesProduction(1.01);
upgrade("An itchy sweater"			).requires("christmas").isRandomSantaReward().scalesProduction(1.01);
upgrade("Improved jolliness"		).requires("christmas").isRandomSantaReward().scalesProduction(1.15);
upgrade("Increased merriness"		).requires("christmas").isRandomSantaReward().scalesProduction(1.15);
upgrade("Toy workshop"				).requires("christmas").isRandomSantaReward().scalesUpgradeCost(0.95);
upgrade("Santa's helpers"			).requires("christmas").isRandomSantaReward().scalesClicking(1.1);
upgrade("Santa's milk and cookies"	).requires("christmas").isRandomSantaReward().scalesMilk(1.05);
upgrade("Santa's legacy"			).requires("christmas").isRandomSantaReward().boostsSantaPower(0.03);
upgrade("Season savings"			).requires("christmas").isRandomSantaReward().scalesBuildingCost(0.99);
upgrade("Ho ho ho-flavored frosting").requires("christmas").isRandomSantaReward().scalesReindeer(2);
upgrade("Weighted sleighs"			).requires("christmas").isRandomSantaReward().scalesReindeerDuration(2);
upgrade("Reindeer baking grounds"	).requires("christmas").isRandomSantaReward().scalesReindeerFrequency(2);
upgrade("Santa's bottomless bag"	).requires("christmas").isRandomSantaReward().scalesRandomDropFrequency(1.1).addValueScaling(1.0001);
upgrade("Santa's dominion"			).requires("christmas").scalesProduction(1.20).scalesBuildingCost(0.99).scalesUpgradeCost(0.98);

new SantaLevel().requires("A festive hat");

// Biscuits from clicking reindeer
upgrade("Christmas tree biscuits"	).requires("christmas").scalesProduction(1.02);
upgrade("Snowflake biscuits"		).requires("christmas").scalesProduction(1.02);
upgrade("Snowman biscuits"			).requires("christmas").scalesProduction(1.02);
upgrade("Holly biscuits"			).requires("christmas").scalesProduction(1.02);
upgrade("Candy cane biscuits"		).requires("christmas").scalesProduction(1.02);
upgrade("Bell biscuits"				).requires("christmas").scalesProduction(1.02);
upgrade("Present biscuits"			).requires("christmas").scalesProduction(1.02);

// Easter season
// upgrade("Ant larva"					).boostsGlobalProduction(1).forSeason(Constants.EASTER);
// upgrade("Cassowary egg"				).boostsGlobalProduction(1).forSeason(Constants.EASTER);
// upgrade("Chicken egg"				).boostsGlobalProduction(1).forSeason(Constants.EASTER);
// upgrade("Duck egg"					).boostsGlobalProduction(1).forSeason(Constants.EASTER);
// upgrade("Frogspawn"					).boostsGlobalProduction(1).forSeason(Constants.EASTER);
// upgrade("Ostrich egg"				).boostsGlobalProduction(1).forSeason(Constants.EASTER);
// upgrade("Quail egg"					).boostsGlobalProduction(1).forSeason(Constants.EASTER);
// upgrade("Robin egg"					).boostsGlobalProduction(1).forSeason(Constants.EASTER);
// upgrade("Salmon roe"				).boostsGlobalProduction(1).forSeason(Constants.EASTER);
// upgrade("Shark egg"					).boostsGlobalProduction(1).forSeason(Constants.EASTER);
// upgrade("Turkey egg"				).boostsGlobalProduction(1).forSeason(Constants.EASTER);
// upgrade("Turtle egg"				).boostsGlobalProduction(1).forSeason(Constants.EASTER);
// upgrade("Golden goose egg"			).scalesGoldenCookieDelay(0.95).forSeason(Constants.EASTER);
// upgrade("\"egg\""					).boostsBaseCps(9).forSeason(Constants.EASTER);
// upgrade("Cookie egg"				).scalesTotalClicking(1.1).forSeason(Constants.EASTER);
// upgrade("Century egg"				).boostsCenturyProduction(10).forSeason(Constants.EASTER);
// upgrade("Wrinklerspawn"				).scalesWrinklers(1.05).forSeason(Constants.EASTER);
// upgrade("Omelette"					).increasesEggDropChance(10).forSeason(Constants.EASTER);
// upgrade("Faberge egg"				).scalesUpgradeCost(0.99).scalesBuildingCpsCost(0.99).forSeason(Constants.EASTER);
// upgrade("Chocolate egg"				).scalesCookieBank(1.05).forSeason(Constants.EASTER);

// Prestige Upgrades
legacy("Legacy"							);	// Unlocks heavenly power
legacy("Persistent memory"				).requires("Legacy");	// Future research is 10 times faster
legacy("How to bake your dragon"		).requires("Legacy");	// Unlocks the dragon egg

// Permanant upgrade slots
legacy("Permanent upgrade slot I"		).requires("Legacy");
legacy("Permanent upgrade slot II"		).requires("Permanent upgrade slot I");
legacy("Permanent upgrade slot III"		).requires("Permanent upgrade slot II");

// Heavenly cookies branch
legacy("Heavenly cookies"				).requires("Legacy").scalesProduction(1.10);
legacy("Tin of butter cookies"			).requires("Heavenly cookies");
legacy("Tin of british tea biscuits"	).requires("Heavenly cookies");
legacy("Box of brand biscuits"			).requires("Heavenly cookies");
legacy("Box of macarons"				).requires("Heavenly cookies");
legacy("Starter kit"					).requires("Tin of butter cookies").requires("Tin of british tea biscuits").requires("Box of brand biscuits").requires("Box of macarons");	// You start with 10 cursors
legacy("Starter kitchen"				).requires("Starter kit");	// You start with 5 grandmas
legacy("Halo gloves"					).requires("Starter kit").scalesClicking(1.10);

// Season switcher branch
legacy("Season switcher"				).requires("Legacy");

// Heavenly luck branch
legacy("Heavenly luck"					).requires("Legacy").scalesGoldenCookieFrequency(1.05);
legacy("Lasting fortune"				).requires("Heavenly luck").scalesGoldenCookieEffectDuration(1.10);
legacy("Golden switch"					).requires("Heavenly luck");	// Unlocks the golden switch which boosts passive cps 50% but stops golden cookies
legacy("Decisive fate"					).requires("Lasting fortune").scalesGoldenCookieDuration(1.05);
legacy("Divine discount"				).requires("Decisive fate").scalesBuildingCost(0.99);
legacy("Divine sales"					).requires("Decisive fate").scalesUpgradeCost(0.99);

// Twin Gates of Transcendence branch
legacy("Twin Gates of Transcendence"	).requires("Legacy");	// Retain 5% of regular CpS for 1 hour while closed, 90% reduction to 0.5% beyond that
legacy("Belphegor"						).requires("Twin Gates of Transcendence");	// Doubles retention time to 2 hours
legacy("Mammon"							).requires("Belphegor");					// Doubles retention time to 4 hours
legacy("Abaddon"						).requires("Mammon");						// Doubles retention time to 8 hours
legacy("Satan"							).requires("Abaddon");						// Doubles retention time to 16 hours
legacy("Asmodeus"						).requires("Satan");						// Doubles retention time to 1 day 8 hours
legacy("Beelzebub"						).requires("Asmodeus");						// Doubles retention time to 2 days 16 hours

legacy("Angels"							).requires("Twin Gates of Transcendence");	// Retain an extra 10% total 15%
legacy("Archangels"						).requires("Angels");						// Retain an extra 10% total 25%
legacy("Virtues"						).requires("Archangels");					// Retain an extra 10% total 35%
legacy("Dominions"						).requires("Virtues");						// Retain an extra 10% total 45%
legacy("Cherubim"						).requires("Dominions");					// Retain an extra 10% total 55%
legacy("Seraphim"						).requires("Cherubim");						// Retain an extra 10% total 65%

legacy("Kitten angels"					).requires("Dominions").unlocksMilk(0.1, 1);
legacy("Synergies Vol. I"				).requires("Satan").requires("Dominions");	// Unlocks first tier of synergy upgrades
legacy("Synergies Vol. II"				).requires("Beelzebub").requires("Seraphim").requires("Synergies Vol. I");	// Unlocks second tier of synergy upgrades

// Unlocks from "Tin of butter cookies"
upgrade("Butter horseshoes"	).requires("Tin of butter cookies").scalesProduction(1.04);
upgrade("Butter pucks"		).requires("Tin of butter cookies").scalesProduction(1.04);
upgrade("Butter knots"		).requires("Tin of butter cookies").scalesProduction(1.04);
upgrade("Butter slabs"		).requires("Tin of butter cookies").scalesProduction(1.04);
upgrade("Butter swirls"		).requires("Tin of butter cookies").scalesProduction(1.04);

// Unlocks from "Tin of british tea biscuits"
upgrade("British tea biscuits"									).requires("Tin of british tea biscuits").scalesProduction(1.02);
upgrade("Chocolate british tea biscuits"						).requires("Tin of british tea biscuits").scalesProduction(1.02);
upgrade("Round british tea biscuits"							).requires("Tin of british tea biscuits").scalesProduction(1.02);
upgrade("Round chocolate british tea biscuits"					).requires("Tin of british tea biscuits").scalesProduction(1.02);
upgrade("Round british tea biscuits with heart motif"			).requires("Tin of british tea biscuits").scalesProduction(1.02);
upgrade("Round chocolate british tea biscuits with heart motif"	).requires("Tin of british tea biscuits").scalesProduction(1.02);

// Unlocks from "Box of brand biscuits"
upgrade("Fig gluttons"			).requires("Box of brand biscuits").scalesProduction(1.02);
upgrade("Loreols"				).requires("Box of brand biscuits").scalesProduction(1.02);
upgrade("Grease's cups"			).requires("Box of brand biscuits").scalesProduction(1.02);
upgrade("Jaffa cakes"			).requires("Box of brand biscuits").scalesProduction(1.02);
upgrade("Digits"				).requires("Box of brand biscuits").scalesProduction(1.02);
upgrade("Caramoas"				).requires("Box of brand biscuits").scalesProduction(1.03);
upgrade("Sagalongs"				).requires("Box of brand biscuits").scalesProduction(1.03);
upgrade("Shortfoils"			).requires("Box of brand biscuits").scalesProduction(1.03);
upgrade("Win mints"				).requires("Box of brand biscuits").scalesProduction(1.03);
upgrade("Lombardia cookies"		).requires("Box of brand biscuits").scalesProduction(1.03);
upgrade("Bastenaken cookies"	).requires("Box of brand biscuits").scalesProduction(1.03);

// Unlocks from "Box of macarons"
upgrade("Rose macarons"		).requires("Box of macarons").scalesProduction(1.03);
upgrade("Lemon macarons"	).requires("Box of macarons").scalesProduction(1.03);
upgrade("Chocolate macarons").requires("Box of macarons").scalesProduction(1.03);
upgrade("Pistachio macarons").requires("Box of macarons").scalesProduction(1.03);
upgrade("Violet macarons"	).requires("Box of macarons").scalesProduction(1.03);
upgrade("Hazelnut macarons"	).requires("Box of macarons").scalesProduction(1.03);
upgrade("Caramel macarons"	).requires("Box of macarons").scalesProduction(1.03);
upgrade("Licorice macarons"	).requires("Box of macarons").scalesProduction(1.03);

// Synergies Vol. I
upgrade("Seismic magic"					).requires("Synergies Vol. I").givesSynergy(Constants.MINE_INDEX, Constants.WIZARD_TOWER_INDEX, 0.05, 0.001);
upgrade("Fossil fuels"					).requires("Synergies Vol. I").givesSynergy(Constants.MINE_INDEX, Constants.SHIPMENT_INDEX, 0.05, 0.001);
upgrade("Primordial ores"				).requires("Synergies Vol. I").givesSynergy(Constants.MINE_INDEX, Constants.ALCHEMY_LAB_INDEX, 0.05, 0.001);
upgrade("Arcane knowledge"				).requires("Synergies Vol. I").givesSynergy(Constants.WIZARD_TOWER_INDEX, Constants.ALCHEMY_LAB_INDEX, 0.05, 0.001);
upgrade("Infernal crops"				).requires("Synergies Vol. I").givesSynergy(Constants.FARM_INDEX, Constants.PORTAL_INDEX, 0.05, 0.001);
upgrade("Contracts from beyond"			).requires("Synergies Vol. I").givesSynergy(Constants.BANK_INDEX, Constants.PORTAL_INDEX, 0.05, 0.001);
upgrade("Paganism"						).requires("Synergies Vol. I").givesSynergy(Constants.TEMPLE_INDEX, Constants.PORTAL_INDEX, 0.05, 0.001);
upgrade("Future almanacs"				).requires("Synergies Vol. I").givesSynergy(Constants.FARM_INDEX, Constants.TIME_MACHINE_INDEX, 0.05, 0.001);
upgrade("Relativistic parsec-skipping"	).requires("Synergies Vol. I").givesSynergy(Constants.SHIPMENT_INDEX, Constants.TIME_MACHINE_INDEX, 0.05, 0.001);
upgrade("Quantum electronics"			).requires("Synergies Vol. I").givesSynergy(Constants.FACTORY_INDEX, Constants.ANTIMATTER_CONDENSER_INDEX, 0.05, 0.001);
upgrade("Extra physics funding"			).requires("Synergies Vol. I").givesSynergy(Constants.BANK_INDEX, Constants.ANTIMATTER_CONDENSER_INDEX, 0.05, 0.001);
upgrade("Light magic"					).requires("Synergies Vol. I").givesSynergy(Constants.WIZARD_TOWER_INDEX, Constants.PRISM_INDEX, 0.05, 0.001);
upgrade("Gemmed talismans"				).requires("Synergies Vol. I").givesSynergy(Constants.MINE_INDEX, Constants.CHANCEMAKER_INDEX, 0.05, 0.001);

// Synergies Vol. II
upgrade("Printing presses"				).requires("Synergies Vol. II").givesSynergy(Constants.FACTORY_INDEX, Constants.BANK_INDEX, 0.05, 0.001);
upgrade("Rain prayer"					).requires("Synergies Vol. II").givesSynergy(Constants.FARM_INDEX, Constants.TEMPLE_INDEX, 0.05, 0.001);
upgrade("Magical botany"				).requires("Synergies Vol. II").givesSynergy(Constants.FARM_INDEX, Constants.WIZARD_TOWER_INDEX, 0.05, 0.001);
//upgrade("Asteroid mining"				).requires("Synergies Vol. II").givesSynergy(Constants.MINE_INDEX, Constants.SHIPMENT_INDEX, 0.05, 0.001);

getUpgradeFunction = function(name) {
	if (upgradeIndex[name] == undefined) {
		upgrade(name, 0);
		console.log("Unknown upgrade: " + name);
	}
	return upgradeIndex[name];
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
	constructor() {
		this.buildings = [];
		this.modifiers = {};
		this.upgrades = {};
		this.seasons = {};
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
		function building(name, cost, cps) {
			var building = new Building(sim, name, cost, cps);
			sim.buildings.push(building);
			return building;
		}

		// Add a new Legacy upgrade to the Simulation
		function legacy(name) {
			var legacy = new Modifier(sim, name);
			sim.modifiers[name] = legacy;
			sim.legacies[name] = legacy;
			return legacy;
		}

		// Add a new Season to the Simulation
		function season(name) {
			var season = new Season(sim, name);
			sim.modifiers[name] = season;
			sim.seasons[name] = season;
			return season;
		}

		// Add a new Toggle to the Simulation
		function toggle(name) {
			var toggle = new Modifier(sim, name);
			sim.modifiers[name] = toggle;
			sim.toggles[name] = toggle;
			return toggle;
		}

		// Add a new Upgrade to the Simulation
		function upgrade(name) {
			var upgrade = new Modifier(sim, name);
			sim.modifiers[name] = upgrade;
			sim.upgrades[name] = upgrade;
			return upgrade;
		}

		// Create all the buildings - the order matters, dont shuffle these!
		building('Cursor',			   	         	  15,           0.1);
		building('Grandma',			 	        	 100,           1.0);
		building('Farm',					   	    1100,           8.0);
		building('Mine',				      	   12000,          47.0);
		building('Factory',			    	 	  130000,         260.0);
		building('Bank',						 1400000,        1400.0);
		building('Temple',				   	    20000000,        7800.0);
		building('Wizard tower',		  	   330000000,       44000.0);
		building('Shipment',			 	  5100000000,      260000.0);
		building('Alchemy lab',				 75000000000,     1600000.0);
		building('Portal',			  	   1000000000000,    10000000.0);
		building('Time machine',	  	  14000000000000,    65000000.0);
		building('Antimatter condenser', 170000000000000,   430000000.0);
		building('Prism',				2100000000000000,  2900000000.0);
		building('Chancemaker',		   26000000000000000, 21000000000.0);

		// Create all the buffs
		buff('Clot'					).scalesFrenzyMultiplier(0.5);
		buff('Frenzy'				).scalesFrenzyMultiplier(7).scalesReindeerBuffMultiplier(0.75);
		buff('Elder frenzy'			).scalesFrenzyMultiplier(666).scalesReindeerBuffMultiplier(0.5);
		buff('Click frenzy'			).scalesClickFrenzyMultiplier(777);
		buff('High-five'			).scalesFrenzyMultiplierPerBuilding(Constants.CURSOR_INDEX);
		buff('Congregation'			).scalesFrenzyMultiplierPerBuilding(Constants.GRANDMA_INDEX);
		buff('Luxuriant harvest'	).scalesFrenzyMultiplierPerBuilding(Constants.FARM_INDEX);
		buff('Ore vein'				).scalesFrenzyMultiplierPerBuilding(Constants.MINE_INDEX);
		buff('Oiled-up'				).scalesFrenzyMultiplierPerBuilding(Constants.FACTORY_INDEX);
		buff('Juicy profits'		).scalesFrenzyMultiplierPerBuilding(Constants.BANK_INDEX);
		buff('Fervent adoration'	).scalesFrenzyMultiplierPerBuilding(Constants.TEMPLE_INDEX);
		buff('Manabloom'			).scalesFrenzyMultiplierPerBuilding(Constants.WIZARD_TOWER_INDEX);
		buff('Delicious lifeforms'	).scalesFrenzyMultiplierPerBuilding(Constants.SHIPMENT_INDEX);
		buff('Breakthrough'			).scalesFrenzyMultiplierPerBuilding(Constants.ALCHEMY_LAB_INDEX);
		buff('Righteous cataclysm'	).scalesFrenzyMultiplierPerBuilding(Constants.PORTAL_INDEX);
		buff('Golden ages'			).scalesFrenzyMultiplierPerBuilding(Constants.TIME_MACHINE_INDEX);
		buff('Extra cycles'			).scalesFrenzyMultiplierPerBuilding(Constants.ANTIMATTER_CONDENSER_INDEX);
		buff('Solar flare'			).scalesFrenzyMultiplierPerBuilding(Constants.PRISM_INDEX);
		buff('Winning streak'		).scalesFrenzyMultiplierPerBuilding(Constants.CHANCEMAKER_INDEX);
		buff('Cursed finger', 10	).cursesFinger();	
		

		// Create all the seasons
		season("christmas");
		
		
		this.reset();
	}

	reset() {
		var i = 0;
		
		for (i = 0; i < this.buildings.length; ++i)
			this.buildings[i].reset();
		for (var key in this.buffs)
			this.buffs[key].reset();
			
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
		this.globalProductionMultiplier = 0;
		this.centuryProductionMultiplier = 0;

		// Heavenly chips
		this.heavenlyChips = 0;

		// Prestige
		this.prestige = 0;
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
		this.goldenCookieTime = Constants.GOLDEN_COOKIE_AVG_INTERVAL;
		this.goldenCookieDuration = Constants.GOLDEN_COOKIE_DURATION;
		this.goldenCookieEffectDurationMultiplier = 1;

		// Reindeer stuff
		this.reindeerDuration = Constants.REINDEER_DURATION;
		this.reindeerTime = 180;
		this.reindeerMultiplier = 1;
		this.reindeerBuffMultiplier = 1;

		// Grandmatriarch stuff
		this.grandmatriarchStatus = Constants.APPEASED;
		this.wrinklerMultiplier = 1;

		// Santa level
		this.santaLevel = 0;
		this.santaPower = 0;
		this.randomSantaRewardsRemaining = allRandomSantaRewards.slice(0);

		// Building cost reduction
		this.buildingCostScale = 1;

		// Reset upgrades, buffs etc. - just set them to false to avoid recreating the entire dictionary
		for (var key in keys(this.upgrades))
			this.upgrades[key] = false;

		// Current season
		this.seasonStack = [""];	// Needs to be a stack so that adding seasons is reversible, only element 0 is active

		this.matchError = "";
	}

	get season() {
		return this.seasonStack[0];
	}

	hasUpgrade(name) {
		return !!this.upgrades[name];
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
		var totalTime = this.goldenCookieTime * 2;
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

	cookiesPerReindeer() {
		var cookies = this.getCps() * Constants.REINDEER_CPS_SECONDS * this.reindeerBuffMultiplier;
		return Math.max(Constants.REINDEER_MIN_COOKIES, cookies) * this.reindeerMultiplier;
	}

	//
	// Lucky cookies
	//

	cookiesPerLuckyWithBuffs(buffs) {
		return this.cookiesPerLucky();
	}

	cookiesPerLucky() {
		// If we dont click them, they don't work
		if (!Config.autoClickGoldenCookies) {
			return 0;
		}

		var cookies1 = this.getCps() * Constants.LUCKY_COOKIE_CPS_SECONDS;
		var cookies2 = cookies1; // cookieBank * 0.15;

		return Math.min(cookies1, cookies2) + Constants.LUCKY_COOKIE_FLAT_BONUS;
	}
}

// Check that the values in the evaluator match those of the game, for debugging use
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
		if (this.buildings[i].name != Game.ObjectsById[i].name) {
			errMsg += "- Building Name " + this.buildings[i].name + " does not match " + Game.ObjectsById[i].name + "\n";			
		}
		if (!equalityFunction(this.buildings[i].getCost(), Game.ObjectsById[i].getPrice())) {
			errMsg += "- Building Cost " + this.buildings[i].name + " - Predicted: " + this.buildings[i].cost + ", Actual: " + Game.ObjectsById[i].getPrice() + "\n";
		}
		if (!equalityFunction(this.buildings[i].individualCps, Game.ObjectsById[i].cps(Game.ObjectsById[i]))) {
			errMsg += "- Building CpS " + this.buildings[i].name + " - Predicted: " + this.buildings[i].individualCps + ", Actual: " + Game.ObjectsById[i].cps(Game.ObjectsById[i]) + "\n";
		}
	}
	// Check that all buildings are supported
	if (this.buildings.length != Game.ObjectsById.length)
		errMsg += "- Building getCount " + this.buildings.length + " does not match " + Game.ObjectsById.length + "\n";

	// Check that all available upgrade costs match those of similar upgrade functions
	for (i = 0; i < Game.UpgradesInStore.length; ++i) {
		var u = Game.UpgradesInStore[i];
		var uf = getUpgradeFunction(u.name);
		if (uf.setsSeason == undefined && !equalityFunction(uf.getCost(), u.getPrice())) {
			errMsg += "- Upgrade Cost " + u.name + " - Predicted: " + uf.getCost() + ", Actual: " + u.getPrice() + "\n";
		}
	}
	if (errMsg != "") {
		errMsg = "Evaluator Mismatch:\n" + errMsg;
		for (var key in Game.buffs) {
			errMsg += "- Buff Active: " + key + "\n";
		}
		errMsg += "- Game Save: " + Game.WriteSave(1) + "\n";
	}

	this.matchError = errMsg;
	if (this.matchError) {
		this.lastError = this.matchError;
		if (Game.version != Constants.SUPPORTED_VERSION) {
			this.lastError = this.lastError + Constants.VERSION_ERROR;
		}
	} else if (!this.lastError) {
		if (Game.version != Constants.SUPPORTED_VERSION) {
			this.lastError = Constants.VERSION_ERROR;
		}
	}
	return this.matchError == "";
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
	return this.getCps(true) * allBuffs['Cursed finger'].duration * this.goldenCookieEffectDurationMultiplier;
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
	var santaScale = 1 + (this.santaLevel + 1) * this.santaPower;
	var prestigeScale = this.prestige * this.prestigeUnlocked * 0.01;

	var scale = this.productionScale * santaScale * (1 + prestigeScale);

	// Scale it for milk, two tiers to deal with ordering and minimise floating point errors
	for (i = 0; i < this.milkUnlocks.length; ++i) {
		for (j = 0; j < this.milkUnlocks[i].length; ++j) {
			scale *= (1 + this.milkUnlocks[i][j] * this.milkAmount * this.milkMultiplier);
		}
	}

	// Scale it for global production
	var sessionDays = Math.min(Math.floor((this.currentTime - this.sessionStartTime) / 1000 / 10) * 10 / 60 / 60 / 24, 100);
	var centuryMult = (1 - Math.pow(1 - sessionDays / 100, 3)) * this.centuryProductionMultiplier;

	scale *= (1 + (this.globalProductionMultiplier + centuryMult) * 0.01);
	scale *= this.frenzyMultiplier;

	cps *= scale;

	if (ignoreCursedFinger || !this.cursedFinger)
		return cps;
	return 0;
}

Simulator.prototype.getCookieChainMax = function(frenzy) {
	return this.getFrenziedCps(frenzy) * Constants.COOKIE_CHAIN_MULTIPLIER;
}

// Get the current required cookie bank size, accounts for time until the
// next golden cookie appears
Simulator.prototype.getCookieBankSize = function(timeSinceLastGoldenCookie) {
	// Don't need one if not clicking golden cookies
	if (!Config.maintainCookieBank) {
		return 0;
	}

	var bank;
	var normalTimeRemaining;
	var frenzyTimeRemaining;
	var luckyBank;
	var chainBank;

	var timeToNextCookie = Math.max(this.goldenCookieTime - Game.shimmerTypes['golden'] ? Game.shimmerTypes['golden'].time / Game.fps : 0, 0);

	// Bank size varies on whether you can get another golden cookie during frenzy
	if (this.frenzyDuration * this.goldenCookieEffectDurationMultiplier < this.goldenCookieTime) {
		luckyBank = this.getLuckyCookieMax(1) * Constants.LUCKY_COOKIE_BANK_SCALE;
		chainBank = this.getCookieChainMax(1) * Constants.COOKIE_CHAIN_BANK_SCALE;

		normalTimeRemaining = timeToNextCookie;
		frenzyTimeRemaining = 0;
	} else {
		luckyBank = this.getLuckyCookieMax(Constants.FRENZY_MULTIPLIER) * Constants.LUCKY_COOKIE_BANK_SCALE;
		chainBank = this.getCookieChainMax(Constants.FRENZY_MULTIPLIER) * Constants.COOKIE_CHAIN_BANK_SCALE;

		if (this.frenzy) {
			normalTimeRemaining = 0;
			frenzyTimeRemaining = timeToNextCookie;
		} else {
			normalTimeRemaining = timeToNextCookie;
			frenzyTimeRemaining = this.frenzyDuration * this.goldenCookieEffectDurationMultiplier;
		}
	}
	var frenzyMult = Math.min(this.frenzyMultiplier, Constants.FRENZY_MULTIPLIER);	// stop elder frenzy messing up bank
	bank = Math.max(luckyBank, chainBank);
	bank -= normalTimeRemaining * (this.getFrenziedCps(1) + this.getFrenziedCpc(1) * this.clickRate);
	bank -= frenzyTimeRemaining * (this.getFrenziedCps(frenzyMult) + this.getFrenziedCpc(frenzyMult) * this.clickRate);
	
	return Math.max(bank, 0);
}

// Sync an evaluator with the current in game store
Simulator.prototype.syncToGame = function() {
	this.reset();
	var i;
	for (i = 0; i < Game.ObjectsById.length && i < this.buildings.length; ++i) {
		this.buildings[i].quantity = Game.ObjectsById[i].amount;
		this.buildings[i].free = Game.ObjectsById[i].free;
	}
	for (i = 0; i < Game.UpgradesById.length; ++i) {
		if (Game.UpgradesById[i].bought == 1) {
			var uf = getUpgradeFunction(Game.UpgradesById[i].name);
			uf.applyTo(this);
			if (uf.season) {
				this.lockedSeasonUpgrades[uf.season]--;
			}
		} else if (Game.UpgradesById[i].unlocked == 1) {
			var uf = getUpgradeFunction(Game.UpgradesById[i].name);
			if (this.randomSantaRewardsRemaining.indexOf(uf.name) != -1)
			if (uf.season) {
				this.lockedSeasonUpgrades[uf.season]--;
			}
		}
		// Remove from random santa rewards if its bought or in store
		if (Game.UpgradesById[i].bought == 1 || Game.UpgradesById[i].unlocked == 1) {
			var uf = getUpgradeFunction(Game.UpgradesById[i].name);
			if (this.randomSantaRewardsRemaining.indexOf(uf.name) != -1) {
				this.randomSantaRewardsRemaining.splice(this.randomSantaRewardsRemaining.indexOf(uf.name), 1);				
			}
		}
	}
	this.heavenlyChips = Game.heavenlyChips;
	this.prestige = Game.prestige;
	this.milkAmount = Game.AchievementsOwned / 25;
	this.frenzyMultiplier = 1;
	this.clickFrenzyMultiplier = 1;
	for (var key in Game.buffs) {
		if (this.buffs[key]) {
			this.buffs[key].apply();
		} else {
			console.log("Unknown buff: " + key);
		}
	}
	
	this.santaLevel = Game.santaLevel;
	this.sessionStartTime = Game.startDate;
	this.currentTime = new Date().getTime();
}

//
// Utility stuff and starting the app off
//

// Compare floats with an epsilon value
function floatEqual(a, b) {
	var eps = Math.abs(a - b) * 1000000000000.0;
	return eps <= Math.abs(a) && eps <= Math.abs(b);
}

console.log("Ultimate Cookie starting at " + new Date() + " supporting " + upgradesSupported + " upgrades and " + upgradeBuildingsSupported + " buildings.");

// Create the upgradeInfo and Ultimate Cookie instances
var uc = new UltimateCookie();
