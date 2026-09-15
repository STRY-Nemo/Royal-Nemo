/**
 * Roster sheets transcribed from the leaders' spreadsheet and validated against
 * the source screenshot (names corrected to roster spellings). Leaders can import
 * one onto its week from the Roster sheet page (existing votes are kept); the
 * "Apply roster sheet" workflow applies one server-side with force.
 */
import type { BundledSheetRow } from '../engine/rosterSheet';

export interface BundledSheet {
  event_date: string;
  label: string;
  source: string;
  rows: BundledSheetRow[];
}

export const BUNDLED_SHEETS: BundledSheet[] = [
  {
    event_date: '2026-09-11',
    label: 'Roster sheet for Friday 2026-09-11',
    source: 'Alliance_Roster_09-11.xlsx, transcribed from the 09-11 tab screenshot; names validated against the roster',
    rows: [
          {
                "username": "Elmo",
                "section": "Team 1 starters",
                "voted": "either",
                "joined": "yes",
                "ready": "ready",
                "starter": "Team 1"
          },
          {
                "username": "raZ",
                "section": "Team 1 starters",
                "voted": "either",
                "joined": "yes",
                "ready": "ready",
                "starter": "Team 1"
          },
          {
                "username": "Ultra EGO",
                "section": "Team 1 starters",
                "voted": "team1",
                "joined": "yes",
                "ready": "ready",
                "starter": "Team 1"
          },
          {
                "username": "Victoria13",
                "section": "Team 1 starters",
                "voted": "team1",
                "joined": "yes",
                "ready": "ready",
                "starter": "Team 1"
          },
          {
                "username": "PablitoSnow",
                "section": "Team 1 starters",
                "voted": "team1",
                "joined": "yes",
                "ready": "ready",
                "starter": "Team 1"
          },
          {
                "username": "Shastorm",
                "section": "Team 1 starters",
                "voted": "team1",
                "joined": "yes",
                "ready": "ready",
                "starter": "Team 1"
          },
          {
                "username": "Thrykika",
                "section": "Team 1 starters",
                "voted": "team1",
                "joined": "no",
                "ready": "ready",
                "starter": "Team 1",
                "note": "Did not join (red in sheet)"
          },
          {
                "username": "KEV1980",
                "section": "Team 1 starters",
                "voted": "team1",
                "joined": "yes",
                "ready": "ready",
                "starter": "Team 1"
          },
          {
                "username": "JoelitoBB",
                "section": "Team 1 starters",
                "voted": "team1",
                "joined": "yes",
                "starter": "Team 1"
          },
          {
                "username": "Flowmotion47",
                "section": "Team 1 starters",
                "voted": "team1",
                "joined": "yes",
                "ready": "ready",
                "starter": "Team 1"
          },
          {
                "username": "Chika Strike",
                "section": "Team 1 starters",
                "voted": "team1",
                "joined": "mvp",
                "ready": "ready",
                "starter": "Team 1"
          },
          {
                "username": "Mada",
                "section": "Team 1 starters",
                "voted": null,
                "joined": "yes",
                "ready": "ready",
                "starter": "Team 1",
                "note": "R4"
          },
          {
                "username": "• Dyo •",
                "section": "Team 1 starters",
                "voted": null,
                "joined": "yes",
                "ready": "ready",
                "starter": "Team 1"
          },
          {
                "username": "fivos tech",
                "section": "Team 1 starters",
                "voted": null,
                "joined": "yes",
                "ready": "ready",
                "starter": "Team 1"
          },
          {
                "username": "-PIM-",
                "section": "Team 1 starters",
                "voted": null,
                "joined": "yes",
                "ready": "ready",
                "starter": "Team 1"
          },
          {
                "username": "SwiftBunny DH",
                "section": "Team 1 starters",
                "voted": null,
                "joined": "yes",
                "ready": "ready",
                "starter": "Team 1"
          },
          {
                "username": "Sats0mNlak",
                "section": "Team 1 starters",
                "voted": null,
                "joined": "yes",
                "ready": "ready",
                "starter": "Team 1"
          },
          {
                "username": "Giovanni Savage",
                "section": "Team 1 starters",
                "voted": null,
                "joined": "yes",
                "ready": "ready",
                "starter": "Team 1"
          },
          {
                "username": "MamaBt",
                "section": "Team 1 starters",
                "voted": null,
                "joined": "yes",
                "ready": "ready",
                "starter": "Team 1"
          },
          {
                "username": "Rrrrrrrrrd",
                "section": "Team 1 removed",
                "voted": null,
                "joined": "no",
                "ready": "declined",
                "flag": "removed",
                "starter": "Team 1?",
                "note": "Declined team 2; removed from Team 1"
          },
          {
                "username": "crumbum271",
                "section": "Team 1 added",
                "voted": "team1",
                "joined": "yes",
                "ready": "ready",
                "flag": "added",
                "starter": "Team 1",
                "note": "Added to Team 1 late"
          },
          {
                "username": "CooksLS9",
                "section": "Team 1 substitutes",
                "voted": null,
                "sub": "Team 1"
          },
          {
                "username": "Provh",
                "section": "Team 1 substitutes",
                "voted": "either",
                "ready": "ready",
                "sub": "Team 1"
          },
          {
                "username": "Tẽmujïn",
                "section": "Team 1 substitutes",
                "voted": "team1",
                "joined": "yes",
                "ready": "ready",
                "sub": "Team 1"
          },
          {
                "username": "Raul863",
                "section": "Team 1 substitutes",
                "joined": "no",
                "voted": "team1",
                "ready": "ready",
                "sub": "Team 1"
          },
          {
                "username": "AvatarNavi",
                "section": "Team 1 substitutes",
                "joined": "no",
                "voted": "team1",
                "ready": "ready",
                "sub": "Team 1"
          },
          {
                "username": "PajuHalfLapin",
                "section": "Team 1 substitutes",
                "voted": "team1",
                "joined": "yes",
                "ready": "ready",
                "sub": "Team 1"
          },
          {
                "username": "levON",
                "section": "Team 1 substitutes",
                "voted": "team1",
                "joined": "yes",
                "ready": "ready",
                "sub": "Team 1"
          },
          {
                "username": "Pandoraloft",
                "section": "Team 1 substitutes",
                "joined": "no",
                "voted": "team1",
                "sub": "Team 1"
          },
          {
                "username": "Mapinski",
                "section": "Team 1 substitutes",
                "voted": "team1",
                "joined": "yes",
                "sub": "Team 1",
                "note": "Highlighted in sheet"
          },
          {
                "username": "-Yeti-",
                "section": "Team 1 substitutes",
                "voted": "team1",
                "joined": "yes",
                "ready": "ready",
                "sub": "Team 1"
          },
          {
                "username": "InkedWitch",
                "section": "Team 1 substitutes",
                "joined": "no",
                "voted": null,
                "ready": "ready",
                "sub": "Team 1"
          },
          {
                "username": "Queen Rouge",
                "section": "Team 2 starters",
                "voted": "either",
                "joined": "yes",
                "ready": "ready",
                "starter": "Team 2",
                "note": "R5"
          },
          {
                "username": "Mario AK47",
                "section": "Team 2 starters",
                "voted": "team2",
                "joined": "mvp",
                "ready": "ready",
                "starter": "Team 2",
                "note": "R4"
          },
          {
                "username": "RosolinoFriddi",
                "section": "Team 2 starters",
                "voted": "team2",
                "joined": "other_alliance",
                "ready": "ready",
                "starter": "Team 2",
                "note": "Played for ICE"
          },
          {
                "username": "TinaG",
                "section": "Team 2 starters",
                "voted": "team2",
                "joined": "yes",
                "ready": "ready",
                "starter": "Team 2",
                "note": "R4"
          },
          {
                "username": "Dorin",
                "section": "Team 2 starters",
                "voted": "team2",
                "joined": "yes",
                "ready": "ready",
                "starter": "Team 2"
          },
          {
                "username": "DeeDeeeee",
                "section": "Team 2 starters",
                "voted": "team2",
                "joined": "yes",
                "ready": "ready",
                "starter": "Team 2"
          },
          {
                "username": "JAY QUEEN",
                "section": "Team 2 starters",
                "voted": "team2",
                "joined": "yes",
                "ready": "ready",
                "starter": "Team 2"
          },
          {
                "username": "Dvon Khan",
                "section": "Team 2 starters",
                "voted": "team2",
                "joined": "yes",
                "ready": "ready",
                "starter": "Team 2"
          },
          {
                "username": "Galihad",
                "section": "Team 2 starters",
                "voted": "team2",
                "joined": "yes",
                "ready": "ready",
                "starter": "Team 2"
          },
          {
                "username": "DemonKingg",
                "section": "Team 2 starters",
                "voted": "team2",
                "joined": "yes",
                "starter": "Team 2"
          },
          {
                "username": "Dinkleberg6969",
                "section": "Team 2 starters",
                "voted": "team2",
                "joined": "yes",
                "ready": "ready",
                "starter": "Team 2"
          },
          {
                "username": "MaKaRa",
                "section": "Team 2 starters",
                "voted": "team2",
                "joined": "yes",
                "ready": "ready",
                "starter": "Team 2"
          },
          {
                "username": "Twist of Fate",
                "section": "Team 2 starters",
                "voted": "team2",
                "joined": "no",
                "starter": "Team 2",
                "note": "Did not join (red in sheet)"
          },
          {
                "username": "Appins",
                "section": "Team 2 starters",
                "voted": null,
                "joined": "yes",
                "ready": "ready",
                "starter": "Team 2",
                "note": "R4"
          },
          {
                "username": "Apparition-",
                "section": "Team 2 starters",
                "voted": null,
                "joined": "yes",
                "ready": "ready",
                "starter": "Team 2",
                "note": "R4"
          },
          {
                "username": "Nemo Hoes",
                "section": "Team 2 starters",
                "voted": null,
                "joined": "yes",
                "ready": "ready",
                "starter": "Team 2",
                "note": "R4"
          },
          {
                "username": "Pappless",
                "section": "Team 2 starters",
                "voted": null,
                "joined": "yes",
                "ready": "ready",
                "starter": "Team 2",
                "note": "R4"
          },
          {
                "username": "IcemanPowaaa",
                "section": "Team 2 starters",
                "voted": null,
                "joined": "yes",
                "starter": "Team 2"
          },
          {
                "username": "R8drz4life",
                "section": "Team 2 starters",
                "voted": null,
                "joined": "yes",
                "starter": "Team 2"
          },
          {
                "username": "Captain Cake",
                "section": "Team 2 starters",
                "voted": null,
                "joined": "yes",
                "ready": "ready",
                "starter": "Team 2?",
                "note": "Ready on team 1; sheet has conflicting team"
          },
          {
                "username": "JetPed",
                "section": "Team 2 substitutes",
                "joined": "no",
                "voted": "team2",
                "sub": "Team 2"
          },
          {
                "username": "KingLow",
                "section": "Team 2 substitutes",
                "voted": "team2",
                "joined": "yes",
                "ready": "ready",
                "sub": "Team 2"
          },
          {
                "username": "Sanatio Fax",
                "section": "Team 2 substitutes",
                "joined": "no",
                "voted": "team2",
                "sub": "Team 2"
          },
          {
                "username": "Krakenasaurus",
                "section": "Team 2 substitutes",
                "voted": "team2",
                "ready": "ready",
                "sub": "Team 2"
          },
          {
                "username": "DontMesswNess",
                "section": "Team 2 substitutes",
                "joined": "no",
                "voted": "team2",
                "ready": "ready",
                "sub": "Team 2"
          },
          {
                "username": "King of goats",
                "section": "Team 2 substitutes",
                "voted": "team2",
                "joined": "yes",
                "ready": "ready",
                "sub": "Team 2"
          },
          {
                "username": "USO Kiwi",
                "section": "Team 2 substitutes",
                "joined": "no",
                "voted": "team2",
                "ready": "ready",
                "sub": "Team 2"
          },
          {
                "username": "SophieUa",
                "section": "Team 2 substitutes",
                "joined": "no",
                "voted": null,
                "sub": "Team 2"
          },
          {
                "username": "Tubbie 300BLK",
                "section": "Team 2 substitutes",
                "voted": null,
                "sub": "Team 2"
          },
          {
                "username": "UndertakerGreg",
                "section": "Declined / offline",
                "voted": "team1",
                "ready": "declined"
          },
          {
                "username": "Rockysaurus",
                "section": "Declined / offline",
                "voted": "team1",
                "ready": "declined",
                "note": "Not in the app roster (RockyNoSpeedUps?)"
          },
          {
                "username": "Black-wolff",
                "section": "Declined / offline",
                "voted": "team1",
                "ready": "declined"
          },
          {
                "username": "hausshavoc",
                "section": "Declined / offline",
                "voted": null,
                "ready": "declined"
          },
          {
                "username": "Royal09",
                "section": "Declined / offline",
                "voted": null,
                "ready": "declined"
          },
          {
                "username": "Bigfor86",
                "section": "Declined / offline",
                "voted": null,
                "ready": "declined"
          },
          {
                "username": "SnoopyB",
                "section": "Declined / offline",
                "voted": null,
                "ready": "declined"
          },
          {
                "username": "• TooN •",
                "section": "Declined / offline",
                "voted": null,
                "ready": "declined"
          },
          {
                "username": "Dr House 96",
                "section": "Declined / offline",
                "voted": null,
                "ready": "declined"
          },
          {
                "username": "Wakeboy",
                "section": "Declined / offline",
                "voted": null,
                "ready": "declined"
          },
          {
                "username": "pi nk",
                "section": "Declined / offline",
                "voted": null,
                "ready": "declined"
          },
          {
                "username": "MathSic",
                "section": "Declined / offline",
                "voted": null,
                "ready": "offline"
          },
          {
                "username": "Anton S",
                "section": "Ready list",
                "voted": "team1",
                "ready": "ready"
          },
          {
                "username": "Bachter",
                "section": "Ready list",
                "joined": "no",
                "voted": "team1",
                "ready": "ready"
          },
          {
                "username": "-Aleks-",
                "section": "Ready list",
                "voted": "team1",
                "ready": "ready"
          },
          {
                "username": "Pmari Snow",
                "section": "Ready list",
                "joined": "no",
                "voted": "team1",
                "ready": "ready"
          },
          {
                "username": "Thir13en",
                "section": "Ready list",
                "voted": null,
                "ready": "ready"
          },
          {
                "username": "Momit",
                "section": "Ready list",
                "voted": null,
                "ready": "ready"
          },
          {
                "username": "MysticPotato",
                "section": "Ready list",
                "voted": null,
                "ready": "ready"
          },
          {
                "username": "Wanderer629",
                "section": "Ready list",
                "joined": "no",
                "voted": null,
                "ready": "ready"
          },
          {
                "username": "Texas Roman",
                "section": "Ready list",
                "voted": null,
                "ready": "ready",
                "note": "Ready Team 2; doesn't show up"
          },
          {
                "username": "LostSoul1213",
                "section": "Ready list",
                "joined": "no",
                "voted": "either",
                "ready": "ready",
                "note": "Doesn't show up"
          },
          {
                "username": "Pitour",
                "section": "Didn't vote or respond",
                "joined": "no",
                "voted": "team1"
          },
          {
                "username": "Kotsos rs6",
                "section": "Didn't vote or respond",
                "voted": "team1"
          },
          {
                "username": "Potepuhec",
                "section": "Didn't vote or respond",
                "joined": "no",
                "voted": "team1"
          },
          {
                "username": "Matt02",
                "section": "Didn't vote or respond",
                "joined": "no",
                "voted": "team2"
          },
          {
                "username": "Swarly",
                "section": "Didn't vote or respond",
                "voted": "team2"
          },
          {
                "username": "Kane •",
                "section": "Didn't vote or respond",
                "voted": null
          },
          {
                "username": "Jeanniee",
                "section": "Didn't vote or respond",
                "voted": null
          },
          {
                "username": "Robamboo",
                "section": "Didn't vote or respond",
                "voted": null
          },
          {
                "username": "Oggie83",
                "section": "Didn't vote or respond",
                "voted": null
          },
          {
                "username": "Warriorwarrior",
                "section": "Didn't vote or respond",
                "joined": "no",
                "voted": null
          },
          {
                "username": "LoC187",
                "section": "Didn't vote or respond",
                "voted": null
          },
          {
                "username": "kikimyu",
                "section": "Didn't vote or respond",
                "voted": null
          },
          {
                "username": "the david",
                "section": "Didn't vote or respond",
                "voted": null
          },
          {
                "username": "Luigi Banana",
                "section": "Didn't vote or respond",
                "voted": null
          },
          {
                "username": "coincoin18",
                "section": "Didn't vote or respond",
                "voted": null
          },
          {
                "username": "pepito",
                "section": "Didn't vote or respond",
                "joined": "no",
                "voted": null
          }
    ],
  },
  {
    event_date: '2026-09-18',
    label: 'Votes from the 09-18 Canyon tab',
    source: 'The "09-18 Canyon" tab screenshot: the 18:00, 23:00 and Both columns as votes, "Played Last week" kept as a note; names matched to the roster',
    rows: [
      {
        "username": "Queen Rouge",
        "section": "Voted 18:00",
        "voted": "team1"
      },
      {
        "username": "Mada",
        "section": "Voted 18:00",
        "voted": "team1"
      },
      {
        "username": "JoelitoBB",
        "section": "Voted 18:00",
        "voted": "team1"
      },
      {
        "username": "LostSoul1213",
        "section": "Voted 18:00",
        "voted": "team1",
        "note": "Last week: No"
      },
      {
        "username": "Dorin",
        "section": "Voted either time",
        "voted": "either"
      },
      {
        "username": "Ultra EGO",
        "section": "Voted 18:00",
        "voted": "team1"
      },
      {
        "username": "Raul863",
        "section": "Voted 18:00",
        "voted": "team1",
        "note": "Last week: Sub (No)"
      },
      {
        "username": "Pandoraloft",
        "section": "Voted 18:00",
        "voted": "team1",
        "note": "Last week: No"
      },
      {
        "username": "-Yeti-",
        "section": "Voted 18:00",
        "voted": "team1",
        "note": "Last week: Sub (Yes)"
      },
      {
        "username": "Shastorm",
        "section": "Voted 18:00",
        "voted": "team1"
      },
      {
        "username": "Tẽmujïn",
        "section": "Voted either time",
        "voted": "either",
        "slots": {
          "team1": 1,
          "team2": 2
        },
        "note": "Can do both, prefers 18:00 · Last week: Sub (Yes)"
      },
      {
        "username": "MamaBt",
        "section": "Voted 18:00",
        "voted": "team1"
      },
      {
        "username": "Bachter",
        "section": "Voted 18:00",
        "voted": "team1",
        "note": "Last week: No"
      },
      {
        "username": "SwiftBunny DH",
        "section": "Voted 18:00",
        "voted": "team1"
      },
      {
        "username": "AvatarNavi",
        "section": "Voted 18:00",
        "voted": "team1",
        "note": "Last week: Sub (No)"
      },
      {
        "username": "levON",
        "section": "Voted 18:00",
        "voted": "team1",
        "note": "Last week: Sub (Yes)"
      },
      {
        "username": "Chika Strike",
        "section": "Voted 18:00",
        "voted": "team1",
        "note": "Last week: MVP"
      },
      {
        "username": "Potepuhec",
        "section": "Voted 18:00",
        "voted": "team1",
        "note": "Last week: No"
      },
      {
        "username": "Sats0mNlak",
        "section": "Voted 18:00",
        "voted": "team1"
      },
      {
        "username": "PajuHalfLapin",
        "section": "Voted 18:00",
        "voted": "team1",
        "note": "Last week: No"
      },
      {
        "username": "Azale",
        "section": "Voted 18:00",
        "voted": "team1",
        "note": "Last week: No"
      },
      {
        "username": "• Dyo •",
        "section": "Voted 18:00",
        "voted": "team1"
      },
      {
        "username": "Flowmotion47",
        "section": "Voted 18:00",
        "voted": "team1"
      },
      {
        "username": "Matt02",
        "section": "Voted 18:00",
        "voted": "team1",
        "note": "Last week: No"
      },
      {
        "username": "Giovanni Savage",
        "section": "Voted 18:00",
        "voted": "team1"
      },
      {
        "username": "Mapinski",
        "section": "Voted 18:00",
        "voted": "team1",
        "note": "Last week: Sub (Yes)"
      },
      {
        "username": "Victoria13",
        "section": "Voted either time",
        "voted": "either"
      },
      {
        "username": "crumbum271",
        "section": "Voted 18:00",
        "voted": "team1"
      },
      {
        "username": "Pmari Snow",
        "section": "Voted 18:00",
        "voted": "team1",
        "note": "Last week: No"
      },
      {
        "username": "Warriorwarrior",
        "section": "Voted 18:00",
        "voted": "team1",
        "note": "Last week: No"
      },
      {
        "username": "Pitour",
        "section": "Voted 18:00",
        "voted": "team1",
        "note": "Last week: No"
      },
      {
        "username": "Mario AK47",
        "section": "Voted 23:00",
        "voted": "team2"
      },
      {
        "username": "RosolinoFriddi",
        "section": "Voted 23:00",
        "voted": "team2"
      },
      {
        "username": "TinaG",
        "section": "Voted 23:00",
        "voted": "team2"
      },
      {
        "username": "Apparition-",
        "section": "Voted 23:00",
        "voted": "team2"
      },
      {
        "username": "Galihad",
        "section": "Voted either time",
        "voted": "either"
      },
      {
        "username": "DemonKingg",
        "section": "Voted 23:00",
        "voted": "team2"
      },
      {
        "username": "JetPed",
        "section": "Voted 23:00",
        "voted": "team2",
        "note": "Last week: No"
      },
      {
        "username": "SophieUa",
        "section": "Voted 23:00",
        "voted": "team2",
        "note": "Last week: No"
      },
      {
        "username": "raZ",
        "section": "Voted 23:00",
        "voted": "team2"
      },
      {
        "username": "King of goats",
        "section": "Voted 23:00",
        "voted": "team2",
        "note": "Last week: Sub (Yes)"
      },
      {
        "username": "DeeDeeeee",
        "section": "Voted 23:00",
        "voted": "team2"
      },
      {
        "username": "KingLow",
        "section": "Voted 23:00",
        "voted": "team2",
        "note": "Last week: Sub (Yes)"
      },
      {
        "username": "JAY QUEEN",
        "section": "Voted 23:00",
        "voted": "team2"
      },
      {
        "username": "MaKaRa",
        "section": "Voted 23:00",
        "voted": "team2"
      },
      {
        "username": "Captain Cake",
        "section": "Voted 23:00",
        "voted": "team2"
      },
      {
        "username": "pepito",
        "section": "Voted 23:00",
        "voted": "team2",
        "note": "Last week: No"
      },
      {
        "username": "-PIM-",
        "section": "Voted either time",
        "voted": "either"
      },
      {
        "username": "Vodkashot",
        "section": "Voted 23:00",
        "voted": "team2",
        "note": "Last week: No"
      },
      {
        "username": "Wanderer629",
        "section": "Voted 23:00",
        "voted": "team2",
        "note": "Last week: No"
      },
      {
        "username": "Dinkleberg6969",
        "section": "Voted 23:00",
        "voted": "team2"
      },
      {
        "username": "DontMesswNess",
        "section": "Voted 23:00",
        "voted": "team2",
        "note": "Last week: Sub (No)"
      },
      {
        "username": "Sanatio Fax",
        "section": "Voted 23:00",
        "voted": "team2",
        "note": "Last week: Sub (No)"
      },
      {
        "username": "Dvon Khan",
        "section": "Voted 23:00",
        "voted": "team2"
      },
      {
        "username": "USO Kiwi",
        "section": "Voted either time",
        "voted": "either",
        "note": "Last week: Sub (No)"
      },
      {
        "username": "Appins",
        "section": "Voted either time",
        "voted": "either"
      },
      {
        "username": "Pappless",
        "section": "Voted either time",
        "voted": "either"
      },
      {
        "username": "InkedWitch",
        "section": "Voted either time",
        "voted": "either",
        "note": "Last week: No"
      }
    ],
  },
];
