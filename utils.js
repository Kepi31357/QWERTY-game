/**
 * Dictionary & word utilities for QWERTY
 */

const LETTER_VALUES = {
  A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5, L: 1, M: 3,
  N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10,
  '*': 0,
};

const TILE_BAG = (() => {
  const counts = {
    A: 9, B: 2, C: 2, D: 4, E: 12, F: 2, G: 3, H: 2, I: 9, J: 1, K: 1, L: 4, M: 2,
    N: 6, O: 8, P: 2, Q: 1, R: 6, S: 4, T: 6, U: 4, V: 2, W: 2, X: 1, Y: 2, Z: 1,
  };
  const bag = [];
  for (const [letter, n] of Object.entries(counts)) {
    for (let i = 0; i < n; i++) bag.push(letter);
  }
  bag.push('*', '*');
  return bag;
})();

/** Compact dictionary — common English words for gameplay */
const DICTIONARY = new Set(
  `aa ab ad ae ag ah ai al am an ar as at aw ax ay ba be bi bo by da de di do ed ef eh el em en er es et ex fa go ha he hi ho id if in is it jo ka la li lo ma me mi mm mo mu my na ne no nu od oe of oh oi om on op or os ow ox oy pa pe pi re sh si so ta ti to uh um un up us ut we wo xi xu ya ye yo za
  act add ado ads adz aft age ago aid ail aim ain air ais alb ale all alp alt amp and ant any ape apt arc are ark arm art ash ask asp ass ate ave awa awe awl awn axe aye bad bag bah bal bam ban bap bar bas bat bay bed bee beg bel bet bey bib bid big bin bio bis bit biz boa bob bog boo bop bot bow box boy bra bro bud bug bum bun bur bus but buy bye cab cad cam can cap car cat caw cay cob cod cog col con coo cop cor cos cot cow coy cry cub cud cue cup cur cut dab dad dag dam day deb dee def den dew dex dib did die dig dim din dip dis doc doe dog dol dom don dot dry dub dud due dug dun duo dye ear eat ebb eel egg ego eke elf elk ell elm end eng eon era ere erg err eve ewe eye fad fag fan far fat fax fay fed fee fen fey fib fig fin fir fit fix flu fly fob foe fog fop for fox fro fry fun fur gab gad gag gal gap gas gay gel gem get gig gin gip git gnu gob god goo got gum gun gut guy gym gyp had hag ham has hat haw hay hem hen her hew hex hey hid him hip his hit hob hod hoe hog hop hot how hub hue hug hum hun hut ice ich icy ids ifs ilk ill imp ink inn ion ire irk ism its ivy jab jag jam jar jaw jay jet jig jin job jog jot joy jug jun jus jut kab kae kat kay kea keg ken key kid kif kin kip kit koa kob kop kor kos kue lab lac lad lag lam lap lar las lat lav law lax lay lea led lee leg lei lek let leu lev lex ley lib lid lie lin lip lis lit lob log loo lop lot low lox lug lum lux lye mac mad mae mag man map mar mas mat maw max may med meg mel men met mew mho mid mig mil mim mir mix moa mob mod mog mol mom moo mop mor mot mow mud mug mum mun mus nab nae nag nah nam nap naw nay neb nee net new nib nil nim nip nit nix nob nod nog nom nor nos not now nub nus nut oaf oak oar oat oba obe obi oca odd ode ods oes off oft ohm oho ohs oil oka oke old ole oms one ons ooh oot ope ops opt ora orb ore ors ort ose oud our out ova owe owl own oxo oxy pad pah pal pam pan pap par pas pat paw pax pay pea pec ped pee peg pen pep per pes pet pew phi pht pia pic pie pig pin pip pis pit pix ply pod poh poi pol pom pop pot pow pox pro psi pst pub pud pug pul pun pup pur pus put pya pye pyx qat qua rad rag rah ram ran rap ras rat raw rax ray reb rec red ree ref reg rei rem rep res ret rev rex rho rib rid rif rig rim rin rip rob roc rod roe rom rot row rub rue rug rum run rut rya rye sab sac sad sag sal sap sat sau saw sax say sea sec see seg sei sel sen ser set sew sex sha she shy sib sic sim sin sip sir sis sit six ska ski sky sly sob sod sol son sop sot sou sow sox soy spa spy sri sty sub sue sum sun sup suq syn tab tad tae tag taj tam tan tao tap tar tas tat tau tav taw tax tea ted tee teg tel ten tet tew the thy tic tie til tin tip tis tit tod toe tog tom ton too top tor tot tow toy try tsk tub tug tui tun tup tut tux twa two tye udo ugh uke ulu umm ump ums uni uns upo ups urb urd urn urp use uta ute uts vac van var vas vat vau vav vaw vee veg vet vex via vie vig vim voe vog vox vug vum wab wad wae wag wan wap war was wat waw wax way web wed wee wen wet wha who why wig win wis wit wiz woe wok won woo wos wot wry wye wyn xed xis yag yah yak yam yap yar yaw yay yea yeh yen yep yes yet yew yid yin yip yod yok yom yon you yow yuk yum yup zag zap zas zax zed zee zek zep zig zin zip zit zoa zoo zuz zzz
  able acid aged also area army away baby back ball band bank base bath bear beat been beer bell belt best bill bird birth bite blue boat body book born both bowl bulk burn bush busy call calm came camp card care case cash cast cell cent chat chip city clay clip club coal coat code cold come cool copy corn cost crew crop dark data date dawn days dead deal dear debt deep desk dial dice diet dirt disc dish disk does done door down draw drop drug dual duck duly dumb dump dust duty each earn ease east easy edge eggs else even ever evil exam exit face fact fail fair fall farm fast fate fear feed feel feet fell felt file fill film find fine fire firm fish five flat flow flux foam fold folk food foot form fort foul four free frog from fuel full fund gain game gate gave gift girl give glad goal goes gold golf gone good grew grey grow gulf hair half hall hand hang hard harm hate have head hear heat held hell help here hide high hill hold hole holy home hope host hour huge hung hunt hurt idea inch into iron item jack join joke jump junk just keep kept keys kick kill kind king kiss knee knew know lack lady lake land lane last late lead left less life lift like line link list live load loan lock logo long look lord lose loss lost love luck made mail main make male many mark mass mate meal mean meat meet menu mere mile milk mind mine miss mode moon more most move much must name near neck need news next nice nine none nose note noun okay once only onto open oral over pace pack page paid pain pair pale palm park part pass past path peak pick pile pine pink pipe plan play plot plug plus poem poet pole poll pool poor port post pull pure push race rail rain rank rare rate read real rear rest rice rich ride ring rise risk road rock role roll room root rose rule runs safe said sail sale salt same sand save seat seed seek seem seen self sell send sent ship shop shot show shut sick side sign silk sing sink site size skin slip slow snow soft soil sold sole some song soon sort soul spot star stay step stop such suit sure take talk tall tank tape task team tell term test text than that them then they thin this tide tile till time tiny told tone took tool tops tour town tree trip true tube turn type unit upon used user vary vast very view vote wait walk wall want ward warm wash wave ways weak wear week well went were west what when whom wide wife wild will wind wine wing wire wise wish with word work yard year your zero zone
  about above abuse actor acute admit adopt adult after again agent agree ahead alarm album alert alike alive allow alone along alter among anger angle angry apart apple apply arena argue arise array aside asset audio audit avoid awake award aware badly basic beech began begin being below bench black blame blank blast blend blind block blood board boost bound brain brand bread break breed brief bring broad broke brown build built burst buyer cable carry catch cause chain chair chalk chaos charm chart chase cheap check chest chief child china chose civil claim class clean clear click climb clock close coach coast could count court cover crack craft crash crazy cream crime cross crowd crown crude curve cycle daily dance dated dealt death debut delay delta dense depth devil diary dirty doing doubt draft drain drama drawn dream dress drift drink drive drunk early earth eight elite empty enemy enjoy enter entry equal error event every exact exist extra faith false fancy fault fiber field fifth fifty fight final first fixed flash fleet floor flour fluid focus force forth forty forum found frame frank fraud fresh front frost fruit fully funny giant given glass globe going grace grade grand grant grass grave great green gross group grown guard guess guest guide happy heart heavy hello hence horse hotel house human ideal image index inner input issue japan jeans judge juice known label large laser later laugh layer learn lease least leave legal level light limit links lives local logic loose lower lucky lunch lying magic major maker march match maybe mayor meant media metal might miles miner minor mixed model money month moral motor mount mouse mouth moved movie music needs nerve never newly night noble noise north noted novel nurse occur ocean offer often order other ought outer owner panel paper party peace phase phone photo piece pilot pitch place plain plane plant plate point pound power press price pride prime print prior prize proof proud prove queen quick quiet quite radio raise range rapid ratio reach ready realm rebel refer relax reply rider ridge right rigid rival river robot rocky roman rough round route royal rural scale scene scope score sense serve seven shall shape share sharp sheet shelf shell shift shine shirt shock shoot short shown sides sight silly since sixth sixty sized skill sleep slide small smart smile smoke snake solar solid solve sorry sound south space spare speak speed spend spent split spoke sport staff stage stake stand start state steam steel stick still stock stone stood store storm story strip stuck study stuff style sugar suite super sweet table taken taste taxes teach teeth thank theme there these thick thing think third those three threw throw tight times title today topic total touch tough tower track trade train treat trend trial tribe trick tried tries truck truly trust truth twice under union unity until upper upset urban usage usual valid value video virus visit vital voice waste watch water wheel where which while white whole whose woman world worry worse worst worth would write wrong wrote young youth`.split(/\s+/)
);

function isValidWord(word) {
  if (!word || word.length < 2) return false;
  return DICTIONARY.has(word.toLowerCase());
}

function letterValue(letter) {
  var key = letter.toUpperCase();
  return LETTER_VALUES[key] !== undefined ? LETTER_VALUES[key] : 0;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function createTileBag() {
  return shuffle([...TILE_BAG]);
}

function drawTiles(bag, count) {
  const drawn = [];
  while (drawn.length < count && bag.length > 0) {
    drawn.push(bag.pop());
  }
  return drawn;
}

function getAllWordsFromBoard(board, cols, rows) {
  const words = [];
  const seen = new Set();

  for (let r = 0; r < rows; r++) {
    let run = '';
    let start = 0;
    for (let c = 0; c <= cols; c++) {
      const cell = c < cols ? board[r * cols + c] : null;
      const letter = cell && cell.letter;
      if (letter) {
        if (!run) start = c;
        run += letter;
      } else if (run.length >= 2) {
        const key = `h-${r}-${start}-${run}`;
        if (!seen.has(key)) {
          seen.add(key);
          words.push({ word: run, cells: wordCellsH(r, start, run.length, cols) });
        }
        run = '';
      } else {
        run = '';
      }
    }
  }

  for (let c = 0; c < cols; c++) {
    let run = '';
    let start = 0;
    for (let r = 0; r <= rows; r++) {
      const cell = r < rows ? board[r * cols + c] : null;
      const letter = cell && cell.letter;
      if (letter) {
        if (!run) start = r;
        run += letter;
      } else if (run.length >= 2) {
        const key = `v-${c}-${start}-${run}`;
        if (!seen.has(key)) {
          seen.add(key);
          words.push({ word: run, cells: wordCellsV(c, start, run.length, cols) });
        }
        run = '';
      } else {
        run = '';
      }
    }
  }

  return words;
}

function wordCellsH(row, colStart, len, cols) {
  const cells = [];
  for (let i = 0; i < len; i++) cells.push(row * cols + (colStart + i));
  return cells;
}

function wordCellsV(col, rowStart, len, cols) {
  const cells = [];
  for (let i = 0; i < len; i++) cells.push((rowStart + i) * cols + col);
  return cells;
}

const SAVE_KEY = 'qwerty-pogo-save';

function getCandidateWords() {
  return [...DICTIONARY].filter((w) => w.length >= 2 && w.length <= 8);
}

window.QWERTYUtils = {
  isValidWord,
  letterValue,
  shuffle,
  createTileBag,
  drawTiles,
  getAllWordsFromBoard,
  getCandidateWords,
  SAVE_KEY,
};
