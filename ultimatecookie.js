// To-do
// Figure out how to get AutoBuy as a member of the UltimateCookie

var Constants = {};

// Interval delays for clicking and updates
Constants.CLICK_DELAY = 1;
Constants.UPDATE_DELAY = 50;

Constants.AUTO_CLICK = true;
Constants.AUTO_CLICK_GOLDEN_COOKIES = true;
Constants.AUTO_RESET = false;
Constants.AUTO_BUY = true;
Constants.AUTO_DISMISS_NOTES = true;
Constants.AUTO_SWITCH_SEASONS = true;
Constants.ENABLE_FAST_BUY = true;

Constants.FAST_BUY_TIMEOUT = 1000;
Constants.NOTE_DISMISS_DELAY = 10000;
Constants.RESET_LIMIT = 1.1;
Constants.DEBUG = true;

// Evaluator constants
Constants.FRENZY_MULTIPLIER = 7;			// Frenzy multiplies CpS by 7
Constants.CLICK_FRENZY_MULTIPLIER = 777;	// Click frenzies give 777x cookier per click
Constants.LUCKY_COOKIE_BANK_TIME = 1200;	// Lucky provides up to 1200 seconds of CpS based on bank
Constants.LUCKY_COOKIE_BONUS_TIME = 13;		// Lucky provides 13 additional seconds of CpS regardless

// Indices into the buildings arrays
Constants.CURSOR_INDEX = 0;
Constants.GRANDMA_INDEX = 1;
Constants.FARM_INDEX = 2;
Constants.FACTORY_INDEX = 3;
Constants.MINE_INDEX = 4;
Constants.SHIPMENT_INDEX = 5;
Constants.ALCHEMY_LAB_INDEX = 6;
Constants.PORTAL_INDEX = 7;
Constants.TIME_MACHINE_INDEX = 8;
Constants.ANTIMATTER_CONDENSER_INDEX = 9;
Constants.PRISM_INDEX = 10;

//
// UltimateCookie represents the app itself
//

function UltimateCookie() {
	var t = this;
	this.fastBuy = (Constants.ENABLE_FAST_BUY && Game.cookiesPs == 0);
	this.lastPurchaseTime = new Date();

	this.autoClicker = setInterval(function() { t.click(); }, Constants.CLICK_DELAY);
	this.autoUpdater = setInterval(function() { t.update(); }, Constants.UPDATE_DELAY);
}

UltimateCookie.prototype.compareUpgrades = function(eval, a, b) {
	var e = eval.clone();

	if (this.fastBuy) {
		// Fast buy is for just after resets where you have lots of cookies and
		// just want to maximise cps as fast as possible
		var cookies = Game.cookies;
		var currentCps = e.getEffectiveCps();
		a.upgradeFunction.applyUpgrade(e);
		var aCpsGain = e.getEffectiveCps() - currentCps;

		e = eval.clone();
		b.upgradeFunction.applyUpgrade(e);
		var bCpsGain = e.getEffectiveCps() - currentCps;

		if (a.getCost() <= cookies && b.getCost() <= cookies) {
			// Both cost less than we have, buy the one that gives most cps
			if (aCpsGain >= bCpsGain) {
				return a;
			} else {
				return b;
			}
		} else if (a.getCost() <= cookies) {
			return a;
		} else if (b.getCost() <= cookies) {
			return b;
		}
		// Cant afford either, just fall back on normal logic
		e = eval.clone();
	}
	// Get time to buy both starting with a
	var ta = a.getCost() / e.getEffectiveCps();
	a.upgradeFunction.applyUpgrade(e);
	ta += b.getCost() / e.getEffectiveCps();

	// Get time to buy both starting with b
	e = eval.clone();
	var tb = b.getCost() / e.getEffectiveCps();
	b.upgradeFunction.applyUpgrade(e);
	tb += a.getCost() / e.getEffectiveCps();

	// If you can get both faster starting with a, it is the best
//	console.log([a.getName(), b.getName(), ta, tb]);
	if (ta < tb) {
		return a;
	} else {
		return b;
	}
}

UltimateCookie.prototype.createPurchaseList = function() {
	var purchases = [];

	// Add the buildings
	var i;
	for (i = 0; i < Game.ObjectsById.length; ++i) {
		purchases.push(new PurchasableItem(Game.ObjectsById[i]));
	}

	// Add the upgrades
	for (i = 0; i < Game.UpgradesInStore.length; ++i) {
		purchases.push(new PurchasableItem(Game.UpgradesInStore[i]));
	}

	return purchases;
}

// Work out what the optimal next purchase is for a given evaluator
UltimateCookie.prototype.determineNextPurchase = function(eval) {
	// Get a list of the current available purchases
	var purchases = this.createPurchaseList();

	var next = purchases[0];

	for (i = 1; i < purchases.length; ++i) {
		next = this.compareUpgrades(eval, next, purchases[i]);
	}

	// Autobuy the research speed upgrade before the first research item
	if (next.getName() == "Specialized chocolate chips") {
		for (i = 0; i < purchases.length; ++i) {
			if (purchases[i].getName() == "Persistent memory") {
				next = purchases[i];
			}
		}
	}

	// Nasty Elder Pledge hack for short term
	for (i = 0; i < purchases.length; ++i) {
		if (purchases[i].getName() == "Elder Pledge") {
			next = purchases[i];
		}
	}
	// Similarly nasty Sacrificial rolling pins autobuy
	for (i = 0; i < purchases.length; ++i) {
		if (purchases[i].getName() == "Sacrificial rolling pins") {
			next = purchases[i];
		}
	}

	if (this.lastDeterminedPurchase == undefined) {
		this.lastDeterminedPurchase == "";
	}

	if (next.toString() != this.lastDeterminedPurchase) {
		this.lastDeterminedPurchase = next.toString();
		console.log("FastBuy: " + this.fastBuy + ", next purchase: " + this.lastDeterminedPurchase);
	}

	return next;
}

UltimateCookie.prototype.click = function() {
	if (Constants.AUTO_CLICK) {
		Game.ClickCookie();
	}
}

UltimateCookie.prototype.update = function() {
	// Auto dismiss notes
	if (!Game.recalculateGains && Constants.AUTO_DISMISS_NOTES) {
		if (Game.Notes.length > 0) {
			if (new Date() - Game.Notes[0].date > Constants.NOTE_DISMISS_DELAY) {
				Game.CloseNote(Game.Notes[0].id);
			}
		}
	}
	// Auto click golden cookies
	if (!Game.recalculateGains && Constants.AUTO_CLICK_GOLDEN_COOKIES) {
		if (Game.goldenCookie.life > 0 && Game.goldenCookie.toDie == 0) {
			Game.goldenCookie.click();
		}
	}
	// Auto switch seasons
	if (!Game.recalculateGains && Constants.AUTO_SWITCH_SEASONS) {
	}
	// Auto buy
	if (!Game.recalculateGains && Constants.AUTO_BUY) {
		// Get an Evaluator synced to the current game
		var currentGame = new Evaluator();
		currentGame.syncToGame();

		// Shutdown if out of sync
		if (Constants.DEBUG) {
			if (!currentGame.matchesGame()) {
				Constants.AUTO_BUY = false;
				console.log("Evaluator error: autoBuy disabled.");
				return;
			}
		}
		var nextPurchase = this.determineNextPurchase(currentGame);
		var cookieBank = currentGame.getCookieBankSize(Game.goldenCookie.time / Game.fps, Game.frenzy / Game.fps);
		// Cap cookie bank at 5% of total cookies earned
		cookieBank = Math.min(Game.cookiesEarned / 20, cookieBank);
		if (this.fastBuy) {
			cookieBank = 0;
		}
		if (Game.cookies - cookieBank > nextPurchase.getCost()) {
			var time = new Date();
			if (this.fastBuy && time - this.lastPurchaseTime > Constants.FAST_BUY_TIMEOUT) {
				console.log("Disabling fast buy");
				this.fastBuy = false;
			}
			this.lastPurchaseTime = time;
			nextPurchase.purchase();
		}
	}
	// Auto reset
	if (!Game.recalculateGains && Constants.AUTO_RESET) {
		// Wait until frenzy or clickFrenzy is over to reset
		if (!Game.frenzy && !Game.clickFrenzy) {
			var hcs = Game.HowMuchPrestige(Game.cookiesReset);
			var resethcs = Game.HowMuchPrestige(Game.cookiesReset + Game.cookiesEarned);

			var scaleNow = 1 + hcs * 0.02;
			var scaleReset = 1 + resethcs * 0.02;

			if (scaleReset / scaleNow >= Constants.RESET_LIMIT) {
				console.log("Resetting game. HCs now: " + hcs + ", HCs after reset: " + resethcs + ", time: " + new Date());
				this.fastBuy = Constants.ENABLE_FAST_BUY;
				this.lastPurchaseTime = new Date();
				Game.Reset(1, 0);
			}
		}
	}
}

UltimateCookie.prototype.clickRate = function() {
	// Assume 175 clicks per second for now
	return 175;
}

//
// Class used for the X gains Y per building of type Z upgrades
//
function BuildingScaler() {
	// One per building type
	this.scales = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
}

BuildingScaler.prototype.getScale = function(buildings) {
	var scale = 0;
	var i;
	for (i = 0; i < this.scales.length; ++i) {
		scale += this.scales[i] * buildings[i].quantity;
	}
	return scale;
}

BuildingScaler.prototype.clone = function() {
	var i;
	var bs = new BuildingScaler();
	for (i = 0; i < this.scales.length; ++i) {
		bs.scales[i] = this.scales[i];
	}
	return bs;
}

BuildingScaler.prototype.scaleAll = function(amount) {
	var i;
	for (i = 0; i < this.scales.length; ++i) {
		this.scales[i] += amount;
	}
}

BuildingScaler.prototype.scaleOne = function(index, amount) {
	this.scales[index] += amount;
}


//
// Class used to represent a particular building type for the cost Evaluator
//

function EvaluatorBuilding(evaluator, baseCost, baseCps) {
	this.evaluator = evaluator;
	this.baseCost = baseCost;
	this.baseCps = baseCps;
	this.quantity = 0;
	this.multiplier = 1;
	this.buildingScaler = new BuildingScaler();
	this.buildingBaseScaler = new BuildingScaler();
}

EvaluatorBuilding.prototype.getCps = function() {
	return this.quantity * this.getIndividualCps();
}

EvaluatorBuilding.prototype.getIndividualCps = function() {
	return (this.baseCps + this.buildingBaseScaler.getScale(this.evaluator.buildings)) * this.multiplier + this.buildingScaler.getScale(this.evaluator.buildings);
}

EvaluatorBuilding.prototype.getCost = function() {
	return Math.ceil(this.baseCost * Math.pow(1.15, this.quantity));
}

//
// Cost Evaluator, used to determine upgrade paths
//

function Evaluator() {
	// Buildings
	this.buildings = [];
	this.buildings.push(new EvaluatorBuilding(this,         15,        0.1));	// Cursor
	this.buildings.push(new EvaluatorBuilding(this,        100,        0.5));	// Grandma
	this.buildings.push(new EvaluatorBuilding(this,        500,        4.0));	// Farm
	this.buildings.push(new EvaluatorBuilding(this,       3000,       10.0));	// Factory
	this.buildings.push(new EvaluatorBuilding(this,      10000,       40.0));	// Mine
	this.buildings.push(new EvaluatorBuilding(this,      40000,      100.0));	// Shipment
	this.buildings.push(new EvaluatorBuilding(this,     200000,      400.0));	// Alchemy lab
	this.buildings.push(new EvaluatorBuilding(this,    1666666,     6666.0));	// Portal
	this.buildings.push(new EvaluatorBuilding(this,  123456789,    98765.0));	// Time Machine
	this.buildings.push(new EvaluatorBuilding(this, 3999999999,   999999.0));	// Antimatter condenser
	this.buildings.push(new EvaluatorBuilding(this,75000000000, 10000000.0));	// Prism

	// Mouse click information
	this.cpcBase = 1;
	this.cpcMultiplier = 1;
	this.cpcCpsMultiplier = 0;
	this.cpcBuildingBaseScaler = new BuildingScaler();

	// Production multiplier
	this.productionMultiplier = 0;

	// Heavenly chips
	this.heavenlyChips = 0;
	this.heavenlyUnlock = 0;

	// Milk scaling
	this.milkAmount = 0;
	this.milkMultipliers = [];

	// Game status indicators
	this.frenzy = 0
	this.frenzyPower = 1;
	this.clickFrenzy = 0;

	// Golden cookie information - only used in estimating value of golden cookie
	// frequency upgrades
	this.frenzyDuration = 77;
	this.goldenCookieTime = 300;

	// Elder covenant revoked
	this.elderCovenant = false;	// 5% reduction in CpS

	// Santa level
	this.santaLevel = 0;
}

// Create a clone of an Evaluator
Evaluator.prototype.clone = function() {
	var e = new Evaluator();
	var i;
	// Clone buildings making sure to set the evaluator reference to the clone
	for (i = 0; i < this.buildings.length; ++i) {
		e.buildings[i] = new EvaluatorBuilding();
		e.buildings[i].evaluator = e;
		e.buildings[i].baseCost = this.buildings[i].baseCost;
		e.buildings[i].baseCps = this.buildings[i].baseCps;
		e.buildings[i].quantity = this.buildings[i].quantity;
		e.buildings[i].multiplier = this.buildings[i].multiplier;
		e.buildings[i].buildingScaler = this.buildings[i].buildingScaler.clone();
		e.buildings[i].buildingBaseScaler = this.buildings[i].buildingBaseScaler.clone();
	}
	e.cpcBase = this.cpcBase;
	e.cpcMultiplier = this.cpcMultiplier;
	e.cpcCpsMultiplier = this.cpcCpsMultiplier;
	e.cpcBuildingBaseScaler = this.cpcBuildingBaseScaler.clone();
	e.productionMultiplier = this.productionMultiplier;
	e.heavenlyChips = this.heavenlyChips;
	e.heavenlyUnlock = this.heavenlyUnlock;
	e.milkAmount = this.milkAmount;
	e.milkMultipliers = [];
	for (i = 0; i < this.milkMultipliers.length; ++i) {
		e.milkMultipliers[i] = this.milkMultipliers[i];
	}
	e.frenzy = this.frenzy;
	e.frenzyPower = this.frenzyPower;
	e.clickFrenzy = this.clickFrenzy;
	e.frenzyDuration = this.frenzyDuration;
	e.goldenCookieTime = this.goldenCookieTime;
	e.elderCovenant = this.elderCovenant;
	e.santaLevel = this.santaLevel;

	if (Constants.DEBUG) {
		// Make sure the cloning worked
		if (this.getEffectiveCps() != e.getEffectiveCps()) {
			console.log("Error cloning Evaluator");
		}
	}
	return e;
}

// Check that the values in the evaluator match those of the game, for debugging use
Evaluator.prototype.matchesGame = function() {
	var match = true;
	// Check that Cps matches the game
	if (!floatEqual(this.getCps(), Game.cookiesPs)) {
		console.log("Evaluator Error - Predicted Cps: " + this.getCps() + ", Actual Cps: " + Game.cookiesPs);
		match = false;
	}
	// Check the Cpc matches the game
	if (!floatEqual(this.getCpc(), Game.mouseCps())) {
		console.log("Evaluator Error - Predicted Cpc: " + this.getCpc() + ", Actual Cpc: " + Game.mouseCps());
		match = false;
	}
	// Check the building costs match the game
	var i;
	for (i = 0; i < this.buildings.length; ++i) {
		if (!floatEqual(this.buildings[i].getCost(), Game.ObjectsById[i].getPrice())) {
			console.log("Evaluator Error - Index: " + i + ", Predicted Building Cost: " + this.buildings[i].getCost() + ", Actual Cost: " + Game.ObjectsById[i].getPrice());
			match = false;
		}
		if (!floatEqual(this.buildings[i].getIndividualCps(), Game.ObjectsById[i].cps())) {
			console.log("Evaluator Error - Index: " + i + ", Predicted Building CpS: " + this.buildings[i].getIndividualCps() + ", Actual CpS: " + Game.ObjectsById[i].cps());
			match = false;
		}
	}
	// Default all is fine
	return match;
}

// Get the current cookies per click amount
Evaluator.prototype.getCpc = function() {
	var cpc = this.cpcBase * this.cpcMultiplier + this.cpcBuildingBaseScaler.getScale(this.buildings);	// Base cpc
	cpc += this.getCps() * this.cpcCpsMultiplier;	// Add in percentage click scaling
	if (this.clickFrenzy) {	// Increase if click frenzy is active
		cpc *= Constants.CLICK_FRENZY_MULTIPLIER;
	}
	return cpc;
}

// Calculate the total Cps generated by the game in this state
Evaluator.prototype.getCps = function() {
	var i;
	// Get the cps from buildings
	var cps = 0;
	for (i = 0; i < this.buildings.length; ++i) {
		cps += this.buildings[i].getCps();
	}
	// Scale it for production and heavely chip multipliers
	var productionScale = this.productionMultiplier * 0.01;
	var heavenlyScale = this.heavenlyChips * this.heavenlyUnlock * 0.02;
	cps *= (1 + productionScale + heavenlyScale);
	// Scale it for milk
	var milkScale = 1;
	for (i = 0; i < this.milkMultipliers.length; ++i) {
		milkScale *= (1 + this.milkMultipliers[i] * this.milkAmount * 0.01);
	}
	cps *= milkScale;
	// Scale it for frenzy
	if (this.frenzy) {
		cps *= this.frenzyMultiplier;
	}

	if (this.elderCovenant) {
		cps *= 0.95;
	}
	return cps;
}

// Calculate the CpS at a specific frenzy multiplier
Evaluator.prototype.getFrenziedCps = function(multiplier) {
	var frenzy = this.frenzy;
	var clickFrenzy = this.clickFrenzy;
	var frenzyMultiplier = this.frenzyMultiplier;
	this.frenzy = 1;
	this.frenzyMultiplier = multiplier;
	this.clickFrenzy = 0;
	var cps = this.getCps();
	this.frenzy = frenzy;
	this.clickFrenzy = clickFrenzy;
	this.frenzyMultiplier = frenzyMultiplier;
	return cps;
}

// Calculate the CpC at a specific frenzy multiplier
Evaluator.prototype.getFrenziedCpc = function(multiplier) {
	var frenzy = this.frenzy;
	var clickFrenzy = this.clickFrenzy;
	var frenzyMultiplier = this.frenzyMultiplier;
	this.frenzy = 1;
	this.frenzyMultiplier = multiplier;
	this.clickFrenzy = 0;
	var cps = this.getCps();
	this.frenzy = frenzy;
	this.clickFrenzy = clickFrenzy;
	this.frenzyMultiplier = frenzyMultiplier;
	return cps;
}

// Estimate the extra CpS contribution from collecting all golden cookies
// Assumes max click rate and that golden cookies just follow the simple pattern
// of Frenzy followed by Lucky and appear at the minimum spawn time every time.
// Not 100% accurate but near enough to give a decent estimation.
Evaluator.prototype.getGoldenCookieCps = function() {
	// Add gains from a single full duration frenzy
	var totalGain = 0;
	totalGain += (this.getFrenziedCps(Constants.FRENZY_MULTIPLIER) - this.getFrenziedCps(1)) * this.frenzyDuration;
	totalGain += (this.getFrenziedCpc(Constants.FRENZY_MULTIPLIER) - this.getFrenziedCpc(1)) * this.frenzyDuration * ultimateCookie.clickRate();

	// Add gains from a single lucky cookie
	if (this.goldenCookieTime < this.frenzyDuration) {
		totalGain += this.getFrenziedCps(Constants.FRENZY_MULTIPLIER) * (Constants.LUCKY_COOKIE_BANK_TIME + Constants.LUCKY_COOKIE_BONUS_TIME);
	} else {
		totalGain += this.getFrenziedCps(1) * (Constants.LUCKY_COOKIE_BANK_TIME + Constants.LUCKY_COOKIE_BONUS_TIME);
	}

	// Divide this total by time it would take to get two golden cookies
	return totalGain / (this.goldenCookieTime * 2);
}

// Calculate the effective Cps at the current games click rate minus golden cookies
Evaluator.prototype.getCurrentCps = function() {
	return this.getCps() + this.getCpc() * ultimateCookie.clickRate();
}

// Calculate the effective Cps at the current games click rate
Evaluator.prototype.getEffectiveCps = function() {
	return this.getCps() + this.getCpc() * ultimateCookie.clickRate() + this.getGoldenCookieCps();
}

// Get the current required cookie bank size, accounts for time until the
// next golden cookie appears
Evaluator.prototype.getCookieBankSize = function(timeSinceLastGoldenCookie, frenzyTimeRemaining) {
	var totalCookieBankRequired = this.getFrenziedCps(1) * Constants.LUCKY_COOKIE_BANK_TIME * 10 * Constants.FRENZY_MULTIPLIER;
	var timeRemaining = Math.max(this.goldenCookieTime - timeSinceLastGoldenCookie, 0);
	var frenziedCps = this.getFrenziedCps(Constants.FRENZY_MULTIPLIER) + this.getFrenziedCpc(Constants.FRENZY_MULTIPLIER) * ultimateCookie.clickRate();
	var unfrenziedCps = this.getFrenziedCps(1) + this.getFrenziedCpc(1) * ultimateCookie.clickRate();

	totalCookieBankRequired -= Math.min(timeRemaining, frenzyTimeRemaining) * frenziedCps;
	totalCookieBankRequired -= Math.max(timeRemaining - frenzyTimeRemaining, 0) * unfrenziedCps;

	return totalCookieBankRequired;
}

// Sync an evaluator with the current in game store
Evaluator.prototype.syncToGame = function() {
	var i;
	for (i = 0; i < Game.ObjectsById.length && i < this.buildings.length; ++i) {
		this.buildings[i].quantity = Game.ObjectsById[i].amount;
	}
	for (i = 0; i < Game.UpgradesById.length; ++i) {
		if (Game.UpgradesById[i].bought == 1) {
			getUpgradeFunction(Game.UpgradesById[i].name).applyUpgrade(this);
		}
	}
	this.heavenlyChips = Game.prestige['Heavenly chips'];
	this.milkAmount = Game.AchievementsOwned * 4;
	this.frenzy = Game.frenzy;
	this.frenzyMultiplier = Game.frenzyPower;
	this.clickFrenzy = Game.clickFrenzy;
	this.santaLevel = Game.santaLevel;
}

//
// Classes to represent upgrades purely for use in Emulator calculations
//

// Shorthand for declaring property values
pv = function(val) { return { enumerable: true, value: val }; }

// All the supported types of upgrades
var upgradeTypes = {};
// Basic upgrade type, does nothing
upgradeTypes.basic = {
	name: "<unnamed>",
	applyUpgrade: function(eval) {},
	revokeUpgrade: function(eval) {},
	purchase: function() { Game.Upgrades[this.name].buy(1); },
	getCost: function() { return Game.Upgrades[this.name].getPrice(); },
	getCps: function(eval) {
		var e = eval.clone();
		var cps = eval.getEffectiveCps();
		this.applyUpgrade(e);
		return e.getEffectiveCps() - cps;
	},
	getValue: function(eval) {
		return this.getCps();
	},
};
// Upgrade to represent building one more of a building type
upgradeTypes.building = Object.create(upgradeTypes.basic, {
	index: pv( Constants.CURSOR_INDEX ),
	applyUpgrade: pv( function(eval) { eval.buildings[this.index].quantity += 1; } ),
	revokeUpgrade: pv( function(eval) { eval.buildings[this.index].quantity -= 1; } ),
	purchase: pv( function() { Game.ObjectsById[this.index].buy(1); } ),
	getCost: pv( function() { return Game.ObjectsById[this.index].getPrice(); } ),
});
// Upgrades that increase the base CpS of a building type
upgradeTypes.buildingBaseCps = Object.create(upgradeTypes.building, {
	amount: pv( 0 ),
	applyUpgrade: pv( function(eval) { eval.buildings[this.index].baseCps += this.amount; } ),
	revokeUpgrade: pv( function(eval) { eval.buildings[this.index].baseCps -= this.amount; } ),
});
// Upgrades that increase total CpS of a building type
upgradeTypes.buildingMultiplier = Object.create(upgradeTypes.building, {
	scale: pv( 1 ),
	applyUpgrade: pv( function(eval) { eval.buildings[this.index].multiplier *= this.scale; } ),
	revokeUpgrade: pv( function(eval) { eval.buildings[this.index].multiplier /= this.scale; } ),
});
// Upgrades that double the CpS of clicking
upgradeTypes.clickDoubler = Object.create(upgradeTypes.basic, {
	applyUpgrade: pv( function(eval) { eval.cpcMultiplier *= 2; } ),
	revokeUpgrade: pv( function(eval) { eval.cpcMultiplier /= 2; } ),
});
// Upgrades that increase the base CpS of clicking
upgradeTypes.clickBase = Object.create(upgradeTypes.basic, {
	amount: pv( 0 ),
	applyUpgrade: pv( function(eval) { eval.cpcBase += this.amount; } ),
	revokeUpgrade: pv( function(eval) { eval.cpcBase -= this.amount; } ),
});
// Upgrades that add a percentage of CpS to each click
upgradeTypes.clickCps = Object.create(upgradeTypes.basic, {
	amount: pv( 0 ),
	applyUpgrade: pv( function(eval) { eval.cpcCpsMultiplier += this.amount; } ),
	revokeUpgrade: pv( function(eval) { eval.cpcCpsMultiplier -= this.amount; } ),
});
// Upgrades that increase all cookie production
upgradeTypes.production = Object.create(upgradeTypes.basic, {
	amount: pv( 0 ),
	applyUpgrade: pv( function(eval) { eval.productionMultiplier += this.amount; } ),
	revokeUpgrade: pv( function(eval) { eval.productionMultiplier -= this.amount; } ),
});
// Upgrade that makes golden cookies appear more often
upgradeTypes.goldenCookieFrequency = Object.create(upgradeTypes.basic, {
	scale: pv( 0 ),
	applyUpgrade: pv( function(eval) { eval.goldenCookieTime /= this.scale; } ),
	revokeUpgrade: pv( function(eval) { eval.goldenCookieTime *= this.scale; } ),
});
// Upgrade that makes golden cookies affects last longer
upgradeTypes.goldenCookieDuration = Object.create(upgradeTypes.basic, {
	applyUpgrade: pv( function(eval) { eval.frenzyDuration *= 2; } ),
	revokeUpgrade: pv( function(eval) { eval.frenzyDuration /= 2; } ),
});
// Upgrade that makes milk more effective
upgradeTypes.milk = Object.create(upgradeTypes.basic, {
	scale: pv( 0 ),
	applyUpgrade: pv(
		function(eval) {
			eval.milkMultipliers.push(this.scale);
			eval.milkMultipliers.sort();
		}
	),
	revokeUpgrade: pv(
		function(eval) {
			eval.milkMultipliers.splice(eval.milkMultipliers.indexOf(this.scale), 1);
		}
	),
});
// Upgrade that unlocks heavenly chip potential
upgradeTypes.heavenlyPower = Object.create(upgradeTypes.basic, {
	amount: pv( 0 ),
	applyUpgrade: pv( function(eval) { eval.heavenlyUnlock += this.amount; } ),
	revokeUpgrade: pv( function(eval) { eval.heavenlyUnlock -= this.amount; } ),
});
// Upgrade that increases mouse and cursor cps based on buildings owned
upgradeTypes.multifinger = Object.create(upgradeTypes.basic, {
	amount: pv( 0 ),
	applyUpgrade: pv(
		function(eval) {
			// Scale up all except the excluded type
			eval.buildings[Constants.CURSOR_INDEX].buildingScaler.scaleAll(this.amount);
			eval.buildings[Constants.CURSOR_INDEX].buildingScaler.scaleOne(Constants.CURSOR_INDEX, -this.amount);
			eval.cpcBuildingBaseScaler.scaleAll(this.amount);
			eval.cpcBuildingBaseScaler.scaleOne(Constants.CURSOR_INDEX, -this.amount);
		}
	),
	revokeUpgrade: pv(
		function(eval) {
			// Scale up all except the excluded type
			eval.buildings[Constants.CURSOR_INDEX].buildingScaler.scaleAll(-this.amount);
			eval.buildings[Constants.CURSOR_INDEX].buildingScaler.scaleOne(Constants.CURSOR_INDEX, this.amount);
			eval.cpcBuildingBaseScaler.scaleAll(-this.amount);
			eval.cpcBuildingBaseScaler.scaleOne(Constants.CURSOR_INDEX, this.amount);
		}
	),
});
// Upgrade that increases base cps of one building based on quantity of another
upgradeTypes.perBuildingScaler = Object.create(upgradeTypes.building, {
	target: pv( Constants.CURSOR_INDEX ),
	amount: pv( 0 ),
	applyUpgrade: pv( function(eval) { eval.buildings[this.index].buildingBaseScaler.scaleOne(this.target, this.amount); } ),
	revokeUpgrade: pv( function(eval) { eval.buildings[this.index].buildingBaseScaler.scaleOne(this.target, -this.amount); } ),
});
// Upgrade that doubles both mouse and cursor CpS
upgradeTypes.reinforcedIndexFinger = Object.create(upgradeTypes.basic, {
	applyUpgrade: pv(
		function(eval) {
			upgradeTypes.clickDoubler.applyUpgrade(eval);
			eval.buildings[Constants.CURSOR_INDEX].baseCps += 0.1;
		}
	),
	revokeUpgrade: pv(
		function(eval) {
			upgradeTypes.clickDoubler.revokeUpgrade(eval);
			eval.buildings[Constants.CURSOR_INDEX].baseCps -= 0.1;
		}
	),
});
// Upgrade that doubles both mouse and cursor CpS
upgradeTypes.ambidextrous = Object.create(upgradeTypes.building, {
	scale: pv( 2 ),
	applyUpgrade: pv(
		function(eval) {
			eval.cpcMultiplier *= 2;
			eval.buildings[this.index].multiplier *= this.scale;
		}
	),
	revokeUpgrade: pv(
		function(eval) {
			eval.cpcMultiplier /= 2;
			eval.buildings[this.index].multiplier /= this.scale;
		}
	),
});
// Revoke elder covenant upgrade - permanant 5% CpS reduction
upgradeTypes.elderCovenant = Object.create(upgradeTypes.basic, {
	revoke: pv( true ),
	applyUpgrade: pv( function(eval) { eval.elderCovenant = this.revoke; } ),
	// This is a bit dodgy
	revokeUpgrade: pv( function(eval) { eval.elderCovenant = !this.revoke; } ),
});
// Santa level upgrades
upgradeTypes.santaLevel = Object.create(upgradeTypes.basic, {
	level: pv( 0 ),
	applyUpgrade: pv( function(eval) { ++eval.santaLevel; } ),
	revokeUpgrade: pv( function(eval) { --eval.santaLevel; } ),
	purchase: pv(
		function() {
			var mx = Game.mouseX;
			var my = Game.mouseY;
			var c = Game.Click;
			Game.mouseX = 24;
			Game.mouseY = Game.LeftBackground.canvas.height - 48;
			Game.Click = 1;
			Game.UpdateSanta();
			Game.mouseX = mx;
			Game.mouseY = my;
			Game.Click = c;
		}
	),
	getCost: pv( function() { return Math.pow(this.level, this.level); } ),
});

// Shorthand functions for declaring the individual upgrade types
basicUpgrade = function(nam)
	{ return Object.create(upgradeTypes.basic, { name: pv(nam) } ); }
buildingUpgrade = function(nam, indx)
	{ return Object.create(upgradeTypes.building, { name: pv(nam), index: pv(indx) } ); }
buildingBaseCpsUpgrade = function(nam, indx, amnt)
	{ return Object.create(upgradeTypes.buildingBaseCps, { name: pv(nam), index: pv(indx), amount: pv(amnt) } ); }
buildingMultiplierUpgrade = function(nam, indx, scal)
	{ return Object.create(upgradeTypes.buildingMultiplier, { name: pv(nam), index: pv(indx), scale: pv(scal) } ); }
productionUpgrade = function(nam, amnt)
	{ return Object.create(upgradeTypes.production, { name: pv(nam), amount: pv(amnt) } ); }
goldenCookieFrequencyUpgrade = function(nam, scal)
	{ return Object.create(upgradeTypes.goldenCookieFrequency, { name: pv(nam), scale: pv(scal) } ); }
goldenCookieDurationUpgrade = function(nam)
	{ return Object.create(upgradeTypes.goldenCookieDuration, { name: pv(nam) } ); }
perBuildingScalerUpgrade = function(nam, indx, tar, amt)
	{ return Object.create(upgradeTypes.perBuildingScaler, { name: pv(nam), index: pv(indx), target: pv(tar), amount: pv(amt) } ); }
reinforcedIndexFingerUpgrade = function(nam)
	{ return Object.create(upgradeTypes.reinforcedIndexFinger, { name: pv(nam) } ); }
ambidextrousUpgrade = function(nam)
	{ return Object.create(upgradeTypes.ambidextrous, { name: pv(nam) } ); }
multifingerUpgrade = function(nam, amnt)
	{ return Object.create(upgradeTypes.multifinger, { name: pv(nam), amount: pv(amnt) } ); }
milkUpgrade = function(nam, scal)
	{ return Object.create(upgradeTypes.milk, { name: pv(nam), scale: pv(scal) } ); }
heavenlyPowerUpgrade = function(nam, amnt)
	{ return Object.create(upgradeTypes.heavenlyPower, { name: pv(nam), amount: pv(amnt) } ); }
clickCpsUpgrade = function(nam, amnt)
	{ return Object.create(upgradeTypes.clickCps, { name: pv(nam), amount: pv(amnt) } ); }
elderCovenantUpgrade = function(nam, revok)
	{ return Object.create(upgradeTypes.elderCovenant, { name: pv(nam), revoke: pv(revok) } ); }

// All of the upgrades supported are declared here
var upgradeFunctions = {
	// Upgrades for the basic building types
	cursor:					buildingUpgrade("Cursor", Constants.CURSOR_INDEX),
	grandma: 				buildingUpgrade("Grandma", Constants.GRANDMA_INDEX),
	farm:					buildingUpgrade("Farm", Constants.FARM_INDEX),
	factory:				buildingUpgrade("Factory", Constants.FACTORY_INDEX),
	mine:					buildingUpgrade("Mine", Constants.MINE_INDEX),
	shipment: 				buildingUpgrade("Shipment", Constants.SHIPMENT_INDEX),
	alchemyLab: 			buildingUpgrade("Alchemy lab", Constants.ALCHEMY_LAB_INDEX),
	portal: 				buildingUpgrade("Portal", Constants.PORTAL_INDEX),
	timeMachine: 			buildingUpgrade("Time machine", Constants.TIME_MACHINE_INDEX),
	antimatterCondenser:	buildingUpgrade("Antimatter condenser", Constants.ANTIMATTER_CONDENSER_INDEX),
	prism: 					buildingUpgrade("Prism", Constants.PRISM_INDEX),
	// Upgrades that increase basic building cps
	forwardsFromGrandma:	buildingBaseCpsUpgrade("Forwards from grandma", Constants.GRANDMA_INDEX, 0.3),
	cheapHoes:				buildingBaseCpsUpgrade("Cheap hoes", Constants.FARM_INDEX, 1),
	sturdierConveyorBelts:	buildingBaseCpsUpgrade("Sturdier conveyor belts", Constants.FACTORY_INDEX, 4),
	sugarGas:				buildingBaseCpsUpgrade("Sugar gas", Constants.MINE_INDEX, 10),
	vanillaNebulae:			buildingBaseCpsUpgrade("Vanilla nebulae", Constants.SHIPMENT_INDEX, 30),
	antimony:				buildingBaseCpsUpgrade("Antimony", Constants.ALCHEMY_LAB_INDEX, 100),
	ancientTablet:			buildingBaseCpsUpgrade("Ancient tablet", Constants.PORTAL_INDEX, 1666),
	fluxCapacitors:			buildingBaseCpsUpgrade("Flux capacitors", Constants.TIME_MACHINE_INDEX, 9876),
	sugarBosons:			buildingBaseCpsUpgrade("Sugar bosons", Constants.ANTIMATTER_CONDENSER_INDEX, 99999),
	gemPolish:				buildingBaseCpsUpgrade("Gem polish", Constants.PRISM_INDEX, 1000000),
	// Upgrades that double the productivity of a type of building
	steelPlatedRollingPins:	buildingMultiplierUpgrade("Steel-plated rolling pins", Constants.GRANDMA_INDEX, 2),
	lubricatedDentures:		buildingMultiplierUpgrade("Lubricated dentures", Constants.GRANDMA_INDEX, 2),
	farmerGrandmas:			buildingMultiplierUpgrade("Farmer grandmas", Constants.GRANDMA_INDEX, 2),
	workerGrandmas:			buildingMultiplierUpgrade("Worker grandmas", Constants.GRANDMA_INDEX, 2),
	minerGrandmas:			buildingMultiplierUpgrade("Miner grandmas", Constants.GRANDMA_INDEX, 2),
	cosmicGrandmas:			buildingMultiplierUpgrade("Cosmic grandmas", Constants.GRANDMA_INDEX, 2),
	pruneJuice:				buildingMultiplierUpgrade("Prune juice", Constants.GRANDMA_INDEX, 2),
	transmutedGrandmas:		buildingMultiplierUpgrade("Transmuted grandmas", Constants.GRANDMA_INDEX, 2),
	doubleThickGlasses:		buildingMultiplierUpgrade("Double-thick glasses", Constants.GRANDMA_INDEX, 2),
	alteredGrandmas:		buildingMultiplierUpgrade("Altered grandmas", Constants.GRANDMA_INDEX, 2),
	grandmasGrandmas:		buildingMultiplierUpgrade("Grandmas' grandmas", Constants.GRANDMA_INDEX, 2),
	antigrandmas:			buildingMultiplierUpgrade("Antigrandmas", Constants.GRANDMA_INDEX, 2),
	rainbowGrandmas:		buildingMultiplierUpgrade("Rainbow grandmas", Constants.GRANDMA_INDEX, 2),
	agingAgents:			buildingMultiplierUpgrade("Aging agents", Constants.GRANDMA_INDEX, 2),
	fertilizer:				buildingMultiplierUpgrade("Fertilizer", Constants.FARM_INDEX, 2),
	cookieTrees:			buildingMultiplierUpgrade("Cookie trees", Constants.FARM_INDEX, 2),
	geneticallyModifiedCookies:	buildingMultiplierUpgrade("Genetically-modified cookies", Constants.FARM_INDEX, 2),
	gingerbreadScarecrows:	buildingMultiplierUpgrade("Gingerbread scarecrows", Constants.FARM_INDEX, 2),
	pulsarSprinklers:		buildingMultiplierUpgrade("Pulsar sprinklers", Constants.FARM_INDEX, 2),
	childLabor:				buildingMultiplierUpgrade("Child labor", Constants.FACTORY_INDEX, 2),
	sweatshop:				buildingMultiplierUpgrade("Sweatshop", Constants.FACTORY_INDEX, 2),
	radiumReactors:			buildingMultiplierUpgrade("Radium reactors", Constants.FACTORY_INDEX, 2),
	recombobulators:		buildingMultiplierUpgrade("Recombobulators", Constants.FACTORY_INDEX, 2),
	deepBakeProcess:		buildingMultiplierUpgrade("Deep-bake process", Constants.FACTORY_INDEX, 2),
	megadrill:				buildingMultiplierUpgrade("Megadrill", Constants.MINE_INDEX, 2),
	ultradrill:				buildingMultiplierUpgrade("Ultradrill", Constants.MINE_INDEX, 2),
	ultimadrill:			buildingMultiplierUpgrade("Ultimadrill", Constants.MINE_INDEX, 2),
	hBombMining:			buildingMultiplierUpgrade("H-bomb mining", Constants.MINE_INDEX, 2),
	coreforge:				buildingMultiplierUpgrade("Coreforge", Constants.MINE_INDEX, 2),
	wormholes:				buildingMultiplierUpgrade("Wormholes", Constants.SHIPMENT_INDEX, 2),
	frequentFlyer:			buildingMultiplierUpgrade("Frequent flyer", Constants.SHIPMENT_INDEX, 2),
	warpDrive:				buildingMultiplierUpgrade("Warp drive", Constants.SHIPMENT_INDEX, 2),
	chocolateMonoliths:		buildingMultiplierUpgrade("Chocolate monoliths", Constants.SHIPMENT_INDEX, 2),
	generationShip:			buildingMultiplierUpgrade("Generation ship", Constants.SHIPMENT_INDEX, 2),
	essenceOfDough:			buildingMultiplierUpgrade("Essence of dough", Constants.ALCHEMY_LAB_INDEX, 2),
	trueChocolate:			buildingMultiplierUpgrade("True chocolate", Constants.ALCHEMY_LAB_INDEX, 2),
	ambrosia:				buildingMultiplierUpgrade("Ambrosia", Constants.ALCHEMY_LAB_INDEX, 2),
	aquaCrustulae:			buildingMultiplierUpgrade("Aqua crustulae", Constants.ALCHEMY_LAB_INDEX, 2),
	originCrucible:			buildingMultiplierUpgrade("Origin crucible", Constants.ALCHEMY_LAB_INDEX, 2),
	insaneOatlingWorkers:	buildingMultiplierUpgrade("Insane oatling workers", Constants.PORTAL_INDEX, 2),
	soulBond:				buildingMultiplierUpgrade("Soul bond", Constants.PORTAL_INDEX, 2),
	sanityDance:			buildingMultiplierUpgrade("Sanity dance", Constants.PORTAL_INDEX, 2),
	braneTransplant:		buildingMultiplierUpgrade("Brane transplant", Constants.PORTAL_INDEX, 2),
	deitySizedPortals:		buildingMultiplierUpgrade("Deity-sized portals", Constants.PORTAL_INDEX, 2),
	timeParadoxResolver:	buildingMultiplierUpgrade("Time paradox resolver", Constants.TIME_MACHINE_INDEX, 2),
	quantumConundrum:		buildingMultiplierUpgrade("Quantum conundrum", Constants.TIME_MACHINE_INDEX, 2),
	causalityEnforcer:		buildingMultiplierUpgrade("Causality enforcer", Constants.TIME_MACHINE_INDEX, 2),
	yestermorrowComparators:buildingMultiplierUpgrade("Yestermorrow comparators", Constants.TIME_MACHINE_INDEX, 2),
	farFutureEnactment:		basicUpgrade("Far future enactment"),	// Bugged, does nothing
	stringTheory:			buildingMultiplierUpgrade("String theory", Constants.ANTIMATTER_CONDENSER_INDEX, 2),
	largeMacaronCollider:	buildingMultiplierUpgrade("Large macaron collider", Constants.ANTIMATTER_CONDENSER_INDEX, 2),
	bigBangBake:			buildingMultiplierUpgrade("Big bang bake", Constants.ANTIMATTER_CONDENSER_INDEX, 2),
	reverseCyclotrons:		buildingMultiplierUpgrade("Reverse cyclotrons", Constants.ANTIMATTER_CONDENSER_INDEX, 2),
	nanocosmics:			buildingMultiplierUpgrade("Nanocosmics", Constants.ANTIMATTER_CONDENSER_INDEX, 2),
	ninthColor:				buildingMultiplierUpgrade("9th color", Constants.PRISM_INDEX, 2),
	chocolateLight:			buildingMultiplierUpgrade("Chocolate light", Constants.PRISM_INDEX, 2),
	grainbow:				buildingMultiplierUpgrade("Grainbow", Constants.PRISM_INDEX, 2),
	pureCosmicLight:		buildingMultiplierUpgrade("Pure cosmic light", Constants.PRISM_INDEX, 2),
	glowInTheDark:			buildingMultiplierUpgrade("Glow-in-the-dark", Constants.PRISM_INDEX, 2),
	// Upgrades that increase cookie production
	sugarCookies:			productionUpgrade("Sugar cookies", 5),
	peanutButterCookies:	productionUpgrade("Peanut butter cookies", 5),
	plainCookies:			productionUpgrade("Plain cookies", 5),
	oatmealRaisinCookies:	productionUpgrade("Oatmeal raisin cookies", 5),
	coconutCookies:			productionUpgrade("Coconut cookies", 5),
	whiteChocolateCookies:	productionUpgrade("White chocolate cookies", 5),
	macadamiaNutCookies:	productionUpgrade("Macadamia nut cookies", 5),
	whiteChocolateMacadamiaNutCookies:	productionUpgrade("White chocolate macadamia nut cookies", 10),
	doubleChipCookies:		productionUpgrade("Double-chip cookies", 10),
	allChocolateCookies:	productionUpgrade("All-chocolate cookies", 10),
	whiteChocolateCoatedCookies:	productionUpgrade("White chocolate-coated cookies", 15),
	darkChocolateCoatedCookies:		productionUpgrade("Dark chocolate-coated cookies", 15),
	eclipseCookies:			productionUpgrade("Eclipse cookies", 15),
	zebraCookies:			productionUpgrade("Zebra cookies", 15),
	snickerdoodles:			productionUpgrade("Snickerdoodles", 15),
	stroopwafels:			productionUpgrade("Stroopwafels", 15),
	empireBiscuits:			productionUpgrade("Empire biscuits", 15),
	macaroons:				productionUpgrade("Macaroons", 15),
	britishTeaBiscuits:		productionUpgrade("British tea biscuits", 15),
	chocolateBritishTeaBiscuits:					productionUpgrade("Chocolate british tea biscuits", 15),
	roundBritishTeaBiscuits:						productionUpgrade("Round british tea biscuits", 15),
	roundChocolateBritishTeaBiscuits:				productionUpgrade("Round chocolate british tea biscuits", 15),
	roundBritishTeaBiscuitsWithHeartMotif:			productionUpgrade("Round british tea biscuits with heart motif", 15),
	roundChocolateBritishTeaBiscuitsWithHeartMotif:	productionUpgrade("Round chocolate british tea biscuits with heart motif", 15),
	palets:					productionUpgrade("Palets", 20),
	sables:					productionUpgrade("Sabl&eacute;s", 20),
	madeleines:				productionUpgrade("Madeleines", 20),
	palmiers:				productionUpgrade("Palmiers", 20),
	shortfoils:				productionUpgrade("Shortfoils", 25),
	figGluttons:			productionUpgrade("Fig gluttons", 25),
	loreols:				productionUpgrade("Loreols", 25),
	jaffaCakes:				productionUpgrade("Jaffa cakes", 25),
	greasesCups:			productionUpgrade("Grease's cups", 25),
	sagalongs:				productionUpgrade("Sagalongs", 25),
	winMints:				productionUpgrade("Win mints", 25),
	caramoas:				productionUpgrade("Caramoas", 25),
	gingerbreadTrees:		productionUpgrade("Gingerbread trees", 25),
	gingerbreadMen:			productionUpgrade("Gingerbread men", 25),
	roseMacarons:			productionUpgrade("Rose macarons", 30),
	lemonMacarons:			productionUpgrade("Lemon macarons", 30),
	chocolateMacarons:		productionUpgrade("Chocolate macarons", 30),
	pistachioMacarons:		productionUpgrade("Pistachio macarons", 30),
	hazelnutMacarons:		productionUpgrade("Hazelnut macarons", 30),
	violetMacarons:			productionUpgrade("Violet macarons", 30),
	// Golden cookie upgrade functions
	luckyDay:				goldenCookieFrequencyUpgrade("Lucky day", 2),
	serendipity:			goldenCookieFrequencyUpgrade("Serendipity", 2),
	getLuckyUpgrade:		goldenCookieDurationUpgrade("Get lucky"),
	// Research centre related upgrades
	bingoCenterResearchFacility:	buildingMultiplierUpgrade("Bingo center/Research facility", Constants.GRANDMA_INDEX, 4),
	persistentMemory:				basicUpgrade("Persistent memory"),
	specializedChocolateChips:		productionUpgrade("Specialized chocolate chips", 1),
	designerCocoaBeans:		productionUpgrade("Designer cocoa beans", 2),
	ritualRollingPins:		buildingMultiplierUpgrade("Ritual rolling pins", Constants.GRANDMA_INDEX, 2),
	underworldOvens:		productionUpgrade("Underworld ovens", 3),
	oneMind:				perBuildingScalerUpgrade("One mind", Constants.GRANDMA_INDEX, Constants.GRANDMA_INDEX, 0.02),
	exoticNuts:				productionUpgrade("Exotic nuts", 4),
	communalBrainsweep:		perBuildingScalerUpgrade("Communal brainsweep", Constants.GRANDMA_INDEX, Constants.GRANDMA_INDEX, 0.02),
	arcaneSugar:			productionUpgrade("Arcane sugar", 5),
	elderPact:				perBuildingScalerUpgrade("Elder Pact", Constants.GRANDMA_INDEX, Constants.PORTAL_INDEX, 0.05),
	sacrificialRollingPins:	basicUpgrade("Sacrificial rolling pins"),
	elderCovenant:			elderCovenantUpgrade("Elder Covenant", true),
	revokeElderCovenant:	elderCovenantUpgrade("Revoke Elder Covenant", false),
	// Reinforced Index Finger
	reinforcedIndexFinger:	reinforcedIndexFingerUpgrade("Reinforced index finger"),
	// Ambidextrous upgrades (double clicking and cursors)
	carpalTunnelPreventionCream:	ambidextrousUpgrade("Carpal tunnel prevention cream", 2),
	ambidextrous:					ambidextrousUpgrade("Ambidextrous", 2),
	// Clicking and Cursors scale with buildings owned
	thousandFingers:		multifingerUpgrade("Thousand fingers", 0.1),
	millionFingers:			multifingerUpgrade("Million fingers", 0.5),
	billionFingers:			multifingerUpgrade("Billion fingers", 2),
	trillionFingers:		multifingerUpgrade("Trillion fingers", 10),
	quadrillionFingers:		multifingerUpgrade("Quadrillion fingers", 20),
	quintillionFingers:		multifingerUpgrade("Quintillion fingers", 100),
	sextillionFingers:		multifingerUpgrade("Sextillion fingers", 200),
	septillionFingers:		multifingerUpgrade("Septillion fingers", 400),
	octillionFingers:		multifingerUpgrade("Octillion fingers", 800),
	// Clicking gains a percent of CpS
	plasticMouse:			clickCpsUpgrade("Plastic mouse", 0.01),
	ironMouse:				clickCpsUpgrade("Iron mouse", 0.01),
	titaniumMouse:			clickCpsUpgrade("Titanium mouse", 0.01),
	adamantiumMouse:		clickCpsUpgrade("Adamantium mouse", 0.01),
	unobtainiumMouse:		clickCpsUpgrade("Unobtainium mouse", 0.01),
	eludium:				clickCpsUpgrade("Eludium mouse", 0.01),
	wishalloy:				clickCpsUpgrade("Wishalloy mouse", 0.01),
	// Milk upgrades
	kittenHelpers:			milkUpgrade("Kitten helpers", 0.05),
	kittenWorkers:			milkUpgrade("Kitten workers", 0.1),
	kittenEngineers:		milkUpgrade("Kitten engineers", 0.2),
	kittenOverseers:		milkUpgrade("Kitten overseers", 0.2),
	kittenManagers:			milkUpgrade("Kitten managers", 0.2),
	// Heavenly chip unlocks
	heavenlyChipSecret:		heavenlyPowerUpgrade("Heavenly chip secret", 0.05),
	heavenlyCookieStand:	heavenlyPowerUpgrade("Heavenly cookie stand", 0.20),
	heavenlyBakery:			heavenlyPowerUpgrade("Heavenly bakery", 0.25),
	heavenlyConfectionery:	heavenlyPowerUpgrade("Heavenly confectionery", 0.25),
	heavenlyKey:			heavenlyPowerUpgrade("Heavenly key", 0.25),
	// Season switcher upgrade
	seasonSwitcher:			basicUpgrade("Season switcher"),
	// Business day season
	foolsBiscuit:			basicUpgrade("Fool's biscuit"),
	// Valentines day season
	lovesickBiscuit:		basicUpgrade("Lovesick biscuit"),
	pureHeartBiscuits:		productionUpgrade("Pure heart biscuits", 25),
	ardentHeartBiscuits:	productionUpgrade("Ardent heart biscuits", 25),
	sourHeartBiscuits:		productionUpgrade("Sour heart biscuits", 25),
	weepingHeartBiscuits:	productionUpgrade("Weeping heart biscuits", 25),
	goldenHeartBiscuits:	productionUpgrade("Golden heart biscuits", 25),
	eternalHeartBiscuits:	productionUpgrade("Eternal heart biscuits", 25),
	// Halloween season
	ghostlyBiscuit:			basicUpgrade("Ghostly biscuit"),
	skullCookies:			productionUpgrade("Skull cookies", 20),
	ghostCookies:			productionUpgrade("Ghost cookies", 20),
	batCookies:				productionUpgrade("Bat cookies", 20),
	slimeCookies:			productionUpgrade("Slime cookies", 20),
	pumpkinCookies:			productionUpgrade("Pumpkin cookies", 20),
	eyeballCookies:			productionUpgrade("Eyeball cookies", 20),
	spiderCookies:			productionUpgrade("Spider cookies", 20),
	// Christmas season
	festiveBiscuit:			basicUpgrade("Festive biscuit"),
	aFestiveHat:			basicUpgrade("A festive hat"),				// Unlocks the santa upgrades
	weightedSleighs:		basicUpgrade("Weighted sleighs"),			// Reindeer are twice as slow
	reindeerBakingGrounds:	basicUpgrade("Reindeer baking grounds"),	// Reindeer appear twice as often
	hoHoHoFlavoredFrosting:	basicUpgrade("Ho ho ho-flavored frosting"),	// Reindeer give twice as much
	seasonSavings:			basicUpgrade("Season savings"),				// All buildings are 1% cheaper
	toyWorkshop:			basicUpgrade("Toy workshop"),				// All upgrades are 5% cheaper
	santasBottomlessBag:	basicUpgrade("Santa's bottomless bag"),		// Random drops are 10% more common
	santasHelpers:			basicUpgrade("Santa's helpers"),			// Clicking is 10% more effective
	santasLegacy:			basicUpgrade("Santa's legacy"),				// Cookie production multiplier +10% per santa's levels
	santasMilkAndCookies:	basicUpgrade("Santa's milk and cookies"),	// Milk is 5% more powerful
	santasDominion:			basicUpgrade("Santa's dominion"),			// Cookie production multiplier +50%, All buildings are 1% cheaper, All upgrades are 2% cheaper
	aLumpOfCoal:			productionUpgrade("A lump of coal", 1),
	anItchySweater:			productionUpgrade("An itchy sweater", 1),
	improvedJolliness:		productionUpgrade("Improved jolliness", 15),
	increasedMerriness:		productionUpgrade("Increased merriness", 15),
	christmasTreeBiscuits:	productionUpgrade("Christmas tree biscuits", 20),
	snowflakeBiscuits:		productionUpgrade("Snowflake biscuits", 20),
	snowmanBiscuits:		productionUpgrade("Snowman biscuits", 20),
	hollyBiscuits:			productionUpgrade("Holly biscuits", 20),
	candyCaneBiscuits:		productionUpgrade("Candy cane biscuits", 20),
	bellBiscuits:			productionUpgrade("Bell biscuits", 20),
	presentBiscuits:		productionUpgrade("Present biscuits", 20),
	naughtyList:			buildingMultiplierUpgrade("Naughty list", Constants.GRANDMA_INDEX, 2),
}

// Lookup table for finding the same upgrade functions by name
var upgradeIndex = {}
for (var upf in upgradeFunctions) {
	upgradeIndex[upgradeFunctions[upf].name] = upgradeFunctions[upf];
}

getUpgradeFunction = function(name) {
	if (upgradeIndex[name] == undefined) {
		upgradeIndex[name] = basicUpgrade(name);
		console.log("Unknown upgrade: " + name);
	}
	return upgradeIndex[name];
}

//
// Classes to represent upgrades and tie them to game purchases
//

// PurchasableItems
function PurchasableItem(item) {
	this.item = item;
	this.upgradeFunction = getUpgradeFunction(this.item.name);
}

PurchasableItem.prototype.getName = function() {
	return this.item.name;
}

PurchasableItem.prototype.toString = function() {
	if (this.item.amount == undefined) {	// Upgrades don't have an amount
		return "Upgrade: " + this.getName();
	} else {
		return "Building: " + this.getName() + " " + (this.item.amount + 1);
	}
}

PurchasableItem.prototype.getCost = function() {
	return this.item.getPrice();
}

PurchasableItem.prototype.purchase = function() {
	this.item.buy(1);
}

//
// Utility stuff and starting the app off
//

// Compare floats with an epsilon value
function floatEqual(a, b) {
	var eps = Math.abs(a - b) * 1000000000.0;
	return eps <= Math.abs(a) && eps <= Math.abs(b);
}

// Create the upgradeInfo and Ultimate Cookie instances
var ultimateCookie = new UltimateCookie();

if (Constants.DEBUG) {
	console.log("Ultimate Cookie started at " + new Date());
}

