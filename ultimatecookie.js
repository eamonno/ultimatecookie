function UltimateCookie() {

	this.autoClicker = setInterval(Game.ClickCookie, 1);
	this.autoBuyer = setInterval(AutoBuy, 500);
}

UltimateCookie.prototype.determineNextBuilding = function() {

	console.log("------------------------------------");
	var i;
	var next = Game.ObjectsById[0];

	console.log(next.displayName + " " + (next.getPrice() / next.cps()));

	for (i = 1; i < Game.ObjectsById.length; ++i) {
		if (Game.ObjectsById[i].getPrice() / Game.ObjectsById[i].cps() <= next.getPrice() / next.cps()) {
			next = Game.ObjectsById[i];
			console.log(next.displayName + " " + (next.getPrice() / next.cps()));
		}
	}

	return next;
}

UltimateCookie.prototype.determineNextUpgrade = function() {

	var next;

	if (Game.UpgradesInStore.length > 0) {
		next = Game.UpgradesInStore[0];

		var i;
		for (i = 1; i < Game.UpgradesInStore.length; ++i) {
			if (Game.UpgradesInStore[i].getPrice() <= next.getPrice()) {
				next = Game.UpgradesInStore[i];
			}
		}
	}
	return next;
}

UltimateCookie.prototype.determineNextPurchase = function() {

	var upgrade = this.determineNextUpgrade();
	var building = this.determineNextBuilding();

	if (upgrade != undefined && (upgrade.getPrice() * 10) < building.getPrice()) {
		console.log("Next upgrade: " + upgrade.name);
		console.log("Upgrade price: " + upgrade.getPrice() + "  Building price: " + building.getPrice());
		return upgrade;
	}
	console.log("Next building: " + building.displayName + " number " + (building.amount + 1));
	return building;
}

UltimateCookie.prototype.autoBuy = function() {

	if (this.nextPurchase == undefined) {
		this.nextPurchase = this.determineNextPurchase();
	}
	if (Game.cookies > this.nextPurchase.getPrice()) {
		if (this.nextPurchase.plural != undefined) {
			// It is a building
			this.nextPurchase.buy(1);
		} else {
			this.nextPurchase.buy(0);
		}
		// This is to allow a delay for the game to update its data structures, just setting this to
		// the result of determineNextPurchase immediately was often causing errors
		this.nextPurchase = undefined;
	}
}

UltimateCookie.prototype.effectiveCps = function() {
	// Assume 250 clicks per second
	return Game.cookiesPs + 250 * Game.mouseCps;
}

var ultimateCookie = new UltimateCookie();

function AutoBuy() { ultimateCookie.autoBuy(); }
