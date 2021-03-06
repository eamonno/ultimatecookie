// Definitions for Cookie Clicker v2.0045
// Project: Cookie Clicker, http://orteil.dashnet.org/cookieclicker
// Partial definitions by Eamonn O'Brien, github.com/eamonno
//
// This is by no means meant to be a complete .d.ts file for Cookie Clicker. It includes
// just the bare minimum it takes to make the typescript compiler stop complaining.

declare namespace Game {
    class Spell {
        name: string
    }

    class MiniGame {
        spells: Spell[]
        castSpell(spell, obj): void
    }

    class Object {
        level: number
        amount: number
        free: number
        name: string
        minigame: MiniGame

        buy(n: number): void
        sacrifice(n: number): void
        getPrice(): number
        cps(o: Object): number
        levelUp(): void
        sell(amount: number): void
    }

    class Upgrade {
        name: string
        bought: number
        unlocked: number
        pool: string
    }

    class Shimmer {
        type: string
        pop(): void
    }

    class Wrinkler {
        sucked: number
        hp: number
    }

    class BuffType {
        name: string
    }

    class Buff {
        multCpS: number
        type: BuffType
    }

    let cookies: number
    let cookiesEarned: number
    let cookiesReset: number
    let cookieClicks: number
    let heavenlyChips: number
    let prestige: number
    let santaLevel: number
    let dragonAura: number
    let dragonAura2: number
    let dragonLevel: number
    let season: string
    let recalculateGains: number
    let cookiesPs: number
    let specialTab: string
    let startDate: number
    let seasonUses: number
    let pledges: number
    let AchievementsOwned: number
    let time: number
    let lumps: number
    let lumpT: number
    let lumpRipeAge: number

    let buffs: { [index: string]: Buff }
    let shimmers: Shimmer[]
    let wrinklers: Wrinkler[]
    let Upgrades: Upgrade[]
    let UpgradesInStore: Upgrade[]
    let UpgradesById: Upgrade[]
    let ObjectsById: Object[]

    function clickLump(): void
    function Has(name: string): number
    function ClickCookie(event?: any, amount?: number): void
    function mouseCps(): number
    function WriteSave(type: number): string
    function hasBuff(name: string): number | Buff
    function UpgradeSanta(): void
    function UpgradeDragon(): void
    function HowMuchPrestige(cookies: number): number
}
