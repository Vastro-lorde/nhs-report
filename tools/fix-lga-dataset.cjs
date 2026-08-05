/**
 * One-off repair of `nigerian-states-lga.json`.
 *
 * The dataset had the right shape (37 states, 774 LGAs, correct per-state
 * counts, full ward lists) but a large number of LGA *names* were truncated
 * ("IsokoSou", "AniochaN", "Abua/Odu"), misspelled ("Esan Centtral", "Emuoha")
 * or outdated ("Egbado North" was renamed Yewa North in 2020). Names that never
 * matched what users actually type left those fellows with no resolvable state.
 *
 * Only `name` fields are rewritten — every `wards` array, coordinate and
 * ordering is preserved byte-for-byte.
 *
 * Dry-run:  node tools/fix-lga-dataset.cjs
 * Apply:    node tools/fix-lga-dataset.cjs --apply
 * Apply to a copy (for before/after verification):
 *           node tools/fix-lga-dataset.cjs --apply --out /path/to/copy.json
 */

"use strict";

const fs = require("fs");
const path = require("path");

const APPLY = process.argv.includes("--apply");
const outIdx = process.argv.indexOf("--out");
const SOURCE = path.resolve(__dirname, "../nigerian-states-lga.json");
const TARGET = outIdx !== -1 ? path.resolve(process.argv[outIdx + 1]) : SOURCE;

/**
 * state → { currentName: correctName }
 *
 * Deliberately conservative: a name is only changed where the current value is
 * wrong AND the new value does not strand an existing database record. Variants
 * that users already have stored and that resolve today (Shomolu, Shagamu,
 * Ilesha, Ayedaade …) are left alone even where another spelling is more
 * official — correctness for live data beats orthographic purity.
 */
const RENAMES = {
  Abia: {
    "Oboma Ngwa": "Obi Ngwa",
    "Umu-Nneochi": "Umunneochi",
  },
  Adamawa: {
    Girie: "Girei",
    Teungo: "Toungo",
  },
  "Akwa Ibom": {
    "Urue Offong|Oruko": "Urue-Offong/Oruko",
  },
  Bauchi: {
    Gamjuwa: "Ganjuwa",
  },
  Bayelsa: {
    "Kolokuma-Opokuma": "Kolokuma/Opokuma",
  },
  Benue: {
    "Katsina- Ala": "Katsina-Ala",
    Oturkpo: "Otukpo",
  },
  Delta: {
    AniochaN: "Aniocha North",
    AniochaS: "Aniocha South",
    EthiopeE: "Ethiope East",
    IkaNorth: "Ika North East",
    IkaSouth: "Ika South",
    IsokoNor: "Isoko North",
    IsokoSou: "Isoko South",
    "Warri South-West": "Warri South West",
  },
  Ebonyi: {
    Abakalik: "Abakaliki",
  },
  Edo: {
    "Esan Centtral": "Esan Central",
    Orhionmw: "Orhionmwon",
  },
  Ekiti: {
    Gboyin: "Gbonyin",
    "Irepodun-Ifelodun": "Irepodun/Ifelodun",
    "Ise-Orun": "Ise/Orun",
  },
  Enugu: {
    EnuguSou: "Enugu South",
    "Igbo-Eti": "Igbo Etiti",
    "Igbo-eze North": "Igbo Eze North",
    "Igbo-eze South": "Igbo Eze South",
  },
  FCT: {
    // Stored values say "Abuja Municipal"; the bare "Municipal" matched nothing.
    Municipal: "Abuja Municipal Area Council",
  },
  Gombe: {
    Shomgom: "Shongom",
    "Yalmatu / Deba": "Yamaltu/Deba",
  },
  Imo: {
    "Ihitte-Uboma Isinweke": "Ihitte/Uboma",
    Unuimo: "Onuimo",
    "Aboh-Mbaise": "Aboh Mbaise",
    "Ahiazu-Mbaise": "Ahiazu Mbaise",
    "Ehime-Mbano": "Ehime Mbano",
    "Ngor-Okpala": "Ngor Okpala",
    "Ohaji-Egbema": "Ohaji/Egbema",
    "Oru-East": "Oru East",
    "Oru-West": "Oru West",
  },
  Jigawa: {
    // "Kiri Kasamma", not "Kiri Kasama" — the database stores the double-m form.
    "Kirika Samma": "Kiri Kasamma",
    "Malam Mado": "Malam Madori",
  },
  Kano: {
    "Tundun Wada": "Tudun Wada",
    "Garum Mallam": "Garun Malam",
  },
  Katsina: {
    "Dutsin-M": "Dutsin-Ma",
    "Katsina (K)": "Katsina",
    Kankiya: "Kankia",
    Danmusa: "Dan Musa",
  },
  Kebbi: {
    "Koko/Bes": "Koko/Besse",
    "Danko Wasagu": "Danko/Wasagu",
  },
  Kogi: {
    // Stored values use the bare "Kogi" for this LGA.
    "Koton-Karfe": "Kogi/Koton Karfe",
    "Kabba-Bunu": "Kabba/Bunu",
    "Ogori Magongo": "Ogori/Magongo",
  },
  // Kwara needs no changes: "Patigi" is the more official spelling, but every
  // stored record uses "Pategi" and renaming would strand all of them.
  Lagos: {
    Badagary: "Badagry",
    "Ifako/Ijaye": "Ifako-Ijaiye",
    "Amuwo Odofin": "Amuwo-Odofin",
    "Ajeromi/Ifelodun": "Ajeromi-Ifelodun",
    "Ibeju/Lekki": "Ibeju-Lekki",
    "Oshodi/Isolo": "Oshodi-Isolo",
  },
  Niger: {
    Kontogur: "Kontagora",
    Muya: "Munya",
  },
  Ogun: {
    // Renamed in 2020; the database already uses the new names.
    "Egbado North": "Yewa North",
    "Egbado South": "Yewa South",
    "Ado Odo-Ota": "Ado-Odo/Ota",
    "Ijebu-Ode": "Ijebu Ode",
    "Obafemi-Owode": "Obafemi Owode",
    "Imeko-Afon": "Imeko Afon",
  },
  Ondo: {
    AkokoNorthWest: "Akoko North West",
    "IleOluji/Okeigbo": "Ile Oluji/Okeigbo",
  },
  Osun: {
    IfeCentral: "Ife Central",
    Ayedaade: "Aiyedaade",
    Ayedire: "Aiyedire",
    "Atakumosa East": "Atakunmosa East",
    "Atakumosa West": "Atakunmosa West",
    "Ilesha East": "Ilesa East",
    "Ilesha West": "Ilesa West",
    "Odo Otin": "Odo-Otin",
    "Ola-Oluwa": "Ola Oluwa",
  },
  Plateau: {
    "Qua'anpa": "Qua'an Pan",
  },
  Rivers: {
    "Abua/Odu": "Abua/Odual",
    Akukutor: "Akuku-Toru",
    "Andoni/Odual": "Andoni",
    Emuoha: "Emohua",
    "Ogba/Egbema/Andoni": "Ogba/Egbema/Ndoni",
    Omumma: "Omuma",
  },
  Sokoto: {
    Gwadabaw: "Gwadabawa",
    Tambawal: "Tambuwal",
    Tangazar: "Tangaza",
  },
  Yobe: {
    Borsari: "Bursari",
  },
  Zamfara: {
    "Birnin Magaji": "Birnin Magaji/Kiyaw",
    "Kaura-Namoda": "Kaura Namoda",
    "Talata-Mafara": "Talata Mafara",
  },
};

function main() {
  const data = JSON.parse(fs.readFileSync(SOURCE, "utf8"));

  const applied = [];
  const missing = [];

  for (const entry of data) {
    const renames = RENAMES[entry.state];
    if (!renames) continue;

    const seen = new Set();
    for (const lga of entry.lgas) {
      const next = renames[lga.name];
      if (!next) continue;
      seen.add(lga.name);
      applied.push(`${entry.state}: "${lga.name}" → "${next}"`);
      lga.name = next;
    }

    for (const from of Object.keys(renames)) {
      if (!seen.has(from)) missing.push(`${entry.state}: "${from}" not found`);
    }
  }

  if (missing.length) {
    console.error(`${missing.length} rename(s) did not match anything — the dataset may already be patched:`);
    for (const m of missing) console.error(`  ${m}`);
    console.error("");
  }

  // Integrity checks — the repair must not change the shape of the data.
  const totalLgas = data.reduce((n, e) => n + e.lgas.length, 0);
  const totalWards = data.reduce(
    (n, e) => n + e.lgas.reduce((m, l) => m + (l.wards?.length ?? 0), 0),
    0,
  );
  console.log(`States: ${data.length}   LGAs: ${totalLgas}   Wards: ${totalWards}`);
  if (data.length !== 37 || totalLgas !== 774) {
    console.error("Shape check FAILED — expected 37 states and 774 LGAs. Aborting.");
    process.exit(1);
  }

  // No state may end up with two LGAs of the same name.
  for (const entry of data) {
    const names = entry.lgas.map((l) => l.name);
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    if (dupes.length) {
      console.error(`Duplicate LGA name(s) in ${entry.state}: ${[...new Set(dupes)].join(", ")}. Aborting.`);
      process.exit(1);
    }
  }

  console.log(`\n${applied.length} name correction(s):`);
  for (const a of applied) console.log(`  ${a}`);

  if (!APPLY) {
    console.log("\nDry run — re-run with --apply to write the file.");
    return;
  }

  fs.writeFileSync(TARGET, JSON.stringify(data, null, 2) + "\n");
  console.log(`\nWrote ${TARGET}`);
}

main();
