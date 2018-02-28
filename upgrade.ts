// class NewUpgrade {
// 	readonly modifier: NewModifier

// 	constructor(public sim: BaseSimulator, public name: string, components: NewModifier.Component[]) {
// 		this.modifier = new NewModifier(sim, components, name, true);
// 	}
// }

enum UpgradeFlags {
    Unlocked        = 0x001,
    Unsupported     = 0x002,
    Egg             = 0x004,
    SantaReward     = 0x008,
    GoldenSwitch    = 0x010,
    SeasonChanger   = 0x020,
    RareEgg         = 0x040,
    Cookie          = 0x080,
    Synergy         = 0x100,
    Toggle          = 0x200,
}
