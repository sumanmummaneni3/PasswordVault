use rand_core::{OsRng, RngCore};
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum GeneratorError {
    #[error("No character classes selected — enable at least one")]
    EmptyCharset,
    #[error("Word count must be between 2 and 12")]
    InvalidWordCount,
    #[error("Password length must be between 4 and 256")]
    InvalidLength,
}

impl From<GeneratorError> for String {
    fn from(e: GeneratorError) -> String {
        e.to_string()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PasswordOptions {
    pub length: u8,
    pub uppercase: bool,
    pub lowercase: bool,
    pub numbers: bool,
    pub symbols: bool,
    pub custom_symbols: Option<String>,
    /// Remove visually ambiguous characters: 0, O, l, 1, I
    pub exclude_ambiguous: bool,
}

impl Default for PasswordOptions {
    fn default() -> Self {
        Self {
            length: 20,
            uppercase: true,
            lowercase: true,
            numbers: true,
            symbols: true,
            custom_symbols: None,
            exclude_ambiguous: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PassphraseOptions {
    pub word_count: u8,
    pub separator: String,
    pub capitalize: bool,
    pub include_number: bool,
}

impl Default for PassphraseOptions {
    fn default() -> Self {
        Self {
            word_count: 5,
            separator: "-".to_string(),
            capitalize: true,
            include_number: true,
        }
    }
}

/// Weighted password generation algorithm:
///
/// Character classes are sampled in two stages:
///   1. Pick a class with probability proportional to its weight
///      (uppercase=3, lowercase=3, digits=2, symbols=1)
///   2. Pick uniformly within that class
///
/// This keeps letters dominant while digits appear regularly and symbols
/// appear sparingly — making the result readable without sacrificing strength.
///
/// Default symbols are `-` and `@` (common, rarely break web forms).
/// If the user supplies custom symbols they fully replace the default set.
///
/// Before returning, one character from each enabled class is guaranteed to
/// appear (inserted then shuffled), so site requirements are always met.
pub fn generate_password(opts: &PasswordOptions) -> Result<String, GeneratorError> {
    if opts.length < 4 {
        return Err(GeneratorError::InvalidLength);
    }

    const AMBIGUOUS: &str = "0Ol1I";

    let filter = |src: &str| -> Vec<char> {
        if opts.exclude_ambiguous {
            src.chars().filter(|c| !AMBIGUOUS.contains(*c)).collect()
        } else {
            src.chars().collect()
        }
    };

    // Build (pool, weight) pairs for each enabled class
    let mut pools: Vec<(Vec<char>, u32)> = Vec::new();

    if opts.uppercase {
        let p = filter("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
        if !p.is_empty() {
            pools.push((p, 3));
        }
    }
    if opts.lowercase {
        let p = filter("abcdefghijklmnopqrstuvwxyz");
        if !p.is_empty() {
            pools.push((p, 3));
        }
    }
    if opts.numbers {
        let p = filter("0123456789");
        if !p.is_empty() {
            pools.push((p, 2));
        }
    }
    if opts.symbols {
        // Custom symbols take full priority; otherwise use the safe defaults -@
        let raw = opts.custom_symbols.as_deref().unwrap_or("-@");
        // Deduplicate while preserving order
        let mut seen = std::collections::HashSet::new();
        let p: Vec<char> = raw.chars().filter(|c| seen.insert(*c)).collect();
        if !p.is_empty() {
            pools.push((p, 1));
        }
    }

    if pools.is_empty() {
        return Err(GeneratorError::EmptyCharset);
    }

    let length = opts.length as usize;
    let mut result: Vec<char> = Vec::with_capacity(length);

    // Guarantee at least one character from each enabled class
    for (pool, _) in &pools {
        if result.len() < length {
            result.push(pick_from(pool));
        }
    }

    // Fill remaining positions: pick a class by weight, then pick within it
    let total_weight: u32 = pools.iter().map(|(_, w)| *w).sum();
    while result.len() < length {
        let idx = weighted_pick(&pools, total_weight);
        result.push(pick_from(&pools[idx].0));
    }

    // Fisher-Yates shuffle — ensures guaranteed chars aren't always at the front
    fisher_yates(&mut result);

    Ok(result.into_iter().collect())
}

/// Picks a random element from `pool` using rejection sampling (no modulo bias).
fn pick_from(pool: &[char]) -> char {
    let n = pool.len() as u64;
    let max_valid = (u64::MAX / n) * n;
    loop {
        let r = OsRng.next_u64();
        if r < max_valid {
            return pool[(r % n) as usize];
        }
    }
}

/// Selects a pool index proportional to its weight, with no modulo bias.
fn weighted_pick(pools: &[(Vec<char>, u32)], total_weight: u32) -> usize {
    let tw = total_weight as u64;
    let max_valid = (u64::MAX / tw) * tw;
    loop {
        let r = OsRng.next_u64();
        if r < max_valid {
            let pick = (r % tw) as u32;
            let mut cumulative = 0u32;
            for (i, (_, w)) in pools.iter().enumerate() {
                cumulative += w;
                if pick < cumulative {
                    return i;
                }
            }
        }
    }
}

/// In-place Fisher-Yates shuffle using cryptographic randomness.
fn fisher_yates(buf: &mut Vec<char>) {
    let n = buf.len();
    for i in (1..n).rev() {
        let range = (i + 1) as u64;
        let max_valid = (u64::MAX / range) * range;
        loop {
            let r = OsRng.next_u64();
            if r < max_valid {
                buf.swap(i, (r % range) as usize);
                break;
            }
        }
    }
}

pub fn generate_passphrase(opts: &PassphraseOptions) -> Result<String, GeneratorError> {
    if opts.word_count < 2 || opts.word_count > 12 {
        return Err(GeneratorError::InvalidWordCount);
    }

    let list = WORD_LIST;
    let max_valid = (u64::MAX / list.len() as u64) * list.len() as u64;

    let mut words: Vec<String> = Vec::with_capacity(opts.word_count as usize);
    for _ in 0..opts.word_count {
        loop {
            let rand = OsRng.next_u64();
            if rand < max_valid {
                let word = list[(rand as usize) % list.len()];
                let w = if opts.capitalize {
                    let mut chars = word.chars();
                    match chars.next() {
                        None => String::new(),
                        Some(f) => f.to_uppercase().collect::<String>() + chars.as_str(),
                    }
                } else {
                    word.to_string()
                };
                words.push(w);
                break;
            }
        }
    }

    let mut passphrase = words.join(&opts.separator);

    if opts.include_number {
        let mut n_bytes = [0u8; 4];
        OsRng.fill_bytes(&mut n_bytes);
        let n = u32::from_le_bytes(n_bytes) % 9000 + 1000; // 4-digit number
        passphrase.push_str(&opts.separator);
        passphrase.push_str(&n.to_string());
    }

    Ok(passphrase)
}

// ~800-word curated list for passphrase generation (~9.6 bits/word).
// 5 words ≈ 48 bits, 6 words ≈ 58 bits, 7 words ≈ 67 bits entropy.
const WORD_LIST: &[&str] = &[
    "abbey", "abide", "able", "absorb", "accent", "access", "account", "achieve", "acid",
    "across", "action", "active", "adapt", "adult", "advice", "afford", "afraid", "agent",
    "agree", "ahead", "alarm", "album", "alert", "alien", "align", "alive", "alley", "allow",
    "alone", "alter", "amaze", "amber", "ample", "amuse", "angel", "angle", "angry", "ankle",
    "annex", "apple", "apply", "arena", "argue", "arise", "armor", "arrow", "aside", "asset",
    "atlas", "audio", "avoid", "award", "aware", "awful", "bacon", "badge", "baker", "basic",
    "batch", "beach", "beard", "beast", "begin", "bench", "birth", "black", "blade", "blame",
    "blank", "blast", "blaze", "blend", "blind", "block", "blood", "bloom", "blown", "board",
    "bonus", "boost", "booth", "bound", "brave", "bread", "break", "brief", "bring", "broad",
    "broke", "brook", "brown", "brush", "buddy", "build", "built", "burst", "cabin", "candy",
    "cargo", "carry", "catch", "cause", "cedar", "chain", "chalk", "charm", "chart", "chase",
    "cheap", "check", "chess", "chief", "child", "chill", "civic", "civil", "claim", "clamp",
    "clash", "class", "clean", "clear", "clerk", "click", "cliff", "climb", "clock", "close",
    "cloud", "coach", "coast", "coral", "count", "court", "cover", "craft", "crane", "crash",
    "cream", "creek", "crisp", "cross", "crowd", "crown", "crush", "cubic", "curve", "daily",
    "dance", "delta", "depth", "dirty", "draft", "drain", "drama", "dream", "dress", "dried",
    "drift", "drink", "drive", "drone", "drown", "dusty", "eagle", "early", "earth", "eight",
    "elite", "empty", "enter", "equal", "erase", "essay", "event", "exact", "exist", "extra",
    "faint", "faith", "feast", "fence", "ferry", "field", "fifty", "fight", "fixed", "flame",
    "flash", "flesh", "float", "flood", "floor", "flour", "fluid", "flute", "focus", "force",
    "forge", "found", "frame", "frank", "freed", "fresh", "frost", "fruit", "fully", "gauge",
    "giant", "given", "glass", "gleam", "globe", "gloom", "glory", "glove", "grace", "grade",
    "grain", "grant", "grasp", "grass", "grave", "great", "green", "greet", "grief", "grind",
    "groan", "group", "grove", "grown", "guard", "guess", "guest", "guide", "guild", "happy",
    "harsh", "haste", "haunt", "heart", "heavy", "herbs", "hinge", "holly", "honey", "honor",
    "horse", "hotel", "human", "humor", "ideal", "image", "inner", "issue", "jewel", "joint",
    "judge", "juice", "jumbo", "karma", "kayak", "knife", "known", "labor", "lance", "large",
    "laser", "later", "laugh", "layer", "learn", "leave", "ledge", "legal", "lemon", "level",
    "light", "limit", "linen", "liver", "local", "lodge", "logic", "lunar", "magic", "major",
    "maple", "march", "marsh", "match", "mercy", "merit", "metal", "meter", "minor", "model",
    "money", "month", "moral", "motor", "mount", "mouse", "mouth", "music", "naive", "nerve",
    "night", "noble", "noise", "north", "novel", "nudge", "nurse", "ocean", "offer", "olive",
    "onion", "orbit", "otter", "outer", "oxide", "paint", "panic", "paper", "patch", "pause",
    "peace", "pearl", "penny", "phone", "photo", "pilot", "pitch", "pixel", "plain", "plant",
    "plate", "plaza", "pluck", "point", "polar", "pound", "power", "press", "price", "pride",
    "prime", "print", "prior", "prize", "probe", "proof", "prose", "proud", "prove", "pulse",
    "purse", "quest", "quick", "quiet", "quota", "quote", "radar", "radio", "raise", "ranch",
    "range", "rapid", "reach", "realm", "rebel", "reign", "relax", "reply", "rider", "ridge",
    "rigid", "risky", "rival", "river", "robin", "robot", "rocky", "rough", "round", "route",
    "rover", "royal", "ruler", "scale", "scene", "scent", "scope", "score", "scout", "sense",
    "serve", "seven", "shade", "shake", "shame", "shape", "shark", "sharp", "shift", "shock",
    "short", "sight", "sixty", "skill", "slate", "sleep", "slide", "slope", "smart", "smile",
    "smoke", "solid", "solve", "sorry", "sound", "south", "space", "spare", "spark", "speak",
    "spear", "speed", "spend", "spine", "split", "sport", "spray", "stage", "stain", "stair",
    "stake", "stand", "stare", "stark", "start", "steam", "steep", "stern", "stick", "still",
    "stock", "stone", "store", "storm", "story", "stove", "strap", "straw", "strip", "study",
    "sugar", "super", "surge", "sweet", "swift", "table", "taste", "teach", "teeth", "theme",
    "thick", "think", "three", "throw", "tiger", "tight", "timer", "tired", "title", "today",
    "token", "topic", "total", "touch", "tough", "trace", "track", "trade", "trail", "train",
    "trait", "trash", "treat", "trend", "trial", "tribe", "trick", "trust", "twist", "ultra",
    "uncle", "under", "unity", "until", "upper", "urban", "usage", "usual", "utter", "valid",
    "valor", "value", "valve", "vault", "video", "vigor", "viral", "virus", "visit", "vital",
    "vivid", "vocal", "voice", "waist", "waste", "watch", "water", "weary", "wedge", "weird",
    "white", "whole", "wider", "windy", "woman", "world", "worry", "worth", "yacht", "yield",
    "young", "youth", "zebra", "zesty", "blunt", "braid", "brand", "brash", "bravo", "brisk",
    "brood", "brute", "canal", "caper", "cameo", "carol", "cadet", "chalk", "champ", "chant",
    "chasm", "cheek", "cheer", "chimp", "cloak", "clone", "cloth", "clown", "cocoa", "comet",
    "comic", "croak", "crumb", "decor", "decoy", "dense", "depot", "digit", "disco", "dodge",
    "dough", "dowel", "dread", "drawn", "elbow", "email", "ember", "emote", "enact", "endow",
    "epoch", "evade", "exert", "exile", "exult", "fable", "facet", "fancy", "farce", "fatal",
    "felon", "fever", "fiber", "finch", "flare", "flair", "flock", "flora", "foggy", "folio",
    "forte", "freak", "frond", "froze", "glaze", "gloat", "gloss", "goose", "gorge", "gravy",
    "grill", "grimy", "gross", "guava", "guile", "gusto", "habit", "hatch", "haven", "heist",
    "helix", "heron", "hippo", "hoist", "homer", "hound", "hover", "husky", "iceberg", "igloo",
    "imply", "indie", "infer", "input", "intro", "irate", "ivory", "jaunt", "jazzy", "jolly",
    "joust", "juicy", "jumpy", "koala", "kudos", "lanky", "lofty", "loner", "loose", "lurch",
    "lusty", "lyric", "manor", "melon", "mirth", "misty", "mixed", "moat", "motto", "mulch",
    "musty", "niche", "nutty", "nymph", "oasis", "optic", "organ", "otter", "ought", "paddy",
    "pagan", "pansy", "parka", "patio", "pedal", "perch", "petty", "piano", "pirate", "plaid",
    "plank", "plumb", "plume", "plump", "podium", "polka", "porch", "pouch", "prank", "prawn",
    "preen", "prism", "prone", "prune", "quell", "query", "quilt", "rabid", "radon", "rainy",
    "rally", "ramen", "raven", "rayon", "rebus", "reedy", "renew", "repel", "resin", "retro",
    "revel", "rivet", "rodeo", "rowdy", "ruddy", "rupee", "rusty", "salve", "sandy", "satin",
    "sauce", "savvy", "scalp", "scone", "scorn", "scrub", "serif", "serum", "shale", "sheen",
    "sheep", "shelf", "shell", "shiny", "shore", "shrug", "sized", "slant", "sleek", "sleet",
    "slick", "slink", "smack", "smell", "snare", "snide", "snoop", "soggy", "solar", "sonic",
    "sonar", "speck", "spite", "spoke", "spoon", "squid", "stale", "stamp", "stash", "state",
    "stave", "steel", "steed", "stomp", "stump", "stuff", "style", "suite", "sulky", "sunny",
    "swamp", "swarm", "swine", "swipe", "swoop", "syrup", "tacky", "tangy", "taunt", "tawny",
    "tempo", "tense", "tepid", "terse", "thorn", "thump", "tibia", "timid", "titan", "topaz",
    "toxic", "trawl", "tripe", "troll", "trout", "truce", "truly", "tubby", "tulip", "turbo",
    "usher", "unify", "unite", "unzip", "venom", "verse", "villa", "viper", "visor", "vixen",
    "vodka", "vogue", "wader", "waltz", "whelp", "whirl", "witty", "women", "wrath", "wrist",
    "yodel",
];
