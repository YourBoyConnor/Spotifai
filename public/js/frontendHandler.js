import OpenAI from 'openai';

var badWords = ["4r5e", "5h1t", "5hit", "a55", "anal", "anus", "ar5e", "arrse", "arse", "ass", "ass-fucker", "asses", "assfucker", "assfukka", "asshole", "assholes", "asswhole", "a_s_s", "b!tch", "b00bs", "b17ch", "b1tch", "ballbag", "balls", "ballsack", "bastard", "beastial", "beastiality", "bellend", "bestial", "bestiality", "bi+ch", "biatch", "bitch", "bitcher", "bitchers", "bitches", "bitchin", "bitching", "bloody", "blow job", "blowjob", "blowjobs", "boiolas", "bollock", "bollok", "boner", "boob", "boobs", "booobs", "boooobs", "booooobs", "booooooobs", "breasts", "buceta", "bugger", "bum", "bunny fucker", "butt", "butthole", "buttmuch", "buttplug", "c0ck", "c0cksucker", "carpet muncher", "cawk", "chink", "cipa", "cl1t", "clit", "clitoris", "clits", "cnut", "cock", "cock-sucker", "cockface", "cockhead", "cockmunch", "cockmuncher", "cocks", "cocksuck", "cocksucked", "cocksucker", "cocksucking", "cocksucks", "cocksuka", "cocksukka", "cok", "cokmuncher", "coksucka", "coon", "cox", "crap", "cum", "cummer", "cumming", "cums", "cumshot", "cunilingus", "cunillingus", "cunnilingus", "cunt", "cuntlick", "cuntlicker", "cuntlicking", "cunts", "cyalis", "cyberfuc", "cyberfuck", "cyberfucked", "cyberfucker", "cyberfuckers", "cyberfucking", "d1ck", "damn", "dick", "dickhead", "dildo", "dildos", "dink", "dinks", "dirsa", "dlck", "dog-fucker", "doggin", "dogging", "donkeyribber", "doosh", "duche", "dyke", "ejaculate", "ejaculated", "ejaculates", "ejaculating", "ejaculatings", "ejaculation", "ejakulate", "f u c k", "f u c k e r", "f4nny", "fag", "fagging", "faggitt", "faggot", "faggs", "fagot", "fagots", "fags", "fanny", "fannyflaps", "fannyfucker", "fanyy", "fatass", "fcuk", "fcuker", "fcuking", "feck", "fecker", "felching", "fellate", "fellatio", "fingerfuck", "fingerfucked", "fingerfucker", "fingerfuckers", "fingerfucking", "fingerfucks", "fistfuck", "fistfucked", "fistfucker", "fistfuckers", "fistfucking", "fistfuckings", "fistfucks", "flange", "fook", "fooker", "fuck", "fucka", "fucked", "fucker", "fuckers", "fuckhead", "fuckheads", "fuckin", "fucking", "fuckings", "fuckingshitmotherfucker", "fuckme", "fucks", "fuckwhit", "fuckwit", "fudge packer", "fudgepacker", "fuk", "fuker", "fukker", "fukkin", "fuks", "fukwhit", "fukwit", "fux", "fux0r", "f_u_c_k", "gangbang", "gangbanged", "gangbangs", "gaylord", "gaysex", "goatse", "God", "god-dam", "god-damned", "goddamn", "goddamned", "hardcoresex", "hell", "heshe", "hoar", "hoare", "hoer", "homo", "hore", "horniest", "horny", "hotsex", "jack-off", "jackoff", "jap", "jerk-off", "jism", "jiz", "jizm", "jizz", "kawk", "knob", "knobead", "knobed", "knobend", "knobhead", "knobjocky", "knobjokey", "kock", "kondum", "kondums", "kum", "kummer", "kumming", "kums", "kunilingus", "l3i+ch", "l3itch", "labia", "lust", "lusting", "m0f0", "m0fo", "m45terbate", "ma5terb8", "ma5terbate", "masochist", "master-bate", "masterb8", "masterbat*", "masterbat3", "masterbate", "masterbation", "masterbations", "masturbate", "mo-fo", "mof0", "mofo", "mothafuck", "mothafucka", "mothafuckas", "mothafuckaz", "mothafucked", "mothafucker", "mothafuckers", "mothafuckin", "mothafucking", "mothafuckings", "mothafucks", "mother fucker", "motherfuck", "motherfucked", "motherfucker", "motherfuckers", "motherfuckin", "motherfucking", "motherfuckings", "motherfuckka", "motherfucks", "muff", "mutha", "muthafecker", "muthafuckker", "muther", "mutherfucker", "n1gga", "n1gger", "nazi", "nigg3r", "nigg4h", "nigga", "niggah", "niggas", "niggaz", "nigger", "niggers", "nob", "nob jokey", "nobhead", "nobjocky", "nobjokey", "numbnuts", "nutsack", "orgasim", "orgasims", "orgasm", "orgasms", "p0rn", "pawn", "pecker", "penis", "penisfucker", "phonesex", "phuck", "phuk", "phuked", "phuking", "phukked", "phukking", "phuks", "phuq", "pigfucker", "pimpis", "piss", "pissed", "pisser", "pissers", "pisses", "pissflaps", "pissin", "pissing", "pissoff", "poop", "porn", "porno", "pornography", "pornos", "prick", "pricks", "pron", "pube", "pusse", "pussi", "pussies", "pussy", "pussys", "rectum", "retard", "rimjaw", "rimming", "s hit", "s.o.b.", "sadist", "schlong", "screwing", "scroat", "scrote", "scrotum", "semen", "sex", "sh!+", "sh!t", "sh1t", "shag", "shagger", "shaggin", "shagging", "shemale", "shi+", "shit", "shitdick", "shite", "shited", "shitey", "shitfuck", "shitfull", "shithead", "shiting", "shitings", "shits", "shitted", "shitter", "shitters", "shitting", "shittings", "shitty", "skank", "slut", "sluts", "smegma", "smut", "snatch", "son-of-a-bitch", "spac", "spunk", "s_h_i_t", "t1tt1e5", "t1tties", "teets", "teez", "testical", "testicle", "tit", "titfuck", "tits", "titt", "tittie5", "tittiefucker", "titties", "tittyfuck", "tittywank", "titwank", "tosser", "turd", "tw4t", "twat", "twathead", "twatty", "twunt", "twunter", "v14gra", "v1gra", "vagina", "viagra", "vulva", "w00se", "wang", "wank", "wanker", "wanky", "whoar", "whore", "willies", "willy", "xrated", "xxx"].map(name => name.toLowerCase());

const openai = new OpenAI({
    api_key: process.env.OPENAI_API_KEY
});

const getHashParams = () => {
    const hashParams = {};
    let e,
        r = /([^&;=]+)=?([^&;]*)/g,
        q = window.location.search.substring(1);

    while (e = r.exec(q)) {
        hashParams[e[1]] = decodeURIComponent(e[2]);
    }

    return hashParams;
}

async function getLikedSongs() {
    var quit = false;
    var likedSongs = [];
    var queryParam = `limit=50&offset=0`;
    var url = 'https://api.spotify.com/v1/me/tracks?' + queryParam;

    const headers = {
        Authorization: 'Bearer ' + getHashParams().access_token
    }

    while (url != null && !quit) {
        var nextURL = '';

        await fetch(url, { headers })
            .then(response => response.json())
            .then(data => {
                if (data != undefined) {
                    data.items.forEach(element => {
                        if (!badWords.includes(element.track.name.toLowerCase())) {
                            likedSongs.push(element.track.name);
                        }
                    });

                    nextURL = data.next;
                } else {
                    throw new Error("Getting data failed. Please try again.");
                }

            })
            .catch(error => {
                console.log(error);
                return -1;
            });

        url = nextURL;
    }

    return likedSongs;
}

async function getDalleImage(api_key) {
    document.getElementById("image_button").disabled = true;
    await getLikedSongs().then(res => {
        if (res == -1) {
            throw new Error("Getting Spotify Songs failed. Please try again.");
        }

        // Shuffle
        res.sort(() => Math.random() - 0.5);

        // Return shuffled array
        return res;
    }).then(async likedSongs => {
        const maxResults = 5;
        var likedSongsCopy = likedSongs.slice(0);

        // Trim & Stringify
        do {
            likedSongs.pop();
        } while (likedSongs.join(" ").length + (likedSongs.length * 2) + 4 > 900);
        likedSongsString = likedSongs.join(" ");

        // Request OpenAI API for images
        for (counter = false, shuffle = false; counter < maxResults;) {
            await openai.createImage({
                model: 'dall-e-3',
                prompt: likedSongsString,
                n: 1,
                size: '256x256',
            }).then(async response => {
                var data = response.json();
                if (response.ok) {
                    await data.then(res => {
                        console.log(`Data Used: ${likedSongsString}, Result: ${res.data[0].url}`);
                    }).then(() => {
                        counter++;
                        shuffle = true;
                    });
                }
            }).catch(error => {
                console.log(error);
            }).finally(() => {
                likedSongs.pop();

                // Shuffle, Trim, & Stringify if likedSongs is empty or data has been returned
                if (shuffle || likedSongs.length == 0) {
                    likedSongs = likedSongsCopy.slice(0);
                    likedSongs = fisherYates(likedSongs);
                    do {
                        likedSongs.pop();
                    } while (likedSongs.join(" ").length + 4 > 1000);
                    shuffle = false;
                }

                likedSongsString = likedSongs.join(' ');
            })
        }
    }).catch(err => {
        console.log(err);
    });
    document.getElementById("image_button").disabled = false;
}

const fisherYates = (toShuffle = []) => {
    for (let i = (toShuffle.length - 1); i > 0; i -= 1) {
        const randomIndex = Math.floor(Math.random() * (i + 1));
        [toShuffle[i], toShuffle[randomIndex]] = [toShuffle[randomIndex], toShuffle[i]];
    }
    return toShuffle;
}

