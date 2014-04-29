// To-do
// Figure out how to get AutoBuy as a member of the UltimateCookie

var Constants = {};

// Interval delays for clicking and updates
Constants.CLICK_DELAY = 1;
Constants.UPDATE_DELAY = 50;

Constants.AUTO_CLICK = true;
Constants.AUTO_CLICK_GOLDEN_COOKIES = true;
Constants.AUTO_RESET = true;
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
		a.upgradeFunction.upgradeEval(e);
		var aCpsGain = e.getEffectiveCps() - currentCps;

		e = eval.clone();
		b.upgradeFunction.upgradeEval(e);
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
	a.upgradeFunction.upgradeEval(e);
	ta += b.getCost() / e.getEffectiveCps();

	// Get time to buy both starting with b
	e = eval.clone();
	var tb = b.getCost() / e.getEffectiveCps();
	b.upgradeFunction.upgradeEval(e);
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
	this.cpcBuildingScaler = new BuildingScaler();

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
	this.clickFrenzy = 0;

	// Golden cookie information - only used in estimating value of golden cookie
	// frequency upgrades
	this.frenzyDuration = 77;
	this.goldenCookieTime = 300;
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
	e.cpcBuildingScaler = this.cpcBuildingScaler.clone();
	e.productionMultiplier = this.productionMultiplier;
	e.heavenlyChips = this.heavenlyChips;
	e.heavenlyUnlock = this.heavenlyUnlock;
	e.milkAmount = this.milkAmount;
	e.milkMultipliers = [];
	for (i = 0; i < this.milkMultipliers.length; ++i) {
		e.milkMultipliers[i] = this.milkMultipliers[i];
	}
	e.frenzy = this.frenzy;
	e.clickFrenzy = this.clickFrenzy;
	e.frenzyDuration = this.frenzyDuration;
	e.goldenCookieTime = this.goldenCookieTime;

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
			console.log("Evaluator Error - Predicted Building Cost: " + this.buildings[i].getCost() + ", Actual Cost: " + Game.ObjectsById[i].getPrice());
			match = false;
		}
		if (!floatEqual(this.buildings[i].getIndividualCps(), Game.ObjectsById[i].cps())) {
			console.log("Evaluator Error - Predicted Building CpS: " + this.buildings[i].getIndividualCps() + ", Actual CpS: " + Game.ObjectsById[i].cps());
			match = false;
		}
	}
	// Default all is fine
	return match;
}

// Get the current cookies per click amount
Evaluator.prototype.getCpc = function() {
	var cpc = (this.cpcBase + this.cpcBuildingScaler.getScale(this.buildings)) * this.cpcMultiplier;	// Base cpc
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
		cps *= Constants.FRENZY_MULTIPLIER;
	}
	return cps;
}

// Calculate the CpS during frenzy
Evaluator.prototype.getFrenziedCps = function() {
	var frenzy = this.frenzy;
	var clickFrenzy = this.clickFrenzy;
	this.frenzy = 1;
	this.clickFrenzy = 0;
	var cps = this.getCps();
	this.frenzy = frenzy;
	this.clickFrenzy = clickFrenzy;
	return cps;
}

// Calculate the CpC during frenzy
Evaluator.prototype.getFrenziedCpc = function() {
	var frenzy = this.frenzy;
	var clickFrenzy = this.clickFrenzy;
	this.frenzy = 1;
	this.clickFrenzy = 0;
	var cpc = this.getCpc();
	this.frenzy = frenzy;
	this.clickFrenzy = clickFrenzy;
	return cpc;
}

// Calculate the CpS without frenzy
Evaluator.prototype.getUnfrenziedCps = function() {
	var frenzy = this.frenzy;
	var clickFrenzy = this.clickFrenzy;
	this.frenzy = 0;
	this.clickFrenzy = 0;
	var cps = this.getCps();
	this.frenzy = frenzy;
	this.clickFrenzy = clickFrenzy;
	return cps;
}

// Calculate the CpC without frenzy
Evaluator.prototype.getUnfrenziedCpc = function() {
	var frenzy = this.frenzy;
	var clickFrenzy = this.clickFrenzy;
	this.frenzy = 0;
	this.clickFrenzy = 0;
	var cpc = this.getCpc();
	this.frenzy = frenzy;
	this.clickFrenzy = clickFrenzy;
	return cpc;
}

// Estimate the extra CpS contribution from collecting all golden cookies
// Assumes max click rate and that golden cookies just follow the simple pattern
// of Frenzy followed by Lucky and appear at the minimum spawn time every time.
// Not 100% accurate but near enough to give a decent estimation.
Evaluator.prototype.getGoldenCookieCps = function() {
	// Add gains from a single full duration frenzy
	var totalGain = 0;
	totalGain += (this.getFrenziedCps() - this.getUnfrenziedCps()) * this.frenzyDuration;
	totalGain += (this.getFrenziedCpc() - this.getUnfrenziedCpc()) * this.frenzyDuration * ultimateCookie.clickRate();

	// Add gains from a single lucky cookie
	if (this.goldenCookieTime < this.frenzyDuration) {
		totalGain += this.getFrenziedCps() * (Constants.LUCKY_COOKIE_BANK_TIME + Constants.LUCKY_COOKIE_BONUS_TIME);
	} else {
		totalGain += this.getUnfrenziedCps() * (Constants.LUCKY_COOKIE_BANK_TIME + Constants.LUCKY_COOKIE_BONUS_TIME);
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
	var totalCookieBankRequired = this.getUnfrenziedCps() * Constants.LUCKY_COOKIE_BANK_TIME * 10 * Constants.FRENZY_MULTIPLIER;
	var timeRemaining = Math.max(this.goldenCookieTime - timeSinceLastGoldenCookie, 0);
	var frenziedCps = this.getFrenziedCps() + this.getFrenziedCpc() * ultimateCookie.clickRate();
	var unfrenziedCps = this.getUnfrenziedCps() + this.getUnfrenziedCpc() * ultimateCookie.clickRate();

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
			upgradeInfo.getUpgradeFunction(Game.UpgradesById[i].name).upgradeEval(this);
		}
	}
	this.heavenlyChips = Game.prestige['Heavenly chips'];
	this.milkAmount = Game.AchievementsOwned * 4;
	this.frenzy = Game.frenzy;
	this.frenzyMultiplier = Game.frenzyPower;
	this.clickFrenzy = Game.clickFrenzy;
}

//
// Classes to represent upgrades purely for use in Emulator calculations
//

// Base Upgrade function,
function Upgrade() {
	this.upgradeEval = function(eval) {}
}

// Get the CpS gain applying this upgrade will net
Upgrade.prototype.getCps = function(eval) {
	var e = eval.clone();
	var cps = eval.getEffectiveCps();
	this.upgradeEval(e);
	return e.getEffectiveCps() - cps;
}

// Get the CpS Value of applying this upgrade. This may differ from the CpS gain
// for upgrades that add value in a way that doesn't directly increase the CpS of the
// Evaluator. Default is to just return CpS. other upgrades may change this.
Upgrade.prototype.getValue = function(eval) {
	return this.getCps();
}


// Upgrade representing buying one of a building type
function BuildingUpgrade(index) {
	this.index = index;
	this.upgradeEval = function(eval) {
		eval.buildings[this.index].quantity += 1;
	}
}

// Upgrades that increase the base Cps of a building by a certain amount
function BuildingBaseCpsUpgrade(index, amount) {
	this.index = index;
	this.amount = amount;
	this.upgradeEval = function(eval) {
		eval.buildings[this.index].baseCps += this.amount;
	}
}

// Upgrades that double the CPS of a building type
function BuildingMultiplierUpgrade(index, scale) {
	this.index = index;
	this.scale = scale;
	this.upgradeEval = function(eval) {
		eval.buildings[this.index].multiplier *= scale;
	}
}

// Upgrades that double the CPS of clicking
function ClickDoublerUpgrade() {
	this.upgradeEval = function(eval) {
		eval.cpcMultiplier = eval.cpcMultiplier * 2;
	}
}

// Upgrades that base CPC of clicking
function ClickBaseUpgrade(amount) {
	this.amount = amount;
	this.upgradeEval = function(eval) {
		eval.cpcBase += this.amount;
	}
}

// Upgrades that base CPC of clicking
function ClickCpsUpgrade(amount) {
	this.amount = amount;
	this.upgradeEval = function(eval) {
		eval.cpcCpsMultiplier += this.amount;
	}
}

// Upgrades that increase cookie production
function ProductionUpgrade(amount) {
	this.amount = amount;
	this.upgradeEval = function(eval) {
		eval.productionMultiplier += this.amount;
	}
}

// Upgrade that makes Golden Cookies appear more often
function GoldenCookieFrequencyUpgrade(frequencyScale) {
	this.frequencyScale = frequencyScale;
	this.upgradeEval = function(eval) {
		eval.goldenCookieTime /= frequencyScale;
	}
}

// Upgrade that makes Golden Cookie effects last twice as long
function GoldenCookieDurationUpgrade() {
	this.upgradeEval = function(eval) {
		eval.frenzyDuration *= 2;
	}
}

// Upgrades that provide a bonus scaling from milk
function MilkUpgrade(amount) {
	this.amount = amount;
	this.upgradeEval = function(eval) {
		eval.milkMultipliers.push(this.amount);
		eval.milkMultipliers.sort();
	}
}

// Upgrades that unlock heavenly chip potential
function HeavenlyUnlockUpgrade(amount) {
	this.amount = amount;
	this.upgradeEval = function(eval) {
		eval.heavenlyUnlock += this.amount;
	}
}

// Upgrades that increase cursor and mouse cps based on number of buildings owned
function MultifingerUpgrade(amount) {
	this.amount = amount;
	this.upgradeEval = function(eval) {
		// Scale up all except the excluded type
		eval.buildings[Constants.CURSOR_INDEX].buildingScaler.scaleAll(this.amount);
		eval.buildings[Constants.CURSOR_INDEX].buildingScaler.scaleOne(Constants.CURSOR_INDEX, -this.amount);
		eval.cpcBuildingScaler.scaleAll(this.amount);
		eval.cpcBuildingScaler.scaleOne(Constants.CURSOR_INDEX, -this.amount);
	}
}

// Upgrade that increases cps based on a given building type
function PerBuildingScalerUpgrade(beneficiary, target, amount) {
	this.beneficiary = beneficiary;
	this.target = target;
	this.amount = amount;
	this.upgradeEval = function(eval) {
		eval.buildings[this.beneficiary].buildingBaseScaler.scaleOne(this.target, this.amount);
	}
}

// Upgrades that combine the effects of two or more other upgrade types
function ComboUpgrade(upgrades) {
	this.upgrades = upgrades;
	this.upgradeEval = function(eval) {
		var i;
		for (i = 0; i < this.upgrades.length; ++i) {
			this.upgrades[i].upgradeEval(eval);
		}
	}
}

// Upgrade with no affect on cookie production
function NonProductionUpgrade() {
	this.upgradeEval = function(eval) {
	}
}

function UpgradeInfo() {
	// Create the array of known Upgrade functions
	this.upgradeFunctions = {};
	this.du = this.declareUpgrade = function(name, func) {
		this.upgradeFunctions[name] = func;
	}
	// Upgrades that should just be bought immediately, used mostly for upgrades with no
	// direct cps contribution
	this.instabuyUpgrades = [];



	// Building upgrade functions
	this.cursorUpgrade				= this.du("Cursor",					new BuildingUpgrade(Constants.CURSOR_INDEX));
	this.grandmaUpgrade 			= this.du("Grandma",				new BuildingUpgrade(Constants.GRANDMA_INDEX));
	this.farmUpgrade				= this.du("Farm",					new BuildingUpgrade(Constants.FARM_INDEX));
	this.factoryUpgrade				= this.du("Factory",				new BuildingUpgrade(Constants.FACTORY_INDEX));
	this.mineUpgrade				= this.du("Mine",					new BuildingUpgrade(Constants.MINE_INDEX));
	this.shipmentUpgrade 			= this.du("Shipment",				new BuildingUpgrade(Constants.SHIPMENT_INDEX));
	this.alchemyLabUpgrade 			= this.du("Alchemy lab",			new BuildingUpgrade(Constants.ALCHEMY_LAB_INDEX));
	this.portalUpgrade 				= this.du("Portal",					new BuildingUpgrade(Constants.PORTAL_INDEX));
	this.timeMachineUpgrade 		= this.du("Time machine",			new BuildingUpgrade(Constants.TIME_MACHINE_INDEX));
	this.antimatterCondenserUpgrade = this.du("Antimatter condenser",	new BuildingUpgrade(Constants.ANTIMATTER_CONDENSER_INDEX));
	this.prismUpgrade 				= this.du("Prism",					new BuildingUpgrade(Constants.PRISM_INDEX));

	// Base CpS upgrades increase the base cps of a building
	this.forwardsFromGrandmaUpgrade		= this.du("Forwards from grandma",		new BuildingBaseCpsUpgrade(Constants.GRANDMA_INDEX, 0.3));
	this.cheapHoesUpgrade				= this.du("Cheap hoes",					new BuildingBaseCpsUpgrade(Constants.FARM_INDEX, 1));
	this.sturdierConveyorBeltsUpgrade	= this.du("Sturdier conveyor belts",	new BuildingBaseCpsUpgrade(Constants.FACTORY_INDEX, 4));
	this.sugarGasUpgrade				= this.du("Sugar gas",					new BuildingBaseCpsUpgrade(Constants.MINE_INDEX, 10));
	this.vanillaNebulaeUpgrade			= this.du("Vanilla nebulae",			new BuildingBaseCpsUpgrade(Constants.SHIPMENT_INDEX, 30));
	this.antimonyUpgrade				= this.du("Antimony",					new BuildingBaseCpsUpgrade(Constants.ALCHEMY_LAB_INDEX, 100));
	this.ancientTabletUpgrade			= this.du("Ancient tablet",				new BuildingBaseCpsUpgrade(Constants.PORTAL_INDEX, 1666));
	this.fluxCapacitorsUpgrade			= this.du("Flux capacitors",			new BuildingBaseCpsUpgrade(Constants.TIME_MACHINE_INDEX, 9876));
	this.sugarBosonsUpgrade				= this.du("Sugar bosons",				new BuildingBaseCpsUpgrade(Constants.ANTIMATTER_CONDENSER_INDEX, 99999));
	this.gemPolishUpgrade				= this.du("Gem polish",					new BuildingBaseCpsUpgrade(Constants.PRISM_INDEX, 1000000));

	// Doubler Upgrades are those that double the productivity of a type of building
	this.steelPlatedRollingPinsUpgrade		= this.du("Steel-plated rolling pins",		new BuildingMultiplierUpgrade(Constants.GRANDMA_INDEX, 2));
	this.lubricatedDenturesUpgrade			= this.du("Lubricated dentures",			new BuildingMultiplierUpgrade(Constants.GRANDMA_INDEX, 2));
	this.farmerGrandmasUpgrade				= this.du("Farmer grandmas",				new BuildingMultiplierUpgrade(Constants.GRANDMA_INDEX, 2));
	this.workerGrandmasUpgrade				= this.du("Worker grandmas",				new BuildingMultiplierUpgrade(Constants.GRANDMA_INDEX, 2));
	this.minerGrandmasUpgrade				= this.du("Miner grandmas",					new BuildingMultiplierUpgrade(Constants.GRANDMA_INDEX, 2));
	this.cosmicGrandmasUpgrade				= this.du("Cosmic grandmas",				new BuildingMultiplierUpgrade(Constants.GRANDMA_INDEX, 2));
	this.pruneJuiceUpgrade					= this.du("Prune juice",					new BuildingMultiplierUpgrade(Constants.GRANDMA_INDEX, 2));
	this.transmutedGrandmasUpgrade			= this.du("Transmuted grandmas",			new BuildingMultiplierUpgrade(Constants.GRANDMA_INDEX, 2));
	this.doubleThickGlassesUpgrade			= this.du("Double-thick glasses",			new BuildingMultiplierUpgrade(Constants.GRANDMA_INDEX, 2));
	this.alteredGrandmasUpgrade				= this.du("Altered grandmas",				new BuildingMultiplierUpgrade(Constants.GRANDMA_INDEX, 2));
	this.grandmasGrandmasUpgrade			= this.du("Grandmas' grandmas",				new BuildingMultiplierUpgrade(Constants.GRANDMA_INDEX, 2));
	this.antigrandmasUpgrade				= this.du("Antigrandmas",					new BuildingMultiplierUpgrade(Constants.GRANDMA_INDEX, 2));
	this.rainbowGrandmasUpgrade				= this.du("Rainbow grandmas",				new BuildingMultiplierUpgrade(Constants.GRANDMA_INDEX, 2));
	this.agingAgentsUpgrade					= this.du("Aging agents",					new BuildingMultiplierUpgrade(Constants.GRANDMA_INDEX, 2));
	this.fertilizerUpgrade					= this.du("Fertilizer",						new BuildingMultiplierUpgrade(Constants.FARM_INDEX, 2));
	this.cookieTreesUpgrade					= this.du("Cookie trees",					new BuildingMultiplierUpgrade(Constants.FARM_INDEX, 2));
	this.geneticallyModifiedCookiesUpgrade	= this.du("Genetically-modified cookies",	new BuildingMultiplierUpgrade(Constants.FARM_INDEX, 2));
	this.gingerbreadScarecrowsUpgrade		= this.du("Gingerbread scarecrows",			new BuildingMultiplierUpgrade(Constants.FARM_INDEX, 2));
	this.pulsarSprinklersUpgrade			= this.du("Pulsar sprinklers",				new BuildingMultiplierUpgrade(Constants.FARM_INDEX, 2));
	this.childLaborUpgrade					= this.du("Child labor",					new BuildingMultiplierUpgrade(Constants.FACTORY_INDEX, 2));
	this.sweatshopUpgrade					= this.du("Sweatshop",						new BuildingMultiplierUpgrade(Constants.FACTORY_INDEX, 2));
	this.radiumReactorsUpgrade				= this.du("Radium reactors",				new BuildingMultiplierUpgrade(Constants.FACTORY_INDEX, 2));
	this.recombobulatorsUpgrade				= this.du("Recombobulators",				new BuildingMultiplierUpgrade(Constants.FACTORY_INDEX, 2));
	this.deepBakeProcessUpgrade				= this.du("Deep-bake process",				new BuildingMultiplierUpgrade(Constants.FACTORY_INDEX, 2));
	this.megadrillUpgrade					= this.du("Megadrill",						new BuildingMultiplierUpgrade(Constants.MINE_INDEX, 2));
	this.ultradrillUpgrade					= this.du("Ultradrill",						new BuildingMultiplierUpgrade(Constants.MINE_INDEX, 2));
	this.ultimadrillUpgrade					= this.du("Ultimadrill",					new BuildingMultiplierUpgrade(Constants.MINE_INDEX, 2));
	this.hBombMiningUpgrade					= this.du("H-bomb mining",					new BuildingMultiplierUpgrade(Constants.MINE_INDEX, 2));
	this.coreforgeUpgrade					= this.du("Coreforge",						new BuildingMultiplierUpgrade(Constants.MINE_INDEX, 2));
	this.wormholesUpgrade					= this.du("Wormholes",						new BuildingMultiplierUpgrade(Constants.SHIPMENT_INDEX, 2));
	this.frequentFlyerUpgrade				= this.du("Frequent flyer",					new BuildingMultiplierUpgrade(Constants.SHIPMENT_INDEX, 2));
	this.warpDriveUpgrade					= this.du("Warp drive",						new BuildingMultiplierUpgrade(Constants.SHIPMENT_INDEX, 2));
	this.chocolateMonolithsUpgrade			= this.du("Chocolate monoliths",			new BuildingMultiplierUpgrade(Constants.SHIPMENT_INDEX, 2));
	this.generationShipUpgrade				= this.du("Generation ship",				new BuildingMultiplierUpgrade(Constants.SHIPMENT_INDEX, 2));
	this.essenceOfDoughUpgrade				= this.du("Essence of dough",				new BuildingMultiplierUpgrade(Constants.ALCHEMY_LAB_INDEX, 2));
	this.trueChocolateUpgrade				= this.du("True chocolate",					new BuildingMultiplierUpgrade(Constants.ALCHEMY_LAB_INDEX, 2));
	this.ambrosiaUpgrade					= this.du("Ambrosia",						new BuildingMultiplierUpgrade(Constants.ALCHEMY_LAB_INDEX, 2));
	this.aquaCrustulaeUpgrade				= this.du("Aqua crustulae",					new BuildingMultiplierUpgrade(Constants.ALCHEMY_LAB_INDEX, 2));
	this.originCrucibleUpgrade				= this.du("Origin crucible",				new BuildingMultiplierUpgrade(Constants.ALCHEMY_LAB_INDEX, 2));
	this.insaneOatlingWorkersUpgrade		= this.du("Insane oatling workers",			new BuildingMultiplierUpgrade(Constants.PORTAL_INDEX, 2));
	this.soulBondUpgrade					= this.du("Soul bond",						new BuildingMultiplierUpgrade(Constants.PORTAL_INDEX, 2));
	this.sanityDanceUpgrade					= this.du("Sanity dance",					new BuildingMultiplierUpgrade(Constants.PORTAL_INDEX, 2));
	this.braneTransplantUpgrade				= this.du("Brane transplant",				new BuildingMultiplierUpgrade(Constants.PORTAL_INDEX, 2));
	this.deitySizedPortalsUpgrade			= this.du("Deity-sized portals",			new BuildingMultiplierUpgrade(Constants.PORTAL_INDEX, 2));
	this.timeParadoxResolverUpgrade			= this.du("Time paradox resolver",			new BuildingMultiplierUpgrade(Constants.TIME_MACHINE_INDEX, 2));
	this.quantumConundrumUpgrade			= this.du("Quantum conundrum",				new BuildingMultiplierUpgrade(Constants.TIME_MACHINE_INDEX, 2));
	this.causalityEnforcerUpgrade			= this.du("Causality enforcer",				new BuildingMultiplierUpgrade(Constants.TIME_MACHINE_INDEX, 2));
	this.yestermorrowComparatorsUpgrade		= this.du("Yestermorrow comparators",		new BuildingMultiplierUpgrade(Constants.TIME_MACHINE_INDEX, 2));
	this.farFutureEnactmentUpgrade			= this.du("Far future enactment",			new NonProductionUpgrade());	// Bugged, does nothing
	this.stringTheoryUpgrade				= this.du("String theory",					new BuildingMultiplierUpgrade(Constants.ANTIMATTER_CONDENSER_INDEX, 2));
	this.largeMacaronColliderUpgrade		= this.du("Large macaron collider",			new BuildingMultiplierUpgrade(Constants.ANTIMATTER_CONDENSER_INDEX, 2));
	this.bigBangBakeUpgrade					= this.du("Big bang bake",					new BuildingMultiplierUpgrade(Constants.ANTIMATTER_CONDENSER_INDEX, 2));
	this.reverseCyclotronsUpgrade			= this.du("Reverse cyclotrons",				new BuildingMultiplierUpgrade(Constants.ANTIMATTER_CONDENSER_INDEX, 2));
	this.nanocosmicsUpgrade					= this.du("Nanocosmics",					new BuildingMultiplierUpgrade(Constants.ANTIMATTER_CONDENSER_INDEX, 2));
	this.ninthColorUpgrade					= this.du("9th color",						new BuildingMultiplierUpgrade(Constants.PRISM_INDEX, 2));
	this.chocolateLightUpgrade				= this.du("Chocolate light",				new BuildingMultiplierUpgrade(Constants.PRISM_INDEX, 2));
	this.grainbowUpgrade					= this.du("Grainbow",						new BuildingMultiplierUpgrade(Constants.PRISM_INDEX, 2));
	this.pureCosmicLightUpgrade				= this.du("Pure cosmic light",				new BuildingMultiplierUpgrade(Constants.PRISM_INDEX, 2));
	this.glowInTheDarkUpgrade				= this.du("Glow-in-the-dark",				new BuildingMultiplierUpgrade(Constants.PRISM_INDEX, 2));

	// Cookie production multipliers
	this.sugarCookiesUpgrade									= this.du("Sugar cookies",											new ProductionUpgrade(5));
	this.peanutButterCookiesUpgrade								= this.du("Peanut butter cookies",									new ProductionUpgrade(5));
	this.plainCookiesUpgrade									= this.du("Plain cookies",											new ProductionUpgrade(5));
	this.oatmealRaisinCookiesUpgrade							= this.du("Oatmeal raisin cookies",									new ProductionUpgrade(5));
	this.coconutCookiesUpgrade									= this.du("Coconut cookies",										new ProductionUpgrade(5));
	this.whiteChocolateCookiesUpgrade							= this.du("White chocolate cookies",								new ProductionUpgrade(5));
	this.macadamiaNutCookiesUpgrade								= this.du("Macadamia nut cookies",									new ProductionUpgrade(5));
	this.whiteChocolateMacadamiaNutCookiesUpgrade				= this.du("White chocolate macadamia nut cookies",					new ProductionUpgrade(10));
	this.doubleChipCookiesUpgrade								= this.du("Double-chip cookies",									new ProductionUpgrade(10));
	this.allChocolateCookiesUpgrade								= this.du("All-chocolate cookies",									new ProductionUpgrade(10));
	this.whiteChocolateCoatedCookiesUpgrade						= this.du("White chocolate-coated cookies",							new ProductionUpgrade(15));
	this.darkChocolateCoatedCookiesUpgrade						= this.du("Dark chocolate-coated cookies",							new ProductionUpgrade(15));
	this.eclipseCookiesUpgrade									= this.du("Eclipse cookies",										new ProductionUpgrade(15));
	this.zebraCookiesUpgrade									= this.du("Zebra cookies",											new ProductionUpgrade(15));
	this.snickerdoodlesUpgrade									= this.du("Snickerdoodles",											new ProductionUpgrade(15));
	this.stroopwafelsUpgrade									= this.du("Stroopwafels",											new ProductionUpgrade(15));
	this.empireBiscuitsUpgrade									= this.du("Empire biscuits",										new ProductionUpgrade(15));
	this.macaroonsUpgrade										= this.du("Macaroons",												new ProductionUpgrade(15));
	this.britishTeaBiscuitsUpgrade								= this.du("British tea biscuits",									new ProductionUpgrade(15));
	this.chocolateBritishTeaBiscuitsUpgrade						= this.du("Chocolate british tea biscuits",							new ProductionUpgrade(15));
	this.roundBritishTeaBiscuitsUpgrade							= this.du("Round british tea biscuits",								new ProductionUpgrade(15));
	this.roundChocolateBritishTeaBiscuitsUpgrade				= this.du("Round chocolate british tea biscuits",					new ProductionUpgrade(15));
	this.roundBritishTeaBiscuitsWithHeartMotifUpgrade			= this.du("Round british tea biscuits with heart motif",			new ProductionUpgrade(15));
	this.roundChocolateBritishTeaBiscuitsWithHeartMotifUpgrade	= this.du("Round chocolate british tea biscuits with heart motif",	new ProductionUpgrade(15));
	this.paletsUpgrade											= this.du("Palets",													new ProductionUpgrade(20));
	this.sablesUpgrade											= this.du("Sabl&eacute;s",											new ProductionUpgrade(20));
	this.madeleinesUpgrade										= this.du("Madeleines",												new ProductionUpgrade(20));
	this.palmiersUpgrade										= this.du("Palmiers",												new ProductionUpgrade(20));
	this.shortfoilsUpgrade										= this.du("Shortfoils",												new ProductionUpgrade(25));
	this.figGluttonsUpgrade										= this.du("Fig gluttons",											new ProductionUpgrade(25));
	this.loreolsUpgrade											= this.du("Loreols",												new ProductionUpgrade(25));
	this.jaffaCakesUpgrade										= this.du("Jaffa cakes",											new ProductionUpgrade(25));
	this.greasesCupsUpgrade										= this.du("Grease's cups",											new ProductionUpgrade(25));
	this.sagalongsUpgrade										= this.du("Sagalongs",												new ProductionUpgrade(25));
	this.winMintsUpgrade										= this.du("Win mints",												new ProductionUpgrade(25));
	this.caramoasUpgrade										= this.du("Caramoas",												new ProductionUpgrade(25));
	this.gingerbreadTreesUpgrade								= this.du("Gingerbread trees",										new ProductionUpgrade(25));
	this.gingerbreadMenUpgrade									= this.du("Gingerbread men",										new ProductionUpgrade(25));
	this.roseMacaronsUpgrade									= this.du("Rose macarons",											new ProductionUpgrade(30));
	this.lemonMacaronsUpgrade									= this.du("Lemon macarons",											new ProductionUpgrade(30));
	this.chocolateMacaronsUpgrade								= this.du("Chocolate macarons",										new ProductionUpgrade(30));
	this.pistachioMacaronsUpgrade								= this.du("Pistachio macarons",										new ProductionUpgrade(30));
	this.hazelnutMacaronsUpgrade								= this.du("Hazelnut macarons",										new ProductionUpgrade(30));
	this.violetMacaronsUpgrade									= this.du("Violet macarons",										new ProductionUpgrade(30));

	// Golden cookie upgrade functions
	this.luckyDayUpgrade	= this.du("Lucky day",		new GoldenCookieFrequencyUpgrade(2));
	this.serendipityUpgrade	= this.du("Serendipity",	new GoldenCookieFrequencyUpgrade(2));
	this.getLuckyUpgrade	= this.du("Get lucky",		new GoldenCookieDurationUpgrade());

	// Research upgrade functions
	this.bingoCenterResearchFacilityUpgrade	= this.du("Bingo center/Research facility",	new BuildingMultiplierUpgrade(Constants.GRANDMA_INDEX, 4));
	this.persistentMemoryUpgrade			= this.du("Persistent memory",				new NonProductionUpgrade());
	this.specializedChocolateChipsUpgrade	= this.du("Specialized chocolate chips",	new ProductionUpgrade(1));
	this.designerCocoaBeansUpgrade			= this.du("Designer cocoa beans",			new ProductionUpgrade(2));
	this.ritualRollingPinsUpgrade			= this.du("Ritual rolling pins",			new BuildingMultiplierUpgrade(Constants.GRANDMA_INDEX, 2));
	this.underworldOvensUpgrade				= this.du("Underworld ovens",				new ProductionUpgrade(3));
	this.oneMindUpgrade						= this.du("One mind",						new PerBuildingScalerUpgrade(Constants.GRANDMA_INDEX, Constants.GRANDMA_INDEX, 0.02));
	this.exoticNutsUpgrade					= this.du("Exotic nuts",					new ProductionUpgrade(4));
	this.communalBrainsweepUpgrade			= this.du("Communal brainsweep",			new PerBuildingScalerUpgrade(Constants.GRANDMA_INDEX, Constants.GRANDMA_INDEX, 0.02));
	this.arcaneSugarUpgrade					= this.du("Arcane sugar",					new ProductionUpgrade(4));
	this.elderPactUpgrade					= this.du("Elder Pact",						new PerBuildingScalerUpgrade(Constants.GRANDMA_INDEX, Constants.PORTAL_INDEX, 0.05));
	this.sacrificialRollingPinsUpgrade		= this.du("Sacrificial rolling pins",		new NonProductionUpgrade());

	// Combo upgrades, combine a couple of effects
	this.reinforcedIndexFingerUpgrade = this.du("Reinforced index finger", new ComboUpgrade([
		new BuildingBaseCpsUpgrade(Constants.CURSOR_INDEX, 0.1),
		new ClickBaseUpgrade(1)
	]));

	// Mouse and Cursor Doublers
	this.carpalTunnelPreventionCreamUpgrade = this.du("Carpal tunnel prevention cream", new ComboUpgrade([
		new BuildingMultiplierUpgrade(Constants.CURSOR_INDEX, 2),
		new ClickDoublerUpgrade()
	]));
	this.ambidextrousUpgrade = this.du("Ambidextrous", new ComboUpgrade([
		new BuildingMultiplierUpgrade(Constants.CURSOR_INDEX, 2),
		new ClickDoublerUpgrade()
	]));

	// Clicking and Cursors scale with buildings owned
	this.thousandFingersUpgrade		= this.du("Thousand fingers",		new MultifingerUpgrade(0.1));
	this.millionFingersUpgrade		= this.du("Million fingers",		new MultifingerUpgrade(0.5));
	this.billionFingersUpgrade		= this.du("Billion fingers",		new MultifingerUpgrade(2));
	this.trillionFingersUpgrade		= this.du("Trillion fingers",		new MultifingerUpgrade(10));
	this.quadrillionFingersUpgrade	= this.du("Quadrillion fingers",	new MultifingerUpgrade(20));
	this.quintillionFingersUpgrade	= this.du("Quintillion fingers",	new MultifingerUpgrade(100));
	this.sextillionFingersUpgrade	= this.du("Sextillion fingers",		new MultifingerUpgrade(200));
	this.septillionFingersUpgrade	= this.du("Septillion fingers",		new MultifingerUpgrade(400));
	this.octillionFingersUpgrade	= this.du("Octillion fingers",		new MultifingerUpgrade(800));

	// Clicking gains a percent of CpS
	this.plasticMouseUpgrade		= this.du("Plastic mouse",		new ClickCpsUpgrade(0.01));
	this.ironMouseUpgrade			= this.du("Iron mouse",			new ClickCpsUpgrade(0.01));
	this.titaniumMouseUpgrade		= this.du("Titanium mouse",		new ClickCpsUpgrade(0.01));
	this.adamantiumMouseUpgrade		= this.du("Adamantium mouse",	new ClickCpsUpgrade(0.01));
	this.unobtainiumMouseUpgrade	= this.du("Unobtainium mouse",	new ClickCpsUpgrade(0.01));
	this.eludiumUpgrade				= this.du("Eludium mouse",		new ClickCpsUpgrade(0.01));
	this.wishalloyUpgrade			= this.du("Wishalloy mouse",	new ClickCpsUpgrade(0.01));

	// Milk upgrades
	this.kittenHelpersUpgrade	= this.du("Kitten helpers",		new MilkUpgrade(0.05));
	this.kittenWorkersUpgrade	= this.du("Kitten workers",		new MilkUpgrade(0.1));
	this.kittenEngineersUpgrade	= this.du("Kitten engineers",	new MilkUpgrade(0.2));
	this.kittenOverseersUpgrade	= this.du("Kitten overseers",	new MilkUpgrade(0.2));
	this.kittenManagersUpgrade	= this.du("Kitten managers",	new MilkUpgrade(0.2));

	// Heavenly chip unlocks
	this.heavenlyChipSecretUpgrade		= this.du("Heavenly chip secret",	new HeavenlyUnlockUpgrade(0.05));
	this.heavenlyCookieStandUpgrade		= this.du("Heavenly cookie stand",	new HeavenlyUnlockUpgrade(0.20));
	this.heavenlyBakeryUpgrade			= this.du("Heavenly bakery",		new HeavenlyUnlockUpgrade(0.25));
	this.heavenlyConfectioneryUpgrade	= this.du("Heavenly confectionery",	new HeavenlyUnlockUpgrade(0.25));
	this.heavenlyKeyUpgrade				= this.du("Heavenly key",			new HeavenlyUnlockUpgrade(0.25));
}

UpgradeInfo.prototype.getUpgradeFunction = function(name) {
	if (this.upgradeFunctions[name] == undefined) {
		this.upgradeFunctions[name] = new NonProductionUpgrade();
		console.log("Unknown upgrade: " + name);
	}
	return this.upgradeFunctions[name];
}

//
// Classes to represent upgrades and tie them to game purchases
//

// PurchasableItems
function PurchasableItem(item) {
	this.item = item;
	this.upgradeFunction = upgradeInfo.getUpgradeFunction(this.item.name);
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
var upgradeInfo = new UpgradeInfo();
var ultimateCookie = new UltimateCookie();

if (Constants.DEBUG) {
	console.log("Ultimate Cookie started at " + new Date());
}

