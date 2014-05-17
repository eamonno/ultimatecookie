var Constants = {};
var Config = {};

Config.autoClick = true;
Config.autoClickGoldenCookies = true;
Config.autoClickReindeer = true;
Config.autoReset = false;
Config.autoBuy = true;
Config.autoDismissNotes = false;
Config.autoSwitchSeasons = true;
Config.autoPledge = true;
Config.autoPopWrinklers = true;
Config.skipHalloween = false;
Config.resetLimit = 1.1;
Config.maintainCookieBank = true;

// General purpose constants
Constants.AUTO_BUY_MIN_INTERVAL = 1;
Constants.AUTO_BUY_MAX_INTERVAL = 1000;
Constants.AUTO_CLICK_INTERVAL = 1;
Constants.AUTO_UPDATE_INTERVAL = 1000;
Constants.CLICK_RATE_ESTIMATE_SAMPLES = 120;
Constants.DEBUG = true;
Constants.NOTE_DISMISS_DELAY = 10000;
Constants.FRENZY_MULTIPLIER = 7;			// Frenzy multiplies CpS by 7
Constants.CLICK_FRENZY_MULTIPLIER = 777;	// Click frenzies give 777x cookier per click
Constants.REINDEER_CPS_MULTIPLIER = 60;		// Reindeer provide 60 seconds of CpS
Constants.REINDEER_MIN_COOKIES = 25;		// Reindeer give at least 25 cookies
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

// Elder Wrath levels
Constants.APPEASED = 0;
Constants.AWOKEN = 1;
Constants.DISPLEASED = 2;
Constants.ANGERED = 3;

// Season names
Constants.NO_SEASON = "";
Constants.BUSINESS_DAY = "fools";
Constants.CHRISTMAS = "christmas";
Constants.EASTER = "easter";
Constants.HALLOWEEN = "halloween";
Constants.VALENTINES_DAY = "valentines";
Constants.MAX_SANTA_LEVEL = 14;
Constants.NUM_CHRISTMAS_UPGRADES = 37;
Constants.NUM_EASTER_UPGRADES = 100;	// 2
Constants.NUM_VALENTINES_UPGRADES = 6;
Constants.NUM_HALLOWEEN_UPGRADES = 7;

var seasons = {};
seasons[Constants.BUSINESS_DAY] = {
	name: Constants.BUSINESS_DAY,
	numUpgrades: 0,
};
seasons[Constants.CHRISTMAS] = {
	name: Constants.CHRISTMAS,
	numUpgrades: 37,
};
seasons[Constants.EASTER] = {
	name: Constants.EASTER,
	numUpgrades: 100,	// 2
};
seasons[Constants.HALLOWEEN] = {
	name: Constants.HALLOWEEN,
	numUpgrades: 7,
};
seasons[Constants.VALENTINES] = {
	name: Constants.VALENTINES,
	numUpgrades: 6,
};

//
// UltimateCookie represents the app itself
//

function UltimateCookie() {
	this.autoBuyInterval = -1;
	this.lastDeterminedPurchase = "";
	this.lastPurchaseTime = new Date();
	this.lastClickRateCheckTime = this.lastPurchaseTime;
	this.lastClickCount = Game.cookieClicks;
	this.clickRates = [100];
	this.clickRate = 100;
	this.lockSeasons = false;
	this.matchError = "";

	this.updateAutoClicker(Constants.AUTO_CLICK_INTERVAL);
	this.updateAutoUpdater(Constants.AUTO_UPDATE_INTERVAL);
	this.updateAutoBuyer(Constants.AUTO_BUY_MIN_INTERVAL);
}

UltimateCookie.prototype.updateAutoClicker = function(interval) {
	clearInterval(this.autoClicker);
	if (interval) {
		var t = this;
		this.autoClicker = setInterval(function() { if (Config.autoClick) t.click(); }, interval);
	}
}

UltimateCookie.prototype.updateAutoUpdater = function(interval) {
	clearInterval(this.autoUpdater);
	if (interval) {
		var t = this;
		this.autoUpdater = setInterval(function() { t.update(); }, interval);
	}
}

UltimateCookie.prototype.updateAutoBuyer = function(interval) {
	interval = Math.max(Constants.AUTO_BUY_MIN_INTERVAL, interval);
	interval = Math.min(Constants.AUTO_BUY_MAX_INTERVAL, interval);

	if (interval != this.autoBuyInterval) {
		clearInterval(this.autoBuyer);
		var t = this;
		this.autoBuyer = setInterval(function() { if (Config.autoBuy) t.buy(); }, interval);
		this.autoBuyInterval = interval;
	}
}

UltimateCookie.prototype.rankPurchases = function(eval) {
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
	console.clear();
	var e = new Evaluator();
	e.syncToGame();
	var p1 = ultimateCookie.rankPurchases();
	for (var p = p1.length - 1; p >= 0; --p) {
		console.log(p1[p].name + "(" + p1[p].getValue(e) + ")");
	}
}

UltimateCookie.prototype.comparePurchases = function(eval, a, b) {
	// If autoPledge is active, Elder Pledge trumps all
	if (Config.autoPledge && (eval.season != Constants.HALLOWEEN || eval.missingSeasonUpgrades[Constants.HALLOWEEN] == 0)
			&& (eval.season != Constants.EASTER || eval.missingSeasonUpgrades[Constants.EASTER] == 0)) {
		if (a.beginsElderPledge && !b.beginsElderPledge) {
			return -1;
		} else if (b.beginsElderPledge && !a.beginsElderPledge) {
			return 1;
		}
	}

	var eCps = eval.getEffectiveCps();
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
	// Add santa level
	if (Game.season == Constants.CHRISTMAS && Game.santaLevel < Constants.MAX_SANTA_LEVEL) {
		purchases.push(upgradeFunctions.santaLevel);
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
		console.log("Next purchase: " + this.lastDeterminedPurchase);
	}
	return purchases[p];
}

UltimateCookie.prototype.click = function() {
	Game.ClickCookie();
}

UltimateCookie.prototype.buy = function() {
	// Get an Evaluator synced to the current game
	var currentGame = new Evaluator();
	currentGame.syncToGame();

	this.matchError = currentGame.matchesGame();
	if (!this.matchError) {
		// If all upgrades for current season are bought, unlock season switching
		if (currentGame.season == Constants.CHRISTMAS) {
			this.lockSeasons = (currentGame.santaLevel != Constants.MAX_SANTA_LEVEL);
		} else {
			this.lockSeasons = (currentGame.missingSeasonUpgrades[currentGame.season] > 0);
		}

		var nextPurchase = this.determineNextPurchase(currentGame);
		// Shutdown if out of sync
		var cookieBank = currentGame.getCookieBankSize(Game.goldenCookie.time / Game.fps, Game.frenzy / Game.fps);
		// Cap cookie bank at 5% of total cookies earned
		cookieBank = Math.min(Game.cookiesEarned / 20, cookieBank);
		var time = new Date();
		if (Game.cookies - cookieBank > nextPurchase.getCost()) {
			this.lastPurchaseTime = time;
			this.updateAutoBuyer(Constants.AUTO_BUY_MIN_INTERVAL);
			if (Config.autoBuy || (Config.autoPledge && nextPurchase.beginsElderPledge)) {
				nextPurchase.purchase();
			}
		} else {
			this.updateAutoBuyer((time - this.lastPurchaseTime) / 2)
		}

		if (Config.autoPopWrinklers && Game.season == Constants.HALLOWEEN && currentGame.missingSeasonUpgrades[Constants.HALLOWEEN] != 0) {
			for (var w in Game.wrinklers) {
				if (Game.wrinklers[w].sucked > 0) {
					Game.wrinklers[w].hp = 0;
				}
			}
		}
	}
}

UltimateCookie.prototype.update = function() {
	var now = new Date();

	if (now - this.lastClickRateCheckTime >= 1000) {
		var newClicks = Game.cookieClicks - this.lastClickCount;
		if (newClicks > 0) {
			var newRate = newClicks * 1000 / (now - this.lastClickRateCheckTime);
			this.clickRates.push(newRate);
			while (this.clickRates.length > Constants.CLICK_RATE_ESTIMATE_SAMPLES) {
				this.clickRates.shift();
			}
			var sum = 0;
			for (var i = 0; i < this.clickRates.length; ++i)
				sum += this.clickRates[i];
			this.clickRate = Math.floor(sum / this.clickRates.length);
			//console.log("Click rate - Last Second: " + Math.floor(newRate) +", Average: " + this.clickRate);
		}
		this.lastClickCount = Game.cookieClicks;
		this.lastClickRateCheckTime = now;
	}
	if (Config.autoDismissNotes && Game.Notes.length > 0) {
		var n = 0;
		while (n < Game.Notes.length && now - Game.Notes[n].date < Constants.NOTE_DISMISS_DELAY)
			++n;
		if (n < Game.Notes.length) {
			Game.CloseNote(Game.Notes[n].id);
		}
	}
	if (Config.autoClickGoldenCookies) {
		if (Game.goldenCookie.life > 0 && Game.goldenCookie.toDie == 0) {
			Game.goldenCookie.click();
		}
	}
	if (Config.autoClickReindeer) {
		Game.seasonPopup.click();
	}
	if (Config.autoReset) {
		// Wait until frenzy or clickFrenzy is over to reset
		if (!Game.frenzy && !Game.clickFrenzy) {
			var hcs = Game.HowMuchPrestige(Game.cookiesReset);
			var resethcs = Game.HowMuchPrestige(Game.cookiesReset + Game.cookiesEarned);

			var scaleNow = 1 + hcs * 0.02;
			var scaleReset = 1 + resethcs * 0.02;

			if (scaleReset / scaleNow >= Config.resetLimit) {
				console.log("Resetting game. HCs now: " + hcs + ", HCs after reset: " + resethcs + ", time: " + now);
				this.lastPurchaseTime = now;
				Game.Reset(1, 0);
			}
		}
	}
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
	return Math.ceil(this.evaluator.buildingCostScale * this.baseCost * Math.pow(1.15, this.quantity));
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
	this.cpcBaseMultiplier = 1;
	this.cpcCpsMultiplier = 0;

	// Production multiplier
	this.productionMultiplier = 0;
	this.globalProductionMultiplier = 0;

	// Heavenly chips
	this.heavenlyChips = 0;
	this.heavenlyPower = 0;

	// Milk scaling
	this.milkAmount = 0;
	this.milkMultiplier = 1;
	this.milkUnlocks = [];

	// Game status indicators
	this.frenzy = 0
	this.frenzyPower = 1;
	this.clickFrenzy = 0;

	// Golden cookie and reindeer information
	this.frenzyDuration = 77;
	this.goldenCookieTime = 300;
	this.reindeerTime = 180;
	this.reindeerMultiplier = 1;

	// Elder covenant and Grandmatriarch stuff
	this.grandmatriarchStatus = Constants.APPEASED;
	this.elderCovenant = false;	// 5% reduction in CpS

	// Santa level
	this.santaLevel = 0;
	this.santaPower = 0;

	// Building cost reduction
	this.buildingCostScale = 1;

	// Current season
	this.season = Constants.NO_SEASON;
	this.resetSeasonUpgradeCounters();
}

Evaluator.prototype.resetSeasonUpgradeCounters = function() {
	this.missingSeasonUpgrades = this.missingSeasonUpgrades || {};
	this.missingSeasonUpgrades[Constants.NO_SEASON] = 0;
	this.missingSeasonUpgrades[Constants.BUSINESS_DAY] = 0;
	this.missingSeasonUpgrades[Constants.CHRISTMAS] = Constants.NUM_CHRISTMAS_UPGRADES;
	this.missingSeasonUpgrades[Constants.EASTER] = Constants.NUM_EASTER_UPGRADES;
	this.missingSeasonUpgrades[Constants.HALLOWEEN] = Constants.NUM_HALLOWEEN_UPGRADES;
	this.missingSeasonUpgrades[Constants.VALENTINES_DAY] = Constants.NUM_VALENTINES_UPGRADES;
}

// Check that the values in the evaluator match those of the game, for debugging use
Evaluator.prototype.matchesGame = function() {
	var errMsg = "";
	// Check that Cps matches the game
	if (!floatEqual(this.getCps(), Game.cookiesPs)) {
		if (!errMsg) { errMsg += "Evaluator Mismatch:\n"; }
		errMsg += "- CpS - Predicted: " + this.getCps() + ", Actual: " + Game.cookiesPs + "\n";
	}
	// Check the Cpc matches the game
	if (!floatEqual(this.getCpc(), Game.mouseCps())) {
		if (!errMsg) { errMsg += "Evaluator Mismatch:\n"; }
		errMsg += "- CpC - Predicted: " + this.getCpc() + ", Actual: " + Game.mouseCps() + "\n";
	}
	// Check the building costs match the game
	var i;
	for (i = 0; i < this.buildings.length; ++i) {
		if (!floatEqual(this.buildings[i].getCost(), Game.ObjectsById[i].getPrice())) {
			if (!errMsg) { errMsg += "Evaluator Mismatch:\n"; }
			errMsg += "- Building Cost " + i + " - Predicted: " + this.buildings[i].getCost() + ", Actual: " + Game.ObjectsById[i].getPrice() + "\n";
		}
		if (!floatEqual(this.buildings[i].getIndividualCps(), Game.ObjectsById[i].cps())) {
			if (!errMsg) { errMsg += "Evaluator Mismatch:\n"; }
			errMsg += "- Building CpS " + i + " - Predicted: " + this.buildings[i].getIndividualCps() + ", Actual: " + Game.ObjectsById[i].cps() + "\n";
		}
	}
	// Check that all available upgrade costs match those of similar upgrade functions
	for (i = 0; i < Game.UpgradesInStore.length; ++i) {
		var u = Game.UpgradesInStore[i];
		var uf = getUpgradeFunction(u.name);
		if (uf.setsSeason == undefined && !floatEqual(uf.getCost(), u.getPrice())) {
			if (!errMsg) { errMsg += "Evaluator Mismatch:\n"; }
			errMsg += "- Upgrade Cost " + u.name + " - Predicted: " + uf.getCost() + ", Actual: " + u.getPrice() + "\n";
		}
	}

	return errMsg;
}

// Get the current cookies per click amount
Evaluator.prototype.getCpc = function() {
	var cpc = this.cpcBase * this.cpcBaseMultiplier;			// Base cpc
	cpc += this.buildings[Constants.CURSOR_INDEX].buildingScaler.getScale(this.buildings);	// Add building scaled cpc
	cpc += this.getCps() * this.cpcCpsMultiplier;				// Add in percentage click scaling
	cpc *= this.cpcMultiplier;									// Multiply by total multiplier
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
	var santaScale = (this.santaLevel + 1) * this.santaPower * 0.01;
	var productionScale = this.productionMultiplier * 0.01;
	var heavenlyScale = this.heavenlyChips * this.heavenlyPower * 0.02;
	cps *= (1 + santaScale + productionScale + heavenlyScale);
	// Scale it for milk
	var milkScale = 1;
	for (i = 0; i < this.milkUnlocks.length; ++i) {
		milkScale *= (1 + this.milkUnlocks[i] * this.milkAmount * this.milkMultiplier * 0.01);
	}
	cps *= milkScale;
	// Scale it for global production
	cps *= (100 + this.globalProductionMultiplier) * 0.01;

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
	var cpc = this.getCpc();
	this.frenzy = frenzy;
	this.clickFrenzy = clickFrenzy;
	this.frenzyMultiplier = frenzyMultiplier;
	return cpc;
}

Evaluator.prototype.getReindeerCps = function() {
	if (this.season == Constants.CHRISTMAS) {
		var frenzycookies = Math.max(Constants.REINDEER_MIN_COOKIES, this.getFrenziedCps(Constants.FRENZY_MULTIPLIER) * Constants.REINDEER_CPS_MULTIPLIER);
		var normalcookies = Math.max(Constants.REINDEER_MIN_COOKIES, this.getFrenziedCps(1) * Constants.REINDEER_CPS_MULTIPLIER);
		var frenzyChance = this.frenzyDuration / (this.goldenCookieTime * 2);
		return (frenzycookies * frenzyChance + normalcookies * (1 - frenzyChance)) * this.reindeerMultiplier / this.reindeerTime;
	} else {
		return 0;
	}
}

// Estimate the extra CpS contribution from collecting all golden cookies
// Assumes max click rate and that golden cookies just follow the simple pattern
// of Frenzy followed by Lucky and appear at the minimum spawn time every time.
// Not 100% accurate but near enough to give a decent estimation.
Evaluator.prototype.getGoldenCookieCps = function() {
	// If we dont click them, they don't work
	if (!Config.autoClickGoldenCookies) {
		return 0;
	}
	// Add gains from a single full duration frenzy
	var totalGain = 0;
	totalGain += (this.getFrenziedCps(Constants.FRENZY_MULTIPLIER) - this.getFrenziedCps(1)) * this.frenzyDuration;
	totalGain += (this.getFrenziedCpc(Constants.FRENZY_MULTIPLIER) - this.getFrenziedCpc(1)) * this.frenzyDuration * ultimateCookie.clickRate;

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
	return this.getCps() + this.getCpc() * ultimateCookie.clickRate;
}

// Calculate the effective Cps at the current games click rate
Evaluator.prototype.getEffectiveCps = function() {
	return this.getFrenziedCps(1) + this.getFrenziedCpc(1) * ultimateCookie.clickRate + this.getGoldenCookieCps() + this.getReindeerCps();
}

// Get the current required cookie bank size, accounts for time until the
// next golden cookie appears
Evaluator.prototype.getCookieBankSize = function(timeSinceLastGoldenCookie, frenzyTimeRemaining) {
	// Don't need one if not clicking golden cookies
	if (!Config.maintainCookieBank) {
		return 0;
	}
	var totalCookieBankRequired = this.getFrenziedCps(1) * Constants.LUCKY_COOKIE_BANK_TIME * 10 * Constants.FRENZY_MULTIPLIER;
	var timeRemaining = Math.max(this.goldenCookieTime - timeSinceLastGoldenCookie, 0);
	var frenziedCps = this.getFrenziedCps(Constants.FRENZY_MULTIPLIER) + this.getFrenziedCpc(Constants.FRENZY_MULTIPLIER) * ultimateCookie.clickRate;
	var unfrenziedCps = this.getFrenziedCps(1) + this.getFrenziedCpc(1) * ultimateCookie.clickRate;

	totalCookieBankRequired -= Math.min(timeRemaining, frenzyTimeRemaining) * frenziedCps;
	totalCookieBankRequired -= Math.max(timeRemaining - frenzyTimeRemaining, 0) * unfrenziedCps;

	return totalCookieBankRequired;
}

// Sync an evaluator with the current in game store
Evaluator.prototype.syncToGame = function() {
	this.resetSeasonUpgradeCounters();
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
	this.missingSeasonUpgrades[Constants.CHRISTMAS] -= Game.santaLevel;
	this.season = Game.season;
}

//
// Classes to represent upgrades
//

var upgradeFunctions = {}
var upgradeIndex = {}

Upgrade = function(name) {
	this.name = name;
}

Upgrade.prototype.applyUpgrade = function(eval) {
	if (this.buildsIndex != undefined)
		eval.buildings[this.buildsIndex].quantity += this.buildsQuantity;
	if (this.boostsBuildingIndex != undefined)
		eval.buildings[this.boostsBuildingIndex].baseCps += this.boostsBuildingAmount;
	if (this.scalesBuildingIndex != undefined)
		eval.buildings[this.scalesBuildingIndex].multiplier *= this.scalesBuildingScale;
	if (this.productionBoost != undefined)
		eval.productionMultiplier += this.productionBoost;
	if (this.globalProductionBoost != undefined)
		eval.globalProductionMultiplier += this.globalProductionBoost;
	if (this.goldenCookieFrequencyScale != undefined)
		eval.goldenCookieTime /= this.goldenCookieFrequencyScale;
	if (this.goldenCookieDurationScale != undefined)
		eval.frenzyDuration *= this.goldenCookieDurationScale;
	if (this.givesPerBuildingBoostTo != undefined)
		eval.buildings[this.givesPerBuildingBoostTo].buildingBaseScaler.scaleOne(this.givesPerBuildingBoostFrom, this.givesPerBuildingBoostAmount);
	if (this.enablesElderCovenant != undefined)
		eval.elderCovenant = true;
	if (this.disablesElderCovenant != undefined)
		eval.elderCovenant = false;
	if (this.clickBoost != undefined)
		eval.cpcBase += this.clickBoost;
	if (this.baseClickScale != undefined)
		eval.cpcBaseMultiplier *= this.baseClickScale;
	if (this.givesTotalBuildingBonusTo != undefined) {
		eval.buildings[this.givesTotalBuildingBonusTo].buildingScaler.scaleAll(this.givesTotalBuildingBonusAmount);
		eval.buildings[this.givesTotalBuildingBonusTo].buildingScaler.scaleOne(this.givesTotalBuildingBonusExcluding, -this.givesTotalBuildingBonusAmount);
	}
	if (this.makesGrandmasAngry)
		eval.grandmatriarchStatus++;
	if (this.clickCpsBoost != undefined)
		eval.cpcCpsMultiplier += this.clickCpsBoost;
	if (this.milkUnlock != undefined) {
		eval.milkUnlocks.push(this.milkUnlock);
		eval.milkUnlocks.sort();
	}
	if (this.heavenlyPowerBoost != undefined)
		eval.heavenlyPower += this.heavenlyPowerBoost;
	if (this.buildingCostScale != undefined)
		eval.buildingCostScale *= this.buildingCostScale;
	if (this.totalClickScale != undefined)
		eval.cpcMultiplier *= this.totalClickScale;
	if (this.santaPowerBoost != undefined)
		eval.santaPower += this.santaPowerBoost;
	if (this.milkScale != undefined)
		eval.milkMultiplier *= this.milkScale;
	if (this.increasesSantaLevel != undefined)
		++eval.santaLevel;
	if (this.reindeerFrequencyScale != undefined)
		eval.reindeerTime /= this.reindeerFrequencyScale;
	if (this.reindeerScale != undefined)
		eval.reindeerMultiplier *= this.reindeerScale;
	if (this.setsSeason != undefined) {
		this.restoreSeason = eval.season;
		eval.season = this.setsSeason;
	}
	if (this.season != undefined)
		eval.missingSeasonUpgrades[this.season]--;
}

Upgrade.prototype.revokeUpgrade = function(eval) {
	if (this.buildsIndex != undefined)
		eval.buildings[this.buildsIndex].quantity -= this.buildsQuantity;
	if (this.boostsBuildingIndex != undefined)
		eval.buildings[this.boostsBuildingIndex].baseCps -= this.boostsBuildingAmount;
	if (this.scalesBuildingIndex != undefined)
		eval.buildings[this.scalesBuildingIndex].multiplier /= this.scalesBuildingScale;
	if (this.productionBoost != undefined)
		eval.productionMultiplier -= this.productionBoost;
	if (this.globalProductionBoost != undefined)
		eval.globalProductionMultiplier -= this.globalProductionBoost;
	if (this.goldenCookieFrequencyScale != undefined)
		eval.goldenCookieTime *= this.goldenCookieFrequencyScale;
	if (this.goldenCookieDurationScale != undefined)
		eval.frenzyDuration /= this.goldenCookieDurationScale;
	if (this.givesPerBuildingBoostTo != undefined)
		eval.buildings[this.givesPerBuildingBoostTo].buildingBaseScaler.scaleOne(this.givesPerBuildingBoostFrom, -this.givesPerBuildingBoostAmount);
	if (this.enablesElderCovenant != undefined)
		eval.elderCovenant = false;
	if (this.disablesElderCovenant != undefined)
		eval.elderCovenant = true;
	if (this.clickBoost != undefined)
		eval.cpcBase -= this.clickBoost;
	if (this.baseClickScale != undefined)
		eval.cpcBaseMultiplier /= this.baseClickScale;
	if (this.givesTotalBuildingBonusTo != undefined) {
		eval.buildings[this.givesTotalBuildingBonusTo].buildingScaler.scaleAll(-this.givesTotalBuildingBonusAmount);
		eval.buildings[this.givesTotalBuildingBonusTo].buildingScaler.scaleOne(this.givesTotalBuildingBonusExcluding, this.givesTotalBuildingBonusAmount);
	}
	if (this.makesGrandmasAngry)
		eval.grandmatriarchStatus--;
	if (this.clickCpsBoost != undefined)
		eval.cpcCpsMultiplier -= this.clickCpsBoost;
	if (this.milkUnlock != undefined)
		eval.milkUnlocks.splice(eval.milkUnlocks.indexOf(this.milkUnlock), 1);
	if (this.heavenlyPowerBoost != undefined)
		eval.heavenlyPower -= this.heavenlyPowerBoost;
	if (this.buildingCostScale != undefined)
		eval.buildingCostScale /= this.buildingCostScale;
	if (this.totalClickScale != undefined)
		eval.cpcMultiplier /= this.totalClickScale;
	if (this.santaPowerBoost != undefined)
		eval.santaPower -= this.santaPowerBoost;
	if (this.milkScale != undefined)
		eval.milkMultiplier /= this.milkScale;
	if (this.increasesSantaLevel != undefined)
		--eval.santaLevel;
	if (this.reindeerFrequencyScale != undefined)
		eval.reindeerTime *= this.reindeerFrequencyScale;
	if (this.reindeerScale != undefined)
		eval.reindeerMultiplier /= this.reindeerScale;
	if (this.restoreSeason != undefined) {
		eval.season = this.restoreSeason;
		this.restoreSeason = null;
	}
	if (this.season != undefined)
		eval.missingSeasonUpgrades[this.season]++;
}

Upgrade.prototype.getVariableName = function() {
	var s = this.name;
	s = s.replace("9th", "ninth");
	s = s.replace("&eacute;", "e");
	s = s.replace("'", "");
	s = s.replace(/\W\w/g, function(s) { return s.toUpperCase(); } );
	s = s.replace(/\W+/g, "");
	s = s.replace(/^\w/g, function(s) { return s.toLowerCase(); } );
	return s;
}

Upgrade.prototype.getGameObject = function() {
	if (this.buildsIndex != undefined)
		return Game.ObjectsById[this.buildsIndex];
	else
		return Game.Upgrades[this.name];
}

Upgrade.prototype.getCost = function() {
	if (this.setsSeason == Constants.VALENTINES_DAY) {
		return Math.max(upgradeFunctions.pureHeartBiscuits.getCost(), this.getGameObject().getPrice());
	}
	if (!Config.skipHalloween && this.setsSeason == Constants.HALLOWEEN) {
		return Math.max(upgradeFunctions.skullCookies.getCost(), this.getGameObject().getPrice());
	}
	if (this == upgradeFunctions.santaLevel) {
		return Math.pow(Game.santaLevel + 1, Game.santaLevel + 1)
	}
	return this.getGameObject().getPrice();
}

Upgrade.prototype.purchase = function() {
	if (this == upgradeFunctions.santaLevel) {
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
	} else {
		this.getGameObject().buy(1);
	}
}

Upgrade.prototype.getEffectiveCps = function(eval) {
	var cps = eval.getEffectiveCps();
	this.applyUpgrade(eval);
	cps = eval.getEffectiveCps() - cps;
	this.revokeUpgrade(eval);
	return cps;
}

Upgrade.prototype.getValue = function(eval) {
	var val = this.getEffectiveCps(eval);
	if (this.valueFromTotalCps)
		val += eval.getEffectiveCps() * this.valueFromTotalCps;
	if (this.doublesElderPledgeDuration) {
		val += upgradeFunctions.elderPledge.getCost() / 3600;
	}
	if (this.setsSeason == Constants.VALENTINES_DAY && eval.missingSeasonUpgrades[Constants.VALENTINES_DAY] > 0) {
		val = upgradeFunctions.pureHeartBiscuits.getValue(eval);
	}
	if (this.setsSeason == Constants.EASTER && eval.missingSeasonUpgrades[Constants.EASTER] > 0) {
		if (eval.grandmatriarchStatus >= Constants.AWOKEN) {
			val = upgradeFunctions.chickenEgg.getValue(eval);
		}
	}
	if (this.setsSeason == Constants.HALLOWEEN && eval.missingSeasonUpgrades[Constants.HALLOWEEN] > 0) {
		if (eval.grandmatriarchStatus >= Constants.AWOKEN && !Config.skipHalloween) {
			val = upgradeFunctions.skullCookies.getValue(eval);
		}
	}
	return val;
}

Upgrade.prototype.builds = function(index, quantity) {
	this.buildsIndex = index;
	this.buildsQuantity = quantity;
	return this;
}

Upgrade.prototype.boostsBuilding = function(index, amount) {
	this.boostsBuildingIndex = index;
	this.boostsBuildingAmount = amount;
	return this;
}

Upgrade.prototype.scalesBuilding = function(index, scale) {
	this.scalesBuildingIndex = index;
	this.scalesBuildingScale = scale;
	return this;
}

Upgrade.prototype.boostsProduction = function(amount) {
	this.productionBoost = amount;
	return this;
}

Upgrade.prototype.boostsGlobalProduction = function(amount) {
	this.globalProductionBoost = amount;
	return this;
}

Upgrade.prototype.scalesGoldenCookieFrequency = function(scale) {
	this.goldenCookieFrequencyScale = scale;
	return this;
}

Upgrade.prototype.scalesGoldenCookieDuration = function(scale) {
	this.goldenCookieDurationScale = scale;
	return this;
}

Upgrade.prototype.boostsResearch = function() {
	this.isResearchBooster = true;
	return this;
}

Upgrade.prototype.startsResearch = function() {
	this.isResearchStarter = true;
	return this;
}

Upgrade.prototype.startsElderCovenant = function() {
	this.enablesElderCovenant = true;
	return this;
}

Upgrade.prototype.endsElderCovenant = function() {
	this.disablesElderCovenant = true;
	return this;
}

Upgrade.prototype.startsElderPledge = function() {
	this.beginsElderPledge = true;
	return this;
}

Upgrade.prototype.doublesElderPledge = function() {
	this.doublesElderPledgeDuration = true;
	return this;
}

Upgrade.prototype.givesPerBuildingBoost = function(receiver, source, amount) {
	this.givesPerBuildingBoostTo = receiver;
	this.givesPerBuildingBoostFrom = source;
	this.givesPerBuildingBoostAmount = amount;
	return this;
}

Upgrade.prototype.givesTotalBuildingBonus = function(receiver, exclude, amount) {
	this.givesTotalBuildingBonusTo = receiver;
	this.givesTotalBuildingBonusExcluding = exclude;
	this.givesTotalBuildingBonusAmount = amount;
	return this;
}

Upgrade.prototype.boostsClicking = function(amount) {
	this.clickBoost = amount;
	return this;
}

Upgrade.prototype.angersGrandmas = function() {
	this.makesGrandmasAngry = true;
	return this;
}

Upgrade.prototype.scalesBaseClicking = function(scale) {
	this.baseClickScale = scale;
	return this;
}

Upgrade.prototype.boostsClickCps = function(amount) {
	this.clickCpsBoost = amount;
	return this;
}

Upgrade.prototype.unlocksMilk = function(amount) {
	this.milkUnlock = amount;
	return this;
}

Upgrade.prototype.boostsHeavenlyPower = function(amount) {
	this.heavenlyPowerBoost = amount;
	return this;
}

Upgrade.prototype.unlocksSantaLevels = function() {
	this.valueFromTotalCps = (this.valueFromTotalCps ? this.valueFromTotalCps : 0) + 0.01;
	return this;
}

Upgrade.prototype.scalesBuildingCost = function(scale) {
	this.valueFromTotalCps = (this.valueFromTotalCps ? this.valueFromTotalCps : 0) + (1 - scale);
	this.buildingCostScale = scale;
	return this;
}

Upgrade.prototype.reducesUpgradeCost = function(amount) {
	this.valueFromTotalCps = (this.valueFromTotalCps ? this.valueFromTotalCps : 0) + 0.0001 * amount;
	return this;
}

Upgrade.prototype.increasesRandomDropChance = function(amount) {
	this.valueFromTotalCps = (this.valueFromTotalCps ? this.valueFromTotalCps : 0) + 0.0001 * amount;
	return this;
}

Upgrade.prototype.scalesTotalClicking = function(scale) {
	this.totalClickScale = scale;
	return this;
}

Upgrade.prototype.boostsSantaPower = function(amount) {
	this.santaPowerBoost = amount;
	return this;
}

Upgrade.prototype.increasesSantasLevel = function() {
	this.valueFromTotalCps = (this.valueFromTotalCps ? this.valueFromTotalCps : 0) + 0.005;
	this.increasesSantaLevel = true;
	return this;
}

Upgrade.prototype.scalesMilk = function(scale) {
	this.milkScale = scale;
	return this;
}

Upgrade.prototype.slowsReindeer = function(scale) {
	// Set a tiny percentage CPS value just to buy it
	this.valueFromTotalCps = (this.valueFromTotalCps ? this.valueFromTotalCps : 0) + 0.0001;
	return this;
}

Upgrade.prototype.scalesReindeerFrequency = function(scale) {
	this.reindeerFrequencyScale = scale;
	return this;
}

Upgrade.prototype.scalesReindeer = function(scale) {
	this.reindeerScale = scale;
	return this;
}

Upgrade.prototype.unlocksSeasonSwitching = function() {
	this.valueFromTotalCps = (this.valueFromTotalCps ? this.valueFromTotalCps : 0) + 0.05;
	this.unlocksSeasons = true;
	return this;
}

Upgrade.prototype.changesSeason = function(season) {
	this.setsSeason = season;
	return this;
}

Upgrade.prototype.forSeason = function(season) {
	this.season = season;
}

upgrade = function(name) {
	var u = new Upgrade(name);
	upgradeIndex[name] = u;
	upgradeFunctions[u.getVariableName()] = u;
	return u;
}

// Upgrades for the basic building types
upgrade("Cursor"				).builds(Constants.CURSOR_INDEX, 1);
upgrade("Grandma"				).builds(Constants.GRANDMA_INDEX, 1);
upgrade("Farm"					).builds(Constants.FARM_INDEX, 1);
upgrade("Factory"				).builds(Constants.FACTORY_INDEX, 1);
upgrade("Mine"					).builds(Constants.MINE_INDEX, 1);
upgrade("Shipment"				).builds(Constants.SHIPMENT_INDEX, 1);
upgrade("Alchemy lab"			).builds(Constants.ALCHEMY_LAB_INDEX, 1);
upgrade("Portal"				).builds(Constants.PORTAL_INDEX, 1);
upgrade("Time machine"			).builds(Constants.TIME_MACHINE_INDEX, 1);
upgrade("Antimatter condenser"	).builds(Constants.ANTIMATTER_CONDENSER_INDEX, 1);
upgrade("Prism"					).builds(Constants.PRISM_INDEX, 1);

// Upgrades that increase basic building cps
upgrade("Forwards from grandma"		).boostsBuilding(Constants.GRANDMA_INDEX, 0.3);
upgrade("Cheap hoes"				).boostsBuilding(Constants.FARM_INDEX, 1);
upgrade("Sturdier conveyor belts"	).boostsBuilding(Constants.FACTORY_INDEX, 4);
upgrade("Sugar gas"					).boostsBuilding(Constants.MINE_INDEX, 10);
upgrade("Vanilla nebulae"			).boostsBuilding(Constants.SHIPMENT_INDEX, 30);
upgrade("Antimony"					).boostsBuilding(Constants.ALCHEMY_LAB_INDEX, 100);
upgrade("Ancient tablet"			).boostsBuilding(Constants.PORTAL_INDEX, 1666);
upgrade("Flux capacitors"			).boostsBuilding(Constants.TIME_MACHINE_INDEX, 9876);
upgrade("Sugar bosons"				).boostsBuilding(Constants.ANTIMATTER_CONDENSER_INDEX, 99999);
upgrade("Gem polish"				).boostsBuilding(Constants.PRISM_INDEX, 1000000);

// Upgrades that double the productivity of a type of building
upgrade("Steel-plated rolling pins"		).scalesBuilding(Constants.GRANDMA_INDEX, 2);
upgrade("Lubricated dentures"			).scalesBuilding(Constants.GRANDMA_INDEX, 2);
upgrade("Farmer grandmas"				).scalesBuilding(Constants.GRANDMA_INDEX, 2);
upgrade("Worker grandmas"				).scalesBuilding(Constants.GRANDMA_INDEX, 2);
upgrade("Miner grandmas"				).scalesBuilding(Constants.GRANDMA_INDEX, 2);
upgrade("Cosmic grandmas"				).scalesBuilding(Constants.GRANDMA_INDEX, 2);
upgrade("Prune juice"					).scalesBuilding(Constants.GRANDMA_INDEX, 2);
upgrade("Transmuted grandmas"			).scalesBuilding(Constants.GRANDMA_INDEX, 2);
upgrade("Double-thick glasses"			).scalesBuilding(Constants.GRANDMA_INDEX, 2);
upgrade("Altered grandmas"				).scalesBuilding(Constants.GRANDMA_INDEX, 2);
upgrade("Grandmas' grandmas"			).scalesBuilding(Constants.GRANDMA_INDEX, 2);
upgrade("Antigrandmas"					).scalesBuilding(Constants.GRANDMA_INDEX, 2);
upgrade("Rainbow grandmas"				).scalesBuilding(Constants.GRANDMA_INDEX, 2);
upgrade("Aging agents"					).scalesBuilding(Constants.GRANDMA_INDEX, 2);
upgrade("Fertilizer"					).scalesBuilding(Constants.FARM_INDEX, 2);
upgrade("Cookie trees"					).scalesBuilding(Constants.FARM_INDEX, 2);
upgrade("Genetically-modified cookies"	).scalesBuilding(Constants.FARM_INDEX, 2);
upgrade("Gingerbread scarecrows"		).scalesBuilding(Constants.FARM_INDEX, 2);
upgrade("Pulsar sprinklers"				).scalesBuilding(Constants.FARM_INDEX, 2);
upgrade("Child labor"					).scalesBuilding(Constants.FACTORY_INDEX, 2);
upgrade("Sweatshop"						).scalesBuilding(Constants.FACTORY_INDEX, 2);
upgrade("Radium reactors"				).scalesBuilding(Constants.FACTORY_INDEX, 2);
upgrade("Recombobulators"				).scalesBuilding(Constants.FACTORY_INDEX, 2);
upgrade("Deep-bake process"				).scalesBuilding(Constants.FACTORY_INDEX, 2);
upgrade("Megadrill"						).scalesBuilding(Constants.MINE_INDEX, 2);
upgrade("Ultradrill"					).scalesBuilding(Constants.MINE_INDEX, 2);
upgrade("Ultimadrill"					).scalesBuilding(Constants.MINE_INDEX, 2);
upgrade("H-bomb mining"					).scalesBuilding(Constants.MINE_INDEX, 2);
upgrade("Coreforge"						).scalesBuilding(Constants.MINE_INDEX, 2);
upgrade("Wormholes"						).scalesBuilding(Constants.SHIPMENT_INDEX, 2);
upgrade("Frequent flyer"				).scalesBuilding(Constants.SHIPMENT_INDEX, 2);
upgrade("Warp drive"					).scalesBuilding(Constants.SHIPMENT_INDEX, 2);
upgrade("Chocolate monoliths"			).scalesBuilding(Constants.SHIPMENT_INDEX, 2);
upgrade("Generation ship"				).scalesBuilding(Constants.SHIPMENT_INDEX, 2);
upgrade("Essence of dough"				).scalesBuilding(Constants.ALCHEMY_LAB_INDEX, 2);
upgrade("True chocolate"				).scalesBuilding(Constants.ALCHEMY_LAB_INDEX, 2);
upgrade("Ambrosia"						).scalesBuilding(Constants.ALCHEMY_LAB_INDEX, 2);
upgrade("Aqua crustulae"				).scalesBuilding(Constants.ALCHEMY_LAB_INDEX, 2);
upgrade("Origin crucible"				).scalesBuilding(Constants.ALCHEMY_LAB_INDEX, 2);
upgrade("Insane oatling workers"		).scalesBuilding(Constants.PORTAL_INDEX, 2);
upgrade("Soul bond"						).scalesBuilding(Constants.PORTAL_INDEX, 2);
upgrade("Sanity dance"					).scalesBuilding(Constants.PORTAL_INDEX, 2);
upgrade("Brane transplant"				).scalesBuilding(Constants.PORTAL_INDEX, 2);
upgrade("Deity-sized portals"			).scalesBuilding(Constants.PORTAL_INDEX, 2);
upgrade("Time paradox resolver"			).scalesBuilding(Constants.TIME_MACHINE_INDEX, 2);
upgrade("Quantum conundrum"				).scalesBuilding(Constants.TIME_MACHINE_INDEX, 2);
upgrade("Causality enforcer"			).scalesBuilding(Constants.TIME_MACHINE_INDEX, 2);
upgrade("Yestermorrow comparators"		).scalesBuilding(Constants.TIME_MACHINE_INDEX, 2);
if (Game.version == "1.0453") {
	upgrade("Far future enactment"			);
} else {
	upgrade("Far future enactment"			).scalesBuilding(Constants.TIME_MACHINE_INDEX, 2);
}
upgrade("String theory"					).scalesBuilding(Constants.ANTIMATTER_CONDENSER_INDEX, 2);
upgrade("Large macaron collider"		).scalesBuilding(Constants.ANTIMATTER_CONDENSER_INDEX, 2);
upgrade("Big bang bake"					).scalesBuilding(Constants.ANTIMATTER_CONDENSER_INDEX, 2);
upgrade("Reverse cyclotrons"			).scalesBuilding(Constants.ANTIMATTER_CONDENSER_INDEX, 2);
upgrade("Nanocosmics"					).scalesBuilding(Constants.ANTIMATTER_CONDENSER_INDEX, 2);
upgrade("9th color"						).scalesBuilding(Constants.PRISM_INDEX, 2);
upgrade("Chocolate light"				).scalesBuilding(Constants.PRISM_INDEX, 2);
upgrade("Grainbow"						).scalesBuilding(Constants.PRISM_INDEX, 2);
upgrade("Pure cosmic light"				).scalesBuilding(Constants.PRISM_INDEX, 2);
upgrade("Glow-in-the-dark"				).scalesBuilding(Constants.PRISM_INDEX, 2);

// Upgrades that increase cookie production
upgrade("Sugar cookies"											).boostsProduction(5);
upgrade("Peanut butter cookies"									).boostsProduction(5);
upgrade("Plain cookies"											).boostsProduction(5);
upgrade("Oatmeal raisin cookies"								).boostsProduction(5);
upgrade("Coconut cookies"										).boostsProduction(5);
upgrade("White chocolate cookies"								).boostsProduction(5);
upgrade("Macadamia nut cookies"									).boostsProduction(5);
upgrade("White chocolate macadamia nut cookies"					).boostsProduction(10);
upgrade("Double-chip cookies"									).boostsProduction(10);
upgrade("All-chocolate cookies"									).boostsProduction(10);
upgrade("White chocolate-coated cookies"						).boostsProduction(15);
upgrade("Dark chocolate-coated cookies"							).boostsProduction(15);
upgrade("Eclipse cookies"										).boostsProduction(15);
upgrade("Zebra cookies"											).boostsProduction(15);
upgrade("Snickerdoodles"										).boostsProduction(15);
upgrade("Stroopwafels"											).boostsProduction(15);
upgrade("Empire biscuits"										).boostsProduction(15);
upgrade("Macaroons"												).boostsProduction(15);
upgrade("British tea biscuits"									).boostsProduction(15);
upgrade("Chocolate british tea biscuits"						).boostsProduction(15);
upgrade("Round british tea biscuits"							).boostsProduction(15);
upgrade("Round chocolate british tea biscuits"					).boostsProduction(15);
upgrade("Round british tea biscuits with heart motif"			).boostsProduction(15);
upgrade("Round chocolate british tea biscuits with heart motif"	).boostsProduction(15);
upgrade("Palets"												).boostsProduction(20);
upgrade("Sabl&eacute;s"											).boostsProduction(20);
upgrade("Madeleines"											).boostsProduction(20);
upgrade("Palmiers"												).boostsProduction(20);
upgrade("Shortfoils"											).boostsProduction(25);
upgrade("Fig gluttons"											).boostsProduction(25);
upgrade("Loreols"												).boostsProduction(25);
upgrade("Jaffa cakes"											).boostsProduction(25);
upgrade("Grease's cups"											).boostsProduction(25);
upgrade("Sagalongs"												).boostsProduction(25);
upgrade("Win mints"												).boostsProduction(25);
upgrade("Caramoas"												).boostsProduction(25);
upgrade("Gingerbread trees"										).boostsProduction(25);
upgrade("Gingerbread men"										).boostsProduction(25);
upgrade("Rose macarons"											).boostsProduction(30);
upgrade("Lemon macarons"										).boostsProduction(30);
upgrade("Chocolate macarons"									).boostsProduction(30);
upgrade("Pistachio macarons"									).boostsProduction(30);
upgrade("Hazelnut macarons"										).boostsProduction(30);
upgrade("Violet macarons"										).boostsProduction(30);

// Golden cookie upgrade functions
upgrade("Lucky day"		).scalesGoldenCookieFrequency(2);
upgrade("Serendipity"	).scalesGoldenCookieFrequency(2);
upgrade("Get lucky"		).scalesGoldenCookieDuration(2);

// Research centre related upgrades
upgrade("Bingo center/Research facility").scalesBuilding(Constants.GRANDMA_INDEX, 4).startsResearch();
upgrade("Persistent memory"				).boostsResearch();
upgrade("Specialized chocolate chips"	).boostsProduction(1).startsResearch();
upgrade("Designer cocoa beans"			).boostsProduction(2).startsResearch();
upgrade("Ritual rolling pins"			).scalesBuilding(Constants.GRANDMA_INDEX, 2).startsResearch();
upgrade("Underworld ovens"				).boostsProduction(3).startsResearch();
upgrade("One mind"						).givesPerBuildingBoost(Constants.GRANDMA_INDEX, Constants.GRANDMA_INDEX, 0.02).angersGrandmas().startsResearch();
upgrade("Exotic nuts"					).boostsProduction(4).startsResearch();
upgrade("Communal brainsweep"			).givesPerBuildingBoost(Constants.GRANDMA_INDEX, Constants.GRANDMA_INDEX, 0.02).angersGrandmas().startsResearch();
upgrade("Arcane sugar"					).boostsProduction(5).startsResearch();
upgrade("Elder Pact"					).givesPerBuildingBoost(Constants.GRANDMA_INDEX, Constants.PORTAL_INDEX, 0.05).angersGrandmas();

// Elder pledge related upgrades
upgrade("Elder Covenant"			).startsElderCovenant();
upgrade("Revoke Elder Covenant"		).endsElderCovenant();
upgrade("Elder Pledge"				).startsElderPledge();
upgrade("Sacrificial rolling pins"	).doublesElderPledge();

// Assorted cursor / clicking upgrades
upgrade("Reinforced index finger"		).boostsBuilding(Constants.CURSOR_INDEX, 0.1).boostsClicking(1);
upgrade("Carpal tunnel prevention cream").scalesBaseClicking(2).scalesBuilding(Constants.CURSOR_INDEX, 2);
upgrade("Ambidextrous"					).scalesBaseClicking(2).scalesBuilding(Constants.CURSOR_INDEX, 2);
upgrade("Thousand fingers"				).givesTotalBuildingBonus(Constants.CURSOR_INDEX, Constants.CURSOR_INDEX, 0.1);
upgrade("Million fingers"				).givesTotalBuildingBonus(Constants.CURSOR_INDEX, Constants.CURSOR_INDEX, 0.5);
upgrade("Billion fingers"				).givesTotalBuildingBonus(Constants.CURSOR_INDEX, Constants.CURSOR_INDEX, 2);
upgrade("Trillion fingers"				).givesTotalBuildingBonus(Constants.CURSOR_INDEX, Constants.CURSOR_INDEX, 10);
upgrade("Quadrillion fingers"			).givesTotalBuildingBonus(Constants.CURSOR_INDEX, Constants.CURSOR_INDEX, 20);
upgrade("Quintillion fingers"			).givesTotalBuildingBonus(Constants.CURSOR_INDEX, Constants.CURSOR_INDEX, 100);
upgrade("Sextillion fingers"			).givesTotalBuildingBonus(Constants.CURSOR_INDEX, Constants.CURSOR_INDEX, 200);
upgrade("Septillion fingers"			).givesTotalBuildingBonus(Constants.CURSOR_INDEX, Constants.CURSOR_INDEX, 400);
upgrade("Octillion fingers"				).givesTotalBuildingBonus(Constants.CURSOR_INDEX, Constants.CURSOR_INDEX, 800);
upgrade("Plastic mouse"					).boostsClickCps(0.01);
upgrade("Iron mouse"					).boostsClickCps(0.01),
upgrade("Titanium mouse"				).boostsClickCps(0.01),
upgrade("Adamantium mouse"				).boostsClickCps(0.01),
upgrade("Unobtainium mouse"				).boostsClickCps(0.01),
upgrade("Eludium mouse"					).boostsClickCps(0.01),
upgrade("Wishalloy mouse"				).boostsClickCps(0.01),

// Milk and heavenly power increases
upgrade("Kitten helpers"		).unlocksMilk(0.05);
upgrade("Kitten workers"		).unlocksMilk(0.1);
upgrade("Kitten engineers"		).unlocksMilk(0.2);
upgrade("Kitten overseers"		).unlocksMilk(0.2);
upgrade("Kitten managers"		).unlocksMilk(0.2);
upgrade("Heavenly chip secret"	).boostsHeavenlyPower(0.05);
upgrade("Heavenly cookie stand"	).boostsHeavenlyPower(0.20);
upgrade("Heavenly bakery"		).boostsHeavenlyPower(0.25);
upgrade("Heavenly confectionery").boostsHeavenlyPower(0.25);
upgrade("Heavenly key"			).boostsHeavenlyPower(0.25);

// Season switcher and season changers
upgrade("Season switcher"	).unlocksSeasonSwitching();
upgrade("Lovesick biscuit"	).changesSeason(Constants.VALENTINES_DAY);
upgrade("Ghostly biscuit"	).changesSeason(Constants.HALLOWEEN);
upgrade("Festive biscuit"	).changesSeason(Constants.CHRISTMAS);
upgrade("Fool's biscuit"	).changesSeason(Constants.BUSINESS_DAY);

// Valentines day season upgrades
upgrade("Pure heart biscuits"	).boostsProduction(25).forSeason(Constants.VALENTINES_DAY);
upgrade("Ardent heart biscuits"	).boostsProduction(25).forSeason(Constants.VALENTINES_DAY);
upgrade("Sour heart biscuits"	).boostsProduction(25).forSeason(Constants.VALENTINES_DAY);
upgrade("Weeping heart biscuits").boostsProduction(25).forSeason(Constants.VALENTINES_DAY);
upgrade("Golden heart biscuits"	).boostsProduction(25).forSeason(Constants.VALENTINES_DAY);
upgrade("Eternal heart biscuits").boostsProduction(25).forSeason(Constants.VALENTINES_DAY);

// Halloween season upgrades
upgrade("Skull cookies"		).boostsProduction(20).forSeason(Constants.HALLOWEEN);
upgrade("Ghost cookies"		).boostsProduction(20).forSeason(Constants.HALLOWEEN);
upgrade("Bat cookies"		).boostsProduction(20).forSeason(Constants.HALLOWEEN);
upgrade("Slime cookies"		).boostsProduction(20).forSeason(Constants.HALLOWEEN);
upgrade("Pumpkin cookies"	).boostsProduction(20).forSeason(Constants.HALLOWEEN);
upgrade("Eyeball cookies"	).boostsProduction(20).forSeason(Constants.HALLOWEEN);
upgrade("Spider cookies"	).boostsProduction(20).forSeason(Constants.HALLOWEEN);

// Christmas season
upgrade("A festive hat"				).unlocksSantaLevels().forSeason(Constants.CHRISTMAS);
upgrade("Santa Level"				).increasesSantasLevel().forSeason(Constants.CHRISTMAS);
upgrade("Weighted sleighs"			).slowsReindeer(2).forSeason(Constants.CHRISTMAS);
upgrade("Reindeer baking grounds"	).scalesReindeerFrequency(2).forSeason(Constants.CHRISTMAS);
upgrade("Ho ho ho-flavored frosting").scalesReindeer(2).forSeason(Constants.CHRISTMAS);
upgrade("Season savings"			).scalesBuildingCost(0.99).forSeason(Constants.CHRISTMAS);
upgrade("Toy workshop"				).reducesUpgradeCost(5).forSeason(Constants.CHRISTMAS);
upgrade("Santa's bottomless bag"	).increasesRandomDropChance(10).forSeason(Constants.CHRISTMAS);
upgrade("Santa's helpers"			).scalesTotalClicking(1.1).forSeason(Constants.CHRISTMAS);
upgrade("Santa's legacy"			).boostsSantaPower(10).forSeason(Constants.CHRISTMAS);
upgrade("Santa's milk and cookies"	).scalesMilk(1.05).forSeason(Constants.CHRISTMAS);
upgrade("A lump of coal"			).boostsProduction(1).forSeason(Constants.CHRISTMAS);
upgrade("An itchy sweater"			).boostsProduction(1).forSeason(Constants.CHRISTMAS);
upgrade("Improved jolliness"		).boostsProduction(15).forSeason(Constants.CHRISTMAS);
upgrade("Increased merriness"		).boostsProduction(15).forSeason(Constants.CHRISTMAS);
upgrade("Christmas tree biscuits"	).boostsProduction(20).forSeason(Constants.CHRISTMAS);
upgrade("Snowflake biscuits"		).boostsProduction(20).forSeason(Constants.CHRISTMAS);
upgrade("Snowman biscuits"			).boostsProduction(20).forSeason(Constants.CHRISTMAS);
upgrade("Holly biscuits"			).boostsProduction(20).forSeason(Constants.CHRISTMAS);
upgrade("Candy cane biscuits"		).boostsProduction(20).forSeason(Constants.CHRISTMAS);
upgrade("Bell biscuits"				).boostsProduction(20).forSeason(Constants.CHRISTMAS);
upgrade("Present biscuits"			).boostsProduction(20).forSeason(Constants.CHRISTMAS);
upgrade("Santa's dominion"			).boostsProduction(50).scalesBuildingCost(0.99).reducesUpgradeCost(2).forSeason(Constants.CHRISTMAS);
upgrade("Naughty list"				).scalesBuilding(Constants.GRANDMA_INDEX, 2).forSeason(Constants.CHRISTMAS);

// Easter stuff
upgrade("Caramel macarons"			).boostsProduction(30);
upgrade("Licorice macarons"			).boostsProduction(30);

upgrade("Bunny biscuit"				).changesSeason(Constants.EASTER);

upgrade("Chicken egg"				).boostsGlobalProduction(1).forSeason(Constants.EASTER);
upgrade("Robin egg"					).boostsGlobalProduction(1).forSeason(Constants.EASTER);


getUpgradeFunction = function(name) {
	if (upgradeIndex[name] == undefined) {
		upgrade(name);
		console.log("Unknown upgrade: " + name);
	}
	return upgradeIndex[name];
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

console.log("Ultimate Cookie started at " + new Date());
