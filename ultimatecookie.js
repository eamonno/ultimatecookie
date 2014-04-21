//
// TO-DO List
//
// Adjust for the AutoBuy delay in the autobuy function for very high reset regen rates
// Implement a proper click rate function
// Add a version check
//

function UltimateCookie() {
	this.AUTO_CLICK_DELAY = 1;
	this.AUTO_BUY_DELAY = 500;

	this.enable();
}

UltimateCookie.prototype.enable = function() {
	this.autoClicker = setInterval(Game.ClickCookie, this.AUTO_CLICK_DELAY);
	this.autoBuyer = setInterval(AutoBuy, this.AUTO_BUY_DELAY);
}

UltimateCookie.prototype.disable = function() {
	clearInterval(this.autoClicker);
	clearInterval(this.autoBuyer);
}

UltimateCookie.prototype.timeToBuy = function(cps, a, b) {
	return a.getCost() / cps + b.getCost() / (cps + a.getCps());
}

UltimateCookie.prototype.createPurchaseList = function() {
	var purchases = new Array();

	// Add the buildings
	var i;
	for (i = 0; i < Game.ObjectsById.length; ++i) {
		purchases.push(new PurchasableBuilding(Game.ObjectsById[i]));
	}

	// Add the upgrades
	for (i = 0; i < Game.UpgradesInStore.length; ++i) {
		purchases.push(new PurchasableUpgrade(Game.UpgradesInStore[i]));
	}

	return purchases;
}

UltimateCookie.prototype.determineNextPurchase = function() {
	var purchases = this.createPurchaseList();
	var next = purchases[0];
	var cps = this.effectiveCps();

	var i;
	for (i = 1; i < purchases.length; ++i) {
		if (this.timeToBuy(cps, next, purchases[i]) > this.timeToBuy(cps, purchases[i], next)) {
			next = purchases[i];
		}
	}

	console.log("Next purchase: " + next);

	return next;
}

UltimateCookie.prototype.autoBuy = function() {
	if (this.nextPurchase == undefined) {
		this.nextPurchase = this.determineNextPurchase();
	}
	if (Game.cookies > this.nextPurchase.getCost()) {
		this.nextPurchase.purchase();
		// This is to allow a delay for the game to update its data structures, just setting this to
		// the result of determineNextPurchase immediately was often causing errors
		this.nextPurchase = undefined;
	}
}

UltimateCookie.prototype.effectiveCps = function() {
	// Assume 250 clicks per second
	return Game.cookiesPs + this.clickRate() * Game.mouseCps();
}

UltimateCookie.prototype.clickRate = function() {
	// Assume 250 clicks per second for now
	return 250;
}

//
// Class to represent buildings for cost and buy order evaluation
//

function PurchasableBuilding(building) {
	this.building = building;
}

PurchasableBuilding.prototype.toString = function() {
	return "Building: " + this.building.displayName + " " + (this.building.amount + 1);
}

PurchasableBuilding.prototype.getCost = function() {
	return this.building.getPrice();
}

PurchasableBuilding.prototype.getCps = function() {
	return this.building.cps();
}

PurchasableBuilding.prototype.purchase = function() {
	this.building.buy(1);
}

//
// Class to represent upgrades for cost and buy order evaluation
//

function UpgradeAnalyser() {
	// Index into the Game.ObjectsByID array
	this.CURSOR_INDEX = 0;
	this.GRANDMA_INDEX = 1;
	this.FARM_INDEX = 2;
	this.FACTORY_INDEX = 3;

	// Base CPS upgrades are those that adjust the base CPS of a building
	this.baseCpsUpgrades[] = new Array();
	this.baseCpsUpgrades.push([this.GRANDMA_INDEX, 0.3, "Forwards from grandma"]);
	this.baseCpsUpgrades.push([this.FARM_INDEX, 1.0, "Cheap hoes"]);
	this.baseCpsUpgrades.push([this.FACTORY_INDEX, 4.0, "Sturdier conveyor belts"]);

	// Doubler Upgrades are those that double the productivity of a type of building
	this.doublerUpgrades[] = new Array();
	this.doublerUpgrades.push([this.CURSOR_INDEX, "Carpal tunnel prevention cream"]);
	this.doublerUpgrades.push([this.CURSOR_INDEX, "Ambidextrous"]);
	this.doublerUpgrades.push([this.GRANDMA_INDEX, "Steel-plated rolling pins"]);
	this.doublerUpgrades.push([this.GRANDMA_INDEX, "Lubricated dentures"]);
	this.doublerUpgrades.push([this.FARM_INDEX, "Fertilizer"]);


}

UpgradeAnalyser.prototype.getScale = function(buildingIndex) {
	var s = 1;
	var i;
	for (i = 0; i < doublerUpgrades.length; ++i) {
		if (doublerUpgrades[i][0] == buildingIndex && Game.has[doublerUpgrades[i][1]) {
			s = s * 2;
		}
	}
	return s;
}

function PurchasableUpgrade(upgrade) {
	this.upgrade = upgrade;

	// Now set an appropriate CPS function
	switch (this.upgrade.name) {
		case "Reinforced index finger":
			// The mouse gains +1 cookie per click. Cursors gain +0.1 base CpS.
			this.getCps = function() {
				return (ultimateCookie.clickRate() + getCursors().amount * 0.1) * getCursorScale();
			}
			break;
		case "Carpal tunnel prevention cream":
		case "Ambidextrous":
			// The mouse and cursors are twice as efficient.
			this.getCps = function() {
				return ultimateCookie.clickRate() * Game.mouseCps() + getCursors().amount * getCursors().cps();
			}
			break;
		case "Forwards from grandma":
			// Grandmas gain +0.3 base CpS.
			this.getCps = function() {
				return getGrandmas().amount * 0.3 * getGrandmaScale();
			}
			break;
		case "Cheap hoes":
			// Farms gain +1 base CpS.
			this.getCps = function() {
				return getFarms().amount * 1.0 * getFarmScale();
			}
			break;
		case "Steel-plated rolling pins":
		case "Lubricated dentures":
			// Grandmas are twice as efficient.
			this.getCps = function() {
				return getGrandmas().amount * getGrandmas().cps();
			}
			break;
		case "Sturdier conveyor belts":
			// Factories gain +4 base CpS.
			this.getCps = function() {
				return getFactories().amount * 4 * getFactoryScale();
			}
			break;
		case "Fertilizer":
			// Farms are twice as efficient.
			this.getCps = function() {
				return getFarms().amount * getFarms().cps();
			}
			break;
		case "Plastic mouse":
		case "Iron mouse":
			// Clicking gains +1% of your CpS.
			// Tested in game: this doesn't scale with mouse click doublers
			this.getCps = function() {
				return ultimateCookie.clickRate() * Game.cookiesPs * 0.01;
			}
			break;
		default:
			// Unhandled, set CPS to 0 so it will never be auto bought
			this.getCps = function() {
				return 0;
			}
			break;
	}
}

PurchasableUpgrade.prototype.toString = function() {
	return "Upgrade: " + this.upgrade.name;
}

PurchasableUpgrade.prototype.getCost = function() {
	return this.upgrade.getPrice();
}

PurchasableUpgrade.prototype.purchase = function() {
	this.upgrade.buy(0);
}

//
// Utility Functions to avoid using magic numbers
//

getCursors = function() {
	return Game.ObjectsById[0];
}

getCursorScale = function() {
	var s = 1;
	if (Game.has("Carpal tunnel prevention cream")) {
		s = s * 2;
	}
	if (Game.has("Ambidextrous")) {
		s = s * 2;
	}
	return s;
}

getGrandmas = function() {
	return Game.ObjectsById[1];
}

getGrandmaScale = function() {
	var s = 1;
	if (Game.has("Steel-plated rolling pins")) {
		s = s * 2;
	}
	if (Game.has("Lubricated dentures")) {
		s = s * 2;
	}
	return s;
}

getFarms = function() {
	return Game.ObjectsById[2];
}

getFarmScale = function() {
	var s = 1;
	if (Game.has("Fertilizer")) {
		s = s * 2;
	}
	return s;
}

getFactories = function() {
	return Game.ObjectsById[3];
}

getFactoryScale = function() {
	var s = 1;

	return s;
}

var ultimateCookie = new UltimateCookie();

function AutoBuy() { ultimateCookie.autoBuy(); }
