//
// This file contains just the populate_simulator function. Mostly it is to isolate all
// of the definition stuff away from the main code. 
//

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
	cookie("Festivity loops"						).scalesProduction(1.02);
	cookie("Pure black chocolate cookies"			).scalesProduction(1.04);
	cookie("Pure white chocolate cookies"			).scalesProduction(1.04);
	cookie("Persian rice cookies"       			).scalesProduction(1.04);
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
