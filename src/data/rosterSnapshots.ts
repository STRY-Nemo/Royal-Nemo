/**
 * Full-roster snapshots transcribed from the leaders' power-ranking spreadsheet
 * (in-game roster screen). The "Sync roster" API route applies the newest one to
 * the live database: names, ranks, origin alliances, levels and arena power are
 * updated, renamed members keep their id and history (the old name becomes an
 * alias), newcomers are added, and anyone missing from the snapshot is marked
 * inactive. The verified seed in members.json stays as it was on package day.
 */
import type { AllianceRank, MemberId } from '../domain/types';

export interface RosterSnapshotMember {
  id: MemberId;
  username: string;
  rank: AllianceRank;
  origin_alliance: string;
  level: number;
  /** Arena power in millions. */
  arena_power_m: number;
}

export interface RosterSnapshot {
  /** ISO date the roster screen was captured; becomes each member's power_as_of. */
  as_of: string;
  source: string;
  members: RosterSnapshotMember[];
}

export const ROSTER_SNAPSHOTS: RosterSnapshot[] = [
  {
    as_of: '2026-09-20',
    source:
      'Last_Z_Alliance_Roster_2026-09-20 (Power Ranking tab, from the 09-20 roster screen recording). Renames matched by level, origin and power: Rockysaurus was RockyNoSpeedUps, Azale Manu1604 was Azale, daddy hauss was hausshavoc, Sun goat Nika was King of goats.',
    members: [
    { id: "stry-001", username: "Mario AK47", rank: "R4", origin_alliance: "ROYL", level: 35, arena_power_m: 866.0 },
    { id: "stry-002", username: "IcemanPowaaa", rank: "R3", origin_alliance: "CAPO", level: 34, arena_power_m: 416.6 },
    { id: "stry-009", username: "Dorin", rank: "R3", origin_alliance: "ROYL", level: 35, arena_power_m: 357.2 },
    { id: "stry-003", username: "Appins", rank: "R4", origin_alliance: "ROYL", level: 35, arena_power_m: 316.1 },
    { id: "stry-007", username: "DeeDeeeee", rank: "R3", origin_alliance: "ROYL", level: 35, arena_power_m: 314.3 },
    { id: "stry-004", username: "Rrrrrrrrrd", rank: "R3", origin_alliance: "CAPO", level: 34, arena_power_m: 309.8 },
    { id: "stry-005", username: "Ultra EGO", rank: "R3", origin_alliance: "STRY", level: 35, arena_power_m: 308.3 },
    { id: "stry-006", username: "Nemo Hoes", rank: "R4", origin_alliance: "ROYL", level: 35, arena_power_m: 292.7 },
    { id: "stry-008", username: "Queen Rouge", rank: "R5", origin_alliance: "STRY", level: 33, arena_power_m: 271.5 },
    { id: "stry-011", username: "Apparition-", rank: "R4", origin_alliance: "ROYL", level: 35, arena_power_m: 264.1 },
    { id: "stry-010", username: "Shastorm", rank: "R3", origin_alliance: "CAPO", level: 31, arena_power_m: 260.3 },
    { id: "stry-013", username: "Rockysaurus", rank: "R3", origin_alliance: "ROYL", level: 34, arena_power_m: 245.7 },
    { id: "stry-015", username: "-PIM-", rank: "R3", origin_alliance: "CAPO", level: 35, arena_power_m: 238.1 },
    { id: "stry-012", username: "R8drz4life", rank: "R3", origin_alliance: "CAPO", level: 33, arena_power_m: 236.0 },
    { id: "stry-101", username: "Azale Manu1604", rank: "R3", origin_alliance: "STRY", level: 35, arena_power_m: 234.5 },
    { id: "stry-102", username: "Vodkashot", rank: "R3", origin_alliance: "STRY", level: 34, arena_power_m: 229.0 },
    { id: "stry-017", username: "JoelitoBB", rank: "R3", origin_alliance: "STRY", level: 34, arena_power_m: 225.9 },
    { id: "stry-014", username: "Dvon Khan", rank: "R3", origin_alliance: "ROYL", level: 35, arena_power_m: 223.6 },
    { id: "stry-018", username: "SwiftBunny DH", rank: "R3", origin_alliance: "STRY", level: 33, arena_power_m: 217.9 },
    { id: "stry-021", username: "Captain Cake", rank: "R3", origin_alliance: "CAPO", level: 34, arena_power_m: 215.0 },
    { id: "stry-023", username: "CooksLS9", rank: "R3", origin_alliance: "ROYL", level: 35, arena_power_m: 214.9 },
    { id: "stry-016", username: "Sats0mNlak", rank: "R3", origin_alliance: "STRY", level: 33, arena_power_m: 213.7 },
    { id: "stry-025", username: "• Dyo •", rank: "R3", origin_alliance: "STRY", level: 32, arena_power_m: 209.9 },
    { id: "stry-020", username: "Tẽmujïn", rank: "R3", origin_alliance: "ROYL", level: 34, arena_power_m: 209.5 },
    { id: "stry-027", username: "Elmo", rank: "R3", origin_alliance: "STRY", level: 35, arena_power_m: 206.5 },
    { id: "stry-022", username: "Victoria13", rank: "R3", origin_alliance: "STRY", level: 35, arena_power_m: 206.0 },
    { id: "stry-029", username: "SnoopyB", rank: "R3", origin_alliance: "ROYL", level: 35, arena_power_m: 205.8 },
    { id: "stry-019", username: "JAY QUEEN", rank: "R3", origin_alliance: "STRY", level: 35, arena_power_m: 204.3 },
    { id: "stry-026", username: "UndertakerGreg", rank: "R3", origin_alliance: "ROYL", level: 33, arena_power_m: 203.5 },
    { id: "stry-024", username: "Mada", rank: "R4", origin_alliance: "CAPO", level: 32, arena_power_m: 203.0 },
    { id: "stry-035", username: "Dinkleberg6969", rank: "R3", origin_alliance: "CAPO", level: 33, arena_power_m: 202.9 },
    { id: "stry-032", username: "Giovanni Savage", rank: "R3", origin_alliance: "CAPO", level: 35, arena_power_m: 201.6 },
    { id: "stry-030", username: "daddy hauss", rank: "R3", origin_alliance: "CAPO", level: 31, arena_power_m: 201.5 },
    { id: "stry-061", username: "Galihad", rank: "R3", origin_alliance: "CAPO", level: 32, arena_power_m: 200.2 },
    { id: "stry-031", username: "MaKaRa", rank: "R3", origin_alliance: "ROYL", level: 34, arena_power_m: 198.4 },
    { id: "stry-028", username: "Chika Strike", rank: "R3", origin_alliance: "ROYL", level: 32, arena_power_m: 197.3 },
    { id: "stry-033", username: "KEV1980", rank: "R3", origin_alliance: "STRY", level: 33, arena_power_m: 197.3 },
    { id: "stry-034", username: "raZ", rank: "R3", origin_alliance: "ROYL", level: 34, arena_power_m: 196.2 },
    { id: "stry-041", username: "Flowmotion47", rank: "R3", origin_alliance: "ROYL", level: 30, arena_power_m: 192.9 },
    { id: "stry-037", username: "Tubbie 300BLK", rank: "R3", origin_alliance: "ROYL", level: 33, arena_power_m: 192.2 },
    { id: "stry-043", username: "RosolinoFriddi", rank: "R4", origin_alliance: "CAPO", level: 32, arena_power_m: 190.8 },
    { id: "stry-046", username: "PajuHalfLapin", rank: "R3", origin_alliance: "STRY", level: 31, arena_power_m: 190.8 },
    { id: "stry-044", username: "• TooN •", rank: "R3", origin_alliance: "ROYL", level: 34, arena_power_m: 190.7 },
    { id: "stry-047", username: "DemonKingg", rank: "R3", origin_alliance: "STRY", level: 33, arena_power_m: 189.9 },
    { id: "stry-039", username: "PablitoSnow", rank: "R3", origin_alliance: "STRY", level: 30, arena_power_m: 188.4 },
    { id: "stry-045", username: "Matt02", rank: "R3", origin_alliance: "STRY", level: 34, arena_power_m: 188.3 },
    { id: "stry-040", username: "JetPed", rank: "R3", origin_alliance: "ROYL", level: 31, arena_power_m: 187.4 },
    { id: "stry-042", username: "Mapinski", rank: "R3", origin_alliance: "ROYL", level: 35, arena_power_m: 186.5 },
    { id: "stry-048", username: "Provh", rank: "R3", origin_alliance: "STRY", level: 30, arena_power_m: 186.5 },
    { id: "stry-063", username: "Pappless", rank: "R4", origin_alliance: "CAPO", level: 32, arena_power_m: 185.9 },
    { id: "stry-072", username: "Pandoraloft", rank: "R3", origin_alliance: "CAPO", level: 31, arena_power_m: 185.2 },
    { id: "stry-038", username: "Kane •", rank: "R3", origin_alliance: "STRY", level: 34, arena_power_m: 184.7 },
    { id: "stry-052", username: "SophieUa", rank: "R3", origin_alliance: "STRY", level: 33, arena_power_m: 183.7 },
    { id: "stry-049", username: "Twist of Fate", rank: "R3", origin_alliance: "CAPO", level: 32, arena_power_m: 182.3 },
    { id: "stry-053", username: "LoC187", rank: "R3", origin_alliance: "ROYL", level: 34, arena_power_m: 181.0 },
    { id: "stry-051", username: "-Yeti-", rank: "R3", origin_alliance: "ROYL", level: 32, arena_power_m: 180.6 },
    { id: "stry-054", username: "levON", rank: "R3", origin_alliance: "STRY", level: 32, arena_power_m: 180.1 },
    { id: "stry-055", username: "TinaG", rank: "R4", origin_alliance: "STRY", level: 33, arena_power_m: 180.0 },
    { id: "stry-059", username: "InkedWitch", rank: "R3", origin_alliance: "ROYL", level: 34, arena_power_m: 179.8 },
    { id: "stry-050", username: "Anton S", rank: "R3", origin_alliance: "ROYL", level: 34, arena_power_m: 178.3 },
    { id: "stry-060", username: "MamaBt", rank: "R3", origin_alliance: "ROYL", level: 32, arena_power_m: 177.5 },
    { id: "stry-057", username: "Thir13en", rank: "R3", origin_alliance: "ROYL", level: 34, arena_power_m: 171.3 },
    { id: "stry-058", username: "KingLow", rank: "R3", origin_alliance: "CAPO", level: 33, arena_power_m: 169.7 },
    { id: "stry-056", username: "Wakeboy", rank: "R3", origin_alliance: "STRY", level: 31, arena_power_m: 169.5 },
    { id: "stry-069", username: "pi nk", rank: "R3", origin_alliance: "ROYL", level: 32, arena_power_m: 169.0 },
    { id: "stry-066", username: "Dr House 96", rank: "R3", origin_alliance: "ROYL", level: 31, arena_power_m: 166.9 },
    { id: "stry-064", username: "DontMesswNess", rank: "R3", origin_alliance: "ROYL", level: 33, arena_power_m: 166.7 },
    { id: "stry-062", username: "USO Kiwi", rank: "R3", origin_alliance: "CAPO", level: 32, arena_power_m: 166.6 },
    { id: "stry-071", username: "MysticPotato", rank: "R3", origin_alliance: "ROYL", level: 33, arena_power_m: 166.5 },
    { id: "stry-073", username: "AvatarNavi", rank: "R3", origin_alliance: "STRY", level: 34, arena_power_m: 166.1 },
    { id: "stry-065", username: "Bachter", rank: "R3", origin_alliance: "STRY", level: 32, arena_power_m: 166.0 },
    { id: "stry-067", username: "Sanatio Fax", rank: "R3", origin_alliance: "CAPO", level: 32, arena_power_m: 164.7 },
    { id: "stry-070", username: "Sun goat Nika", rank: "R3", origin_alliance: "STRY", level: 31, arena_power_m: 164.1 },
    { id: "stry-068", username: "Pmari Snow", rank: "R3", origin_alliance: "ROYL", level: 33, arena_power_m: 161.3 },
    { id: "stry-074", username: "Potepuhec", rank: "R3", origin_alliance: "STRY", level: 33, arena_power_m: 160.5 },
    { id: "stry-104", username: "Ελισάβετ", rank: "R3", origin_alliance: "STRY", level: 33, arena_power_m: 159.3 },
    { id: "stry-090", username: "Robamboo", rank: "R3", origin_alliance: "CAPO", level: 30, arena_power_m: 154.0 },
    { id: "stry-076", username: "Kotsos rs6", rank: "R3", origin_alliance: "STRY", level: 31, arena_power_m: 152.9 },
    { id: "stry-085", username: "crumbum271", rank: "R3", origin_alliance: "STRY", level: 30, arena_power_m: 150.6 },
    { id: "stry-075", username: "Raul863", rank: "R3", origin_alliance: "STRY", level: 32, arena_power_m: 150.0 },
    { id: "stry-078", username: "Krakenasaurus", rank: "R3", origin_alliance: "CAPO", level: 32, arena_power_m: 147.4 },
    { id: "stry-077", username: "Warriorwarrior", rank: "R3", origin_alliance: "CAPO", level: 31, arena_power_m: 146.4 },
    { id: "stry-079", username: "kikimyu", rank: "R3", origin_alliance: "STRY", level: 30, arena_power_m: 144.9 },
    { id: "stry-084", username: "Jeanniee", rank: "R3", origin_alliance: "STRY", level: 31, arena_power_m: 144.3 },
    { id: "stry-080", username: "Thrykika", rank: "R3", origin_alliance: "STRY", level: 30, arena_power_m: 142.8 },
    { id: "stry-100", username: "Black-Wolff", rank: "R3", origin_alliance: "CAPO", level: 30, arena_power_m: 142.4 },
    { id: "stry-082", username: "the david", rank: "R3", origin_alliance: "CAPO", level: 31, arena_power_m: 140.9 },
    { id: "stry-087", username: "Wanderer629", rank: "R3", origin_alliance: "STRY", level: 30, arena_power_m: 139.8 },
    { id: "stry-105", username: "DemonKingg2", rank: "R3", origin_alliance: "STRY", level: 32, arena_power_m: 139.6 },
    { id: "stry-086", username: "LostSoul1213", rank: "R3", origin_alliance: "CAPO", level: 29, arena_power_m: 139.5 },
    { id: "stry-089", username: "SantiSalice", rank: "R3", origin_alliance: "STRY", level: 32, arena_power_m: 138.9 },
    { id: "stry-083", username: "-Aleks-", rank: "R3", origin_alliance: "CAPO", level: 31, arena_power_m: 134.4 },
    { id: "stry-094", username: "Pitour", rank: "R3", origin_alliance: "STRY", level: 33, arena_power_m: 134.4 },
    { id: "stry-091", username: "pepito", rank: "R3", origin_alliance: "CAPO", level: 28, arena_power_m: 132.1 },
    { id: "stry-093", username: "Texas Roman", rank: "R3", origin_alliance: "CAPO", level: 30, arena_power_m: 129.9 },
    { id: "stry-096", username: "Royal09", rank: "R3", origin_alliance: "STRY", level: 31, arena_power_m: 123.8 },
    { id: "stry-097", username: "coincoin18", rank: "R3", origin_alliance: "STRY", level: 30, arena_power_m: 122.9 },
    { id: "stry-095", username: "Momit", rank: "R3", origin_alliance: "STRY", level: 29, arena_power_m: 107.9 },
    { id: "stry-098", username: "Oggie83", rank: "R3", origin_alliance: "CAPO", level: 30, arena_power_m: 78.0 },
    { id: "stry-099", username: "Swarly", rank: "R3", origin_alliance: "CAPO", level: 30, arena_power_m: 73.7 },
    ],
  },
];
