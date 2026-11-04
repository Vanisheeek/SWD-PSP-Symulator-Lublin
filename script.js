// --- STAŁA WERSJI APLIKACJI SWDST ---
const APP_VERSION = "SWDST 0.35 (Lublin i Powiat Lubelski - OSRM Routing)";

// --- MODUŁ AUDIO ---
const audioSelekt = new Audio('selekt.wav');
const audioCpr = new Audio('nowe zdarzenie odbierz.mp3');
const audioMotorola = new Audio('motorola.ogg');

function playSound(type) {
    if (type === 'cpr') { audioCpr.currentTime = 0; audioCpr.play().catch(() => {}); }
    else if (type === 'motorola') { audioMotorola.currentTime = 0; audioMotorola.play().catch(() => {}); }
}

function playOspAlarmRepeated(ospCount) {
    if (ospCount <= 0) return;
    let played = 0;
    function playNext() {
        if (played < ospCount) {
            audioSelekt.currentTime = 0;
            audioSelekt.play().then(() => {
                played++;
                if (played < ospCount) setTimeout(playNext, 3000);
            }).catch(() => {});
        }
    }
    playNext();
}

// --- KLUCZE API ---
const _k = {
    g: "Z3NrX2dEQkRQMWhzenZtVjBQc010OWlXR2d5YjNGWUhzYW5FZ2twUEg2anNIWnY2WGFyY2o0QzM=",
    m: "QVEuQWI4Uk46SlNrZnU5ODBDQnBJUUZ0cnAtTEUxYkJYdU94ZzI0NmZmZUJXTmFSZUZkZ1E=",
    o: "c2stcHJvai1wRHZBV05wbDRnUzRzWlpFUkVSeWMtcGdqVGdXZEp1d3E5Y3pCMnhsc0JQZWd3Z3prbi16OEtidFVlQ2NxMHVlV2lnb0dhWDNpS1QzMmxia0ZKNk55MjJtWjMwTm41NnhjTlpZTYUzM3FUM3BtcUF6aGRfb3E4S2N1MTdCenRLVHQ="
};
function decodeKey(b64) { try { return atob(b64); } catch(e) { return ""; } }

// --- BEZPIECZNY SILNIK AI ---
async function callUniversalAI(systemPrompt, userPrompt, jsonMode = false) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
        const response = await fetch('https://text.pollinations.ai/openai', {
            method: 'POST',
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'openai',
                messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
                temperature: 0.8,
                jsonMode: jsonMode
            })
        });
        clearTimeout(timeoutId);
        if (response.ok) {
            const data = await response.json();
            if (data.choices && data.choices[0]?.message?.content) return data.choices[0].message.content.trim();
        }
    } catch (err) {}

    try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${decodeKey(_k.g)}` },
            body: JSON.stringify({
                model: 'llama-3.1-8b-instant',
                messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
                temperature: 0.8,
                max_tokens: 180,
                ...(jsonMode ? { response_format: { type: "json_object" } } : {})
            })
        });
        const data = await res.json();
        if (data.choices && data.choices[0]?.message?.content) return data.choices[0].message.content.trim();
    } catch (e) {}

    throw new Error("AI Offline");
}

// --- ZOPTYMALIZOWANY DEKOMPRESOR PROFILI POWIATÓW ---
function unpackProfile(raw) {
    const locationsDatabase = {}, gpsCoords = {}, realStreetsByTown = {}, unitExactLocations = {};
    raw.towns.forEach(([tName, regionDesc, lat, lng, streets]) => {
        locationsDatabase[tName] = `${regionDesc}, ${raw.countyName}, woj. ${raw.voivodeship}`;
        gpsCoords[tName] = [lat, lng];
        realStreetsByTown[tName] = streets;
    });
    const mapUnitList = (list) => list.map(([uName, town, addr, lat, lng, locked, vehs]) => {
        unitExactLocations[uName] = { town, address: addr, lat, lng, locked: !!locked };
        return {
            name: uName,
            vehicles: vehs.map(([id, name, obsada]) => ({ id, name, status: "green", obsada: obsada ?? 6 }))
        };
    });
    return {
        id: raw.id, name: raw.name, radioCallsign: raw.radioCallsign, desc: raw.desc,
        voivodeship: raw.voivodeship, countyName: raw.countyName, mapCenter: raw.mapCenter,
        bbox: raw.bbox, jrgList: raw.jrgList, defaultTown: raw.defaultTown,
        locationsDatabase, gpsCoords, realStreetsByTown, unitExactLocations,
        unitsPSP: mapUnitList(raw.psp), unitsOSP: mapUnitList(raw.osp)
    };
}

// INICJALIZACJA PROFILU — LUBLIN JEST DOMYŚLNYM I JEDYNYM REJONEM

{
        id: "lubelski",
        name: "KM PSP Lublin / Powiat Lubelski",
        radioCallsign: "Lublin 998",
        desc: "Woj. lubelskie • KM PSP Lublin + jednostki OSP",
        voivodeship: "lubelskie",
        countyName: "pow. lubelski",
        mapCenter: [51.2465, 22.5684],
        bbox: "22.30,51.10,22.85,51.40",
        jrgList: ["JRG 1 Lublin", "JRG 2 Lublin", "JRG 3 Lublin", "JRG 4 Lublin", "JRG Bełżyce", "JRG Bychawa"],
        defaultTown: "Lublin",
        towns: [
            ["Lublin", "m. Lublin", 51.2465, 22.5684, [
                "ul. 1 Maja", "ul. 100-lecia KUL", "ul. 100-lecia praw wyborczych Polek", "ul. 11 Listopada", "ul. 3 Maja", "ul. Abelarda", "ul. Abrahama Sterna", "ul. Abramowicka", "ul. Adama Asnyka", "ul. Adama Kerstena", "ul. Adama Mickiewicza", "ul. Adolfa Dygasińskiego", "ul. Agaty", "ul. Agrestowa", "ul. Agronomiczna", "ul. Akacjowa", "ul. Akademicka", "ul. Aksini", "ul. Al. generała Władysława Sikorskiego", "ul. Al. Wincentego Witosa", "ul. al. Władysława Andersa", "ul. Aleja Jana Długosza", "ul. Aleja Józefa Piłsudskiego", "ul. Aleja Kompozytorów Polskich", "ul. Aleja Kraśnicka", "ul. Aleja Marzeń", "ul. Aleja Mieczysława Smorawińskiego", "ul. Aleja Młodości", "ul. Aleja Róż", "ul. Aleja Solidarności", "ul. Aleja Spółdzielczości Pracy", "ul. aleja Stanisława Jasińskiego", "ul. aleja Tadeusza Mazowieckiego", "ul. Aleja Unii Lubelskiej", "ul. Aleja Warszawska", "ul. Aleje Racławickie", "ul. Aleje Tysiąclecia", "ul. Aleje Zygmuntowskie", "ul. Aleksandra Czekanowskiego", "ul. Aleksandra Fredry", "ul. Aleksandra Gierymskiego", "ul. Aleksandra Orłowskiego", "ul. Aleksandra Świętochowskiego", "ul. Aleksandra Zelwerowicza", "ul. Alojzego Grochowskiego", "ul. Altanowa", "ul. Ametystowa", "ul. Anastazego Suligowskiego", "ul. Andrzeja Struga", "ul. Anny Henryki Pustowójtówny", "ul. Anny Langfus", "ul. Anny Stanisławskiej", "ul. Anny Walentynowicz", "ul. Antoniego Jeziorańskiego", "ul. Antoniego Pączka", "ul. Antoniego Słomkowskiego", "ul. Antoniego Szczerbowskiego", "ul. Antoniny Grygowej", "ul. arch. Ignacego Kędzierskiego", "ul. Archidiakońska", "ul. Armii Krajowej", "ul. Aroniowa", "ul. Artura Grottgera", "ul. Azaliowa", "ul. Bagatela", "ul. Bajkowa", "ul. Balladyny", "ul. Baltazara Paśnikowskiego", "ul. Bandtkich", "ul. Bartnicza", "ul. Bartosza Głowackiego", "ul. Barwinkowa", "ul. Barwna", "ul. Baśniowa", "ul. Batalionów Chłopskich", "ul. Bazylianówka", "ul. Bażantowa", "ul. Beatrycze", "ul. Beliniaków", "ul. Bełżycka", "ul. Berberysowa", "ul. Bernarda Wapowskiego", "ul. Bernardyńska", "ul. Berylowa", "ul. Beskidzka", "ul. Betonowa", "ul. Biała", "ul. Białkowska Góra", "ul. Białostocka", "ul. Biedronki", "ul. Biernata z Lublina", "ul. Bieszczadzka", "ul. Biłgorajska", "ul. Biskupa Mariana Fulmana", "ul. Biskupie", "ul. Biskupińska", "ul. Blacharska", "ul. Bliska", "ul. Bluszczowa", "ul. bł. ks. Antoniego Zawistowskiego", "ul. bł. ks. Ignacego Kłopotowskiego", "ul. Bławatkowa", "ul. Błękitna", "ul. Bobrzan", "ul. Bociania", "ul. Boczna Lubomelskiej", "ul. Boczna Łęczyńskiej", "ul. Boczna Rusałki", "ul. Boczna Siewnej", "ul. Bogdanówka", "ul. Bohaterów Monte Cassino", "ul. Bohaterów Września", "ul. Bohdana Dobrzańskiego", "ul. Bolesława Chrobrego", "ul. Bolesława Leśmiana", "ul. Bolesława Liszkowskiego", "ul. Bolesława Prusa", "ul. Bolesława Sekutowicza", "ul. Bolesława Śmiałego", "ul. Borówkowa", "ul. Boryny", "ul. Botaniczna", "ul. Bór", "ul. Braci Krausse", "ul. Braci Rylskich", "ul. Braci Wieniawskich", "ul. Bramowa", "ul. Brata Alberta", "ul. Bratnia", "ul. Bronowicka", "ul. Browarna", "ul. Brylantowa", "ul. Bryńskiego", "ul. Brzoskwiniowa", "ul. Brzozowa", "ul. Budowlana", "ul. Budrysów", "ul. Bukietowa", "ul. Bukowa", "ul. Bukszpanowa", "ul. Bulwar im. Stanisława Zalewskiego", "ul. Bulwarowa", "ul. Bursaki", "ul. Bursztynowa", "ul. Bużan", "ul. Bystrzycka", "ul. Cedrowa", "ul. Ceglana", "ul. Celestyna Miklasińskiego", "ul. Ceramiczna", "ul. Cerkiewna", "ul. Chabrowa", "ul. Chełmska", "ul. Chemiczna", "ul. Chłodna", "ul. Chmielna", "ul. Choiny", "ul. Ciasna", "ul. Cicha", "ul. Cienista", "ul. Ciepła", "ul. Ciepłownicza", "ul. Cisowa", "ul. Cmentarna", "ul. Cukrownicza", "ul. Cyda", "ul. Cynamonowa", "ul. Cypriana Godebskiego", "ul. Cypriana Kamila Norwida", "ul. Cyprysowa", "ul. Cyrkoniowa", "ul. Cyrulicza", "ul. Czapla", "ul. Czechowska", "ul. Czeremchowa", "ul. Czereśniowa", "ul. Czernicowa", "ul. Czerniejowska", "ul. Czerwcowa", "ul. Czeska", "ul. Czesława Strzeszewskiego", "ul. Czesława Szczepańskiego", "ul. Czesława Zgorzelskiego", "ul. Czwartaków", "ul. Czwartek", "ul. Czysta", "ul. Daktylowa", "ul. Daliowa", "ul. Dąbrowicka", "ul. Dąbrowska", "ul. Dąbrówki", "ul. Dereniowa", "ul. Deszczowa", "ul. Dębowa", "ul. Diamentowa", "ul. Ditty", "ul. Dłotlice", "ul. Długa", "ul. Do Dysa", "ul. Dobra", "ul. Dojazdowa", "ul. Dolna 3 Maja", "ul. Dolna Panny Marii", "ul. Dominikańska", "ul. Dominowska", "ul. Doświadczalna", "ul. Dożynkowa", "ul. dr Aleksandra Jaworowskiego", "ul. Dr Józefa Sztajna", "ul. dr Wacława Lasockiego", "ul. Dra Gustawa Dolińskiego", "ul. Dra Kazimierza Jaczewskiego", "ul. Dra Witolda Chodźki", "ul. Dragonów", "ul. Drewniana", "ul. Droga Męczenników Majdanka", "ul. Dworcowa", "ul. Dworska", "ul. Dywizjonu 303", "ul. Dzbenin", "ul. Działkowa", "ul. Dzieci Zamojszczyzny", "ul. Dzierżawna", "ul. Dziesiąta", "ul. Dziewanny", "ul. Edwarda Dembowskiego", "ul. Edwarda Kołaczkowskiego", "ul. Edwarda Raczyńskiego", "ul. Edwarda Stachury", "ul. Edwarda Wojtasa", "ul. Edwarda Zwolskiego", "ul. Elektryczna", "ul. Elizy Orzeszkowej", "ul. Emancypantek", "ul. Emanuela Graffa", "ul. Emila Czaplińskiego", "ul. Emila Zegadłowicza", "ul. Emilii i Karola Wojtyłów", "ul. Emilii Plater", "ul. Energetyków", "ul. Erazma Plewińskiego", "ul. Eugeniusza Kwiatkowskiego", "ul. Eugeniusza Romera", "ul. Europejskiej Stolicy Młodzieży Lublin 2023", "ul. Ewalda Sasimowskiego", "ul. Ewangelicka", "ul. Ewy Szelburg-Zarembiny", "ul. Fabryczna", "ul. Fantastyczna", "ul. Faraona", "ul. Farbiarska", "ul. Farmaceutyczna", "ul. Faustyny Morzyckiej", "ul. Feliksa Araszkiewicza", "ul. Feliksa Bieczyńskiego", "ul. Feliksa Brodowskiego", "ul. Feliksa Nowowiejskiego", "ul. Feliksa Skubiszewskiego", "ul. Feliksa Strojnowskiego", "ul. Felin", "ul. Figowa", "ul. Filaretów", "ul. Filona", "ul. Fiołkowa", "ul. Firlejowska", "ul. Floriańska", "ul. Folwarczna", "ul. Forsycjowa", "ul. Franciszka Dionizego Kniaźnina", "ul. Franciszka Galery", "ul. Franciszka Grabowskiego", "ul. Franciszka Kleeberga", "ul. Franciszka Mireckiego", "ul. Franciszka Osiaka", "ul. Franciszka Raczkowskiego", "ul. Franciszka Salezego Jezierskiego", "ul. Franciszka Stefczyka", "ul. Franciszka Uhorczaka", "ul. Franciszka Zabłockiego", "ul. Franciszki Arnsztajnowej", "ul. Frezerów", "ul. Fryderyka Chopina", "ul. Furmańska", "ul. Gabrieli Zapolskiej", "ul. Gajowa", "ul. Gałęzowskich", "ul. Garbarska", "ul. Garncarska", "ul. Gawareckich", "ul. Gawronia", "ul. Gazowa", "ul. Gdańska", "ul. Gen. Bolesława Ducha", "ul. Gen. Józefa Zajączka", "ul. gen. Michała Kruka", "ul. Generała Augusta Fieldorfa", "ul. Generała Stanisława Skalskiego", "ul. Generała Witolda Urbanowicza", "ul. Geodetów", "ul. Gerberowa", "ul. Gęsia", "ul. Gilowa", "ul. Gliniana", "ul. Głęboka", "ul. Głogowa", "ul. Główna", "ul. Głuska", "ul. Gminna", "ul. Gnieźnieńska", "ul. Gołębia", "ul. Goplan", "ul. Gorczańska", "ul. Gospodarcza", "ul. Gościnna", "ul. Goździkowa", "ul. Górna", "ul. Górska", "ul. Grabowa", "ul. Gracjana Chmielewskiego", "ul. Granatowa", "ul. Graniczna", "ul. Granitowa", "ul. Grażyny", "ul. Grenadierów", "ul. Grodzka", "ul. Grunwaldzka", "ul. Gruszkowa", "ul. Grzybowa", "ul. Guliwera", "ul. Gustawa Daniłowskiego", "ul. Gustawa Morcinka", "ul. H. M. Sachsów", "ul. Hajdowska", "ul. Hamleta", "ul. Handlowa", "ul. Hanki Ordonówny", "ul. Harcerska", "ul. Harnasie", "ul. Heleny Dziubińskiej", "ul. Heleny Modrzejewskiej", "ul. Heloizy", "ul. Henryka Halickiego", "ul. Henryka Siemiradzkiego", "ul. Henryka Sienkiewicza", "ul. Henryka Wiercieńskiego", "ul. Henryka Wolińskiego", "ul. Herbowa", "ul. Hetmańska", "ul. Hiacyntowa", "ul. Hieronima Dekutowskiego", "ul. Hieronima Jawłowskiego", "ul. Hieronima Łopacińskiego", "ul. Hipoteczna", "ul. Honorowych Krwiodawców", "ul. Hrubieszowska", "ul. Hubalczyków", "ul. Hugo Kołłątaja", "ul. Husarska", "ul. Hutnicza", "ul. Idziego Radziszewskiego", "ul. Ignacego Czumy", "ul. Ignacego Daszyńskiego", "ul. Ignacego Domeyki", "ul. Ignacego Jana Paderewskiego", "ul. Ignacego Krasickiego", "ul. Ignacego Mościckiego", "ul. Ignacego Rzeckiego", "ul. Ignacego Solarza", "ul. Imbirowa", "ul. Inżynierska", "ul. Ireny Kosmowskiej", "ul. Ireny Sendlerowej", "ul. Irydiona", "ul. Irysowa", "ul. Iwana Pawłowa", "ul. Izabeli Czartoryskiej", "ul. Izabeli Sierakowskiej", "ul. Izerska", "ul. Izoldy", "ul. Jabłoniowa", "ul. Jacka Kuronia", "ul. Jacka Malczewskiego", "ul. Jacka Przybylskiego", "ul. Jacka Woronieckiego", "ul. Jagiellońska", "ul. Jagodowa", "ul. Jakuba Hałasa", "ul. Jakuba Jasińskiego", "ul. Jakubowska", "ul. Jałowcowa", "ul. Jana Barcickiego", "ul. Jana Chęcińskiego", "ul. Jana Ciepielewskiego", "ul. Jana Gilasa", "ul. Jana Igatowskiego", "ul. Jana Karola Chodkiewicza", "ul. Jana Karskiego", "ul. Jana Kasprowicza", "ul. Jana Kiepury", "ul. Jana Kilińskiego", "ul. Jana Kochanowskiego", "ul. Jana Kochanowskiego", "ul. Jana Lisa", "ul. Jana Markowskiego", "ul. Jana Matejki", "ul. Jana Pawła II", "ul. Jana Pocka", "ul. Jana Riabinina", "ul. Jana Samsonowicza", "ul. Jana Sapiehy", "ul. Jana Sawy", "ul. Jana Sobieskiego", "ul. Jana Śniadeckiego", "ul. Jana Śnieżyńskiego", "ul. Jana Turczynowicza", "ul. Janiny Porazińskiej", "ul. Janowska", "ul. Jantarowa", "ul. Janusza Korczaka", "ul. Janusza Krupskiego", "ul. Jarmarczna", "ul. Jarosława Iwaszkiewicza", "ul. Jarzębinowa", "ul. Jaskółcza", "ul. Jasna", "ul. Jaspisowa", "ul. Jastrzębia", "ul. Jaśminowa", "ul. Jaworowa", "ul. Jaworzniacy", "ul. Jemiołowa", "ul. Jemiołuszki", "ul. Jerzego de Tramecourta", "ul. Jerzego Kwiecińskiego", "ul. Jerzego Rudlickiego", "ul. Jerzego Szaniawskiego", "ul. Jesienna", "ul. Jesionowa", "ul. Jezuicka", "ul. Jeżynowa", "ul. Jodłowa", "ul. Józefa Bema", "ul. Józefa Chełmońskiego", "ul. Józefa Czapskiego", "ul. Józefa Dwernickiego", "ul. Józefa Elsnera", "ul. Józefa Franczaka \"Lalka\"", "ul. Józefa Hallera", "ul. Józefa Hauke-Bosaka", "ul. Józefa Ignacego Kraszewskiego", "ul. Józefa Jankowskiego", "ul. Józefa Korzeniowskiego", "ul. Józefa Kustronia", "ul. Józefa Lompy", "ul. Józefa Łobodowskiego", "ul. Józefa Mackiewicza", "ul. Józefa Molickiego", "ul. Józefa Pankiewicza", "ul. Józefa Piechoty", "ul. Józefa Poniatowskiego", "ul. Józefa Sowińskiego", "ul. Józefa Śliwińskiego", "ul. Józefa Toczyskiego", "ul. Józefata Barszczewskiego", "ul. Judyma", "ul. Juliana Falata", "ul. Juliana Ochockiego", "ul. Juliana Tuwima", "ul. Juliana Ursyna Niemcewicza", "ul. Julii", "ul. Juliusza Cezara", "ul. Juliusza Dudzińskiego", "ul. Juliusza Kleinera", "ul. Juliusza Kossaka", "ul. Juliusza Ligonia", "ul. Juliusza Słowackiego", "ul. Jurajska", "ul. Juranda", "ul. Jurka Bitschana", "ul. Jutrzenki", "ul. Kacza", "ul. Kaczeńcowa", "ul. Kajetana Cieszkowskiego", "ul. Kajetana Hryniewieckiego", "ul. Kajetana Koźmiana", "ul. Kalinowa", "ul. Kalinowszczyzna", "ul. Kaliska", "ul. Kameliowa", "ul. Kameralna", "ul. Kamienna", "ul. Kaprysowa", "ul. Kapucyńska", "ul. Karkonoska", "ul. Karmelicka", "ul. Karola Lipińskiego", "ul. Karola Namysłowskiego", "ul. Karola Olszewskiego", "ul. Karola Szymanowskiego", "ul. Karpacka", "ul. Kaskadowa", "ul. Kasztanowa", "ul. Kasztelańska", "ul. Kaszubska", "ul. Kawaleryjska", "ul. Kawia", "ul. Kazimiery Litwiniukowej", "ul. Kazimierza Andrzeja Jaworskiego", "ul. Kazimierza Bogdanowicza", "ul. Kazimierza Dulęby", "ul. Kazimierza Glińskiego", "ul. Kazimierza Jagiellończyka", "ul. Kazimierza Przerwy-Tetmajera", "ul. Kazimierza Pułaskiego", "ul. Kazimierza Tumidajskiego", "ul. Kazimierza Wielkiego", "ul. Kąkolowa", "ul. Kąpielowa", "ul. Kielecka", "ul. Kijańska", "ul. Klemensa Junoszy", "ul. Kleniewskich", "ul. Kleopatry", "ul. Kłosowa", "ul. Kmicica", "ul. Kmieca", "ul. Kminkowa", "ul. Kogucia", "ul. Kolorowa", "ul. Koło", "ul. Koncertowa", "ul. Konopnicka", "ul. Konradana Bielskiego", "ul. Konrada Staczyńskiego", "ul. Konrada Wallenroda", "ul. Konstantego Gałczyńskiego", "ul. Konstantego Józefa Rayskiego", "ul. Konstantynów", "ul. Konstruktorów", "ul. Konwaliowa", "ul. Koralowa", "ul. Kornela Makuszyńskiego", "ul. Korpusu Ochrony Pogranicza", "ul. Korzenna", "ul. Kosmonautów", "ul. Kosynierów", "ul. Kościelna", "ul. Kotlarska", "ul. Kowalska", "ul. Kozia", "ul. kpt. Władysława Raginisa", "ul. Krakowskie Przedmieście", "ul. Krańcowa", "ul. Kredowa", "ul. Kresowa", "ul. Krępiecka", "ul. Kręta", "ul. Krężnicka", "ul. Krochmalna", "ul. Krokusowa", "ul. Króla Rogera", "ul. Królewska", "ul. Królowej Bony", "ul. Królowej Jadwigi", "ul. Krótka", "ul. Krucza", "ul. Kruszynowa", "ul. Kryniczna", "ul. Krystaliczna", "ul. Kryształowa", "ul. Krzemieniecka", "ul. Krzemionki", "ul. Ks. Ludwika Zalewskiego", "ul. ks. Michała Słowikowskiego", "ul. ks. prałata Stanisław Roga", "ul. ks. Wincentego Granata", "ul. Ksawerego Dunikowskiego", "ul. Ksawerego Pruszyńskiego", "ul. Księdza Franciszka Blachnickiego", "ul. księdza Jana Wadowskiego", "ul. księdza Jerzego Popiełuszki", "ul. Księdza Mieczysława Brzozowskiego", "ul. Księdza Wojciecha Danielskiego", "ul. Księżycowa", "ul. Ku Farze", "ul. Ku Słońcu", "ul. Kujawska", "ul. Kukułcza", "ul. Kupiecka", "ul. Kurantowa", "ul. Kurpiowska", "ul. Kwarcowa", "ul. Kwiatowa", "ul. Kwiatów Polnych", "ul. Kwietniowa", "ul. Kwitnąca", "ul. Laskowa", "ul. Laurowa", "ul. Laury", "ul. Laury Kaufman", "ul. Lawendowa", "ul. Lawinowa", "ul. Lazurowa", "ul. Legendy", "ul. Legionowa", "ul. Leona Frankowskiego", "ul. Leona Urmowskiego", "ul. Leona Wyczółkowskiego", "ul. Leonarda", "ul. Leonarda Zub-Zdanowicza", "ul. Leopolda Okulickiego", "ul. Leopolda Staffa", "ul. Lesława Pagi", "ul. Leszczynowa", "ul. Leszka", "ul. Leszka Czarnego", "ul. Leśna", "ul. Letnia", "ul. Letniskowa", "ul. Lędzian", "ul. Liliowa", "ul. Limbowa", "ul. Lipniak", "ul. Lipowa", "ul. Lipska", "ul. Lisia", "ul. Lotnicza", "ul. Lubartowska", "ul. Lubczykowa", "ul. Lubelskich Olimpijczyków", "ul. Lubelskiego Lipca '80", "ul. Lubomelska", "ul. Lubuszan", "ul. Ludomira Michała Rogowskiego", "ul. Ludowa", "ul. Ludwika Hirszfelda", "ul. Ludwika Spiessa", "ul. Ludwika Zamenhofa", "ul. Lutowa", "ul. Lwowska", "ul. Łabędzia", "ul. Łagiewnicka", "ul. Łanowa", "ul. Łazienkowska", "ul. Łąkowa", "ul. Łęczyńska", "ul. Łomżyńska", "ul. Łowicka", "ul. Łubinowa", "ul. Łukasza Rodakiewicza", "ul. Łukowska", "ul. Łuszczkowa", "ul. Łużyczan", "ul. Łysakowska", "ul. Macieja Rataja", "ul. Macierzanki", "ul. Magdaleny Brzeskiej", "ul. Magnoliowa", "ul. Majdan Tatarski", "ul. Majdanek", "ul. Majerankowa", "ul. Makowa", "ul. Maksymiliana Chmielarczyka", "ul. Malinowa", "ul. Malwowa", "ul. Małgorzaty Szewczyk", "ul. Małopolska", "ul. Marcowa", "ul. Margaret Thatcher", "ul. Mariana Dubieckiego", "ul. Mariana Langiewicza", "ul. Mariana Rapackiego", "ul. Mariana Smoluchowskiego", "ul. Mariańska", "ul. Marii Curie-Skłodowskiej", "ul. Marii Koryznowej", "ul. Marii Kuncewiczowej", "ul. Marii Ronikerowej", "ul. Marii Świtalskiej", "ul. Marii Urban-Mieszkowskiej", "ul. Marii Walciszewskiej", "ul. Marzanny", "ul. Masarska", "ul. Maszynowa", "ul. Matki Teresy z Kalkuty", "ul. Maurycego Mochnackiego", "ul. Mazowiecka", "ul. Mazurska", "ul. Medalionów", "ul. Melomanów", "ul. Mełgiewska", "ul. Metalurgiczna", "ul. Mgielna", "ul. Mieczykowa", "ul. Mieczysława Biernackiego", "ul. Mieczysława Jastruna", "ul. Mieczysława Karłowicza", "ul. Mieczysława Romanowskiego", "ul. Mieczysława Stelmasiaka", "ul. Mieczysławy Ćwiklińskiej", "ul. Miedziana", "ul. Miernicza", "ul. Mieszczanka", "ul. Mieszka I", "ul. Miętowa", "ul. Migdałowa", "ul. Mikołaja Kopernika", "ul. Mikołaja Pajdowskiego", "ul. Mikołaja Reja", "ul. Milczan", "ul. Milenijna", "ul. Miła", "ul. Miłorzębowa", "ul. Mineralna", "ul. Miodowa", "ul. Mirosława Dereckiego", "ul. Mirtowa", "ul. Misjonarska", "ul. mjr Mariana Gołębiewskiego", "ul. Młodej Polski", "ul. Młodzieńcza", "ul. Młyńska", "ul. Modra", "ul. Modrzewiowa", "ul. Montażowa", "ul. Morawian", "ul. Morelowa", "ul. Morsztynów", "ul. Morwowa", "ul. Most 700-lecia Lublina", "ul. Most im. Prezydenta RP Ryszarda Kaczorowskiego", "ul. Most Mariana Lutosławskiego", "ul. Motorowa", "ul. Motylowa", "ul. Mrówcza", "ul. Muzyczna", "ul. Na Stoku", "ul. Nad Zalewem", "ul. Nadbystrzycka", "ul. Nadłączna", "ul. Nadrzeczna", "ul. Nadstawna", "ul. Naftowa", "ul. Nagietkowa", "ul. Nałęczowska", "ul. Nałkowskich", "ul. Narcyzowa", "ul. Narcyzy Żmichowskiej", "ul. Narzędziowa", "ul. Nasturcjowa", "ul. Nasutowska", "ul. Nataszy", "ul. Nefrytowa", "ul. Nektarowa", "ul. Niccolo Paganiniego", "ul. Niecała", "ul. Niepodległości", "ul. Niezapominajki", "ul. Niska", "ul. Nizinna", "ul. Notarialna", "ul. Nowogródzka", "ul. Nowomiejska", "ul. Noworybna", "ul. Nowy Plac Targowy", "ul. Nowy Rynek", "ul. Nowy Świat", "ul. Obrońców Lublina", "ul. Obrońców Pokoju", "ul. Obywatelska", "ul. Ochotnicza", "ul. Odległa", "ul. Odlewnicza", "ul. Ofelii", "ul. Ofiar Katynia", "ul. Ogrodowa", "ul. Ogródkowa", "ul. Okopowa", "ul. Okólna", "ul. Olchowa", "ul. Olejna", "ul. Oliwkowa", "ul. Olszyńska", "ul. Olszynowa", "ul. Oniegina", "ul. Onyksowa", "ul. Opalowa", "ul. Operowa", "ul. Opolan", "ul. Opolska", "ul. Oratoryjna", "ul. Organowa", "ul. Orla", "ul. Orlanda", "ul. Orląt Lwowskich", "ul. Orna", "ul. Orzechowa", "ul. Osikowa", "ul. Oskara Kolberga", "ul. Osmolicka", "ul. Otella", "ul. Owocowa", "ul. Palmowa", "ul. Pana Balcera", "ul. Pana Tadeusza", "ul. Pana Wołodyjowskiego", "ul. Pancerniaków", "ul. Paprociowa", "ul. Parafialna", "ul. Parczewska", "ul. Park Jana Pawła II", "ul. Park Rury im. urbanisty Romualda Dylewskiego", "ul. Parkowa", "ul. Partyzantów", "ul. Parysa", "ul. Paryska", "ul. Pasieczna", "ul. Pasterska", "ul. Pawia", "ul. Pawła Konrada", "ul. Pawła Parady", "ul. PCK", "ul. Pejzażowa", "ul. Pelagii Majewskiej", "ul. Peoniowa", "ul. Peowiaków", "ul. Pergolowa", "ul. Perlicza", "ul. Perłowa", "ul. Piaskowa", "ul. Piastowska", "ul. Piekarska", "ul. Pielęgniarek", "ul. Pielgrzymia", "ul. Pienińska", "ul. Piękna", "ul. Pigwowa", "ul. pilota Eugeniusza Kasprzaka", "ul. Piotra Michałowskiego", "ul. Piotra Ściegiennego", "ul. Piotra Wysockiego", "ul. Pistacjowa", "ul. Plac Boboli", "ul. Plac Bychawski", "ul. Plac Dworcowy", "ul. Plac im. Marii Curie-Skłodowskiej", "ul. Plac Izaaka Singera", "ul. Plac Józefa Czechowicza", "ul. Plac Króla Władysława Łokietka", "ul. Plac Lecha Kaczyńskiego", "ul. Plac Litewski", "ul. Plac Mieczysława Alberta Krąpca", "ul. Plac Obrońców Lublina", "ul. Plac Ofiar Getta", "ul. Plac Po Farze", "ul. Plac Wolności", "ul. Plac Zamkowy", "ul. Plac Zygmunta Balickiego", "ul. Placowa", "ul. Plagego i Łaskiewicza", "ul. Platanowa", "ul. Plażowa", "ul. Plebańska", "ul. Pliszczyńska", "ul. płk Marcina Borelowskiego", "ul. płk Stanisława Nowickiego", "ul. płk. Władysława Rokickiego", "ul. Pochyła", "ul. Początkowa", "ul. Pocztowa", "ul. Pod Gajem", "ul. Podchorążych", "ul. Podhalańska", "ul. Podkomorska", "ul. Podlaska", "ul. Podleśna", "ul. Podwale", "ul. Podzamcze", "ul. Pogodna", "ul. Polan", "ul. Poli Gojawiczyńskiej", "ul. Poligonowa", "ul. Polna", "ul. Poloniusza", "ul. Połabian", "ul. Połaniecka", "ul. Południowa", "ul. Pomorska", "ul. Ponikwoda", "ul. Poprzeczna", "ul. Por. Henryka Cybulskiego", "ul. Poranna", "ul. Porzeczkowa", "ul. Potok", "ul. Poturzyńska", "ul. Powojowa", "ul. Powstania Styczniowego", "ul. Powstańców Śląskich", "ul. Powstańców Warszawy", "ul. Poziomkowa", "ul. Poznańska", "ul. Pozytywistów", "ul. Północna", "ul. ppor. Jana Bołbotta", "ul. Prawiednicka", "ul. Prezydenta Gabriela Narutowicza", "ul. Prezydenta Ronalda Reagana", "ul. Prezydenta Teodora Gruella", "ul. Probostwo", "ul. prof. Andrzeja Waksmundzkiego", "ul. prof. Antoniego Gębali", "ul. prof. Ignacego Wośki", "ul. prof. Kazimierza Górskiego", "ul. prof. Włodzimierza Fijałkowskiego", "ul. prof. Zbigniewa Religi", "ul. Projektowa", "ul. Promienista", "ul. Prosta", "ul. Próżna", "ul. Prymasa Stefana Wyszyńskiego", "ul. Prząśniczki", "ul. Przechodnia", "ul. Przecznica", "ul. Przedwiośnie", "ul. Przejazd", "ul. Przejrzysta", "ul. Przelot", "ul. Przemysłowa", "ul. Przemysłowców Lubelskich", "ul. Przepiórcza", "ul. Przeskok", "ul. Przesmyk", "ul. Przy Bocznicy", "ul. Przy Stawie", "ul. Przygodna", "ul. Przyjacielska", "ul. Przyjaźni", "ul. Przymieszańska", "ul. Przytulna", "ul. Pszczela", "ul. Pszenna", "ul. Pszowian", "ul. Ptasia", "ul. Puchacza", "ul. Puławska", "ul. Radomska", "ul. Radości", "ul. Radzikowska", "ul. Radziwiłłowska", "ul. Radzyńska", "ul. Rafała Krajewskiego", "ul. Rajska", "ul. Raszyńska", "ul. Rąblowska", "ul. Rektora Henryka Raabego", "ul. Relaksowa", "ul. Represjonowanych Żołnierzy Górników", "ul. Resorowa", "ul. Rezedowa", "ul. Robotnicza", "ul. Rolna", "ul. Rolna Osada", "ul. Romana Dmowskiego", "ul. Romana Dmowskiego", "ul. Romana Śląskiego", "ul. Romana Żulińskiego", "ul. Romantyczna", "ul. Romea", "ul. Romualda Traugutta", "ul. Rondo 27 Wołyńskiej Dywizji Piechoty AK", "ul. Rondo bł. ks. bp. Władysława Gorala", "ul. Rondo bł. ks. Emilian Kowcza", "ul. Rondo gen. Leona Berbeckiego", "ul. Rondo generała Franciszka Kamińskiego", "ul. Rondo Lubelskiego Lipca '80", "ul. Rondo Metropolity Piotra Mohyły", "ul. Rondo Narodowych Sił Zbrojnych", "ul. Rondo Nauczycieli Tajnego Nauczania", "ul. Rondo Niezależnego Zrzeszenia Studentów", "ul. Rondo płk. Ryszarda J. Kuklińskiego", "ul. Rondo por. Mariana Mokrskiego", "ul. Rondo Wincentego Pola", "ul. Rondo Zrzeszenia Wolność i Niezawisłość", "ul. Rosy", "ul. Roślinna", "ul. Rotmistrza Witolda Pileckiego", "ul. Rotmistrza Witolda Pileckiego", "ul. Rowerowa", "ul. Rozdroże", "ul. Rozmarynowa", "ul. Rozstajna", "ul. Roztocze", "ul. Równa", "ul. Różana", "ul. Róży Wiatrów", "ul. Rubinowa", "ul. Ruciana", "ul. Rudnicka", "ul. Rumiankowa", "ul. Rusałka", "ul. Ruska", "ul. Rybna", "ul. Rycerska", "ul. Rymwida", "ul. Rynek", "ul. Rysia", "ul. Ryszarda Jankowskiego", "ul. Rzemieślnicza", "ul. Rzeszowska", "ul. Sadowa", "ul. Samotna", "ul. Sandomierska", "ul. Sarnia", "ul. Sasankowa", "ul. Sądecka", "ul. Sądowa", "ul. Sąsiedzka", "ul. Sebastiana Klonowica", "ul. Sekwojowa", "ul. Serdeczna", "ul. Seweryna Sierpińskiego", "ul. Sielankowa", "ul. Sielska", "ul. Sienna", "ul. Sieroca", "ul. Sierpniowa", "ul. Siewierzan", "ul. Siewna", "ul. Siostry Bożeny Szerwentke", "ul. Skalista", "ul. Skautów", "ul. Skibińska", "ul. Skierki", "ul. Składowa", "ul. Skołuby", "ul. Skośna", "ul. Skowronkowa", "ul. Skrajna", "ul. Skromna", "ul. Skryta", "ul. Skrzatów", "ul. Skrzetuskiego", "ul. Skrzynicka", "ul. Skrzypcowa", "ul. Skwer adw. Stanisława Kalinowskiego", "ul. Skwer arch. T. Witkowskiego", "ul. Skwer Arcybiskupa Józefa Życińskiego", "ul. Skwer Borowiczan", "ul. Skwer Dzieci z Pahiatua", "ul. Skwer Grażyny Chrostowskiej", "ul. Skwer Ofiar Wołynia", "ul. Skwer Tarasa Szewczenki", "ul. Sławin", "ul. Sławinek", "ul. Sławinkowska", "ul. Słodowa", "ul. Słoneczna", "ul. Słonecznikowa", "ul. Słowian", "ul. Słowicza", "ul. Słupian", "ul. Słupkowa", "ul. Smolna", "ul. Smyczkowa", "ul. Snopkowska", "ul. Sobótki", "ul. Sokola", "ul. Sokolniki", "ul. Solna", "ul. Sołecka", "ul. Sosnowa", "ul. Sowa", "ul. Sójk", "ul. Spacerowa", "ul. Spadochroniarzy", "ul. Spadowa", "ul. Spokojna", "ul. Sportowa", "ul. Sportowców", "ul. Spółdzielcza", "ul. Sprawiedliwych Wśród Narodów Świata", "ul. Stadionowa", "ul. Stalowa", "ul. Stanisława Arcta", "ul. Stanisława Brzóski", "ul. Stanisława Dubois", "ul. Stanisława i Witolda Łokuciewskich", "ul. Stanisława Jachowicza", "ul. Stanisława Konarskiego", "ul. Stanisława Lema", "ul. Stanisława Leszczyńskiego", "ul. Stanisława Maczka", "ul. Stanisława Magierskiego", "ul. Stanisława Mikołajczyka", "ul. Stanisława Moniuszki", "ul. Stanisława Moskalewskiego", "ul. Stanisława Orzechowskiego", "ul. Stanisława Piątkowskiego", "ul. Stanisława Ptaszyckiego", "ul. Stanisława Serwaczyńskiego", "ul. Stanisława Staszica", "ul. Stanisława Szpinalskiego", "ul. Stanisława Węglarza", "ul. Stanisława Wyspiańskiego", "ul. Stanisława Żółkiewskiego", "ul. Startowa", "ul. Stary Gaj", "ul. Stefana Banacha", "ul. Stefana Batorego", "ul. Stefana Czarnieckiego", "ul. Stefana Kisielewskiego", "ul. Stefana Lelka-Sowy", "ul. Stefana Okrzei", "ul. Stefana Roweckiego", "ul. Stefana Skoczylasa", "ul. Stefana Żeromskiego", "ul. Stefanii Sempołowskiej", "ul. Stokrotki", "ul. Stolarska", "ul. Storczykowa", "ul. Strażacka", "ul. Stroma", "ul. Strumykowa", "ul. Strusia", "ul. Strzelecka", "ul. Sucha", "ul. Sudecka", "ul. Sulisławicka", "ul. Sybiraków", "ul. Symborówka", "ul. Symfoniczna", "ul. Sympatyczna", "ul. Szafirowa", "ul. Szafranowa", "ul. Szambelańska", "ul. Szańcowa", "ul. Szarotkowa", "ul. Szarych Szeregów", "ul. Szaserów", "ul. Szczecińska", "ul. Szczęśliwa", "ul. Szczygła", "ul. Szczytowa", "ul. Szerokie", "ul. Szewska", "ul. Szklana", "ul. Szklarniana", "ul. Szkolna", "ul. Szmaragdowa", "ul. Szpacza", "ul. Szwajcarska", "ul. Szwedzka", "ul. Szwejka", "ul. Szwoleżerów", "ul. Szymona Piotrowskiego", "ul. Szymona Szymonowica", "ul. Śląska", "ul. Ślęzan", "ul. Śliska", "ul. Śliwkowa", "ul. Ślusarska", "ul. Środkowa", "ul. Św. Magdaleny", "ul. Św. Wojciecha", "ul. Światowida", "ul. Światowych Dni Młodzieży 2016", "ul. Świdnicka", "ul. Świerkowa", "ul. Świetlista", "ul. Świeża", "ul. Świętoduska", "ul. Świętokrzyska", "ul. Świtezianka", "ul. Tadeusza Błońskiego", "ul. Tadeusza Boya-Żeleńskiego", "ul. Tadeusza Brezy", "ul. Tadeusza Dymowskiego", "ul. Tadeusza Grodzickiego", "ul. Tadeusza Jacyny-Onyszkiewicza", "ul. Tadeusza Karszo-Siedlewskiego", "ul. Tadeusza Kościuszki", "ul. Tadeusza Krwawicza", "ul. Tadeusza Kutrzeby", "ul. Tadeusza Piskora", "ul. Tadeusza Rejtana", "ul. Tadeusza Szeligowskiego", "ul. Tarasowa", "ul. Targowa", "ul. Tarninowa", "ul. Tatarakowa", "ul. Tatarska", "ul. Tatiany", "ul. Teatralny", "ul. Techniczna", "ul. Teodora Leszetyckiego", "ul. Teodora Lipeckiego", "ul. Tęczowa", "ul. Tokarska", "ul. Tomasza Strzembosza", "ul. Tomasza Zana", "ul. Topazowa", "ul. Topolowa", "ul. Torowa", "ul. Towarowa", "ul. Tristana", "ul. Truskawkowa", "ul. Trześniowska", "ul. Tulipanowa", "ul. Turkusowa", "ul. Turniowa", "ul. Turystyczna", "ul. Tymiankowa", "ul. Tyszowiecka", "ul. Ułanów", "ul. Unicka", "ul. Uniwersytecka", "ul. Uprawna", "ul. Urocza", "ul. Urodajna", "ul. Urzędowska", "ul. Ustronie", "ul. Ustronna", "ul. Uśmiechu", "ul. Vetterów", "ul. Wacława Bajkowskiego", "ul. Wacława Gralewskiego", "ul. Wacława Moritza", "ul. Wacława Rogińskiego", "ul. Wacława Sieroszewskiego", "ul. Wajdeloty", "ul. Walecznych", "ul. Walerego Wróblewskiego", "ul. Waleriana Łukasińskiego", "ul. Wałowa", "ul. Wandy", "ul. Wapienna", "ul. Warmińska", "ul. Watykańska", "ul. Wawrzynowa", "ul. Wądolna", "ul. Wąwozowa", "ul. Wąwóz Modesta Sękowskiego", "ul. Wertera", "ul. Wesoła", "ul. Westerplatte", "ul. Weteranów", "ul. Wędrowna", "ul. Węglinek", "ul. Węglowa", "ul. Wiązowa", "ul. Widok", "ul. Wiejska", "ul. Wielka", "ul. Wielkopolska", "ul. Wieniawska", "ul. Wiertnicza", "ul. Wierzbowa", "ul. Wigilijna", "ul. Wiklinowa", "ul. Wiktora Ziółkowskiego", "ul. Wiktoryn", "ul. Wilcza", "ul. Wilczopolska", "ul. Wileńska", "ul. Wilhelma Hessa", "ul. Wilhelma Orlika Ruckemana", "ul. Willowa", "ul. Wiosenna", "ul. Wirowa", "ul. Wiślan", "ul. Wiśniowa", "ul. Wita Stwosza", "ul. Witolda Klepackiego", "ul. Władysława Bartoszewskiego", "ul. Władysława Broniewskiego", "ul. Władysława Cholewy", "ul. Władysława Czarkowskiego", "ul. Władysława Grabskiego", "ul. Władysława Jagiełły", "ul. Władysława Kunickiego", "ul. Władysława Olechnowicza", "ul. Władysława Orkana", "ul. Władysława Petrykiewicza", "ul. Władysława Raczkiewicza", "ul. Władysława Ruckiego", "ul. Władysława Stanisława Reymonta", "ul. Władysława Warneńczyka", "ul. Włościańska", "ul. Wodna", "ul. Wodopojna", "ul. Wojciecha Bogusławskiego", "ul. Wojciecha Kilara", "ul. Wojciecha Kiwerskiego", "ul. Wojciecha Korfantego", "ul. Wojciecha Oczki", "ul. Wojciecha Sieciecha", "ul. Wojciecha Żywnego", "ul. Wojciechowska", "ul. Wojenna", "ul. Wojewódzińska", "ul. Wokulskiego", "ul. Wolska", "ul. Wołynian", "ul. Wołyńska", "ul. Wólczańska", "ul. Wrocławska", "ul. Wrońska", "ul. Wrotkowska", "ul. Wróbla", "ul. Wrzosowa", "ul. Wschodnia", "ul. Wspólna", "ul. Wygodna", "ul. Wygon", "ul. Wysoka", "ul. Wyścigowa", "ul. Wyzwolenia", "ul. Wyżynna", "ul. Zabytkowa", "ul. Zachodnia", "ul. Zaciszna", "ul. Zadębie", "ul. Zagajnikowa", "ul. Zagłoby", "ul. Zagonowa", "ul. Zagrodna", "ul. Zakątek", "ul. Zakładowa", "ul. Zakole", "ul. Zakopiańska", "ul. Zakręt", "ul. Zamkowa", "ul. Zamojska", "ul. Zaułek Hartwigów", "ul. Zaułek Władysława Panasa", "ul. Zawieprycka", "ul. Zawilcowa", "ul. Zbigniewa Herberta", "ul. Zbigniewa Hołdy", "ul. Zbożowa", "ul. Zdrojowa", "ul. Zdrowa", "ul. Zdzisława Jamróżka", "ul. Zdzisława Papierkowskiego", "ul. Zemborzycka", "ul. Zenona Kononowicza", "ul. Zesłańców Sybiru", "ul. Zgodna", "ul. Zielna", "ul. Zielona", "ul. Zielone Wzgórze", "ul. Ziemiańska", "ul. Ziemowita", "ul. Zimna", "ul. Zimowa", "ul. Ziołowa", "ul. Złota", "ul. Zofii Pelczarskiej", "ul. Zofii Zagrobskiej", "ul. Zorza", "ul. Zuchów", "ul. Związkowa", "ul. Zwycięska", "ul. Zygmunta Augusta", "ul. Zygmunta Klukowskiego", "ul. Zygmunta Krasińskiego", "ul. Zygmunta Noskowskiego", "ul. Zygmunta Starego", "ul. Źródlana", "ul. Żarnowiecka", "ul. Żeglarska", "ul. Żelazna", "ul. Żelazowej Woli", "ul. Żmigród", "ul. Żniwna", "ul. Żołnierska", "ul. Żołnierzy Niepodległej", "ul. Żonkilowa", "ul. Żurawia", "ul. Żurawinowa", "ul. Żwirki i Wigury", "ul. Żytnia", "ul. Żywiecka"
// Gm. Jastków
["Jastków", "gm. Jastków", 51.31044709714943, 22.439648308143468, ["ul. Baśniowa","ul. Lawendowe Wzgórze","ul. Leśna","ul. Na wzgórzu","ul. Radosna","ul. Wrzosowe Wzgórze"]],
["Panieńszczyzna", "gm. Jastków", 51.30538975970641, 22.43741314842188, ["ul. Chmielowa", "ul. Księżycowa", "ul. Lawendowa", "ul. Legionistów", "ul. Lubelska", "ul. Motylowa", "ul. Nadrzeczna", "ul. Pałacowe Wzgórze", "ul. Pocztowa", "ul. Poprzeczna", "ul. Przechodnia", "ul. Słoneczna", "ul. Spółdzielcza", "ul. Sympatyczna", "ul. Szkolna", "ul. Warszawska", "ul. Żołnierzy II AWP"]],
["Piotrawin", "gm. Jastków", 51.32445232634477, 22.429182260952583, ["ul. Widokowa"]],
["Snopków", "gm. Jastków", 51.30622666411855, 22.49004334674798, ["ul. Faceliowa", "ul. Klonowa", "ul. Kościelna", "ul. Lawendowa", "ul. Ogórkowa", "ul. Parkowa", "ul. Pastelowa", "ul. Południowa", "ul. Seledynowa", "ul. Szkolna", "ul. Widokowa"]],
["Barak", "gm. Jastków", 51.28463551129551, 22.467968833269545, []],
["Dąbrowica", "gm. Jastków", 51.27298105854361, 22.458655197220843, ["ul. Brzozowa", "ul. Działkowa", "ul. Fiołkowa", "ul. Firlejowska", "ul. Jaksy z Miechowa", "ul. Kolorowa", "ul. Konwaliowa", "ul. Kresowa", "ul. Krótka", "ul. Kwiatowa", "ul. Legionowa", "ul. Lipowa", "ul. Łąkowa", "ul. Magnoliowa", "ul. Makowa", "ul. Malinowa", "ul. Malownicza", "ul. Nałęczowska", "ul. Ogrodowa", "ul. Owocowa", "ul. Pejzażowa", "ul. Polna", "ul. Promienna", "ul. Prosta", "ul. Przyjazna", "ul. Pszeniczna", "ul. Różana", "ul. Skrajna", "ul. Słoneczna", "ul. Spacerowa", "ul. Szkolna", "ul. Środkowa", "ul. Ukośna", "ul. Uzdrowiskowa", "ul. Widokowa", "ul. Wierzbowa", "ul. Wiosenna", "ul. Wiśniowa", "ul. Wrzosowa", "ul. Zakole", "ul. Zwycięska", "ul. Żeglarska"]],
["Dębówka", "gm. Jastków", 51.27682322479799, 22.490491882451384, ["ul. Podleśna"]],
["Józefów - Pociecha", "gm. Jastków", 51.31980769295482, 22.404595351956704, []],
["Ługów", "gm. Jastków", 51.317300907897476, 22.315227019006407, []],
["Marysin", "gm. Jastków", 51.2909290333686, 22.509055446979332, ["ul. Akacjowa", "ul. Aksamitna", "ul. Amarantowa", "ul. Barwna", "ul. Błękitna", "ul. Brzozowa", "ul. Chmielna", "ul. Fiołkowa", "ul. Grafitowa", "ul. Granatowa", "ul. Herbaciana", "ul. Jaskrawa", "ul. Karmelowa", "ul. Karminowa", "ul. Kawowa", "ul. Kobaltowa", "ul. Kremowa", "ul. Lazurowa", "ul. Makowa", "ul. Malownicza", "ul. Miodowa", "ul. Mleczna", "ul. Muzyczna", "ul. Oliwkowa", "ul. Orzechowa", "ul. Pastelowa", "ul. Pąsowa", "ul. Perłowa", "ul. Platynowa", "ul. Purpurowa", "ul. Różana", "ul. Rubinowa", "ul. Rumiana", "ul. Słomkowa", "ul. Szarugi", "ul. Tęczowa", "ul. Turkusowa", "ul. Zielna", "ul. Ziemska", "ul. Złocista"]],
["Miłocin", "gm. Jastków", 51.266756741749084, 22.31662412025646, ["ul. Nałęczowska"]],
["Moszenki", "gm. Jastków", 51.3043711507264, 22.3573729554372, []],
["Moszna", "gm. Jastków", 51.28296012607664, 22.319257151604603, ["ul. Nałęczowska"]],
["Moszna Kolonia", "gm. Jastków", 51.28861683884876, 22.332823793646714, []],
["Natalin", "gm. Jastków", 51.29288093485294, 22.48627308038238, [""ul. Azaliowa", "ul. Czarowna", "ul. Finezyjna", "ul. Gwieździsta", "ul. Jodłowa", "ul. Kosmiczna", "ul. Lotna", "ul. Magiczna", "ul. Modrzewiowa", "ul. Niebiańska", "ul. Orbitalna", "ul. Oriona", "ul. Planetarna", "ul. Podleśna", "ul. Przyjazna", "ul. Satelitarna", "ul. Skrzydlata", "ul. Słoneczna", "ul. Szelestna", "ul. Szumiąca", "ul. Śniegówka", "ul. Śpiewna", "ul. Ziemska""]],
["Ożarów", "gm. Jastków", 51.29509461179654, 22.300131307760324, []],
["Płouszowice", "gm. Jastków", 51.26998656147193, 22.417091160797856, []],
["Płouszowice - Kolonia", "gm. Jastków", 51.267010478840874, 22.415281878597188, ["ul. Chmielna" "ul. imienia por. Antoniego Wszelakiego" "ul. Nałęczowska"]],
["Sieprawice", "gm. Jastków", 51.30445997419549, 22.396049415192753, []],
["Sieprawki", "gm. Jastków", 51.29830164528659, 22.380891953154613, []],
["Sługocin", "gm. Jastków", 51.30884469421537, 22.373145236989465, []],
["Smugi", "gm. Jastków", 51.33112783009105, 22.497374637454254, ["ul. Księżycowa"]],
["Tomaszowice", "gm. Jastków", 51.28187233847689, 22.368621279165353, []],
["Tomaszowice - Kolonia", "gm. Jastków", 51.275528021094146, 22.380258191221024, ["ul. Nałęczowska"]],
["Wysokie", "gm. Jastków", 51.31592305549182, 22.354300525486586, []],
// Gm. Garbów
["Garbów", "gm. Garbów", 51.355300230953006, 22.328314725177894, ["ul. Akacjowa", "ul. Chabrowa", "ul. Dolna", "ul. Głęboka", "ul. Gutanowska", "ul. Jarzębinowa", "ul. Kasztanowa", "ul. Kościelna", "ul. Kościelnisko", "ul. Krakowskie Przedmieście", "ul. Krańcowa", "ul. Leśna", "ul. Lipowa", "ul. Łabędzia", "ul. Łąkowa", "ul. Magnoliowa", "ul. Makowa", "ul. Malinowa", "ul. Młyńska", "ul. Parkowa", "ul. Perłowa", "ul. Piaskowa", "ul. Pogodna", "ul. Południowa", "ul. Północna", "ul. Różana", "ul. Rumiankowa", "ul. Słoneczna", "ul. Słowicza", "ul. Sosnowa", "ul. Spacerowa", "ul. Stawowa", "ul. Szkolna", "ul. św. Wojciecha", "ul. Tatarakowa", "ul. Warszawska", "ul. Widokowa", "ul. Wspólna", "ul. Wyżynna", "ul. Zacisze", "ul. Zawiszy Czarnego", "ul. Zielone Wzgórze"]],
["Bogucin", "gm. Garbów", 51.34396619202308, 22.36228467848334, []],
["Gutanów", "gm. Garbów", 51.342732249108906, 22.28934651708439, []],
["Borków", "gm. Garbów", 51.38277097214857, 22.3838622177461, []],
["Janów", "gm. Garbów", 51.38846083957677, 22.369274585466307, []],
["Karolin", "gm. Garbów", 51.35952076167669, 22.373804227011924, []],
["Piotrowice Wielkie", "gm. Garbów", 51.34525523690894, 22.4138684761486, []],
["Piotrowice - Kolonia", "gm. Garbów", 51.355153887813685, 22.417296886847257, []],
["Leśce", "gm. Garbów", 51.35319791115422, 22.393493336874666, []],
["Meszno", "gm. Garbów", 51.41016687435609, 22.38832282023031, []],
["Wola Przybysławska", "gm. Garbów", 51.40216613426946, 22.33261816427352, []],
["Zagrody", "gm. Garbów", 51.36395954841772, 22.298173768411512, []],
["Przybysławice", "gm. Garbów", 51.36960549492772, 22.28199795475752, []],
// Gm. Wólka
["Turka", "gm. Wólka", 51.286920709484754, 22.67851803988223, ["ul. Akacjowa", "ul. Berberysowa", "ul. Borówkowa", "ul. Brzozowa", "ul. Bukowa", "ul. Cisowa", "ul. Dębowa", "ul. Grabowa", "ul. Jagodowa", "ul. Jałowcowa", "ul. Jarzębinowa", "ul. Jaśminowa", "ul. Jaworowa", "ul. Jesionowa", "ul. Jeżynowa", "ul. Jodłowa", "ul. Kalinowa", "ul. Klonowa", "ul. Konwaliowa", "ul. Leszczynowa", "ul. Lipowa", "ul. Malinowa", "ul. Modrzewiowa", "ul. Olchowa", "ul. Poziomkowa", "ul. Sosnowa", "ul. Świerkowa", "ul. Topolowa", "ul. Wiązowa", "ul. Wierzbowa", "ul. Wrzosowa", "ul. Zawilcowa", "ul. Żurawinowa"]],
["Wólka", "gm. Wólka", 51.26473501500984, 22.638769979209087, []],
["Świdniczek", "gm. Wólka", 51.25996570601213, 22.647655330842742, []],
["Biskupie - Kolonia", "gm. Wólka", 51.258284502632954, 22.661521085211774, []],
["Świdnik Duży", "gm. Wólka", 51.25448801076552, 22.692719032542104, []],
["Kolonia Świdnik Mały", "gm. Wólka", 51.250311507602355, 22.676166788264073, []],
["Długie", "gm. Wólka", 51.274575912997065, 22.648815671690112, []],
["Rudnik", "gm. Wólka", 51.282601121770995, 22.611277519931484, []],
["Pliszczyn", "gm. Wólka", 51.301452559401206, 22.649558493793414, []],
["Łysaków", "gm. Wólka", 51.30045340036395, 22.66394109868774, []],
["Sobianowice", "gm. Wólka", 51.30276959944702, 22.687185712658373, []],
["Bystrzyca", "gm. Wólka", 51.30976290305661, 22.70338430301915, []],
["Jakubowice Murowane", "gm. Wólka", 51.27000477201332, 22.63494788350747, []],
["Kolonia Pliszczyn", "gm. Wólka", 51.297452052036235, 22.642210097920113, []],
["Łuszczów Pierwszy", "gm. Wólka", 51.302255832933554, 22.726613197648714, []],
["Łuszczów Drugi", "gm. Wólka", 51.291201047051, 22.73777921851825, []],
["Świdnik Mały", "gm. Wólka", 51.255488364297136, 22.681230351069008, []],
// Gm. Konopnica
["Konopnica", "gm. Konopnica", 51.219562877599095, 22.45335622558534, []],
["Kozubszczyzna", "gm. Konopnica", 51.22314242823724, 22.42835191315562, []],
["Lipniak", "gm. Konopnica", 51.24251544260733, 22.45363937557803, []],
["Marynin", "gm. Konopnica", 51.21496670612104, 22.428455039844255, []],
["Motycz", "gm. Konopnica", 51.23937783622615, 22.378393865907157, []],
["Motycz Leśny", "gm. Konopnica", 51.24091908228674, 22.352327456213345, []],
["Motycz - Józefin", "gm. Konopnica", 51.26095057821882, 22.378104239166518, []],
["Pawlin", "gm. Konopnica", 51.20502658778032, 22.353689845415623, []],
["Radawczyk Drugi", "gm. Konopnica", 51.18572792832361, 22.41146634079682, []],
["Radawiec Duży", "gm. Konopnica", 51.206640585882795, 22.386132225683898, []],
["Radawiec Mały", "gm. Konopnica", 51.19076568621551, 22.393050779208714, []],
["Sporniak", "gm. Konopnica", 51.23460134215425, 22.362622031467836, []],
["Stasin", "gm. Konopnica", 51.21193212430949, 22.478529147699643, []],
["Szerokie", "gm. Konopnica", 51.251038688478104, 22.473376255689708, []],
["Tereszyn", "gm. Konopnica", 51.200495869563035, 22.419968132818113, []],
["Uniszowice", "gm. Konopnica", 51.25280163083852, 22.441975490161063, []],
["Zemborzyce Dolne", "gm. Konopnica", 51.19046367849755, 22.4670886488781, []],
["Zemborzyce Podleśne", "gm. Konopnica", 51.198271933795716, 22.485418893132994, []],
["Zemborzyce Wojciechowskie", "gm. Konopnica", 51.17825415769393, 22.455277717296713, []],
// Gm. Niemce
["Niemce", "gm. Niemce", 51.36132739202353, 22.632468913689124, ["ul. Boczna", "ul. Centralna", "ul. Ceramiczna", "ul. Chmielna", "ul. Cicha", "ul. Głęboka", "ul. Graniczna", "ul. Ignacego Bonawentury Budnego", "ul. Kolejowa", "ul. Kościelna", "ul. Kręta", "ul. Kwiatowa", "ul. Leonów", "ul. Leśna", "ul. Lubelska", "ul. Ogrodowa", "ul. Orzechowa", "ul. Park im. Rodzin Budnych i Łosiów", "ul. Parkowa", "ul. Południowa", "ul. Prosta", "ul. Przemysłowa", "ul. Różana", "ul. Słoneczna", "ul. Spacerowa", "ul. Spokojna", "ul. Szklarniowa", "ul. Szkolna", "ul. Topolowa", "ul. Willowa", "ul. Włóki", "ul. Zielona"]],
["Wola Niemiecka", "gm. Niemce", 51.35846841452829, 22.608620581615146, []],
["Rudka Kozłowiecka", "gm. Niemce", 51.36187769059084, 22.591184174632993, []],
["Nasutów", "gm. Niemce", 51.36259397802264, 22.52950603622651, []],
["Nowy Staw", "gm. Niemce", 51.383086125949326, 22.55805986085558, []],
["Stoczek", "gm. Niemce", 51.367339904892816, 22.49424816308204, []],
["Stoczek - Kolonia", "gm. Niemce", 51.34598005792184, 22.52189856628714, []],
["Krasienin", "gm. Niemce", 51.360242007152024, 22.457083857628202, []],
["Krasienin - Kolonia", "gm. Niemce", 51.36765685086108, 22.469926938111595, []],
["Osówka", "gm. Niemce", 51.36398519959412, 22.449181490541857, []],
["Kawka", "gm. Niemce", 51.38691626571609, 22.469361253160848, []],
["Pryszczowa Góra", "gm. Niemce", 51.39500084319839, 22.45027429880994, []],
["Majdan Krasieniński", "gm. Niemce", 51.344538288533805, 22.45283380731938, []],
["Pólko", "gm. Niemce", 51.33209877951458, 22.557052058157144, []],
["Jakubowice Konińskie - Kolonia", "gm. Niemce", 51.32021465394913, 22.53120700138625, ["ul. Akacjowa", "ul. Berberysowa", "ul. Białych Brzóz", "ul. Brzozowa", "ul. Bukowa", "ul. Cedrowa", "ul. Cisowa", "ul. Cyprysowa", "ul. Dębina", "ul. Do Dysa", "ul. Gościniec", "ul. Hiacyntowa", "ul. Jodłowa", "ul. Kasztanowa", "ul. Kubusia Puchatka", "ul. Liliowa", "ul. Lubelska", "ul. Makowa", "ul. Modrzewiowa", "ul. Ogrodowa", "ul. Oleandra", "ul. Orzechowa", "ul. Plac Jakuba Konińskiego", "ul. Plac Św. Faustyny", "ul. Starowiejska", "ul. Stary Trakt", "ul. Storczykowa", "ul. Szkolna", "ul. Świerkowa", "ul. Widokowa", "ul. Wierzbowa", "ul. Wrzosowa", "ul. Zawilcowa"]],
["Jakubowice Konińskie", "gm. Niemce", 51.31234099478176, 22.536977438592665, ["ul. Agrestowa", "ul. Czeremchowa", "ul. Fiołkowa", "ul. Jarzębinowa", "ul. Jaśminowa", "ul. Kalinowa", "ul. Klonowa", "ul. Konwaliowa", "ul. Lawendowa", "ul. Lubelska", "ul. Malinowa", "ul. Miła", "ul. Morwowa", "ul. Nad Ciemęgą", "ul. Nowowiejska", "ul. Platanowa", "ul. Pogodna", "ul. Różana", "ul. Słoneczne Wzgórze", "ul. Stokrotki", "ul. Wichrowe Wzgórze", "ul. Widokowa", "ul. Zemborska", "ul. Zielone Wzgórze"]],
["Dys", "gm. Niemce", 51.31630339217817, 22.584278768932545, ["ul. Akacjowa", "ul. Bajkowa", "ul. Bernatówka", "ul. Biskupa Władysława Gorala", "ul. Brzozowa", "ul. Bukowa", "ul. Cyprysowa", "ul. Dolina Ciemęgi", "ul. Dworska", "ul. Gajowa", "ul. Graniczna", "ul. Jaśminowa", "ul. Jaworzniacy", "ul. Karmelicka", "ul. Klasztorna", "ul. Klonowa", "ul. Księżycowa", "ul. Kwiatowa", "ul. Lipowa", "ul. Lotników Polskich", "ul. Lubelska", "ul. Malinowa", "ul. Miodowa", "ul. Nadrzeczna", "ul. Ogrodowa", "ul. Polna", "ul. Południowa", "ul. Poprzeczna", "ul. Północna", "ul. Przyjazna", "ul. Rumiankowa", "ul. Samsonówka", "ul. Skośna", "ul. Skowronkowa", "ul. Słoneczna", "ul. Spacerowa", "ul. Spokojna", "ul. Topolowa", "ul. Wąwozowa", "ul. Widokowa", "ul. Wiśniowa", "ul. Zbożowa", "ul. Zielona", "ul. Złota", "ul. Źródlana"]],
["Ciecierzyn", "gm. Niemce", 51.31925328705057, 22.607590552689164, []],
["Elizówka", "gm. Niemce", 51.29427280984898, 22.579411623848234, ["ul. Ananasowa", "ul. Aroniowa", "ul. Barwinkowa", "ul. Bluszczowa", "ul. Borówkowa", "ul. Bylicowa", "ul. Cedrowa", "ul. Chabrowa", "ul. Cynamonowa", "ul. Daktylowa", "ul. Dereniowa", "ul. Elizówka", "ul. Goździkowa", "ul. Imbirowa", "ul. Irysowa", "ul. Jagodowa", "ul. Jałowcowa", "ul. Jaśminowa", "ul. Jemiołowa", "ul. Jeżynowa", "ul. Kminkowa", "ul. Kokosowa", "ul. Laurowa", "ul. Lawendowa", "ul. Limonkowa", "ul. Lubczykowa", "ul. Miętowa", "ul. Mirabelkowa", "ul. Morelowa", "ul. Nagietkowa", "ul. Nawłociowa", "ul. Oliwkowa", "ul. Pigwowa", "ul. Poziomkowa", "ul. Słoneczna", "ul. Szafranowa", "ul. Szałwiowa", "ul. Tymiankowa", "ul. Waniliowa", "ul. Żurawinowa"]],
["Łagiewniki", "gm. Niemce", 51.29885513135288, 22.604891348510172, []],
["Ludwinów", "gm. Niemce", 51.32501847346549, 22.620577184859997, []],
["Baszki", "gm. Niemce", 51.314300927620216, 22.630817679057287, []],
["Boduszyn", "gm. Niemce", 51.324967685315144, 22.642764922287466, []],
["Dziuchów", "gm. Niemce", 51.327705766545556, 22.65910412786923, []],
["Bystrzyca - Kolonia", "gm. Niemce", 51.32526597270649, 22.678739021828406, []]
        ],
        psp: [
            ["JRG 1 Lublin", "Lublin", "ul. Antoniego Szczerbowskiego 6, 20-012 Lublin", 51.23958397276713, 22.555679861890084, true, [
                ["301[L]21", "GBARt 2,5/16 Renault Trucks D16/MotoTruck", 5],
                ["301[L]22", "GBARt 3,5/16 Renault Range D16/MotoTruck", 5],
                ["301[L]25", "GCBA 5/32 MAN TGM 18.320/MotoTruck", 5],
                ["301[L]26", "GCBA 8,2/50 Scania P410/WISS", 3],
                ["301[L]51", "SD 42 Iveco Magirus 160E30/ Magirus", 2],
                ["301[L]43", "Renault Midlum 300DXi/ISS Wawrzaszek SRt", 2],
                ["301[L]60", "SCRChem Scania G500/Szczęśniak", 3],
                ["301[L]64", "SLRchem Mercedes-Benz Sprinter 319 CDI/ISS Wawrzaszek", 3],
                ["301[L]90", "SLRR Ford Ranger/Frank Cars", 1]
            ]],
            ["JRG 2 Lublin", "Lublin", "ul. Zemborzycka 94, 20-445 Lublin", 51.206376228811465, 22.56695551430396, true, [
                ["302[L]21", "GBA 3/30 Iveco Eurocargo 150-320/MotoTruck", 3],
                ["302[L]25", "GCBA 5/32 MAN TGM 18.320/Stolarczyk", 5],
                ["302[L]26", "GCBA 10/61 Scania P450 XT/Szczęśniak", 2],
                ["302[L]53", "SH 25 MAN TGL 12.240/Bumar-Koszalin", 2],
                ["302[L]43", "SCRt Scania G420CB/ISS Wawrzaszek", 2],
                ["302[L]55", "SLBus Ford Transit/Frank-Cars", 1],
                ["302[L]71", "SRWys Mercedes Benz Atego 1327 4x4/Bocar", 3],
                ["302[L]83", "SCKw Renault K440/Stolarczyk", 1],
                ["302[L]84", "SCKn Scania P450 XT/Szczęśniak", 1],
                ["302[L]91", "SLRr Isuzu D-Max", 1]
            ]],
            ["JRG 3 Lublin", "Lublin", "ul. Metalurgiczna 7, 20-200 Lublin", 51.23903881202467, 22.63776606897038, true, [
                ["303[L]21", "GBA 3/29 MAN TGM 13.290/MotoTruck", 3],
                ["303[L]25", "GCBA 5/32/4 Volvo FMX 380/Bocar", 5],
                ["303[L]53", "SHD-25 MAN TGM 15.290/WISS Bumar", 2],
                ["303[L]43", "SCRt Scania P460 XT/Szczęśniak", 2],
                ["303[L]48", "SCDź-40 Scania G450/WISS", 2],
                ["303[L]49", "SCRd Renault K520/Szczęśniak", 2],
                ["303[L]90", "SLBus Opel Vivaro", 1],
                ["303[L]91", "SLRR Ford Ranger/Frank Cars", 1]
            ]],
            ["JRG 4 Lublin", "Lublin", "ul. Stanisława Węglarza 4, 20-148 Lublin", 51.27072522647258, 22.577408249898753, true, [
                ["304[L]21", "GBARt 2,5/16 Renault Trucks D16/MotoTruck", 6],
                ["304[L]25", "GCBARt 5/32 MAN TGM 18.320/MotoTruck", 2],
                ["304[L]51", "SCD-37 Iveco Eurocargo 160E30/Magirus", 2],
                ["304[L]71", "SLRw Volkswagen Crafter", 2],
                ["304[L]72", "SRw Iveco Eurocargo 150E28/Szczęśniak", 2],
                ["304[L]91", "SLRr Isuzu", 1]
            ]],
            ["JRG Bełżyce", "Bełżyce", "ul. Ksiedza Biskupa Tomasza Wilczyńskiego 7, 24-200 Bełżyce", 51.17116157178525, 22.281457114302587, true, [
                ["305[L]21", "GBARt 3,5/16 Renault Range D16/MotoTruck", 5],
                ["305[L]25", "GCBA 5/38 Scania P410/WISS", 3],
                ["305[L]53", "SH 25 MAN TGL 12.240/Bumar-Koszalin", 1],
                ["305[L]81", "SLKw Ford Transit/Frank-Cars", 2],
                ["305[L]90", "SLRr Isuzu D-MAX", 1]
            ]],
            ["JRG Bychawa", "Bychawa", "ul. Armii Krajowej 2, 23-100 Bychawa", 51.01242580469097, 22.534273257983866, true, [
                ["306[L]21", "GBA 2,5/16 Iveco EuroCargo 150-320/PS Szczęśniak", 3],
                ["306[L]25", "GCBA 6/50 MAN TGM 18.320/Moto Truck", 5],
                ["306[L]53", "SHD-25 - MAN TGL 12.250/Bumar Koszalin", 1],
                ["306[L]81", "SLKw Ford Transit", 2],
                ["306[L]90", "SLOp Skoda octavia", 1]
            ]]
        ],
        osp: [
            [".OSP KSRG Babin", "Babin", "Babin 159A, 24-200 Babin", 51.170170309966004, 22.341526742357914, true, [["339[L]54", "GBA 2,5/25 MAN TGM 13.290/Stolarczyk", 6], ["339[L]56", "SLRt Ford Transit/Stolarczyk", 6]]],
            [".OSP KSRG Bełżyce", "Bełżyce", "Ksiedza Biskupa Tomasza Wilczyńskiego 7A, 24-200 Bełżyce", 51.17145750754837, 22.281845332575575, true, [["339[L]83", "GBA 2,5/25 MAN TGM 13.290/Stolarczyk", 6], ["339[L]95", "SD-31 Mercedes Benz/Metz", 3]]],
            [".OSP KSRG Borzechów", "Borzechów", "Borzechów 1, 24-224", 51.0907819495423, 22.282549602550237, true, [["339[L]07", "GBA-Rt 3/24 MAN TGM 13.290/Moto-Truck", 6], ["339[L]38", "SLKw Peugot Boxer", 6]]],
            [".OSP KSRG Chmiel", "Chmiel", "Chmiel Pierwszy 23, 23-114 Chmiel Pierwszy", 51.08760525179922, 22.695658703073825, true, [["339[L]82", "GBA 3/27 Scania P360/ WISS", 6]]],
            [".OSP KSRG Dragany", "Dragany", "Dragany 167, 23-145 Dragany", 50.88895247589527, 22.660386252753977, true, [["339[L]21", "GBA 2,5/25 MAN TGM 13.290/Stolarczyk", 6], ["339[L]20", "GBA 2,5/16 Star 244/JZS", 6]]],
            [".OSP KSRG Garbów", "Garbów", "Krakowskie Przedmieście 63, 21-080 Garbów", 51.3510572130496, 22.336811426487454, true, [["339[L]25", "GBA 3,5/30 Mercedes Benz Atego 1530/Bonex", 6], ["339[L]24", "GBA 2,5/16 Mercedes Benz Atego 1329/Bocar", 6], ["339[L]27", "SH-18 Star 200/Bumar-Koszalin", 2]]],
            [".OSP KSRG Kozubszczyzna", "Kozubszczyzna", "Kozubszczyzna 127B, 21-030 Kozubszczyzna", 51.22367796773349, 22.42749210899749, true, [["339[L]65", "GBARt 3/28 Renault Range D16/Szczęśniak", 6], ["339[L]64", "GLBM-Rt 3/3 Renault Master/BIBMOT", 6]]],
            [".OSP KSRG Krasienin", "Krasienin", "Krasienin-Kolonia 18a, 21-025 Krasienin-Kolonia", 51.36459830870726, 22.467736528344663, true, [["339[L]32", "GBARt 2,5/24 Man TGM 13.290/Stolarczyk", 6], ["339[L]94", "GLBM 0,2/0,5 Peugeot Boxer/Iuvo Cars", 6]]],
            [".OSP KSRG Maciejów Stary", "Maciejów Stary", "Maciejów Stary 45A, 23-145 Maciejów Stary", 50.90050619669896, 22.734971927593314, true, [["339[L]06", " GBARt 4/30 Renault D16/ MotoTruck", 6], ["339[L]08", "GBA 3/20 Renault G270/ Sides", 6]]],
            [".OSP KSRG Matczyn-Wojcieszyn", "Matczyn-Wojcieszyn", "Matczyn 25, 24-200 Matczyn", 51.20433133901405, 22.320365613383945, true, [["339[L]48", "GBARt 4,8/42 MAN TGM 18.320/Moto-Truck", 6], ["339[L]60", "GLBM Ford Transit/Frank Cars", 6]]],
            [".OSP KSRG Mętów", "Mętów", "Mętów 165, 20-388 Mętów", 51.14717947750697, 22.590693041054877, true, [["339[L]46", "GBA 4/24/4 MAN TGM 18.320/Szczęśniak", 6], ["339[L]51", "GBA 2,5/16 Volvo FL 290/PS Szczęśniak", 6], ["339[L]52", "Peugeot Boxer 335", 6]]],
            [".OSP KSRG Moszenki", "Moszenki", "Moszenki 5, 21-008 Moszenki", 51.303702894506344, 22.358298408672525, true, [["339[L]29", "GBARt 2,5/25 MAN TGM 13.290/Stolarczyk", 6], ["339[L]01", "GCBA 4,5/29 MAN TGM 18.320/Moto-Truck", 6], ["339[L]28", "SLBus Ford Transit Custom/Frank-Cars", 6], ["339[L]31", "SH-18 Star 200/BumarKoszalin", 2]]],
            [".OSP KSRG Nasutów", "Nasutów", "Nasutów 99 D, 21-025 Nasutów", 51.3626853428774, 22.530117686968016, true, [["339[L]41", "GBA-Rt 2,5/20 Mercedes-Benz", 6], ["339[L]42", "SH-18 Volvo FL6", 3]]],
            [".OSP KSRG Niedrzwica Kościelna", "Niedrzwica Kościelna", "Lipowa 32, 24-220 Niedrzwica Kościelna", 51.08475574948593, 22.361731117331708, true, [["339[L]47", "GBARt 2,5/28 Mercedes Benz Atego 1329 / MotoTruck", 6]]],
            [".OSP KSRG Niedrzwica Duża", "Niedrzwica Duża", "Lubelska 10, 24-220 Niedrzwica Duża", 51.112406467435314, 22.3874077615504, true, [["339[L]09", "GBA-Rt 3/24 MAN TGM 13.290/Moto-Truck", 6], ["339[L]10", "SLKw Ford Transit/Frank-Cars", 6]]],
            [".OSP KSRG Niemce", "Niemce", "Różana 10, 21-025 Niemce", 51.3603787073886, 22.623772657491028, true, [["339[L]30", "GBA 2,5/25 MAN TGM 13.290/Stolarczyk", 6], ["339[L]33", "SLBus Ford Transit/Frank-Cars", 6]]],
            [".OSP KSRG Piotrków", "Piotrków", "Piotrków Drugi 10, 23-114 Piotrków Drugi", 51.053439122960974, 22.62842693069839, true, [["339[L]18", "GCBA 5/36 Scania P380/ISS Wawrzaszek", 6]]],
            [".OSP KSRG Pawlin", "Pawlin", "Pawlin 27A, 21-030 Motycz", 51.19740924035124, 22.362054183736, true, [["339[L]45", "GBA 4/28 MAN TGM 18.320/Szczęśniak", 6], ["339[L]44", "GLM Ford Transit/Stolarczyk", 6]]],
            [".OSP KSRG Piotrowice", "Piotrowice", "Piotrowice 143, 23-107 Piotrowice", 51.08569091987645, 22.48332877924416, true, [["339[L]53", "GBA 2,5/16 MAN TGM 13.290/Stolarczyk", 6], ["339[L]14", "SLRt Ford Transit/BoCar", 6]]],
            [".OSP KSRG Płouszowice", "Płouszowice", "Płouszowice-Kolonia 131, 21-008 Płouszowice-Kolonia", 51.267534624344115, 22.414010125835354, true, [["339[L]66", "GBARt 3/16 Renault D14/Stolarczyk", 6]]],
            [".OSP KSRG Radawiec Duży", "Radawiec Duży", "Radawiec Duży 154, 21-030 Radawiec Duży", 51.20615543735089, 22.38634849164673, true, [["339[L]93", "GBARt 4/28 MAN TGM 18.320/Szczęśniak", 6]]],
            [".OSP KSRG Stara Wieś Druga", "Stara Wieś Druga", "68B, Stara Wieś Pierwsza, Stara Wieś Druga Pierwsza, 23-100", 50.94245907635892, 22.553985923295997, true, [["339[L]50", "GBA 2,5/16 MAN TGM 13.290/Stolarczyk", 6], ["339[L]11", "GCBA 6/32 Jelcz 004/JZS", 4]]],
            [".OSP KSRG Strzeszkowice Duże", "Strzeszkowice Duże", "24-220 Strzeszkowice Duże", 51.15471648019531, 22.40056163597355, true, [["339[L]34", "GCBA 5/32 Scania P360/Szczęśniak", 6], ["339[L]35", "SLKw Ford Transit/Frank-Cars", 6]]],
            [".OSP KSRG Świdnik Duży", "Świdnik Duży", "Świdnik Duży 48A, 20-258 Świdnik Duży", 51.25468606338316, 22.691361354822487, true, [["339[L]90", "GBARt Scania P360 3/32 WISS", 6], ["339[L]92", "GLBM-Rt 0,3/0,5 Volkswagen Crafter / Perfekt", 5]]],
            [".OSP KSRG Turka", "Turka", "Turka 124, 20-258 Turka", 51.290039758887026, 22.680184018620086, true, [["339[L]96", "GBA 4,2/16 Volvo FL280/Bocar", 6]]],
            [".OSP KSRG Wilczopole", "Wilczopole", "Wilczopole Kolonia 161B, 20-388 Wilczopole", 51.168389501239474, 22.644126706228032, true, [["339[L]59", "GBARt Scania P360/WISS", 6], ["339[L]70", "GCBA-Rt 7/45 MAN TGM 18.320/Stolarczyk", 6], ["339[L]63", "Renault Magnum SCCn", 2], ["339[L]58", "SD-30 Mercedes", 3], ["339[L]57", "SLRr Isuzu D-Max", 5]]],
            [".OSP KSRG Wojciechów", "Wojciechów", "Wojciechów 107, 24-204 Wojciechów", 51.23007012398404, 22.24707778164358, true, [["339[L]05", "GBARt 4,2/16 Volvo FL280/Bocar", 6]]],
            [".OSP KSRG Wojciechów Kolonia Pierwsza", "Wojciechów Kolonia Pierwsza", "Wojciechów-Kolonia Pierwsza 13, 24-204 Wojciechów-Kolonia Pierwsza", 51.235035072643576, 22.213827225812032, true, [["339[L]98", "GBARt 3/24 MAN TGM 13.290/Moto Truck", 6]]],
            [".OSP KSRG Wola Przybysławska", "Wola Przybysławska", "Wola Przybysławska 324, 21-080 Wola Przybysławska", 51.397925746755206, 22.329646604870273, true, [["339[L]62", "GBARt 3/16 Volvo FL 280/Bocar", 6], ["339[L]61", "GBA 2,5/16 Star 244/Moto Truck", 6]]],
            [".OSP KSRG Zakrzew", "Zakrzew", "Zakrzew 236, 23-155 Zakrzew", 50.88731759115839, 22.588077972186888, true, [["339[L]23", "GBA 4,4/4,5 MAN TGM 18.320/Stolarczyk", 6]]],
            [".OSP KSRG Żabia Wola", "Żabia Wola", "Pszczela Wola 8A, 23-107 Osmolice Pierwsze", 51.111373543877406, 22.501116447971235, true, [["339[L]81", "GBA-Rt 4,5/29 Man TGM 18.340/MotoTruck", 6], ["339[L]84", "SH-18 Star 200/Bumar", 2]]],
            [".OSP KSRG Żuków", "Żuków", "Żuków-Kolonia 58, 23-110 Żuków-Kolonia", 51.04213037806087, 22.785312618560525, true, [["339[L]40", "GBA 2,6/16 Mercedes Benz 1124AF/SCHLINGMANN", 9]]],
            [".OSP Konopnica", "Konopnica", "Konopnica 24A, 21-030 Konopnica", 51.2311704946784, 22.46273067803247, true, [["337[L]80", "GBA-Rt 2,5/16 MAN TGM 13.290/Stolarczyk", 6], ["337[L]82", "GLBM 0,8/02 Opel Movano/ IUVOcars", 5]]],
            [".OSP Jastków", "Jastków", "Jastków 67, 21-002", 51.317885202376935, 22.4410947341817, true, [["337[L]54", "GBA 3/28 Renault D16/Szczęśniak", 6], ["337[L]55", "SLBus Renault Trafic", 5]]],
            [".OSP Piotrowice Wielkie", "Piotrowice Wielkie", "Piotrowice Wielkie 47, 21-080 Piotrowice Wielkie", 51.34403830947209, 22.41032797045279, true, [["337[L]25", "GBA 2,5/20 Star 12.185/Stolarczyk", 6]]],
            [".OSP Jakubowice Konińskie - Kolonia", "Jakubowice Konińskie - Kolonia", "Lubelska 2, 21-003 Jakubowice Konińskie-Kolonia", 51.316595037471174, 22.535482811714218, true, [["337[L]50", "GBARt 3,5/27 MAN TGM 13.290/PUH Stolarczyk", 6]]],
            [".OSP Dys", "Dys", "Ogrodowa 8, 21-003 Dys", 51.31494504342334, 22.578934370853247, true, [["337[L]73", "GBARt 4,5/30 MAN TGM 18.320/MotoTruck", 6]]],
            [".OSP Bystrzyca", "Bystrzyca", "Bystrzyca 93, 20-258 Bystrzyca", 51.31036621863549, 22.707415126409877, true, [["338[L]61", "GCBA 5/40 MAN LE 18.280/Stolarczyk", 6]]],
            [".OSP Lublin - Głusk", "Lublin - Głusk", "20-387 Lublin", 51.191786543200536, 22.597497737863854, true, [["337[L]06", "GBA 2,5/25 MAN TGM 13.290/Stolarczyk", 6], ["337[L]03", "GLBA 0,3/0,8 RENAULT MASTER", 5], ["337[L]01", "SLBus Renault", 5]]],
            [".OSP Miłocin - Czajki", "Miłocin - Czajki", "Palikije Drugie 29A, 24-204 Palikije Drugie", 51.24756467880187, 22.3046303259807, true, [["338[L]70", "GCBA 4/34 MB Atego/Szczęśniak", 6], ["338[L]71", " SLKw Ford Transit", 6]]]
        ]
    }
];

const _sourceProfiles = (typeof RAW_PROFILES !== "undefined" && Array.isArray(RAW_PROFILES)) ? RAW_PROFILES : [];
const _lublinProfiles = [..._sourceProfiles.filter(p => p.id !== "lublin"), LUBLIN_PROFILE];

const COUNTY_PROFILES = {};
_lublinProfiles.forEach(rp => { COUNTY_PROFILES[rp.id] = unpackProfile(rp); });

// --- ZMIENNE AKTYWNEGO POWIATU I ZALOGOWANEGO UŻYTKOWNIKA ---
let currentCountyId = "lublin";
let currentCountyCallsign = "Lublin 998";
let currentUserRank = "asp.";
let currentUserName = "";

let locationsDatabase = COUNTY_PROFILES.lublin ? { ...COUNTY_PROFILES.lublin.locationsDatabase } : {};
let townsList = Object.keys(locationsDatabase);
let realStreetsByTown = COUNTY_PROFILES.lublin ? { ...COUNTY_PROFILES.lublin.realStreetsByTown } : {};
let gpsCoords = COUNTY_PROFILES.lublin ? { ...COUNTY_PROFILES.lublin.gpsCoords } : {};
let unitExactLocations = COUNTY_PROFILES.lublin ? JSON.parse(JSON.stringify(COUNTY_PROFILES.lublin.unitExactLocations)) : {};
let unitsPSP = COUNTY_PROFILES.lublin ? JSON.parse(JSON.stringify(COUNTY_PROFILES.lublin.unitsPSP)) : [];
let unitsOSP = COUNTY_PROFILES.lublin ? JSON.parse(JSON.stringify(COUNTY_PROFILES.lublin.unitsOSP)) : [];

function getStorageKeyForCounty(countyId) { return `SWDST_SAVED_SHIFT_STATE_${countyId}_V2`; }

function getFormattedOperatorName() {
    return (currentUserName && currentUserName.trim() !== "")
        ? `${currentUserRank} ${currentUserName.trim()}`
        : "Nazwa Użytkownika (Niezalogowany)";
}

function updateStatusBarUserDisplay() {
    const firstSpan = document.querySelector('.status-bar span');
    if (!firstSpan || !COUNTY_PROFILES[currentCountyId]) return;
    const pName = COUNTY_PROFILES[currentCountyId].name;
    firstSpan.innerHTML = (currentUserName && currentUserName.trim() !== "")
        ? `Zalogowano jako: <b>${currentUserRank} ${currentUserName.trim()}</b> <span style="color:#0a246a; font-weight:bold; margin-left:6px;">[${pName}]</span>`
        : `Zalogowano jako: <b style="color:#777; font-style:italic;">Nazwa Użytkownika</b> <span style="color:#0a246a; font-weight:bold; margin-left:6px;">[${pName}]</span>`;
}

function updateJrgSelectOptions() {
    if (!COUNTY_PROFILES[currentCountyId]) return;
    const jrgList = COUNTY_PROFILES[currentCountyId].jrgList;
    ['inp-ev-jrg', 'inp-ev-lead', 'inp-ev-area'].forEach(selId => {
        const el = document.getElementById(selId);
        if (el) el.innerHTML = jrgList.map(j => `<option value="${j}">${j}</option>`).join('');
    });
}

// --- EKRAN LOGOWANIA / INFORMACJA O REJONIE ---
function ensureLauncherModalExists() {
    if (document.getElementById('modal-launcher')) return;
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'modal-launcher';
    modal.style.cssText = 'display:flex; background:rgba(10, 36, 106, 0.45); z-index:12000;';

    const rawProf = [LUBLIN_PROFILE];
    const radiosHtml = rawProf.map((rp, idx) => `
        <label style="display: flex; align-items: center; gap: 8px; padding: 6px 8px; border: 1.5px solid #0a246a; background: ${idx === 0 ? '#f0f5ff' : '#ffffff'}; cursor: pointer; border-radius: 3px;">
            <input type="radio" name="launcher-county" value="${rp.id}" ${idx === 0 ? 'checked' : ''}>
            <div>
                <div style="font-weight: bold; color: #0a246a; font-size: 12px;">${rp.name}</div>
                <div style="font-size: 10px; color: #444;">${rp.desc} • Kryptonim: <b>${rp.radioCallsign}</b></div>
            </div>
        </label>
    `).join('');

    modal.innerHTML = `
        <div class="modal-window" style="width: 520px; background: #ece9d8; border: 2px solid #0a246a; box-shadow: 0 6px 25px rgba(0,0,0,0.6);">
            <div class="modal-header" style="background: linear-gradient(90deg, #0a246a, #1d4f91); color: #fff; padding: 6px 10px; font-size: 13px;">
                <span>🚒 ${APP_VERSION} — Logowanie Dyspozytora KM PSP Lublin</span>
            </div>
            <div class="modal-body" style="padding: 12px; display: flex; flex-direction: column; gap: 10px;">
                <div class="form-box" style="padding: 8px;">
                    <div class="form-title" style="font-size: 12px; margin-bottom: 6px;">1. Dane Dyspozytora Stanowiska Kierowania</div>
                    <div style="display: flex; gap: 8px;">
                        <div class="form-group" style="width: 135px;">
                            <label>Stopień służbowy:</label>
                            <select id="launcher-rank" style="padding: 4px;">
                                <option value="str.">strażak</option><option value="st. str.">st. strażak</option>
                                <option value="sekc.">sekcyjny</option><option value="st. sekc.">st. sekcyjny</option>
                                <option value="mł. ogn.">mł. ogniomistrz</option><option value="ogn.">ogniomistrz</option>
                                <option value="st. ogn.">st. ogniomistrz</option><option value="mł. asp.">mł. aspirant</option>
                                <option value="asp." selected>aspirant</option><option value="st. asp.">st. aspirant</option>
                                <option value="asp. szt.">asp. sztabowy</option><option value="mł. kpt.">mł. kapitan</option>
                                <option value="kpt.">kapitan</option><option value="st. kpt.">st. kapitan</option>
                            </select>
                        </div>
                        <div class="form-group" style="flex: 1;">
                            <label>Identyfikator / Nazwa operatora:</label>
                            <input type="text" id="launcher-username" placeholder="Nazwa Użytkownika" style="padding: 4px 8px; font-size: 12px; font-weight: bold;" onkeypress="if(event.key==='Enter') confirmLauncherLogin()">
                        </div>
                    </div>
                </div>
                <div class="form-box" style="padding: 8px;">
                    <div class="form-title" style="font-size: 12px; margin-bottom: 6px;">2. Wybór Rejonu Operacyjnego</div>
                    <div style="display: flex; flex-direction: column; gap: 5px; max-height: 270px; overflow-y: auto; padding-right: 4px;">
                        ${radiosHtml}
                    </div>
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 8px;">
                    <button class="btn-win" style="padding: 6px 18px; font-weight: bold; font-size: 12px; background: #e2f0d9; border: 1.5px solid #155724; color: #155724;" onclick="confirmLauncherLogin()">🚀 Rozpocznij służbę w SWD ➔</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function openLauncherModal() {
    ensureLauncherModalExists();
    const inpUser = document.getElementById('launcher-username');
    const selRank = document.getElementById('launcher-rank');
    if (inpUser) inpUser.value = currentUserName;
    if (selRank) selRank.value = currentUserRank;
    const rad = document.querySelector(`input[name="launcher-county"][value="${currentCountyId}"]`);
    if (rad) rad.checked = true;
    document.getElementById('modal-launcher').style.display = 'flex';
}

function confirmLauncherLogin() {
    const inpUser = document.getElementById('launcher-username');
    const selRank = document.getElementById('launcher-rank');
    const chosenCountyRadio = document.querySelector('input[name="launcher-county"]:checked');

    currentUserRank = selRank ? selRank.value : "asp.";
    currentUserName = inpUser ? inpUser.value.trim() : "";
    const newCountyId = chosenCountyRadio ? chosenCountyRadio.value : "lublin";

    localStorage.setItem('SWDST_USER_SESSION', JSON.stringify({
        rank: currentUserRank, username: currentUserName, countyId: newCountyId
    }));

    applyCountyProfile(newCountyId);
    updateStatusBarUserDisplay();

    const modal = document.getElementById('modal-launcher');
    if (modal) modal.style.display = 'none';
}

function applyCountyProfile(countyId) {
    const profile = COUNTY_PROFILES[countyId] || COUNTY_PROFILES.lublin;
    if (!profile) return;
    
    currentCountyId = profile.id;
    currentCountyCallsign = profile.radioCallsign;

    locationsDatabase = { ...profile.locationsDatabase };
    townsList = Object.keys(locationsDatabase);
    realStreetsByTown = { ...profile.realStreetsByTown };
    gpsCoords = { ...profile.gpsCoords };
    unitExactLocations = JSON.parse(JSON.stringify(profile.unitExactLocations));
    unitsPSP = JSON.parse(JSON.stringify(profile.unitsPSP));
    unitsOSP = JSON.parse(JSON.stringify(profile.unitsOSP));

    unitsOSP.forEach(u => {
        u.vehicles.forEach(v => { v.obsada = Math.floor(Math.random() * 4) + 3; });
    });

    events = []; selectedEvIdForRadio = null; activeEditingId = null;
    mainRadioLogs = []; cprCounter = 101;
    shiftStats = { cprTotalGenerated: 0, cprAccepted: 0, cprRefused: 0, refusalReasons: {} };
    Object.keys(openRadioWindows).forEach(k => closeRadioWindow(k));

    loadSimulationState();
    updateJrgSelectOptions();
    renderUnits(); renderEvents(); renderSelectedEventDetails();

    const mainHdr = document.querySelector('#main-radio-modal .main-radio-header span');
    if (mainHdr) mainHdr.innerText = `📻 Główne Radio SKKP (${currentCountyCallsign})`;
    updateMainRadioChat();

    stationsGeocoded = false;
    geocodeAllFireStationsExact();
    if (leafletMap) {
        leafletMap.setView(profile.mapCenter, 11);
        updateMapMarkers();
    }
}

function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// --- SILNIK ROUTINGU OSRM Z PEŁNĄ GEOMETRIĄ TRASY (DROGI) ---
async function getRoadRouting(lat1, lon1, lat2, lon2, withGeometry = true) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        const geomParam = withGeometry ? '?overview=full&geometries=geojson' : '?overview=false';
        const url = `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}${geomParam}`;
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
            const data = await res.json();
            if (data.routes && data.routes.length > 0) {
                const route = data.routes[0];
                if (route && typeof route.distance === 'number' && typeof route.duration === 'number') {
                    let coordinates = null;
                    if (withGeometry && route.geometry && route.geometry.coordinates) {
                        // OSRM zwraca [lng, lat], zamieniamy na [lat, lng] dla Leafleta
                        coordinates = route.geometry.coordinates.map(c => [c[1], c[0]]);
                    }
                    return {
                        distanceKm: route.distance / 1000,
                        durationSec: route.duration,
                        coordinates: coordinates
                    };
                }
            }
        }
    } catch (e) {}
    return null;
}

async function getUnitProximityAsync(unitName, city, targetLat = null, targetLng = null) {
    const firstUnitKey = Object.keys(unitExactLocations)[0];
    const unitLoc = unitExactLocations[unitName] || unitExactLocations[firstUnitKey];
    const defaultTown = COUNTY_PROFILES[currentCountyId] ? COUNTY_PROFILES[currentCountyId].defaultTown : "Lublin";
    const targetTown = Object.keys(gpsCoords).find(c => c.toLowerCase() === (city || "").trim().toLowerCase()) || defaultTown;
    const tCoords = (targetLat && targetLng) ? [targetLat, targetLng] : (gpsCoords[targetTown] || COUNTY_PROFILES[currentCountyId].mapCenter);

    let kmRounded = 1.5;
    let travelSec = 10;
    let routeCoords = null;

    if (unitLoc && tCoords) {
        const roadRoute = await getRoadRouting(unitLoc.lat, unitLoc.lng, tCoords[0], tCoords[1], true);
        if (roadRoute && !isNaN(roadRoute.durationSec) && roadRoute.durationSec > 0) {
            kmRounded = Math.max(1.0, Math.round(roadRoute.distanceKm * 10) / 10);
            travelSec = Math.max(8, Math.round(roadRoute.durationSec * 0.85));
            routeCoords = roadRoute.coordinates;
        } else {
            const fallbackDist = haversineKm(unitLoc.lat, unitLoc.lng, tCoords[0], tCoords[1]) * 1.25;
            kmRounded = Math.max(1.2, Math.round(fallbackDist * 10) / 10);
            travelSec = Math.max(10, Math.round(kmRounded * 45));
        }
    }
    return { sec: travelSec, kmNum: kmRounded, km: `${kmRounded.toFixed(1)} km`, coordinates: routeCoords };
}

function getUnitProximity(unitName, city) {
    const firstUnitKey = Object.keys(unitExactLocations)[0];
    const unitLoc = unitExactLocations[unitName] || unitExactLocations[firstUnitKey];
    const defaultTown = COUNTY_PROFILES[currentCountyId] ? COUNTY_PROFILES[currentCountyId].defaultTown : "Lublin";
    const targetTown = Object.keys(gpsCoords).find(c => c.toLowerCase() === (city || "").trim().toLowerCase()) || defaultTown;
    const tCoords = gpsCoords[targetTown] || COUNTY_PROFILES[currentCountyId].mapCenter;

    const dist = unitLoc ? haversineKm(unitLoc.lat, unitLoc.lng, tCoords[0], tCoords[1]) * 1.25 : 2.5;
    const kmRounded = Math.max(1.2, Math.round(dist * 10) / 10);
    return { sec: Math.max(10, Math.round(kmRounded * 45)), kmNum: kmRounded, km: `${kmRounded.toFixed(1)} km` };
}

function generateDeparturePrepSeconds(unitName) {
    const isPSP = unitName.includes("JRG") || unitName.includes("KP PSP") || unitName.includes("KM PSP");
    return isPSP ? (Math.floor(Math.random() * 5) + 1) : (Math.floor(Math.random() * 10) + 1);
}

function calculateActionDurationSeconds(desc, subtype, type) {
    if (type === 'PZR') return -1;
    const text = ((desc || "") + " " + (subtype || "")).toLowerCase();
    const isBig = /poszukiwan|zaginion|hala|hali|magazyn|zakład|produkcyjn|las|leśn|mieszkan|kamienic|budynk|dach|poddasz|gospodarcz|stodoł|tartak|szkoł|składowisk/.test(text);
    if (isBig) return Math.floor(Math.random() * 601) + 300;
    if (/wypadek|zderzenie|chemiczn/.test(text)) return Math.floor(Math.random() * 181) + 240;
    return Math.floor(Math.random() * 121) + 150;
}

function autoSelectJRGByCity(city) {
    if (!COUNTY_PROFILES[currentCountyId]) return;
    const jrgList = COUNTY_PROFILES[currentCountyId].jrgList;
    let bestJrg = jrgList[0];
    if (jrgList.length > 1) {
        let bestSec = 999999;
        jrgList.forEach(jName => {
            const p = getUnitProximity(jName, city);
            if (p.sec < bestSec) { bestSec = p.sec; bestJrg = jName; }
        });
    }
    ['inp-ev-jrg', 'inp-ev-lead', 'inp-ev-area'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = bestJrg;
    });
}

// --- PODRODZAJE ZDARZEŃ ---
const subtypesData = {
    "P": [
        "P - Inne pożary", "P - Instytucje, obiekty użyteczności publicznej", "P - Obiekty gospodarcze i inne rolnicze",
        "P - Obiekty magazynowe, place składowe", "P - Obiekty mieszkalne", "P - Obiekty produkcyjne, instalacje technologiczne",
        "P - Śmietniska, wysypiska", "P - Środki transportu drogowego (np. autobus)", "P - Środki transportu kolejowego",
        "P - Środki transportu lotniczego", "P - Środki transportu wodnego", "P - Trawy, torfowiska, lasy, pola, stogi"
    ],
    "MZ": [
        "Inne MZ", "MZ - Atmosferyczne", "MZ - Budowlane", "MZ - Chemiczne", "MZ - Drogowe", "MZ - Kolejowe",
        "MZ - Kolizja", "MZ - Lotnicze", "MZ - Wodne", "MZ - Palenie ognisk w miejscach niedozwolonych",
        "MZ - Podejrzenie podłożenia ładunku", "MZ - Pomoc innym służbom", "MZ - Pomoc Policji", "MZ - Pomoc PRM",
        "MZ - Pomoc w otwarciu mieszkania, podejrzenie zgonu", "MZ - Poszukiwanie osób zaginionych", "MZ - Próba samobójcza",
        "MZ - Sanitarno-epidemiologiczne", "MZ - Topienie się", "MZ - Wypadek", "MZ - Zabezpieczenie ładunku", "MZ - Zwierzęta"
    ],
    "AF": ["AF - Fałszywy z instalacji", "AF - Złośliwy", "AF - W dobrej wierze"],
    "CW": ["CW - Zagrożenie chemiczne", "CW - Zagrożenie ekologiczne"],
    "WG": ["WG - Wybuch gazu", "WG - Inne zagrożenie wybuchem"],
    "BL": ["BL - Budynek zagrożony zawaleniem"],
    "ZPR": ["ZPR - Zagrożenie promieniotwórcze"],
    "PZR": []
};

function updateSubtypes(type) {
    const select = document.getElementById('inp-ev-subtype');
    const group = document.getElementById('subtype-group');
    if(!select) return;
    select.innerHTML = '';
    if (group) {
        if (type === 'PZR') { group.style.display = 'none'; return; }
        else { group.style.display = 'flex'; }
    }
    (subtypesData[type] || ["Brak"]).forEach(sub => {
        const opt = document.createElement('option');
        opt.value = sub; opt.innerText = sub;
        select.appendChild(opt);
    });
}

let events = [], activeEditingId = null, selectedEvIdForRadio = null, selectedVehicles = [];
let servicesState = { prm: false, police: false }, currentCPRData = null, cprCounter = 101;
let openRadioWindows = {}, mainRadioLogs = [], mainRadioModalEl = null;
let simSpeed = 1, simIntervalId = null, autoCprTimeoutId = null;
let shiftStats = { cprTotalGenerated: 0, cprAccepted: 0, cprRefused: 0, refusalReasons: {} };

// --- MODUŁ ZAPISYWANIA I WCZYTYWANIA STANU SŁUŻBY ---
function saveSimulationState() {
    try {
        const stateObj = {
            version: APP_VERSION, countyId: currentCountyId, savedAt: new Date().toISOString(),
            events, unitsPSP, unitsOSP, unitExactLocations, shiftStats, cprCounter,
            mainRadioLogs: mainRadioLogs.slice(-100)
        };
        localStorage.setItem(getStorageKeyForCounty(currentCountyId), JSON.stringify(stateObj));
    } catch (e) {}
}

function loadSimulationState() {
    try {
        const raw = localStorage.getItem(getStorageKeyForCounty(currentCountyId));
        if (!raw) return false;
        const data = JSON.parse(raw);
        if (!data || !Array.isArray(data.events)) return false;

        events = data.events;
        if (Array.isArray(data.unitsPSP) && data.unitsPSP.length > 0) unitsPSP = data.unitsPSP;
        if (Array.isArray(data.unitsOSP) && data.unitsOSP.length > 0) unitsOSP = data.unitsOSP;
        if (data.unitExactLocations) {
            Object.keys(data.unitExactLocations).forEach(k => {
                if (!unitExactLocations[k]) unitExactLocations[k] = data.unitExactLocations[k];
            });
        }
        if (data.shiftStats) shiftStats = data.shiftStats;
        if (typeof data.cprCounter === 'number') cprCounter = data.cprCounter;
        if (Array.isArray(data.mainRadioLogs)) mainRadioLogs = data.mainRadioLogs;

        if (events.length > 0) {
            selectedEvIdForRadio = events[events.length - 1].id;
            const btnOpen = document.getElementById('btn-open-radio');
            if (btnOpen) btnOpen.style.display = 'block';
        }
        return true;
    } catch (e) { return false; }
}

function exportShiftStateToFile() {
    saveSimulationState();
    const raw = localStorage.getItem(getStorageKeyForCounty(currentCountyId)) || "{}";
    const blob = new Blob([raw], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SWDST_${currentCountyId}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function importShiftStateFromFile() {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            try {
                const parsed = JSON.parse(ev.target.result);
                if (!parsed || !Array.isArray(parsed.events)) { alert("Nieprawidłowy plik zapisu służby!"); return; }
                if (parsed.countyId && COUNTY_PROFILES[parsed.countyId]) currentCountyId = parsed.countyId;
                localStorage.setItem(getStorageKeyForCounty(currentCountyId), JSON.stringify(parsed));
                applyCountyProfile(currentCountyId);
                alert("✅ Pomyślnie wczytano zapis służby z pliku!");
            } catch (err) { alert("Błąd podczas odczytu pliku zapisu!"); }
        };
        reader.readAsText(file);
    };
    inp.click();
}

function resetShiftState() {
    if (!confirm("Czy na pewno chcesz zresetować obecną służbę w wybranym rejonie?")) return;
    localStorage.removeItem(getStorageKeyForCounty(currentCountyId));
    applyCountyProfile(currentCountyId);
    const sisBody = document.getElementById('details-sis-body');
    if (sisBody) sisBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #888;">Brak wybranego zdarzenia</td></tr>';
}

function setSimulationSpeed(speed) {
    simSpeed = speed;
    [1, 2, 5].forEach(s => {
        const btn = document.getElementById(`btn-speed-${s}x`);
        if (btn) {
            btn.style.background = s === speed ? '#0a246a' : '#e1e1e1';
            btn.style.color = s === speed ? '#ffffff' : '#000000';
        }
    });
    startSimulationLoop();
    scheduleNextAutoCPR();
}

function injectSpeedAndSaveControls() {
    if (document.getElementById('swd-speed-controls')) return;
    const btnOpenRadio = document.getElementById('btn-open-radio');
    if (btnOpenRadio && btnOpenRadio.parentElement) {
        const bar = btnOpenRadio.parentElement;
        bar.style.flexWrap = 'wrap';
        const speedBox = document.createElement('div');
        speedBox.id = 'swd-speed-controls';
        speedBox.style.cssText = 'display: inline-flex; align-items: center; gap: 3px; background: #d4d0c8; border: 1px solid #808080; padding: 2px 6px; border-radius: 2px; margin-left: auto;';
        speedBox.innerHTML = `
            <span style="font-weight:bold; color:#000; margin-right:2px;">⏩ Tempo:</span>
            <button id="btn-speed-1x" class="btn-win" style="padding: 1px 7px; font-weight: bold; background: #0a246a; color: #fff;" onclick="setSimulationSpeed(1)">1x</button>
            <button id="btn-speed-2x" class="btn-win" style="padding: 1px 7px; font-weight: bold;" onclick="setSimulationSpeed(2)">2x</button>
            <button id="btn-speed-5x" class="btn-win" style="padding: 1px 7px; font-weight: bold;" onclick="setSimulationSpeed(5)">5x</button>
            <span style="margin: 0 3px; color:#777;">|</span>
            <button class="btn-win" style="padding: 1px 6px; font-weight: bold; background:#eef4ff; color:#0a246a;" onclick="openLauncherModal()">👤 Komenda / Login</button>
            <button class="btn-win" style="padding: 1px 6px; font-weight: bold;" onclick="exportShiftStateToFile()">💾 Eksportuj</button>
            <button class="btn-win" style="padding: 1px 6px;" onclick="importShiftStateFromFile()">📂 Wczytaj</button>
            <button class="btn-win" style="padding: 1px 6px; background:#ffe6e6; color:#800000;" onclick="resetShiftState()">🗑️ Reset</button>
        `;
        bar.appendChild(speedBox);
    }
}

function injectPzrStyles() {
    if (document.getElementById('swd-pzr-styles')) return;
    const style = document.createElement('style');
    style.id = 'swd-pzr-styles';
    style.innerHTML = `
        .status-dot.yellow { background-color: #f1c40f !important; box-shadow: 0 0 4px #d4ac0d; }
        .vehicle-row.pzr-active { background-color: #fff8c4 !important; border-left: 3px solid #f1c40f !important; }
        .unit-box.unit-on-pzr { border: 1.5px solid #d4ac0d !important; background-color: #fffdf0 !important; }
        .unit-header.header-on-pzr { background-color: #ffe875 !important; color: #000000 !important; }
    `;
    document.head.appendChild(style);
}

function getActivePzrForVehicle(vehId) {
    let foundPzrEv = null;
    events.forEach(ev => {
        if (ev.status === 'ACTIVE' && ev.type === 'PZR') {
            if (ev.vehicles && ev.vehicles.some(v => v.id === vehId)) foundPzrEv = ev;
        }
    });
    return foundPzrEv;
}

function isVehicleInCombatAction(vehId) {
    return events.some(ev => {
        if (ev.type === 'PZR') return false;
        if (ev.status === 'ACTIVE') return ev.vehicles.some(v => v.id === vehId && v.phase !== 'DONE');
        if (ev.status === 'FINISHED') return ev.vehicles.some(v => v.id === vehId && v.phase === 'RETURN' && v.returnTime > 0);
        return false;
    });
}

// --- GŁÓWNE RADIO OGÓLNOPOWIATOWE SKKP ---
function ensureMainRadioWindow() {
    if (mainRadioModalEl) return mainRadioModalEl;
    const modal = document.createElement('div');
    modal.id = 'main-radio-modal';
    modal.style.cssText = 'position:fixed; z-index:1045; width:460px; right:20px; bottom:35px;';
    modal.innerHTML = `
        <div style="background: #c0c0c0; border: 2px solid #ffffff; border-right-color: #404040; border-bottom-color: #404040; box-shadow: 2px 2px 6px rgba(0,0,0,0.5); font-family: 'Segoe UI', Tahoma, sans-serif;">
            <div class="main-radio-header" style="background: linear-gradient(90deg, #800000, #b30000); color: #ffffff; padding: 4px 6px; font-weight: bold; font-size: 13px; display: flex; justify-content: space-between; align-items: center; cursor: move; user-select: none;">
                <span>📻 Główne Radio SKKP (${currentCountyCallsign})</span>
                <div style="display: flex; gap: 2px;">
                    <button style="background: #c0c0c0; border: 1px solid #fff; width: 18px; height: 16px; font-size: 10px; font-weight: bold; cursor: pointer; padding: 0;" onclick="minimizeMainRadio()">_</button>
                    <button style="background: #c0c0c0; border: 1px solid #fff; width: 18px; height: 16px; font-size: 10px; font-weight: bold; cursor: pointer; padding: 0;" onclick="closeMainRadio()">✕</button>
                </div>
            </div>
            <div style="padding: 6px; background: #c0c0c0;">
                <div style="font-size:10px; color:#222; margin-bottom:3px; font-weight:bold;">Meldunki wyjazdów, dojazdów, zakończenia działań i powrotów do bazy:</div>
                <div id="main-radio-chat" style="background: #111111; color: #ffffff; font-family: 'Consolas', 'Courier New', monospace; font-weight: bold; font-size: 12px; height: 210px; padding: 6px; overflow-y: auto; border: 2px solid #808080; box-sizing: border-box; line-height: 1.35;"></div>
                <div style="display: flex; gap: 4px; margin-top: 6px; align-items: center;">
                    <button style="padding: 4px 8px; font-size: 11px; background: #e1e1e1; border: 2px solid #fff; border-right-color: #404040; border-bottom-color: #404040; cursor: pointer; font-weight: bold; color:#000;" onclick="sendMainRadioDispatchMsg(currentCountyCallsign + ', przyjąłem.')">✔ Przyjąłem</button>
                    <input type="text" id="inp-main-radio" placeholder="Nadaj komunikat ogólny..." style="flex: 1; padding: 4px 6px; font-size: 12px; background: #ffffff; color:#000; border: 2px solid #808080; outline: none;" onkeypress="if(event.key==='Enter') sendMainRadioCustom()">
                    <button style="padding: 4px 10px; font-size: 11px; background: #e1e1e1; border: 2px solid #fff; border-right-color: #404040; border-bottom-color: #404040; cursor: pointer; font-weight: bold; color:#000;" onclick="sendMainRadioCustom()">Nadaj</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    makeDraggable(modal, modal.querySelector('.main-radio-header'));
    mainRadioModalEl = modal;
    updateMainRadioChat();
    return modal;
}

function openMainRadio() {
    const modal = ensureMainRadioWindow();
    modal.style.display = 'block';
    const minItem = document.getElementById('min-main-radio');
    if (minItem) minItem.remove();
    updateMainRadioChat();
}

function closeMainRadio() { if (mainRadioModalEl) mainRadioModalEl.style.display = 'none'; }

function minimizeMainRadio() {
    if (mainRadioModalEl) mainRadioModalEl.style.display = 'none';
    const bar = document.getElementById('minimized-bar');
    if (bar && !document.getElementById('min-main-radio')) {
        const item = document.createElement('div');
        item.className = 'minimized-item'; item.id = 'min-main-radio';
        item.innerHTML = `📻 Główne Radio SKKP`;
        item.onclick = () => openMainRadio();
        bar.appendChild(item);
    }
}

function logToMainRadio(callsign, messageText, color = '#7CFC00', playBeep = true) {
    ensureMainRadioWindow();
    if (playBeep) { audioMotorola.currentTime = 0; audioMotorola.play().catch(() => {}); }
    const timeStr = new Date().toLocaleTimeString();
    mainRadioLogs.push(`<div style="margin-bottom: 6px; color: ${color}; border-bottom: 1px dashed #333; padding-bottom: 3px;"><span style="color:#cccccc;">[${timeStr}]</span> <b>${callsign}:</b><br>"${messageText}"</div>`);
    updateMainRadioChat();
    saveSimulationState();
}

function updateMainRadioChat() {
    const chat = document.getElementById('main-radio-chat');
    if (chat) {
        chat.innerHTML = mainRadioLogs.length > 0
            ? mainRadioLogs.join('')
            : `<div style="color:#aaa; font-style:italic;">[System] Kanał główny SKKP (${currentCountyCallsign}) aktywny. Nasłuch statusów SiS...</div>`;
        chat.scrollTop = chat.scrollHeight;
    }
}

function sendMainRadioDispatchMsg(text) {
    if (!text) return;
    logToMainRadio(`${currentCountyCallsign} ➔ WSZYSCY`, text, '#00ffff', true);
}

function sendMainRadioCustom() {
    const inp = document.getElementById('inp-main-radio');
    if (!inp || !inp.value.trim()) return;
    sendMainRadioDispatchMsg(inp.value.trim());
    inp.value = '';
}

// --- GEOKODER ADRESÓW ---
async function resolveExactCoordinates(streetAddress, townName) {
    const profile = COUNTY_PROFILES[currentCountyId];
    if (!profile) return null;
    const cleanTown = (townName || profile.defaultTown).trim();
    let cleanedStreet = (streetAddress || "")
        .replace(/^(Przystanek Autobusowy|Kamienica|Blok mieszkalny|Hala Magazynowa|Tartak \/ Skład Drzewny)[,\s-]*/i, '')
        .split('/')[0].trim();

    const fullQuery = cleanedStreet
        ? `${cleanedStreet}, ${cleanTown}, ${profile.voivodeship}, Polska`
        : `${cleanTown}, ${profile.voivodeship}, Polska`;

    try {
        const arcUrl = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&singleLine=${encodeURIComponent(fullQuery)}&countryCode=POL&searchExtent=${profile.bbox}&maxLocations=1`;
        const res = await fetch(arcUrl);
        if (res.ok) {
            const data = await res.json();
            if (data.candidates && data.candidates.length > 0) {
                const loc = data.candidates[0].location;
                if (loc && loc.y && loc.x) return { lat: parseFloat(loc.y), lng: parseFloat(loc.x) };
            }
        }
    } catch (e) {}

    try {
        const streetNoPrefix = cleanedStreet.replace(/\b(ul\.|ulica|al\.|aleja|pl\.|plac)\s*/gi, '').trim();
        const center = profile.mapCenter;
        const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(streetNoPrefix + ' ' + cleanTown)}&lat=${center[0]}&lon=${center[1]}&limit=1`;
        const res = await fetch(photonUrl);
        if (res.ok) {
            const data = await res.json();
            if (data.features && data.features.length > 0) {
                const coords = data.features[0].geometry?.coordinates;
                if (coords && coords.length === 2) return { lat: parseFloat(coords[1]), lng: parseFloat(coords[0]) };
            }
        }
    } catch (e) {}

    return null;
}

let stationsGeocoded = false;
async function geocodeAllFireStationsExact() {
    if (stationsGeocoded) return;
    stationsGeocoded = true;

    const cacheKey = `SWD_EXACT_STATIONS_${currentCountyId}_V8`;
    try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            const parsed = JSON.parse(cached);
            Object.keys(parsed).forEach(uName => {
                if (unitExactLocations[uName] && !unitExactLocations[uName].locked && parsed[uName].lat && parsed[uName].lng) {
                    unitExactLocations[uName].lat = parsed[uName].lat;
                    unitExactLocations[uName].lng = parsed[uName].lng;
                }
            });
            updateMapMarkers();
            return;
        }
    } catch (e) {}

    const unitNames = Object.keys(unitExactLocations).filter(u => !unitExactLocations[u].locked);
    const cacheToSave = {};

    await Promise.all(unitNames.map(async (uName) => {
        const info = unitExactLocations[uName];
        const coords = await resolveExactCoordinates(info.address, info.town);
        if (coords) {
            info.lat = coords.lat; info.lng = coords.lng;
            cacheToSave[uName] = { lat: info.lat, lng: info.lng };
        }
    }));

    try {
        if (Object.keys(cacheToSave).length > 2) localStorage.setItem(cacheKey, JSON.stringify(cacheToSave));
    } catch (e) {}

    updateMapMarkers();
}

async function geocodeEventAddress(ev) {
    const rawStreet = (ev.street || "").trim();
    const coords = await resolveExactCoordinates(rawStreet, ev.city);
    if (coords) { ev.lat = coords.lat; ev.lng = coords.lng; }
    else if (!ev.lat || !ev.lng) {
        const fallback = gpsCoords[ev.city] || COUNTY_PROFILES[currentCountyId].mapCenter;
        ev.lat = fallback[0]; ev.lng = fallback[1];
    }
    updateMapMarkers();
    saveSimulationState();
}

function focusEventOnMap(evId) {
    const ev = events.find(e => e.id === evId);
    if (!ev) return;
    switchMainView('map');
    setTimeout(async () => {
        if (!ev.geocodedOnce) { ev.geocodedOnce = true; await geocodeEventAddress(ev); }
        if (leafletMap && ev.lat && ev.lng) leafletMap.setView([ev.lat, ev.lng], 17);
    }, 250);
}

// --- MAPA OPERACYJNA LEAFLET Z RUCHEM PO DROGACH (OSRM GEOMETRY) ---
let leafletMap = null, mapMarkersLayer = null;

function ensureLeafletLoaded(callback) {
    if (window.L) { callback(); return; }
    if (!document.querySelector('link[href*="leaflet.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet'; link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
    }
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = callback;
    document.head.appendChild(script);
}

function initLeafletMap() {
    ensureLeafletLoaded(() => {
        const mapEl = document.getElementById('leaflet-map');
        if (!mapEl) return;
        const center = COUNTY_PROFILES[currentCountyId] ? COUNTY_PROFILES[currentCountyId].mapCenter : [50.0919, 18.2198];
        if (!leafletMap) {
            leafletMap = L.map('leaflet-map').setView(center, 11);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(leafletMap);
            mapMarkersLayer = L.layerGroup().addTo(leafletMap);
            geocodeAllFireStationsExact();
        }
        leafletMap.invalidateSize();
        updateMapMarkers();
    });
}

function updateMapMarkers() {
    if (!leafletMap || !mapMarkersLayer || !window.L) return;
    mapMarkersLayer.clearLayers();

    // 1. Markery stacjonarne jednostek (koszary)
    [...unitsPSP, ...unitsOSP].forEach(u => {
        const firstKey = Object.keys(unitExactLocations)[0];
        const loc = unitExactLocations[u.name] || unitExactLocations[firstKey];
        if (!loc) return;

        const isPSP = u.name.includes("JRG") || u.name.includes("KP PSP") || u.name.includes("KM PSP");
        const hasPzrVeh = u.vehicles.some(v => v.status === 'yellow');
        const borderColor = hasPzrVeh ? "#d4ac0d" : (isPSP ? "#b30000" : "#0a246a");
        const bgBadge = hasPzrVeh ? "#ffe875" : (isPSP ? "#ffe6e6" : "#ffffff");
        
        const vehListHtml = u.vehicles.map(v => {
            const color = v.status === 'green' ? '#1e8449' : (v.status === 'yellow' ? '#d4ac0d' : (v.status === 'orange' ? '#d68910' : '#c0392b'));
            return `<div style="font-size:11px; color:#000;"><span style="color:${color}; font-weight:bold;">●</span> <b>${v.id}</b> - ${v.name}</div>`;
        }).join('');

        const marker = L.marker([loc.lat, loc.lng], {
            icon: L.divIcon({
                className: '',
                html: `<div style="transform:translate(-50%, -50%); background:${bgBadge}; color:#000000; border:2px solid ${borderColor}; border-radius:4px; padding:2px 6px; font-size:11px; font-weight:bold; white-space:nowrap; box-shadow:0 2px 5px rgba(0,0,0,0.45); cursor:pointer;">🚒 ${u.name}</div>`,
                iconSize: [0, 0], iconAnchor: [0, 0]
            })
        });
        marker.bindPopup(`<div style="min-width:220px; color:#000;"><div style="font-weight:bold; color:${borderColor}; font-size:12px;">${u.name}</div><div style="font-size:10px; color:#222; border-bottom:1px solid #ccc; margin-bottom:4px; padding-bottom:3px;">📍 <b>Adres:</b> ${loc.address}</div>${vehListHtml}</div>`);
        mapMarkersLayer.addLayer(marker);
    });

    // 2. Aktywne zdarzenia oraz poruszające się po drogach zastępy
    events.forEach(ev => {
        if (ev.status !== 'ACTIVE') return;
        const fallback = gpsCoords[ev.city] || COUNTY_PROFILES[currentCountyId].mapCenter;
        const evLat = ev.lat || fallback[0], evLng = ev.lng || fallback[1];

        ev.vehicles.forEach(v => {
            if ((v.phase === 'TRAVEL' || v.phase === 'RETURN') && v.baseRouteSeconds > 0) {
                const unitLoc = unitExactLocations[v.unitName] || Object.values(unitExactLocations)[0];
                if (!unitLoc) return;

                let progress = 0;
                let currLat = evLat, currLng = evLng;

                if (v.phase === 'TRAVEL') {
                    progress = Math.max(0, Math.min(1, 1 - (v.travelTime / v.baseRouteSeconds)));
                    
                    if (v.travelGeometry && v.travelGeometry.length > 0) {
                        const idx = Math.min(v.travelGeometry.length - 1, Math.floor(progress * (v.travelGeometry.length - 1)));
                        currLat = v.travelGeometry[idx][0];
                        currLng = v.travelGeometry[idx][1];
                    } else {
                        currLat = unitLoc.lat + (evLat - unitLoc.lat) * progress;
                        currLng = unitLoc.lng + (evLng - unitLoc.lng) * progress;
                    }

                    const movingMarker = L.marker([currLat, currLng], {
                        icon: L.divIcon({
                            className: '',
                            html: `<div style="transform:translate(-50%, -50%); background:#e74c3c; color:#ffffff; border:2px solid #78281f; border-radius:12px; padding:2px 8px; font-size:11px; font-weight:bold; white-space:nowrap; box-shadow:0 0 8px rgba(0,0,0,0.6);">🚒 ${v.id} (Dojazd)</div>`,
                            iconSize: [0, 0], iconAnchor: [0, 0]
                        })
                    });
                    movingMarker.bindPopup(`<div style="color:#000;"><b>Zastęp:</b> ${v.id}<br><b>Jednostka:</b> ${v.unitName}<br><b>Kierunek:</b> Dojazd drogą do ${ev.city}</div>`);
                    mapMarkersLayer.addLayer(movingMarker);

                } else if (v.phase === 'RETURN') {
                    progress = Math.max(0, Math.min(1, 1 - (v.returnTime / v.baseRouteSeconds)));

                    if (v.returnGeometry && v.returnGeometry.length > 0) {
                        const idx = Math.min(v.returnGeometry.length - 1, Math.floor(progress * (v.returnGeometry.length - 1)));
                        currLat = v.returnGeometry[idx][0];
                        currLng = v.returnGeometry[idx][1];
                    } else {
                        currLat = evLat + (unitLoc.lat - evLat) * progress;
                        currLng = evLng + (unitLoc.lng - evLng) * progress;
                    }

                    const returnMarker = L.marker([currLat, currLng], {
                        icon: L.divIcon({
                            className: '',
                            html: `<div style="transform:translate(-50%, -50%); background:#3498db; color:#ffffff; border:2px solid #1b4f72; border-radius:12px; padding:2px 8px; font-size:11px; font-weight:bold; white-space:nowrap; box-shadow:0 0 8px rgba(0,0,0,0.6);">🚒 ${v.id} (Powrót)</div>`,
                            iconSize: [0, 0], iconAnchor: [0, 0]
                        })
                    });
                    returnMarker.bindPopup(`<div style="color:#000;"><b>Zastęp:</b> ${v.id}<br><b>Jednostka:</b> ${v.unitName}<br><b>Kierunek:</b> Powrót drogą do bazy</div>`);
                    mapMarkersLayer.addLayer(returnMarker);
                }
            }
        });

        // 3. Marker samego zdarzenia
        const isPZR = ev.type === 'PZR';
        const bgEv = isPZR ? '#fff3a1' : '#ffcccc';
        const borderEv = isPZR ? '#d4ac0d' : '#b30000';
        const iconEv = isPZR ? '🛡️ [PZR]' : `🚨 [ID:${ev.id}]`;

        const marker = L.marker([evLat, evLng], {
            icon: L.divIcon({
                className: '',
                html: `<div style="transform:translate(-50%, -50%); background:${bgEv}; color:#000000; border:2.5px solid ${borderEv}; border-radius:4px; padding:2px 7px; font-size:11px; font-weight:bold; white-space:nowrap; box-shadow:0 0 8px rgba(0,0,0,0.5); cursor:pointer;">${iconEv} ${ev.city}${ev.street ? ', ' + ev.street : ''}</div>`,
                iconSize: [0, 0], iconAnchor: [0, 0]
            })
        });

        const sisList = ev.vehicles.map(v => {
            if (v.phase === 'PREP') return `${v.id} (Wyjazd z bazy za: ${v.prepTime}s)`;
            if (v.phase === 'TRAVEL') return `${v.id} (Dojazd: ${formatMMSS(v.travelTime)})`;
            if (v.phase === 'ONSITE') return `${v.id} (${isPZR ? 'Zabezpieczenie rejonu' : 'Na miejscu akcji'})`;
            if (v.phase === 'RETURN') return `${v.id} (Powrót: ${formatMMSS(v.returnTime)})`;
            return `${v.id}`;
        }).join('<br>');

        marker.bindPopup(`
            <div style="min-width:230px; color:#000;">
                <b style="color:${borderEv};">ZDARZENIE ID: ${ev.id}/2026 (${ev.type})</b><br>
                <b>Dokładny adres:</b> ${ev.city}, ${ev.street || 'Rejon operacyjny'}<br>
                <b>Opis:</b> ${ev.desc || 'Zabezpieczenie operacyjne rejonu'}<br>
                <b>Zadysponowane SiS (${ev.vehicles.length}):</b><br>${sisList || 'Brak'}<br>
                <div style="margin-top:6px; display:flex; gap:4px;">
                    <button class="btn-win" onclick="openEditEventModal(${ev.id})">Edytuj kartę</button>
                    <button class="btn-win" onclick="openRadioForEvent(${ev.id})">📻 Radio zdarzenia</button>
                </div>
            </div>
        `);
        mapMarkersLayer.addLayer(marker);
    });
}

function switchMainView(viewType) {
    let mapContainer = document.getElementById('view-map-container');
    const pspGrid = document.getElementById('grid-psp');
    const ospGrid = document.getElementById('grid-osp');
    const btnPsp = document.getElementById('btn-tab-psp');
    const btnOsp = document.getElementById('btn-tab-osp');
    const btnMap = document.getElementById('btn-tab-map');

    if (viewType === 'map') {
        if (pspGrid) pspGrid.style.display = 'none';
        if (ospGrid) ospGrid.style.display = 'none';
        if (mapContainer) mapContainer.style.display = 'block';
        if (btnPsp) btnPsp.classList.remove('active');
        if (btnOsp) btnOsp.classList.remove('active');
        if (btnMap) btnMap.classList.add('active');
        setTimeout(() => initLeafletMap(), 100);
    } else {
        if (mapContainer) mapContainer.style.display = 'none';
        if (btnMap) btnMap.classList.remove('active');
        switchTab('PSP');
    }
}

function makeDraggable(elmnt, header) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    if (header) header.onmousedown = dragMouseDown;
    function dragMouseDown(e) {
        if (e.target.closest('.modal-close, .modal-min, button')) return;
        e.preventDefault();
        pos3 = e.clientX; pos4 = e.clientY;
        const rect = elmnt.getBoundingClientRect();
        elmnt.style.position = 'fixed';
        elmnt.style.left = rect.left + 'px'; elmnt.style.top = rect.top + 'px';
        elmnt.style.margin = '0'; elmnt.style.right = 'auto'; elmnt.style.bottom = 'auto';
        document.onmouseup = closeDragElement; document.onmousemove = elementDrag;
    }
    function elementDrag(e) {
        e.preventDefault();
        pos1 = pos3 - e.clientX; pos2 = pos4 - e.clientY;
        pos3 = e.clientX; pos4 = e.clientY;
        elmnt.style.top = (elmnt.offsetTop - pos2) + 'px';
        elmnt.style.left = (elmnt.offsetLeft - pos1) + 'px';
    }
    function closeDragElement() { document.onmouseup = null; document.onmousemove = null; }
}

function ensureVersionBadgeInStatusBar() {
    let badge = document.getElementById('swdst-version-badge');
    if (!badge) {
        const clockBox = document.getElementById('clock-box');
        if (clockBox && clockBox.parentElement) {
            badge = document.createElement('div');
            badge.id = 'swdst-version-badge';
            badge.style.cssText = 'display: inline-block; padding: 2px 6px; font-size: 11px; font-weight: bold; color: #000; background: #ece9d8; border: 1px solid #7f9db9; margin-left: 4px; vertical-align: middle; cursor: pointer;';
            badge.title = "Kliknij, aby zmienić dane operatora";
            badge.onclick = () => openLauncherModal();
            badge.innerText = `${APP_VERSION} (${simSpeed}x)`;
            clockBox.parentElement.insertBefore(badge, clockBox);
        }
    } else {
        badge.innerText = `${APP_VERSION} (${simSpeed}x)`;
    }
}

function ensureSubtypeDOMIntegration() {
    const radios = document.querySelectorAll('input[name="ev-type"]');
    radios.forEach(r => { r.onclick = () => updateSubtypes(r.value); });
    if (!document.getElementById('inp-ev-subtype') && radios.length > 0) {
        const radioRow = radios[0].closest('.form-row');
        if (radioRow && radioRow.parentElement) {
            const subGroup = document.createElement('div');
            subGroup.className = 'form-group'; subGroup.id = 'subtype-group'; subGroup.style.marginTop = '4px';
            subGroup.innerHTML = `<label>Podrodzaj:</label><select id="inp-ev-subtype"></select>`;
            radioRow.insertAdjacentElement('afterend', subGroup);
        }
    }
    updateSubtypes('P');
}

window.addEventListener('DOMContentLoaded', () => {
    injectPzrStyles();

    try {
        const savedSession = localStorage.getItem('SWDST_USER_SESSION');
        if (savedSession) {
            const parsed = JSON.parse(savedSession);
            if (parsed.rank) currentUserRank = parsed.rank;
            if (typeof parsed.username === 'string') currentUserName = parsed.username;
        }
    } catch (e) {}

    applyCountyProfile("lublin");
    updateStatusBarUserDisplay();
    ensureMainRadioWindow();
    ensureVersionBadgeInStatusBar();
    ensureSubtypeDOMIntegration();
    ensureLauncherModalExists();

    document.querySelectorAll('.top-menu .menu-item').forEach(item => {
        const txt = item.innerText.trim().toLowerCase();
        if (txt.includes('system')) item.onclick = () => openLauncherModal();
        else if (txt.includes('siły i środki')) item.onclick = () => openSiSModal();
        else if (txt.includes('mapy')) item.onclick = () => switchMainView('map');
        else if (txt.includes('podział bojowy') || txt.includes('widok')) item.onclick = () => switchMainView('table');
        else if (txt.includes('zestawienia') || txt.includes('raporty') || txt.includes('rejestr')) item.onclick = () => openReportsModal();
        else if (txt.includes('komunikator') || txt.includes('urządzenia')) item.onclick = () => openMainRadio();
    });

    const tabsBar = document.querySelector('.workspace .tabs-bar');
    if (tabsBar && !document.getElementById('btn-tab-map')) {
        const mapTabBtn = document.createElement('button');
        mapTabBtn.className = 'tab-btn'; mapTabBtn.id = 'btn-tab-map';
        mapTabBtn.innerHTML = '🗺️ Mapa Operacyjna';
        mapTabBtn.onclick = () => switchMainView('map');
        tabsBar.appendChild(mapTabBtn);

        const repTabBtn = document.createElement('button');
        repTabBtn.className = 'tab-btn';
        repTabBtn.innerHTML = '📊 Zestawienia i Raporty';
        repTabBtn.onclick = () => openReportsModal();
        tabsBar.appendChild(repTabBtn);
    }

    const btnOpenRadio = document.getElementById('btn-open-radio');
    if (btnOpenRadio && btnOpenRadio.parentElement && !document.getElementById('btn-open-main-radio')) {
        const mainRadBtn = document.createElement('button');
        mainRadBtn.className = 'btn-win'; mainRadBtn.id = 'btn-open-main-radio';
        mainRadBtn.style.cssText = 'background: #fff0f0; border-color: #800000; font-weight: bold; color: #800000;';
        mainRadBtn.innerHTML = '📻 Główne Radio SKKP';
        mainRadBtn.onclick = () => openMainRadio();
        btnOpenRadio.parentElement.appendChild(mainRadBtn);
    }

    injectSpeedAndSaveControls();

    const pspGrid = document.getElementById('grid-psp');
    if (pspGrid && !document.getElementById('view-map-container')) {
        const mapWrap = document.createElement('div');
        mapWrap.id = 'view-map-container';
        mapWrap.style.cssText = 'flex: 1; display: none; width: 100%; min-height: 260px; border: 1px solid #7f9db9; position: relative;';
        mapWrap.innerHTML = '<div id="leaflet-map" style="width: 100%; height: 100%;"></div>';
        pspGrid.parentNode.insertBefore(mapWrap, pspGrid);
    }

    ensureSiSModalExists();
    ensureReportsModalExists();

    const eventModal = document.querySelector('#modal-event .modal-window');
    if (eventModal) makeDraggable(eventModal, document.querySelector('#modal-event .modal-header'));

    const cprModal = document.getElementById('cpr-modal');
    if (cprModal) makeDraggable(cprModal, cprModal.querySelector('.cpr-header'));
});

function ensureSiSModalExists() {
    let sisModal = document.getElementById('modal-sis');
    if (!sisModal) {
        sisModal = document.createElement('div');
        sisModal.className = 'modal-overlay'; sisModal.id = 'modal-sis';
        document.body.appendChild(sisModal);
    }
    sisModal.innerHTML = `
        <div class="modal-window" style="width: 780px; height: 500px;">
            <div class="modal-header">
                <span>🚒 Zarządzanie Siłami i Środkami (Podział Bojowy)</span>
                <div class="modal-close" onclick="closeModal('modal-sis')">×</div>
            </div>
            <div class="modal-body" style="display:flex; flex-direction:column; gap:8px;">
                <div style="display: flex; gap: 8px;">
                    <div class="form-box" style="flex:1;">
                        <div class="form-title">Państwowa Straż Pożarna (JRG)</div>
                        <div style="display:flex; gap:6px; margin-top:6px;">
                            <button class="btn-win" onclick="addCustomUnit('PSP')">➕ Dodaj jednostkę PSP</button>
                            <button class="btn-win" onclick="addCustomVehicle('PSP')">🚒 Dodaj pojazd PSP</button>
                        </div>
                    </div>
                    <div class="form-box" style="flex:1;">
                        <div class="form-title">Ochotnicza Straż Pożarna (OSP)</div>
                        <div style="display:flex; gap:6px; margin-top:6px;">
                            <button class="btn-win" onclick="addCustomUnit('OSP')">➕ Dodaj jednostkę OSP</button>
                            <button class="btn-win" onclick="addCustomVehicle('OSP')">🚒 Dodaj pojazd OSP</button>
                        </div>
                    </div>
                </div>
                <div class="form-box" style="flex:1; overflow-y:auto;">
                    <div class="form-title">Wykaz jednostek, oficjalnych adresów strażnic oraz statusów pojazdów:</div>
                    <div id="sis-manager-list" style="max-height:300px; overflow-y:auto;"></div>
                </div>
            </div>
            <div style="padding: 6px; background: #e1e1e1; display: flex; justify-content: flex-end;">
                <button class="btn-win" onclick="closeModal('modal-sis')">Zamknij</button>
            </div>
        </div>
    `;
    const win = sisModal.querySelector('.modal-window');
    const hdr = sisModal.querySelector('.modal-header');
    if (win && hdr) makeDraggable(win, hdr);
}

function renderSiSManagerList() {
    const container = document.getElementById('sis-manager-list');
    if (!container) return;
    let html = `<table class="sis-table"><thead><tr><th>Jednostka</th><th>Oficjalny adres strażnicy</th><th>Kryptonim</th><th>Pojazd</th><th>Status</th><th>Akcja</th></tr></thead><tbody>`;
    [...unitsPSP, ...unitsOSP].forEach(u => {
        const addr = unitExactLocations[u.name]?.address || "";
        u.vehicles.forEach(v => {
            const stText = v.status === 'green' ? 'W bazie' : (v.status === 'yellow' ? 'Zabezpieczenie rejonu (PZR)' : (v.status === 'orange' ? 'W drodze / Powrót' : 'W akcji na miejscu'));
            const stColor = v.status === 'green' ? '#155724' : (v.status === 'yellow' ? '#b38600' : (v.status === 'orange' ? '#b36b00' : '#b30000'));
            html += `
                <tr style="${v.status === 'yellow' ? 'background:#fff8c4;' : ''}">
                    <td><b>${u.name}</b></td>
                    <td style="font-size:10px; color:#333;">${addr}</td>
                    <td><b>${v.id}</b></td>
                    <td>${v.name}</td>
                    <td style="color:${stColor}; font-weight:bold;">${stText}</td>
                    <td>
                        <button class="btn-win" style="font-size:10px; padding:1px 5px;" onclick="setVehicleStatusManual('${v.id}', 'green')">Wolny</button>
                        <button class="btn-win" style="font-size:10px; padding:1px 5px; background:#fff3a1;" onclick="setVehicleStatusManual('${v.id}', 'yellow')">PZR</button>
                        <button class="btn-win" style="font-size:10px; padding:1px 5px;" onclick="setVehicleStatusManual('${v.id}', 'red')">W akcji</button>
                    </td>
                </tr>
            `;
        });
    });
    html += `</tbody></table>`;
    container.innerHTML = html;
}

function setVehicleStatusManual(vehId, newStatus) {
    [...unitsPSP, ...unitsOSP].forEach(u => {
        const v = u.vehicles.find(x => x.id === vehId);
        if (v) v.status = newStatus;
    });
    renderUnits(); renderSiSManagerList(); updateMapMarkers(); saveSimulationState();
}

async function addCustomUnit(type) {
    const defTown = COUNTY_PROFILES[currentCountyId] ? COUNTY_PROFILES[currentCountyId].defaultTown : "Lublin";
    const name = prompt(`Podaj nazwę nowej jednostki ${type}:`);
    if (!name || !name.trim()) return;
    const town = prompt(`Podaj miejscowość stacjonowania jednostki:`, defTown) || defTown;
    const address = prompt(`Podaj dokładną ulicę i numer strażnicy:`, `ul. Strażacka 1, ${town}`) || town;
    const tCoords = gpsCoords[town.trim()] || COUNTY_PROFILES[currentCountyId].mapCenter;
    unitExactLocations[name.trim()] = { town: town.trim(), address: address.trim(), lat: tCoords[0], lng: tCoords[1] };

    if (type === 'PSP') unitsPSP.push({ name: name.trim(), vehicles: [] });
    else unitsOSP.push({ name: name.trim(), vehicles: [] });

    const exact = await resolveExactCoordinates(address, town);
    if (exact) { unitExactLocations[name.trim()].lat = exact.lat; unitExactLocations[name.trim()].lng = exact.lng; }
    renderUnits(); renderSiSManagerList(); updateMapMarkers(); saveSimulationState();
}

async function addCustomVehicle(type) {
    const targetArray = type === 'PSP' ? unitsPSP : unitsOSP;
    const unitName = prompt(`Podaj dokładną nazwę jednostki ${type}:`, targetArray[0]?.name || "");
    if (!unitName) return;
    const unit = targetArray.find(u => u.name.toLowerCase() === unitName.trim().toLowerCase());
    if (!unit) { alert("Nie znaleziono takiej jednostki na liście!"); return; }
    const id = prompt("Podaj numer operacyjny pojazdu:", "569[S]99");
    const vName = prompt("Podaj typ i markę pojazdu:", "GBA 2,5/16 MAN");
    if (id && vName) {
        unit.vehicles.push({ id: id.trim(), name: vName.trim(), status: "green", obsada: 6 });
        renderUnits(); renderSiSManagerList(); updateMapMarkers(); saveSimulationState();
    }
}

// --- OKNO RAPORTÓW I STATYSTYK ---
function ensureReportsModalExists() {
    if (document.getElementById('modal-reports')) return;
    const modal = document.createElement('div');
    modal.className = 'modal-overlay'; modal.id = 'modal-reports';
    modal.innerHTML = `
        <div class="modal-window" style="width: 920px; height: 660px; background: #d4d0c8; border: 2px solid #0a246a;">
            <div class="modal-header" style="background: #0a246a; color: #fff; padding: 4px 8px;">
                <span>Raporty — Statystyka</span>
                <div class="modal-close" onclick="closeModal('modal-reports')">×</div>
            </div>
            <div class="modal-body" style="padding: 8px; background: #d4d0c8; display: flex; flex-direction: column; gap: 8px; overflow-y: auto;">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 4px;">
                        <b>Zakres:</b>
                        <button class="btn-win" style="background: #eef4ff; font-weight: bold;">Dzień</button>
                        <button class="btn-win">Miesiąc</button>
                        <button class="btn-win">Rok</button>
                        <button class="btn-win">Wszystkie</button>
                        <span id="rep-date-sub" style="color: #444; margin-left: 6px;">Statystyka z bieżącej służby</span>
                    </div>
                    <div style="display:flex; gap:4px;">
                        <button class="btn-win" style="padding: 4px 10px; font-weight: bold;" onclick="exportShiftStateToFile()">💾 Eksportuj JSON</button>
                        <button class="btn-win" style="padding: 4px 10px;" onclick="importShiftStateFromFile()">📂 Wczytaj JSON</button>
                        <button class="btn-win" style="padding: 4px 14px; font-weight: bold;" onclick="window.print()">Drukuj</button>
                    </div>
                </div>
                <div style="background: #ece9d8; border: 1px solid #999; padding: 6px 8px;">
                    <b>Tryb statystyk:</b> Zapis automatyczny w przeglądarce (localStorage) + obsługa plików .json.
                </div>
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;">
                    <div style="background: #e6e6e6; border: 1px solid #999; padding: 6px 8px;"><div style="font-weight: bold; color: #222;">Zgłoszenia ogółem</div><div id="rep-total" style="font-size: 20px; font-weight: bold; margin-top: 4px; color:#000;">0</div></div>
                    <div style="background: #e6e6e6; border: 1px solid #999; padding: 6px 8px;"><div style="font-weight: bold; color: #222;">Aktywne</div><div id="rep-active" style="font-size: 20px; font-weight: bold; margin-top: 4px; color:#000;">0</div></div>
                    <div style="background: #e6e6e6; border: 1px solid #999; padding: 6px 8px;"><div style="font-weight: bold; color: #222;">Zakończone</div><div id="rep-finished" style="font-size: 20px; font-weight: bold; margin-top: 4px; color:#000;">0</div></div>
                    <div style="background: #e6e6e6; border: 1px solid #999; padding: 6px 8px;"><div style="font-weight: bold; color: #222;">Średni czas obsługi</div><div id="rep-avg-time" style="font-size: 16px; font-weight: bold; margin-top: 6px; color:#000;">00:08:30</div></div>
                    <div style="background: #e6e6e6; border: 1px solid #999; padding: 6px 8px;"><div style="font-weight: bold; color: #222;">Odmowy / Anulowane CPR</div><div id="rep-refused" style="font-size: 20px; font-weight: bold; margin-top: 4px; color:#000;">0</div></div>
                    <div style="background: #e6e6e6; border: 1px solid #999; padding: 6px 8px;"><div style="font-weight: bold; color: #222;">Zdarzenia powiązane (CPR)</div><div id="rep-cpr-linked" style="font-size: 20px; font-weight: bold; margin-top: 4px; color:#000;">0</div></div>
                    <div style="background: #e6e6e6; border: 1px solid #999; padding: 6px 8px;"><div style="font-weight: bold; color: #222;">Nowe powyżej 2 min</div><div id="rep-over-2m" style="font-size: 20px; font-weight: bold; margin-top: 4px; color:#000;">0</div></div>
                    <div style="background: #e6e6e6; border: 1px solid #999; padding: 6px 8px;"><div style="font-weight: bold; color: #222;">Komenda</div><div id="rep-range-box" style="font-size: 12px; font-weight: bold; margin-top: 6px; color:#000;">KP PSP</div></div>
                </div>
                <div style="background: #e6e6e6; border: 1px solid #999; padding: 6px;">
                    <div style="background: #cccccc; padding: 4px 6px; font-weight: bold; border: 1px solid #aaa; margin-bottom: 6px;">SŁUŻBY — PRM / PSP / POLICJA</div>
                    <table class="sis-table" style="background: #fff;">
                        <thead><tr><th>Służba</th><th style="text-align:right;">Zadysponowano</th><th style="text-align:right;">Oczekuje (Dojazd)</th><th style="text-align:right;">Obsługa (Na miejscu)</th><th style="text-align:right;">Zakończono</th><th style="text-align:right;">Śr. reakcja</th><th style="text-align:right;">Śr. obsługa</th></tr></thead>
                        <tbody>
                            <tr><td>PRM / ZRM</td><td id="rep-prm-disp" style="text-align:right;">0</td><td id="rep-prm-wait" style="text-align:right;">0</td><td id="rep-prm-act" style="text-align:right;">0</td><td id="rep-prm-fin" style="text-align:right;">0</td><td style="text-align:right;">00:01:20</td><td style="text-align:right;">00:08:00</td></tr>
                            <tr><td>PSP / OSP</td><td id="rep-psp-disp" style="text-align:right;">0</td><td id="rep-psp-wait" style="text-align:right;">0</td><td id="rep-psp-act" style="text-align:right;">0</td><td id="rep-psp-fin" style="text-align:right;">0</td><td style="text-align:right;">00:01:15</td><td style="text-align:right;">00:08:30</td></tr>
                            <tr><td>Policja</td><td id="rep-pol-disp" style="text-align:right;">0</td><td id="rep-pol-wait" style="text-align:right;">0</td><td id="rep-pol-act" style="text-align:right;">0</td><td id="rep-pol-fin" style="text-align:right;">0</td><td style="text-align:right;">00:01:45</td><td style="text-align:right;">00:08:00</td></tr>
                        </tbody>
                    </table>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <div style="background: #e6e6e6; border: 1px solid #999; padding: 6px;"><div style="background: #cccccc; padding: 4px 6px; font-weight: bold; border: 1px solid #aaa; margin-bottom: 4px;">STATUSY CPR</div><table class="sis-table" style="background: #fff;"><thead><tr><th>Nazwa</th><th style="width:70px; text-align:right;">Liczba</th></tr></thead><tbody id="rep-cpr-statuses"></tbody></table></div>
                    <div style="background: #e6e6e6; border: 1px solid #999; padding: 6px;"><div style="background: #cccccc; padding: 4px 6px; font-weight: bold; border: 1px solid #aaa; margin-bottom: 4px;">OPERATORZY</div><table class="sis-table" style="background: #fff;"><thead><tr><th>Nazwa</th><th style="width:70px; text-align:right;">Liczba</th></tr></thead><tbody id="rep-operators"></tbody></table></div>
                    <div style="background: #e6e6e6; border: 1px solid #999; padding: 6px;"><div style="background: #cccccc; padding: 4px 6px; font-weight: bold; border: 1px solid #aaa; margin-bottom: 4px;">TOP KATEGORIE</div><table class="sis-table" style="background: #fff;"><thead><tr><th>Nazwa</th><th style="width:70px; text-align:right;">Liczba</th></tr></thead><tbody id="rep-top-cats"></tbody></table></div>
                    <div style="background: #e6e6e6; border: 1px solid #999; padding: 6px;"><div style="background: #cccccc; padding: 4px 6px; font-weight: bold; border: 1px solid #aaa; margin-bottom: 4px;">TOP PODKATEGORIE</div><table class="sis-table" style="background: #fff;"><thead><tr><th>Nazwa</th><th style="width:70px; text-align:right;">Liczba</th></tr></thead><tbody id="rep-top-subcats"></tbody></table></div>
                    <div style="background: #e6e6e6; border: 1px solid #999; padding: 6px;"><div style="background: #cccccc; padding: 4px 6px; font-weight: bold; border: 1px solid #aaa; margin-bottom: 4px;">POWODY ODMÓW / ANULOWAŃ</div><table class="sis-table" style="background: #fff;"><thead><tr><th>Nazwa</th><th style="width:70px; text-align:right;">Liczba</th></tr></thead><tbody id="rep-refusals-body"></tbody></table></div>
                    <div style="background: #e6e6e6; border: 1px solid #999; padding: 6px;"><div style="background: #cccccc; padding: 4px 6px; font-weight: bold; border: 1px solid #aaa; margin-bottom: 4px;">MIEJSCOWOŚCI / ADRESY</div><table class="sis-table" style="background: #fff;"><thead><tr><th>Nazwa</th><th style="width:70px; text-align:right;">Liczba</th></tr></thead><tbody id="rep-locations-body"></tbody></table></div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    const win = modal.querySelector('.modal-window');
    const hdr = modal.querySelector('.modal-header');
    if (win && hdr) makeDraggable(win, hdr);
}

function openReportsModal() {
    ensureReportsModalExists();
    const total = events.length;
    const active = events.filter(e => e.status === 'ACTIVE').length;
    const finished = events.filter(e => e.status === 'FINISHED').length;

    safeSetElementText('rep-total', total);
    safeSetElementText('rep-active', active);
    safeSetElementText('rep-finished', finished);
    safeSetElementText('rep-refused', shiftStats.cprRefused);
    safeSetElementText('rep-cpr-linked', shiftStats.cprAccepted);
    safeSetElementText('rep-over-2m', events.filter(e => e.vehicles.length >= 2).length);
    safeSetElementText('rep-range-box', COUNTY_PROFILES[currentCountyId] ? COUNTY_PROFILES[currentCountyId].name : "KP PSP");

    let prmDisp = 0, prmWait = 0, prmAct = 0, prmFin = 0;
    let pspDisp = 0, pspWait = 0, pspAct = 0, pspFin = 0;
    let polDisp = 0, polWait = 0, polAct = 0, polFin = 0;
    const catMap = {}, subcatMap = {}, locMap = {};

    events.forEach(ev => {
        const isWaiting = ev.status === 'ACTIVE' && !ev.firstArrived;
        const isOnSite = ev.status === 'ACTIVE' && ev.firstArrived;
        const isDone = ev.status === 'FINISHED';

        if (ev.services && ev.services.prm) { prmDisp++; if (isWaiting) prmWait++; else if (isOnSite) prmAct++; else if (isDone) prmFin++; }
        if (ev.services && ev.services.police) { polDisp++; if (isWaiting) polWait++; else if (isOnSite) polAct++; else if (isDone) polFin++; }
        if (ev.vehicles && ev.vehicles.length > 0) {
            pspDisp += ev.vehicles.length;
            ev.vehicles.forEach(v => {
                if (ev.status === 'FINISHED' && v.phase === 'DONE') pspFin++;
                else if (v.phase === 'PREP' || v.phase === 'TRAVEL') pspWait++;
                else pspAct++;
            });
        }
        const catKey = ev.type || 'P'; catMap[catKey] = (catMap[catKey] || 0) + 1;
        const subKey = ev.subtype || 'Brak podkategorii'; subcatMap[subKey] = (subcatMap[subKey] || 0) + 1;
        const locKey = `${ev.city}${ev.street ? ', ' + ev.street : ''}`; locMap[locKey] = (locMap[locKey] || 0) + 1;
    });

    safeSetElementText('rep-prm-disp', prmDisp); safeSetElementText('rep-prm-wait', prmWait); safeSetElementText('rep-prm-act', prmAct); safeSetElementText('rep-prm-fin', prmFin);
    safeSetElementText('rep-psp-disp', pspDisp); safeSetElementText('rep-psp-wait', pspWait); safeSetElementText('rep-psp-act', pspAct); safeSetElementText('rep-psp-fin', pspFin);
    safeSetElementText('rep-pol-disp', polDisp); safeSetElementText('rep-pol-wait', polWait); safeSetElementText('rep-pol-act', polAct); safeSetElementText('rep-pol-fin', polFin);

    const cprStatBody = document.getElementById('rep-cpr-statuses');
    if (cprStatBody) {
        cprStatBody.innerHTML = (shiftStats.cprTotalGenerated === 0 && total === 0)
            ? `<tr><td colspan="2" style="color:#666;">Brak statusów</td></tr>`
            : `<tr><td>Wygenerowane zgłoszenia 112</td><td style="text-align:right;">${shiftStats.cprTotalGenerated}</td></tr>
               <tr><td>Przyjęte do obsługi (Karty SWD)</td><td style="text-align:right;">${shiftStats.cprAccepted}</td></tr>
               <tr><td>Odrzucone / Zamknięte formatki</td><td style="text-align:right;">${shiftStats.cprRefused}</td></tr>`;
    }

    const opBody = document.getElementById('rep-operators');
    if (opBody) {
        opBody.innerHTML = total === 0
            ? `<tr><td colspan="2" style="color:#666;">Brak danych operatorów</td></tr>`
            : `<tr><td>${getFormattedOperatorName()} (Dyspozytor SKKP)</td><td style="text-align:right;">${total}</td></tr>`;
    }

    const fillTable = (tbodyId, dataObj, emptyLabel) => {
        const el = document.getElementById(tbodyId);
        if (!el) return;
        const entries = Object.entries(dataObj).sort((a, b) => b[1] - a[1]);
        el.innerHTML = entries.length === 0
            ? `<tr><td colspan="2" style="color:#666;">${emptyLabel}</td></tr>`
            : entries.map(([k, v]) => `<tr><td>${k}</td><td style="text-align:right;">${v}</td></tr>`).join('');
    };

    fillTable('rep-top-cats', catMap, 'Brak kategorii');
    fillTable('rep-top-subcats', subcatMap, 'Brak podkategorii');
    fillTable('rep-refusals-body', shiftStats.refusalReasons, 'Brak odmów w wybranym zakresie');
    fillTable('rep-locations-body', locMap, 'Brak danych adresowych');

    const modal = document.getElementById('modal-reports');
    if (modal) modal.style.display = 'flex';
}

function evaluateTacticalForces(ev) {
    const text = ((ev.desc || "") + " " + (ev.subtype || "")).toLowerCase();
    const vehicles = ev.vehicles || [];
    const totalCount = vehicles.length;
    const hasJRG = vehicles.some(v => v.unitName && v.unitName.includes("JRG"));
    const onlyOSP = totalCount > 0 && !hasJRG;
    const hasLadder = vehicles.some(v => /SH-|SD-|SHD-|53|51/.test(v.name + " " + v.id));
    const gcbaCount = vehicles.filter(v => v.name.includes("GCBA")).length;

    if (/hala|hali|magazyn|zakład|produkcyjn|składowisk|tartak/.test(text)) {
        let missing = [];
        if (!hasJRG) missing.push("zastępy gaśnicze z JRG PSP");
        if (gcbaCount < 2) missing.push("co najmniej dwa ciężkie zastępy GCBA");
        if (!hasLadder) missing.push("drabina mechaniczna lub podnośnik (SH/SD)");
        if (totalCount < 4) missing.push(`dodatkowe zastępy gaśnicze (obecnie tylko ${totalCount}, potrzeba min. 4-5)`);
        if (missing.length > 0) return { sufficient: false, reason: `Siły i środki są ZDECYDOWANIE NIEWYSTARCZAJĄCE jak na pożar hali/zakładu! Pilnie potrzebne: ${missing.join(", ")}.` };
    }
    if (/mieszkan|kamienic|balkon|klatce|dach|poddasz|szkoł|urząd|budynk|komin|sadz/.test(text)) {
        let missing = [];
        if (onlyOSP) missing.push("wsparcie z JRG PSP (samo OSP na pożarze budynku mieszkalnego to za mało)");
        if (!hasLadder) missing.push("podnośnik lub drabina mechaniczna (SH/SD)");
        if (totalCount < 3) missing.push(`minimum jeszcze ${3 - totalCount} zastęp(y) GBA/GCBA do pracy w aparatach ODO`);
        if (missing.length > 0) return { sufficient: false, reason: `Siły i środki są NIEWYSTARCZAJĄCE! Na pożar w obiekcie mieszkalnym/budynku konieczne: ${missing.join(", ")}.` };
    }
    if (/las|leśn|traw|stog|stodoł|gospodarcz|rolnicz/.test(text)) {
        let missing = [];
        if (onlyOSP && totalCount < 3) missing.push("wsparcie z JRG PSP oraz sąsiednich OSP");
        if (gcbaCount < 1) missing.push("ciężki samochód gaśniczy GCBA do dowożenia wody");
        if (totalCount < 3) missing.push(`dodatkowe zastępy gaśnicze (obecnie tylko ${totalCount})`);
        if (missing.length > 0) return { sufficient: false, reason: `Siły i środki są NIEWYSTARCZAJĄCE! Prosimy o zadysponowanie: ${missing.join(", ")}.` };
    }
    if (/wypadek|zderzenie|czołow|zakleszcz/.test(text) && (totalCount < 2 || onlyOSP)) {
        return { sufficient: false, reason: `Siły i środki są niewystarczające na wypadek komunikacyjny – potrzebujemy wsparcia zastępu ratownictwa technicznego z JRG PSP oraz ZRM i Policji.` };
    }
    if (/poszukiwan|zaginion/.test(text) && totalCount < 3) {
        return { sufficient: false, reason: `Siły i środki są niewystarczające do przeszukania terenu – prosimy o zadysponowanie dodatkowych zastępów OSP/PSP.` };
    }
    if (totalCount <= 1 && (ev.type === 'P' || onlyOSP) && !/śmietnik|os|szerszeni|konar/.test(text)) {
        return { sufficient: false, reason: `Jeden zastęp na miejscu to za mało ze względów bezpieczeństwa taktycznego – prosimy o zadysponowanie jeszcze jednego zastępu GBA/GCBA.` };
    }
    return { sufficient: true, reason: `Siły i środki zadysponowane na miejsce (${totalCount} zast.) są w tej chwili wystarczające do opanowania sytuacji.` };
}

function generateSmartKdrResponse(kdrCallsign, userQuestion, ev) {
    const q = userQuestion.toLowerCase();
    const desc = (ev.desc || "").toLowerCase();
    const tactical = evaluateTacticalForces(ev);
    const isSmall = /śmietnik|os|szerszeni|konar/.test(desc);
    const hasPrm = /pogotow|zrm|karetk|medyczn/.test(q);
    const hasPol = /policj|patrol/.test(q);
    const hasSis = /dodatkow|siły|środki|srodki|zastęp|podnośnik|drabin|wystarcz/.test(q);

    if (hasSis) return `${currentCountyCallsign}, tu ${kdrCallsign}. ${tactical.reason} Bez odbioru.`;
    if (hasPrm && hasPol) return `${currentCountyCallsign}, tu ${kdrCallsign}. Przyda się u nas zarówno ZRM, jak i patrol Policji do zabezpieczenia miejsca. Bez odbioru.`;
    if (hasPrm) return isSmall ? `${currentCountyCallsign}, tu ${kdrCallsign}. Nie ma osób poszkodowanych, ZRM nie jest potrzebny. Bez odbioru.` : `${currentCountyCallsign}, tu ${kdrCallsign}. Tak, mamy osobę wymagającą przebadania, poproszę ZRM na miejsce. Bez odbioru.`;
    if (hasPol) return `${currentCountyCallsign}, tu ${kdrCallsign}. Tak, przyda się patrol Policji na miejscu. Bez odbioru.`;
    if (/przyjąłem|zrozumiałem/.test(q)) return `${currentCountyCallsign}, tu ${kdrCallsign}. Zrozumiałem, działamy dalej na miejscu. Bez odbioru.`;
    if (!tactical.sufficient) return `${currentCountyCallsign}, tu ${kdrCallsign}. Prowadzimy działania pod adresem ${ev.street || ev.city}, ale ${tactical.reason.charAt(0).toLowerCase() + tactical.reason.slice(1)} Bez odbioru.`;
    return `${currentCountyCallsign}, tu ${kdrCallsign}. Sytuacja na miejscu pod kontrolą, prowadzimy działania pod adresem ${ev.street || ev.city}. Bez odbioru.`;
}

// --- OKNO RADIA ZDARZENIA ---
function createRadioWindow(evId) {
    if (openRadioWindows[evId]) {
        openRadioWindows[evId].style.display = 'block';
        return openRadioWindows[evId];
    }
    const ev = events.find(e => e.id === evId);
    if (!ev) return null;

    const modal = document.createElement('div');
    modal.id = `radio-modal-${evId}`;
    const offset = (Object.keys(openRadioWindows).length * 25) % 150;
    modal.style.cssText = `position:fixed; z-index:1050; width:440px; left:calc(50% - 220px + ${offset}px); top:calc(50% - 210px + ${offset}px);`;

    modal.innerHTML = `
        <div style="background: #c0c0c0; border: 2px solid #ffffff; border-right-color: #404040; border-bottom-color: #404040; box-shadow: 2px 2px 5px rgba(0,0,0,0.5); font-family: 'Segoe UI', Tahoma, sans-serif;">
            <div class="radio-win-header" style="background: linear-gradient(90deg, #004080, #1060b0); color: #ffffff; padding: 3px 6px; font-weight: bold; font-size: 13px; display: flex; justify-content: space-between; align-items: center; cursor: move; user-select: none;">
                <span id="radio-title-${evId}">🖵 Korespondencja Radiowa - ID: ${ev.id} (${ev.city}, ${ev.street || ''})</span>
                <div style="display: flex; gap: 2px;">
                    <button style="background: #c0c0c0; border: 1px solid #fff; width: 18px; height: 16px; font-size: 10px; font-weight: bold; cursor: pointer; padding: 0;" onclick="minimizeRadioWindow(${ev.id})">_</button>
                    <button style="background: #c0c0c0; border: 1px solid #fff; width: 18px; height: 16px; font-size: 10px; font-weight: bold; cursor: pointer; padding: 0;" onclick="closeRadioWindow(${ev.id})">✕</button>
                </div>
            </div>
            <div style="padding: 6px; background: #c0c0c0;">
                <div id="radio-chat-${evId}" style="background: #000000; color: #ffcc00; font-family: 'Courier New', monospace; font-weight: bold; font-size: 12px; height: 195px; padding: 6px; overflow-y: auto; border: 2px solid #808080; box-sizing: border-box; line-height: 1.3;"></div>
                <div style="display: flex; gap: 4px; margin-top: 6px; justify-content: space-between;">
                    <button style="flex: 1; padding: 4px 2px; font-size: 11px; background: #e1e1e1; border: 2px solid #fff; border-right-color: #404040; border-bottom-color: #404040; cursor: pointer; font-weight: bold; color: #000;" onclick="sendRadioReplyDynamic(${ev.id}, 'Przyjąłem.')"><span style="color: green;">✔</span> Przyjąłem</button>
                    <button style="flex: 1; padding: 4px 2px; font-size: 11px; background: #e1e1e1; border: 2px solid #fff; border-right-color: #404040; border-bottom-color: #404040; cursor: pointer; font-weight: bold; color: #000;" onclick="sendRadioReplyDynamic(${ev.id}, currentCountyCallsign + ', czy na miejscu wymagany jest zespół ZRM?')"><span style="color: red;">🚑</span> Wymagany ZRM?</button>
                    <button style="flex: 1; padding: 4px 2px; font-size: 11px; background: #e1e1e1; border: 2px solid #fff; border-right-color: #404040; border-bottom-color: #404040; cursor: pointer; font-weight: bold; color: #000;" onclick="sendRadioReplyDynamic(${ev.id}, currentCountyCallsign + ', czy potrzebny jest patrol Policji?')"><span style="color: blue;">🚔</span> Potrzebna Policja?</button>
                    <button style="flex: 1; padding: 4px 2px; font-size: 11px; background: #e1e1e1; border: 2px solid #fff; border-right-color: #404040; border-bottom-color: #404040; cursor: pointer; font-weight: bold; color: #000;" onclick="sendRadioReplyDynamic(${ev.id}, currentCountyCallsign + ', czy potrzebne są dodatkowe siły i środki?')"><span style="color: darkred;">🚒</span> Dodatkowe SiS?</button>
                </div>
                <div style="display: flex; gap: 4px; margin-top: 6px; align-items: center;">
                    <input type="text" id="inp-radio-reply-${ev.id}" placeholder="Wpisz treść wiadomości radiowej..." style="flex: 1; padding: 5px 8px; font-size: 12px; background: #ffffff; border: 2px solid #808080; outline: none;" onkeypress="if(event.key==='Enter') sendCustomInputRadio(${ev.id})">
                    <button style="padding: 5px 12px; font-size: 11px; background: #e1e1e1; border: 2px solid #fff; border-right-color: #404040; border-bottom-color: #404040; cursor: pointer; font-weight: bold;" onclick="sendCustomInputRadio(${ev.id})">Nadaj</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    makeDraggable(modal, modal.querySelector('.radio-win-header'));
    openRadioWindows[evId] = modal;
    updateRadioChatDynamic(evId);
    return modal;
}

function updateRadioChatDynamic(evId) {
    const ev = events.find(e => e.id === evId);
    if (!ev) return;
    const chat = document.getElementById(`radio-chat-${evId}`);
    if (chat) { chat.innerHTML = (ev.radioLogs || []).join(''); chat.scrollTop = chat.scrollHeight; }
}

function closeRadioWindow(evId) {
    if (openRadioWindows[evId]) { openRadioWindows[evId].remove(); delete openRadioWindows[evId]; }
}

function minimizeRadioWindow(evId) {
    if (openRadioWindows[evId]) {
        openRadioWindows[evId].style.display = 'none';
        const bar = document.getElementById('minimized-bar');
        if (bar) {
            const item = document.createElement('div');
            item.className = 'minimized-item'; item.id = `min-radio-${evId}`;
            item.innerHTML = `📻 Radio (ID: ${evId})`;
            item.onclick = () => { if (openRadioWindows[evId]) openRadioWindows[evId].style.display = 'block'; item.remove(); };
            bar.appendChild(item);
        }
    }
}

function openRadioForEvent(evId) {
    selectedEvIdForRadio = evId;
    createRadioWindow(evId);
    const btnOpen = document.getElementById('btn-open-radio');
    if (btnOpen) btnOpen.style.display = 'block';
}

function openRadioForSelectedEvent() {
    if (selectedEvIdForRadio !== null) openRadioForEvent(selectedEvIdForRadio);
    else if (events.length > 0) openRadioForEvent(events[0].id);
    else alert('Brak aktywnych zdarzeń.');
}

function sendCustomInputRadio(evId) {
    const input = document.getElementById(`inp-radio-reply-${evId}`);
    if (!input || !input.value.trim()) return;
    const val = input.value.trim();
    input.value = '';
    sendRadioReplyDynamic(evId, val);
}

function getCommandRank(vehicle) {
    const uName = (vehicle.unitName || "").toUpperCase();
    const vId = (vehicle.id || "").toUpperCase();
    if (uName.includes("KP PSP") || uName.includes("KM PSP")) return 4.0;
    if (uName.includes("JRG")) {
        if (vId.includes("90")) return 3.3;
        if (vId.includes("21")) return 3.2;
        if (vId.includes("25")) return 3.1;
        return 3.0;
    }
    if (uName.includes("KSRG")) return 2.0;
    return 1.0;
}

async function triggerArrivalRadioReport(ev, vehicle) {
    if (!ev.radioLogs) ev.radioLogs = [];
    if (ev.type === 'PZR') return;

    createRadioWindow(ev.id);
    const newRank = getCommandRank(vehicle);
    const prevRank = ev.kdrRank || 0;
    let takeoverText = "";

    if (!ev.kdrVehicleId) {
        ev.kdrVehicleId = vehicle.id; ev.kdrUnitName = vehicle.unitName; ev.kdrRank = newRank;
    } else if (newRank > prevRank) {
        takeoverText = ` Dowodzenie na miejscu zdarzenia przejmuje przybyły zastęp ${vehicle.id} (${vehicle.unitName}).`;
        ev.kdrVehicleId = vehicle.id; ev.kdrUnitName = vehicle.unitName; ev.kdrRank = newRank;
    }

    const vehiclesListStr = ev.vehicles.map(v => `${v.id} (${v.unitName})`).join(', ');
    const sysPrompt = `Jesteś dowódcą zastępu straży pożarnej (${vehicle.id} z jednostki ${vehicle.unitName}). Dojechałeś na miejsce w miejscowości ${ev.city}, adres: ${ev.street || ''}.
Zdarzenie: "${ev.desc}". Zadysponowane siły: ${vehiclesListStr}.
KOMUNIKAT O PRZEJĘCIU DOWODZENIA: ${takeoverText || 'Brak zmiany KDR.'}
Rozpocznij od: "${currentCountyCallsign}, tu ${vehicle.id}." Zakończ: "Bez odbioru."`;

    let reportText = "";
    try {
        reportText = await callUniversalAI(sysPrompt, "Podaj meldunek z dojazdu i informację o dowodzeniu.", false);
        reportText = reportText.replace(/^["']|["']$/g, '');
    } catch (e) {}

    if (!reportText) {
        reportText = takeoverText
            ? `${currentCountyCallsign}, tu ${vehicle.id}. Dotarliśmy na miejsce (${ev.city}).${takeoverText} Prowadzimy działania. Bez odbioru.`
            : `${currentCountyCallsign}, tu ${vehicle.id}. Jesteśmy na miejscu (${ev.city}, ${ev.street || ''}) – potwierdzam dojazd, prowadzimy działania. Bez odbioru.`;
    }

    audioMotorola.currentTime = 0; audioMotorola.play().catch(() => {});
    const timeStr = new Date().toLocaleTimeString();
    ev.radioLogs.push(`<div style="margin-bottom: 6px; color: #ffcc00;">[${timeStr}] ${vehicle.id} ➔ ${currentCountyCallsign}:<br>"${reportText}"</div>`);
    updateRadioChatDynamic(ev.id);
    saveSimulationState();

    if (takeoverText) {
        logToMainRadio(`${vehicle.id} ➔ SKKP`, `Przejęcie dowodzenia na zdarzeniu ID ${ev.id} (${ev.city}):${takeoverText}`, '#ffaa00', false);
    }
}

async function sendRadioReplyDynamic(evId, text) {
    if (!text) return;
    const ev = events.find(e => e.id === evId);
    if (!ev) return;

    audioMotorola.currentTime = 0; audioMotorola.play().catch(() => {});
    const kdrName = ev.kdrVehicleId || (ev.vehicles[0] ? ev.vehicles[0].id : 'KDR');
    const timeStr = new Date().toLocaleTimeString();
    if (!ev.radioLogs) ev.radioLogs = [];
    ev.radioLogs.push(`<div style="margin-bottom: 6px; color: #00ff00;">[${timeStr}] ${currentCountyCallsign} ➔ ${kdrName}:<br>"${text}"</div>`);

    const chatBox = document.getElementById(`radio-chat-${evId}`);
    if (chatBox) {
        chatBox.innerHTML = ev.radioLogs.join('') + `<div id="ai-typing-${evId}" style="color:#aaa; font-style:italic; padding:2px;">⏳ ${kdrName} nadaje...</div>`;
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    const qLower = text.toLowerCase();
    const tactical = evaluateTacticalForces(ev);
    const asksForSis = /siły|środki|srodki|dodatkow|zastęp|potrzeb|wystarcz/.test(qLower);

    let aiReply = "";
    if (asksForSis && !tactical.sufficient) {
        aiReply = `${currentCountyCallsign}, tu ${kdrName}. ${tactical.reason} Bez odbioru.`;
    } else {
        const vehiclesListStr = ev.vehicles.map(v => `${v.id} (${v.unitName} - ${v.name})`).join(', ');
        const systemPrompt = `Jesteś dowódcą akcji straży pożarnej (${kdrName}) na miejscu w miejscowości ${ev.city}, adres: ${ev.street || ''}.
Opis zdarzenia: "${ev.desc}". Zadysponowane wozy: ${vehiclesListStr}.
OCENA TAKTYCZNA SIŁ I ŚRODKÓW: ${tactical.reason}
Dyspozytor (${currentCountyCallsign}) mówi do Ciebie przez radio: "${text}".
Format: "${currentCountyCallsign}, tu ${kdrName}. [Krótka, konkretna odpowiedź]. Bez odbioru."`;
        try {
            aiReply = await callUniversalAI(systemPrompt, text, false);
            aiReply = aiReply.replace(/^["']|["']$/g, '');
        } catch (err) {}
        if (!aiReply) aiReply = generateSmartKdrResponse(kdrName, text, ev);
    }

    audioMotorola.currentTime = 0; audioMotorola.play().catch(() => {});
    ev.radioLogs.push(`<div style="margin-bottom: 6px; color: #ffcc00;">[${new Date().toLocaleTimeString()}] ${kdrName} ➔ ${currentCountyCallsign}:<br>"${aiReply}"</div>`);
    updateRadioChatDynamic(evId);
    saveSimulationState();
}

function safeSetElementText(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
}

// --- BAZA IMION I NAZWISK ZGŁASZAJĄCYCH ---
const callersMaleFirst = ["Jan", "Piotr", "Tomasz", "Michał", "Krzysztof", "Andrzej", "Paweł", "Marek", "Adam", "Łukasz", "Marcin", "Jakub", "Mateusz", "Wojciech", "Henryk", "Dawid", "Szymon", "Kamil", "Robert", "Rafał", "Jacek", "Grzegorz", "Dariusz", "Mariusz", "Zbigniew", "Sławomir", "Jarosław", "Mirosław", "Ryszard", "Tadeusz", "Artur", "Sebastian", "Patryk", "Damian", "Przemysław", "Maciej", "Bartosz", "Dominik", "Karol", "Filip", "Hubert", "Kacper", "Mikołaj", "Błażej", "Cezary", "Leszek", "Waldemar", "Roman", "Kazimierz", "Wiesław"];
const callersMaleLast = ["Kowalski", "Nowak", "Wiśniewski", "Wójcik", "Kowalczyk", "Kamiński", "Lewandowski", "Zieliński", "Szymański", "Woźniak", "Dąbrowski", "Kozłowski", "Jankowski", "Mazur", "Kwiatkowski", "Wojciechowski", "Krawczyk", "Kaczmarek", "Piotrowski", "Grabowski", "Zając", "Pawłowski", "Michalski", "Król", "Wieczorek", "Jabłoński", "Wróbel", "Nowakowski", "Majewski", "Olszewski", "Stępień", "Malinowski", "Jaworski", "Adamczyk", "Dudek", "Nowicki", "Pawlak", "Górski", "Witkowski", "Walczak", "Sikora", "Baran", "Rutkowski", "Michalak", "Szewczyk", "Ostrowski", "Tomaszewski", "Pietrzak", "Zalewski", "Wróblewski"];
const callersFemaleFirst = ["Anna", "Katarzyna", "Magdalena", "Agnieszka", "Małgorzata", "Krystyna", "Barbara", "Ewa", "Elżbieta", "Zofia", "Teresa", "Joanna", "Monika", "Danuta", "Natalia", "Karolina", "Marta", "Beata", "Dorota", "Halina", "Jadwiga", "Aleksandra", "Irena", "Alicja", "Paulina", "Justyna", "Renata", "Bożena", "Urszula", "Weronika", "Sylwia", "Agata", "Patrycja", "Izabela", "Aneta", "Emilia", "Ewelina", "Kinga", "Martyna", "Klaudia", "Dominika", "Julia", "Zuzanna", "Maja", "Hanna", "Oliwia", "Wiktoria", "Kamila", "Edyta", "Marzena"];
const callersFemaleLast = ["Kowalska", "Nowak", "Wiśniewska", "Wójcik", "Kowalczyk", "Kamińska", "Lewandowska", "Zielińska", "Szymańska", "Woźniak", "Dąbrowska", "Kozłowska", "Jankowska", "Mazur", "Kwiatkowska", "Wojciechowska", "Krawczyk", "Kaczmarek", "Piotrowska", "Grabowska", "Zając", "Pawłowska", "Michalska", "Król", "Wieczorek", "Jabłońska", "Wróbel", "Nowakowska", "Majewska", "Olszewska", "Stępień", "Malinowska", "Jaworska", "Adamczyk", "Dudek", "Nowicka", "Pawlak", "Górska", "Witkowska", "Walczak", "Sikora", "Baran", "Rutkowska", "Michalak", "Szewczyk", "Ostrowska", "Tomaszewska", "Pietrzak", "Zalewska", "Wróblewska"];

function generateRandomPolishCaller() {
    const isFemale = Math.random() < 0.48;
    const first = isFemale ? callersFemaleFirst[Math.floor(Math.random() * callersFemaleFirst.length)] : callersMaleFirst[Math.floor(Math.random() * callersMaleFirst.length)];
    const last = isFemale ? callersFemaleLast[Math.floor(Math.random() * callersFemaleLast.length)] : callersMaleLast[Math.floor(Math.random() * callersMaleLast.length)];
    const prefixes = ["50", "51", "53", "57", "60", "66", "69", "72", "78", "79", "88"];
    const numStr = `${prefixes[Math.floor(Math.random() * prefixes.length)]}${Math.floor(Math.random() * 9000000 + 1000000)}`;
    return `${first} ${last} (tel. ${numStr.slice(0, 3)}-${numStr.slice(3, 6)}-${numStr.slice(6, 9)})`;
}

// --- DYNAMICZNE GENEROWANIE ZGŁOSZEŃ Z CPR PRZEZ AI ---
async function simulateIncomingCPR() {
    audioCpr.currentTime = 0; audioCpr.play().catch(() => {});
    shiftStats.cprTotalGenerated++;
    saveSimulationState();

    const newCprId = `WCPR-2026-${cprCounter++}`;
    const randomTown = townsList[Math.floor(Math.random() * townsList.length)] || "Lublin";
    const chosenType = Math.random() < 0.5 ? "P" : "MZ";

    const townStreets = realStreetsByTown[randomTown] || ["ul. Długa", "ul. Szkolna"];
    const baseStreet = townStreets[Math.floor(Math.random() * townStreets.length)];
    const houseNum = Math.floor(Math.random() * 25) + 1;
    const verifiedStreetAddress = `${baseStreet} ${houseNum}`;

    safeSetElementText('cpr-id', newCprId);
    safeSetElementText('cpr-city', randomTown);
    safeSetElementText('cpr-street', verifiedStreetAddress);
    safeSetElementText('cpr-caller', "Łączenie z operatorem 112...");
    safeSetElementText('cpr-desc', "🤖 AI generuje unikalną treść formatki ze zgłoszenia...");
    
    const cprModal = document.getElementById('cpr-modal');
    if (cprModal) cprModal.style.display = 'flex';

    let generatedDesc = "";
    try {
        const aiPrompt = `Wygeneruj krótką, w 100% realistyczną i unikalną treść zgłoszenia od świadka dla operatora numeru 112 w Polsce.
Typ zdarzenia: ${chosenType === 'P' ? 'Pożar' : 'Zagrożenie miejscowe / Wypadek / Awaria'}, miejscowość: ${randomTown}, adres: ${verifiedStreetAddress}.
Zwróć TYLKO treść powiadomienia po polsku, bez cudzysłowów, maksymalnie 12 słów.`;
        generatedDesc = await callUniversalAI("Jesteś operatorem CPR (112), zapisujesz zgłoszenia od obywateli w systemie.", aiPrompt, false);
        generatedDesc = generatedDesc.replace(/^["']|["']$/g, '').trim();
    } catch (e) {}

    if (!generatedDesc) {
        const phrasesP = [
            "Pali się sadza w kominie, z komina lecą iskry na dach", "Mieszkaniec zgłasza gęsty czarny dym z budynku gospodarczego",
            "Widzę płomienie wydostające się przez dach pustostanu", "Właściciel zgłasza pożar trawy i suchego ścierniska blisko lasu",
            "Pożar samochodu osobowego na poboczu drogi, ogień pod maską", "Pali się altana śmietnikowa przy budynku mieszkalnym",
            "Gęsty dym wydostający się spod dachu warsztatu stolarskiego", "Pożar komory silnika w autobusie komunikacji miejskiej",
            "Widoczne płomienie w oknie na poddaszu budynku mieszkalnego", "Pali się sterta opon na terenie prywatnej posesji",
            "Zgłoszenie pożaru skrzynki elektrycznej na elewacji budynku", "Pożar sadzy w przewodzie kominowym starej kamienicy",
            "Pali się składowisko palet przy magazynie handlowym", "Ogień i silne zadymienie na balkonie na trzecim piętrze bloku",
            "Pali się traktor podczas prac polowych na ściernisku", "Pożar kotłowni w budynku jednorodzinnym, dym na klatce",
            "Pali się poszycie leśne na powierzchni około 10 arów", "Płonie śmietnik kontenerowy w bliskim sąsiedztwie parkingu",
            "Pożar instalacji fotowoltaicznej na dachu domu jednorodzinnego", "Zgłoszenie zadymienia na klatce schodowej w bloku 4-piętrowym"
        ];
        const phrasesMZ = [
            "Samochód uderzył w przydrożne drzewo, kierowca zakleszczony", "Silny wiatr zerwał połowę dachu z budynku mieszkalnego",
            "Podejrzenie silnego wycieku gazu z instalacji w piwnicy", "Duże drzewo całkowicie zablokowało pas ruchu na drodze",
            "Zderzenie czołowe dwóch aut, wyciek płynów na jezdnię", "Konar drzewa zerwał linie energetyczne nad drogą",
            "Kierowca uderzył w słup oświetleniowy, auto zablokowało przejazd", "Plama oleju napędowego na skrzyżowaniu na długości 200 metrów",
            "Zalana piwnica w budynku jednorodzinnym na wysokość 50 cm", "Osoba uwięziona w uszkodzonej windzie między piętrami",
            "Podejrzenie tlenku węgla w łazience, lokator z zawrotami głowy", "Usuwanie gniazda szerszeni przy wejściu do przedszkola",
            "Zderzenie auta osobowego z motocyklem, wyciek paliwa", "Zerwana blacha z dachu zwisa niebezpiecznie nad chodnikiem",
            "Samochód wpadł do głębokiego rowu melioracyjnego", "Zablokowane drzwi do mieszkania, w środku starsza osoba nie odpowiada",
            "Zderzenie trzech samochodów osobowych na skrzyżowaniu", "Pomoc ZRM w zniesieniu ciężkiego pacjenta z 4. piętra",
            "Zabezpieczenie miejsca lądowania dla śmigłowca LPR", "Uszkodzona skrzynka gazowa przy posesji po kolizji auta"
        ];
        const arr = chosenType === 'P' ? phrasesP : phrasesMZ;
        generatedDesc = arr[Math.floor(Math.random() * arr.length)];
    }

    const finalCaller = generateRandomPolishCaller();
    currentCPRData = { id: newCprId, city: randomTown, street: verifiedStreetAddress, type: chosenType, subtype: generatedDesc, desc: generatedDesc, caller: finalCaller };

    resolveExactCoordinates(verifiedStreetAddress, randomTown).then(coords => {
        if (coords && currentCPRData && currentCPRData.id === newCprId) { currentCPRData.lat = coords.lat; currentCPRData.lng = coords.lng; }
    });

    safeSetElementText('cpr-id', currentCPRData.id);
    safeSetElementText('cpr-city', currentCPRData.city);
    safeSetElementText('cpr-street', currentCPRData.street);
    safeSetElementText('cpr-caller', currentCPRData.caller);
    safeSetElementText('cpr-desc', currentCPRData.desc);
}

function closeCPR(isAccepted = false) { 
    if (!isAccepted && currentCPRData) {
        shiftStats.cprRefused++;
        const reason = "Zamknięto formatkę CPR bez otwarcia karty";
        shiftStats.refusalReasons[reason] = (shiftStats.refusalReasons[reason] || 0) + 1;
        currentCPRData = null;
        saveSimulationState();
    }
    const modal = document.getElementById('cpr-modal');
    if(modal) modal.style.display = 'none'; 
}

function minimizeCPR() {
    if (!currentCPRData) return;
    const modal = document.getElementById('cpr-modal');
    if(modal) modal.style.display = 'none';
    const bar = document.getElementById('minimized-bar');
    if(bar) {
        const item = document.createElement('div');
        item.className = 'minimized-item';
        item.innerHTML = `🚨 Zgłoszenie CPR (${currentCPRData.city}, ${currentCPRData.street})`;
        item.onclick = () => { const m = document.getElementById('cpr-modal'); if(m) m.style.display = 'flex'; item.remove(); };
        bar.appendChild(item);
    }
}

function acceptCPRToEvent() {
    if (!currentCPRData) return;
    shiftStats.cprAccepted++;
    openNewEventModal();

    const inpRec = document.getElementById('inp-ev-received');
    const inpCity = document.getElementById('inp-ev-city');
    const inpReg = document.getElementById('inp-ev-region');
    const inpStreet = document.getElementById('inp-ev-street');
    const inpDesc = document.getElementById('inp-ev-desc');
    if(inpRec) inpRec.value = 'CPR';
    if(inpCity) inpCity.value = currentCPRData.city;
    if(inpReg) inpReg.value = locationsDatabase[currentCPRData.city] || '';
    if(inpStreet) inpStreet.value = currentCPRData.street;
    
    let cleanDesc = (currentCPRData.desc || "").replace(/^(P|MZ|AF|CW|WG|BL|ZPR)\s*-\s*/i, "").trim();
    if (inpDesc) inpDesc.value = cleanDesc;

    autoSelectJRGByCity(currentCPRData.city);

    const radioP = document.querySelector('input[name="ev-type"][value="P"]');
    if (radioP) radioP.checked = true;
    updateSubtypes('P');

    const rawCaller = currentCPRData.caller || "";
    const namePart = rawCaller.split(' (tel.')[0] || "";
    const phoneMatch = rawCaller.match(/tel\.\s*([0-9\-]+)/);
    const callerParts = namePart.trim().split(' ');
    const lastNameVal = callerParts.length > 1 ? callerParts.pop() : '';
    const firstNameVal = callerParts.join(' ');

    const nameInp = document.getElementById('inp-caller-name');
    const surInp = document.getElementById('inp-caller-surname');
    const phoneInp = document.getElementById('inp-caller-phone');
    if(nameInp) nameInp.value = firstNameVal;
    if(surInp) surInp.value = lastNameVal;
    if(phoneInp && phoneMatch) phoneInp.value = phoneMatch[1];

    closeCPR(true);
    currentCPRData = null;
    saveSimulationState();
}

function formatMMSS(sec) {
    if (isNaN(sec) || sec < 0) return "Zabezpieczenie rejonu (PZR)";
    const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s} min`;
}

function toggleService(service) {
    servicesState[service] = !servicesState[service];
    const btn = document.getElementById(service === 'prm' ? 'btn-service-prm' : 'btn-service-police');
    if (btn) {
        if (servicesState[service]) btn.classList.add('active');
        else btn.classList.remove('active');
    }
}

function renderUnits() {
    const pspGrid = document.getElementById('grid-psp');
    const ospGrid = document.getElementById('grid-osp');
    if(pspGrid) pspGrid.innerHTML = unitsPSP.map(u => createUnitHTML(u)).join('');
    if(ospGrid) ospGrid.innerHTML = unitsOSP.map(u => createUnitHTML(u)).join('');
}

function createUnitHTML(unit) {
    const exactAddr = unitExactLocations[unit.name]?.address || "";
    const unitHasPzr = unit.vehicles.some(v => v.status === 'yellow' || getActivePzrForVehicle(v.id) !== null);

    let vehiclesHTML = unit.vehicles.length === 0 ? `<div style="padding: 4px; color: #888; font-style: italic;">Brak pojazdów</div>` :
        unit.vehicles.map(v => {
            const pzrEv = getActivePzrForVehicle(v.id);
            const isYellowRow = v.status === 'yellow' || pzrEv !== null;
            const pzrBadge = pzrEv ? ` <span style="background:#f1c40f; color:#000; padding:0 4px; border-radius:2px; font-weight:bold; font-size:9px;">PZR (${pzrEv.city})</span>` : '';
            return `
                <div class="vehicle-row ${isYellowRow ? 'pzr-active' : ''}">
                    <span class="status-dot ${v.status}"></span>
                    <span style="color:#000000;"><b>${v.id}</b> - ${v.name}${pzrBadge}</span>
                </div>
            `;
        }).join('');

    return `
        <div class="unit-box ${unitHasPzr ? 'unit-on-pzr' : ''}">
            <div class="unit-header ${unitHasPzr ? 'header-on-pzr' : ''}" style="color:#000000; font-weight:bold;" title="Adres: ${exactAddr}">
                ${unit.name} ${unitHasPzr ? '🛡️ [PZR]' : ''}
            </div>
            <div>${vehiclesHTML}</div>
        </div>
    `;
}

function renderEvents() {
    const tbody = document.getElementById('events-body');
    if(!tbody) return;
    tbody.innerHTML = '';

    events.forEach(ev => {
        const tr = document.createElement('tr');
        tr.className = (ev.status === 'ACTIVE' ? 'active-ev' : 'finished-ev') + (selectedEvIdForRadio === ev.id ? ' selected-ev' : '');
        if (ev.status === 'ACTIVE' && ev.type === 'PZR' && selectedEvIdForRadio !== ev.id) tr.style.color = '#ffff00';
        tr.ondblclick = () => openEditEventModal(ev.id);
        tr.onclick = () => selectEvent(ev.id);

        let timeDisplay = "";
        if (ev.status === 'FINISHED') {
            const anyReturning = ev.vehicles.some(v => v.phase === 'RETURN' && v.returnTime > 0);
            timeDisplay = anyReturning ? "Powrót SiS..." : "0:00 min (Zakończono)";
        } else if (ev.type === 'PZR') {
            timeDisplay = !ev.firstArrived ? "Dojazd na PZR..." : "Zabezpieczenie rejonu (Aktywne)";
        } else if (!ev.firstArrived) {
            timeDisplay = `W drodze na miejsce... (Czas akcji: ${formatMMSS(ev.remainingSeconds)})`;
        } else {
            timeDisplay = `Działania: ${formatMMSS(ev.remainingSeconds)}`;
        }

        const fullPlace = ev.street ? `${ev.city}, ${ev.street}` : ev.city;
        const rowColorStyle = (ev.status === 'ACTIVE' && ev.type === 'PZR' && selectedEvIdForRadio !== ev.id) ? 'style="color:#ffd700;"' : '';

        tr.innerHTML = `
            <td ${rowColorStyle}>${ev.id}/???/2026</td>
            <td ${rowColorStyle}>${ev.time}</td>
            <td ${rowColorStyle}>${ev.jrg}</td>
            <td ${rowColorStyle}>${ev.jrg}</td>
            <td ${rowColorStyle} title="Kliknij pinezkę, aby przybliżyć adres na mapie">${fullPlace} <span style="cursor:pointer;" onclick="event.stopPropagation(); focusEventOnMap(${ev.id});" title="Pokaż dokładny adres na mapie">📍</span></td>
            <td ${rowColorStyle}>${ev.vehicles.length}</td>
            <td ${rowColorStyle}>${ev.type}</td>
            <td ${rowColorStyle}>${ev.desc || (ev.type === 'PZR' ? 'Przekazanie na zabezpieczenie rejonu' : '')}</td>
            <td ${rowColorStyle}><b>${timeDisplay}</b></td>
            <td ${rowColorStyle}>???-0000${ev.id}</td>
        `;
        tbody.appendChild(tr);
    });
    updateMapMarkers();
}

function renderSelectedEventDetails() {
    if (selectedEvIdForRadio === null) return;
    const ev = events.find(e => e.id === selectedEvIdForRadio);
    if (!ev) return;
    const sisBody = document.getElementById('details-sis-body');
    if (!sisBody) return;

    if (ev.vehicles.length === 0) {
        sisBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #888;">Brak zadysponowanych SiS</td></tr>';
        return;
    }

    sisBody.innerHTML = ev.vehicles.map(v => {
        let statusText = "";
        if (v.phase === 'PREP') statusText = `<span style="color: #d35400; font-weight: bold;">Alarmowanie / Wyjazd za ${v.prepTime}s</span>`;
        else if (v.phase === 'TRAVEL') statusText = `<span style="color: #b36b00; font-weight: bold;">W drodze drogą (${formatMMSS(v.travelTime)})</span>`;
        else if (v.phase === 'ONSITE') {
            statusText = ev.type === 'PZR'
                ? `<span style="color: #b38600; background:#fff8c4; padding:1px 4px; font-weight: bold;">Na zabezpieczeniu rejonu (PZR)</span>`
                : `<span style="color: #b30000; font-weight: bold;">Na miejscu działań</span>`;
        } else if (v.phase === 'RETURN') {
            const pzrEv = getActivePzrForVehicle(v.id);
            const destLabel = (pzrEv && ev.type !== 'PZR') ? `Powrót na PZR ${pzrEv.city}` : `Powrót do bazy`;
            statusText = `<span style="color: #004080; font-weight: bold;">${destLabel} (${formatMMSS(v.returnTime)})</span>`;
        } else {
            const pzrEv = getActivePzrForVehicle(v.id);
            statusText = pzrEv
                ? `<span style="color: #b38600; background:#fff8c4; padding:1px 4px; font-weight: bold;">Na PZR (${pzrEv.city})</span>`
                : `<span style="color: #155724; font-weight: bold;">W bazie (Wolny)</span>`;
        }
        return `
            <tr style="color:#000000; ${ev.type === 'PZR' ? 'background:#fffdf0;' : ''}">
                <td><b>${v.id}</b> - ${v.name}</td>
                <td>${v.obsada}</td>
                <td>${v.unitName}</td>
                <td>${statusText}</td>
            </tr>
        `;
    }).join('');
}

function selectEvent(id) {
    const ev = events.find(e => e.id === id);
    if (!ev) return;
    selectedEvIdForRadio = ev.id;
    const btnOpen = document.getElementById('btn-open-radio');
    const detailsTitle = document.getElementById('details-title');
    if(btnOpen) btnOpen.style.display = 'block';
    if(detailsTitle) detailsTitle.innerText = `ID: ${ev.id} - ${ev.city}${ev.street ? ', ' + ev.street : ''}`;
    renderEvents();
    renderSelectedEventDetails();
}

function switchTab(tab) {
    const pspGrid = document.getElementById('grid-psp');
    const ospGrid = document.getElementById('grid-osp');
    const mapContainer = document.getElementById('view-map-container');
    const btnPsp = document.getElementById('btn-tab-psp');
    const btnOsp = document.getElementById('btn-tab-osp');
    const btnMap = document.getElementById('btn-tab-map');

    if(mapContainer) mapContainer.style.display = 'none';
    if(btnMap) btnMap.classList.remove('active');
    if(pspGrid) pspGrid.style.display = tab === 'PSP' ? 'grid' : 'none';
    if(ospGrid) ospGrid.style.display = tab === 'OSP' ? 'grid' : 'none';
    if(btnPsp) btnPsp.className = 'tab-btn ' + (tab === 'PSP' ? 'active' : '');
    if(btnOsp) btnOsp.className = 'tab-btn ' + (tab === 'OSP' ? 'active' : '');
}

function handleCityInput(input) {
    if(!input) return;
    const val = input.value.trim().toLowerCase();
    const suggestionsBox = document.getElementById('city-suggestions');
    if(!suggestionsBox) return;
    suggestionsBox.innerHTML = '';
    if (!val) { suggestionsBox.style.display = 'none'; return; }

    const matches = Object.keys(locationsDatabase).filter(c => c.toLowerCase().includes(val));
    if (matches.length > 0) {
        matches.forEach(c => {
            const div = document.createElement('div');
            div.className = 'suggestion-item'; div.innerText = c;
            div.onclick = () => {
                const cityInp = document.getElementById('inp-ev-city');
                const regInp = document.getElementById('inp-ev-region');
                if(cityInp) cityInp.value = c;
                if(regInp) regInp.value = locationsDatabase[c];
                autoSelectJRGByCity(c);
                suggestionsBox.style.display = 'none';
            };
            suggestionsBox.appendChild(div);
        });
        suggestionsBox.style.display = 'block';
    } else {
        suggestionsBox.style.display = 'none';
    }
}

function openNewEventModal() {
    activeEditingId = null;
    selectedVehicles = [];
    servicesState = { prm: false, police: false };
    updateJrgSelectOptions();
    
    const btnPrm = document.getElementById('btn-service-prm');
    const btnPol = document.getElementById('btn-service-police');
    if(btnPrm) btnPrm.classList.remove('active');
    if(btnPol) btnPol.classList.remove('active');

    const titleEl = document.getElementById('modal-event-title');
    const timeEl = document.getElementById('inp-ev-time');
    const cityEl = document.getElementById('inp-ev-city');
    const regEl = document.getElementById('inp-ev-region');
    const streetEl = document.getElementById('inp-ev-street');
    const descEl = document.getElementById('inp-ev-desc');
    const nameEl = document.getElementById('inp-caller-name');
    const surEl = document.getElementById('inp-caller-surname');
    const phoneEl = document.getElementById('inp-caller-phone');
    const countEl = document.getElementById('lbl-selected-count');
    const modalEl = document.getElementById('modal-event');

    const defTown = COUNTY_PROFILES[currentCountyId] ? COUNTY_PROFILES[currentCountyId].defaultTown : "Lublin";

    if(titleEl) titleEl.innerText = "Nowa Karta Zdarzenia";
    if(timeEl) timeEl.value = new Date().toLocaleTimeString();
    if(cityEl) { cityEl.value = ''; cityEl.placeholder = `Wpisz np. ${defTown}...`; }
    if(regEl) regEl.value = '';
    if(streetEl) streetEl.value = '';
    if(descEl) descEl.value = '';
    if(nameEl) nameEl.value = '';
    if(surEl) surEl.value = '';
    if(phoneEl) phoneEl.value = '';
    if(countEl) countEl.innerText = "Wybrano pojazdów: 0";

    const radioP = document.querySelector('input[name="ev-type"][value="P"]');
    if (radioP) radioP.checked = true;
    updateSubtypes('P');

    switchModalTab('dane');
    if(modalEl) modalEl.style.display = 'flex';
}

function openEditEventModal(id) {
    const ev = events.find(e => e.id === id);
    if (!ev) return;

    activeEditingId = id;
    selectedVehicles = [...ev.vehicles];
    updateJrgSelectOptions();

    const titleEl = document.getElementById('modal-event-title');
    const timeEl = document.getElementById('inp-ev-time');
    const cityEl = document.getElementById('inp-ev-city');
    const regEl = document.getElementById('inp-ev-region');
    const streetEl = document.getElementById('inp-ev-street');
    const descEl = document.getElementById('inp-ev-desc');
    const countEl = document.getElementById('lbl-selected-count');
    const modalEl = document.getElementById('modal-event');

    if(titleEl) titleEl.innerText = `Edycja zdarzenia ID: ${ev.id}`;
    if(timeEl) timeEl.value = ev.time;
    if(cityEl) cityEl.value = ev.city;
    if(regEl) regEl.value = ev.region;
    if(streetEl) streetEl.value = ev.street;
    if(descEl) descEl.value = ev.desc;
    if(countEl) countEl.innerText = "Wybrano pojazdów: " + selectedVehicles.length;

    const radio = document.querySelector(`input[name="ev-type"][value="${ev.type}"]`);
    if (radio) radio.checked = true;
    updateSubtypes(ev.type);
    const subSel = document.getElementById('inp-ev-subtype');
    if (ev.type !== 'PZR' && subSel) subSel.value = ev.subtype || "";

    servicesState = { ...ev.services };
    const btnPrm = document.getElementById('btn-service-prm');
    const btnPol = document.getElementById('btn-service-police');
    if (btnPrm) { if (servicesState.prm) btnPrm.classList.add('active'); else btnPrm.classList.remove('active'); }
    if (btnPol) { if (servicesState.police) btnPol.classList.add('active'); else btnPol.classList.remove('active'); }

    switchModalTab('dane');
    if(modalEl) modalEl.style.display = 'flex';
}

// --- OKNO DYSPONOWANIA Z GEOMETRIĄ TRASY DROGOWEJ OSRM ---
async function openDispatchModal() {
    const container = document.getElementById('dispatch-list');
    const infoBar = document.getElementById('dispatch-info-bar');
    const cityInput = document.getElementById('inp-ev-city');
    const modalDisp = document.getElementById('modal-dispatch');
    
    if(!container) return;
    const targetCity = cityInput ? cityInput.value.trim() : "";
    
    if(infoBar) {
        infoBar.innerHTML = targetCity ? `📍 Pobieranie geometrii dróg OSRM dla: <span style="color:#b30000;">${targetCity}</span>...` : `⚠️ Brak miejscowości`;
    }

    container.innerHTML = `<div style="padding: 15px; text-align: center; color: #555; font-weight: bold;">⏳ Wyznaczanie tras drogowych dla zastępów...</div>`;
    if(modalDisp) modalDisp.style.display = 'flex';

    const allUnits = [...unitsPSP, ...unitsOSP].filter(u => u.vehicles.length > 0);
    
    const unitsWithProximity = await Promise.all(
        allUnits.map(async u => {
            const prox = await getUnitProximityAsync(u.name, targetCity);
            return { ...u, ...prox };
        })
    );

    unitsWithProximity.sort((a, b) => a.sec - b.sec);

    if(infoBar) {
        infoBar.innerHTML = targetCity ? `📍 Trasy drogowe OSRM gotowe dla: <span style="color:#b30000;">${targetCity}</span>` : `⚠️ Brak miejscowości`;
    }

    container.innerHTML = '';

    unitsWithProximity.forEach((u, index) => {
        const isClosest = index === 0 && targetCity !== "";
        const exactAddr = unitExactLocations[u.name]?.address || "";
        const isPSP = u.name.includes("JRG") || u.name.includes("KP PSP") || u.name.includes("KM PSP");
        const prepRange = isPSP ? "Wyjazd: 1-5s" : "Wyjazd: 1-10s";
        const groupDiv = document.createElement('div');
        groupDiv.className = 'dispatch-unit-group';

        groupDiv.innerHTML = `
            <div class="dispatch-unit-header ${isClosest ? 'closest' : ''}" title="${exactAddr}">
                <span>${index + 1}. ${u.name} <small style="font-weight:normal; color:#333;">(${exactAddr})</small> ${isClosest ? '⭐' : ''}</span>
                <span>${u.km} | Droga: ~${formatMMSS(u.sec)} (${prepRange})</span>
            </div>
            ${u.vehicles.map(v => {
                const pzrEv = getActivePzrForVehicle(v.id);
                const inCombat = isVehicleInCombatAction(v.id);
                const isAssignedToThisEvent = selectedVehicles.some(sv => sv.id === v.id);

                let isBlocked = false;
                let statusBadge = '';
                
                if (inCombat && !isAssignedToThisEvent) {
                    isBlocked = true;
                    statusBadge = `<span style="margin-left:auto; background:#c0392b; color:#fff; padding:1px 5px; border-radius:2px; font-weight:bold; font-size:10px;">🚨 W AKCJI</span>`;
                } else if (pzrEv) {
                    statusBadge = `<span style="margin-left:auto; background:#f1c40f; color:#000; padding:1px 5px; border-radius:2px; font-weight:bold; font-size:10px;">🛡️ PZR (${pzrEv.city})</span>`;
                }

                return `
                    <label class="dispatch-vehicle-item" style="cursor:${isBlocked ? 'not-allowed' : 'pointer'}; color:${isBlocked ? '#888888' : '#000000'}; ${isBlocked ? 'background:#f2f2f2; opacity:0.75;' : (pzrEv ? 'background:#fff8c4;' : '')}">
                        <input type="checkbox" value="${v.id}" data-unit="${u.name}" ${isAssignedToThisEvent ? 'checked' : ''} ${isBlocked ? 'disabled' : ''}>
                        <span class="status-dot ${v.status}"></span>
                        <span><b>${v.id}</b> - ${v.name}</span>
                        ${statusBadge}
                    </label>
                `;
            }).join('')}
        `;
        container.appendChild(groupDiv);
    });
}

async function confirmDispatch() {
    const checkboxes = document.querySelectorAll('#dispatch-list input:checked');
    const cityInput = document.getElementById('inp-ev-city');
    const defTown = COUNTY_PROFILES[currentCountyId] ? COUNTY_PROFILES[currentCountyId].defaultTown : "Lublin";
    const targetCity = (cityInput && cityInput.value.trim()) ? cityInput.value.trim() : defTown;
    const newSelection = [];

    for (const cb of checkboxes) {
        const vehId = cb.value;
        const unitName = cb.getAttribute('data-unit');
        const existing = selectedVehicles.find(sv => sv.id === vehId);
        if (existing) {
            newSelection.push(existing);
        } else {
            for (const u of [...unitsPSP, ...unitsOSP]) {
                const v = u.vehicles.find(veh => veh.id === vehId);
                if (v && !isVehicleInCombatAction(v.id)) {
                    const pzrEv = getActivePzrForVehicle(v.id);
                    const prepSec = pzrEv ? (Math.floor(Math.random() * 5) + 1) : generateDeparturePrepSeconds(u.name);
                    const prox = await getUnitProximityAsync(u.name, targetCity);
                    const routeSec = prox.sec;
                    const travelCoords = prox.coordinates || [];
                    const returnCoords = [...travelCoords].reverse();

                    newSelection.push({
                        ...v, unitName: u.name, phase: 'PREP', prepTime: prepSec,
                        travelTime: routeSec, baseRouteSeconds: routeSec, returnTime: routeSec,
                        travelGeometry: travelCoords, returnGeometry: returnCoords
                    });
                    break;
                }
            }
        }
    }

    selectedVehicles = newSelection;
    const countLbl = document.getElementById('lbl-selected-count');
    if(countLbl) countLbl.innerText = "Wybrano pojazdów: " + selectedVehicles.length;
    closeModal('modal-dispatch');
}

function saveEvent() {
    const cityInput = document.getElementById('inp-ev-city');
    const city = cityInput ? cityInput.value.trim() : "";
    if (!city) { alert('Proszę podać miejscowość!'); return; }

    const typeChecked = document.querySelector('input[name="ev-type"]:checked');
    const typeVal = typeChecked ? typeChecked.value : 'P';
    const subSel = document.getElementById('inp-ev-subtype');
    const subtypeVal = typeVal === 'PZR' ? 'Zabezpieczenie rejonu' : (subSel && subSel.value ? subSel.value : 'Zgłoszenie operacyjne');
    
    const descInput = document.getElementById('inp-ev-desc');
    let descVal = descInput ? descInput.value : '';
    descVal = descVal.replace(/^(P|MZ|AF|CW|WG|BL|ZPR)\s*-\s*/i, "").trim();
    if (typeVal === 'PZR' && !descVal) descVal = `Przekazanie na zabezpieczenie rejonu operacyjnego (${city})`;

    const streetInput = document.getElementById('inp-ev-street');
    const streetVal = streetInput ? streetInput.value.trim() : '';

    (async () => {
        for (const sv of selectedVehicles) {
            if (!sv.phase) {
                sv.phase = 'PREP';
                sv.prepTime = generateDeparturePrepSeconds(sv.unitName);
                const prox = await getUnitProximityAsync(sv.unitName, city);
                sv.travelTime = prox.sec; sv.baseRouteSeconds = prox.sec; sv.returnTime = prox.sec;
                sv.travelGeometry = prox.coordinates || [];
                sv.returnGeometry = [...sv.travelGeometry].reverse();
            }
        }

        let targetEventObj = null;

        if (activeEditingId === null) {
            let countedOspNames = [];
            selectedVehicles.forEach(sv => {
                if (!sv.unitName.includes("JRG") && !sv.unitName.includes("KP PSP") && !sv.unitName.includes("KM PSP") && !countedOspNames.includes(sv.unitName)) {
                    countedOspNames.push(sv.unitName);
                }
            });
            playOspAlarmRepeated(countedOspNames.length);

            const timeInput = document.getElementById('inp-ev-time');
            const regInput = document.getElementById('inp-ev-region');
            const jrgInput = document.getElementById('inp-ev-jrg');
            const fallback = gpsCoords[city] || COUNTY_PROFILES[currentCountyId].mapCenter;
            const calcDuration = calculateActionDurationSeconds(descVal, subtypeVal, typeVal);
            const defJrg = COUNTY_PROFILES[currentCountyId] ? COUNTY_PROFILES[currentCountyId].jrgList[0] : "JRG 1 Lublin";

            const newEv = {
                id: events.length + 1,
                time: timeInput && timeInput.value ? timeInput.value : new Date().toLocaleTimeString(),
                city: city,
                region: regInput ? regInput.value : (locationsDatabase[city] || ''),
                street: streetVal,
                lat: fallback[0], lng: fallback[1],
                desc: descVal, type: typeVal, subtype: subtypeVal,
                remainingSeconds: calcDuration, firstArrived: false, radioReported: false, radioLogs: [],
                jrg: jrgInput ? jrgInput.value : defJrg,
                services: { ...servicesState },
                vehicles: [...selectedVehicles],
                status: 'ACTIVE'
            };
            events.push(newEv);
            targetEventObj = newEv;
            selectEvent(newEv.id);
        } else {
            const ev = events.find(e => e.id === activeEditingId);
            if (ev) {
                ev.city = city; ev.street = streetVal; ev.desc = descVal; ev.type = typeVal;
                ev.subtype = subtypeVal; ev.services = { ...servicesState }; ev.vehicles = [...selectedVehicles];
                targetEventObj = ev;
            }
        }

        selectedVehicles.forEach(sv => {
            [...unitsPSP, ...unitsOSP].forEach(u => {
                const v = u.vehicles.find(veh => veh.id === sv.id);
                if (v) {
                    if (typeVal === 'PZR') v.status = 'yellow';
                    else if (v.status === 'green' || v.status === 'yellow') v.status = 'orange';
                }
            });
        });

        if (targetEventObj) geocodeEventAddress(targetEventObj);
        renderUnits(); renderEvents(); saveSimulationState(); closeModal('modal-event');
    })();
}

function triggerEventFinishAndReturn(ev) {
    if (!ev || ev.status === 'FINISHED') return;
    ev.status = 'FINISHED';
    ev.remainingSeconds = 0;

    ev.vehicles.forEach(sv => {
        const activePzr = (ev.type !== 'PZR') ? getActivePzrForVehicle(sv.id) : null;

        if (sv.phase === 'ONSITE' || sv.phase === 'TRAVEL') {
            sv.phase = 'RETURN';
            sv.returnTime = sv.baseRouteSeconds || getUnitProximity(sv.unitName, ev.city).sec;
            const approxMin = Math.max(1, Math.round(sv.returnTime / 60));

            [...unitsPSP, ...unitsOSP].forEach(u => {
                const veh = u.vehicles.find(vObj => vObj.id === sv.id);
                if (veh) veh.status = 'orange';
            });

            if (activePzr) {
                logToMainRadio(
                    `${sv.id} ➔ ${currentCountyCallsign}`,
                    `${currentCountyCallsign}, tu ${sv.id}. Zakończyliśmy działania w miejscowości ${ev.city}${ev.street ? ' (' + ev.street + ')' : ''}, wracamy z powrotem na zabezpieczenie rejonu (${activePzr.city}). Bez odbioru.`,
                    '#ffd700', true
                );
            } else {
                logToMainRadio(
                    `${sv.id} ➔ ${currentCountyCallsign}`,
                    `${currentCountyCallsign}, tu ${sv.id}. Zakończyliśmy działania w miejscowości ${ev.city}${ev.street ? ' (' + ev.street + ')' : ''}, wracamy do koszar (czas powrotu ok. ${approxMin} min). Bez odbioru.`,
                    '#ffcc00', true
                );
            }
        } else if (sv.phase === 'PREP') {
            sv.phase = 'DONE';
            sv.returnTime = 0;
            [...unitsPSP, ...unitsOSP].forEach(u => {
                const veh = u.vehicles.find(vObj => vObj.id === sv.id);
                if (veh) veh.status = activePzr ? 'yellow' : 'green';
            });
            logToMainRadio(
                `${currentCountyCallsign} ➔ ${sv.id}`,
                `${sv.id}, odwołuję alarm dla waszego zastępu, ${activePzr ? 'pozostańcie na zabezpieczeniu rejonu' : 'pozostańcie w koszarach'}.`,
                '#00ffff', false
            );
        }
    });
    saveSimulationState();
}

function finishCurrentEvent() {
    const targetId = activeEditingId !== null ? activeEditingId : selectedEvIdForRadio;
    if (targetId === null) return;
    const ev = events.find(e => e.id === targetId);
    if (ev) triggerEventFinishAndReturn(ev);
    renderUnits(); renderEvents(); closeModal('modal-event');
}

function switchModalTab(tab) {
    const daneContent = document.getElementById('modal-tab-dane-content');
    const czasyContent = document.getElementById('modal-tab-czasy-content');
    const tabDane = document.getElementById('tab-modal-dane');
    const tabCzasy = document.getElementById('tab-modal-czasy');

    if(daneContent) daneContent.style.display = tab === 'dane' ? 'block' : 'none';
    if(czasyContent) czasyContent.style.display = tab === 'czasy' ? 'block' : 'none';
    if(tabDane) tabDane.className = 'tab-btn ' + (tab === 'dane' ? 'active' : '');
    if(tabCzasy) tabCzasy.className = 'tab-btn ' + (tab === 'czasy' ? 'active' : '');
}

function openSiSModal() { 
    ensureSiSModalExists(); renderSiSManagerList();
    const modal = document.getElementById('modal-sis');
    if(modal) modal.style.display = 'flex'; 
}

function closeModal(id) { 
    const modal = document.getElementById(id);
    if(modal) modal.style.display = 'none'; 
}

// --- GENERATOR KOMUNIKATU WYJAZDU NA GŁÓWNYM RADIU ---
function buildDepartureRadioMessage(vehicle, ev) {
    if (ev.type === 'PZR') return `${vehicle.id} zgłaszam wyjazd na zabezpieczenie rejonu (${ev.city}), odbiór.`;
    if (Math.random() < 0.10) {
        const fullAddr = ev.street ? `${ev.city}, ${ev.street}` : ev.city;
        return `${vehicle.id} zgłaszam wyjazd do zdarzenia na adres: ${fullAddr}, odbiór.`;
    }
    const simpleVariants = [
        `${vehicle.id} zgłaszam wyjazd do zdarzenia, odbiór.`,
        `${vehicle.id} wyjazd, odbiór.`,
        `${currentCountyCallsign}, tu ${vehicle.id}, wyjeżdżamy do zdarzenia, odbiór.`,
        `${vehicle.id} w drodze do zdarzenia, odbiór.`
    ];
    return simpleVariants[Math.floor(Math.random() * simpleVariants.length)];
}

// --- GŁÓWNA PĘTLA CZASU SYMULATORA ---
function runSimulationTick() {
    let needsRender = false;

    events.forEach(ev => {
        if (ev.status === 'ACTIVE') {
            ev.vehicles.forEach(v => {
                if (v.phase === 'PREP') {
                    if (v.prepTime > 0) { v.prepTime--; needsRender = true; }
                    else {
                        v.phase = 'TRAVEL';
                        logToMainRadio(`${v.id} ➔ ${currentCountyCallsign}`, buildDepartureRadioMessage(v, ev), '#7CFC00', true);
                        needsRender = true;
                    }
                }
                else if (v.phase === 'TRAVEL') {
                    if (v.travelTime > 0) { v.travelTime--; needsRender = true; }
                    else {
                        v.phase = 'ONSITE';
                        [...unitsPSP, ...unitsOSP].forEach(u => {
                            const veh = u.vehicles.find(vObj => vObj.id === v.id);
                            if (veh) {
                                if (ev.type === 'PZR') {
                                    if (!isVehicleInCombatAction(v.id)) veh.status = 'yellow';
                                } else {
                                    veh.status = 'red';
                                }
                            }
                        });

                        if (ev.type === 'PZR') {
                            logToMainRadio(`${v.id} ➔ ${currentCountyCallsign}`, `${currentCountyCallsign}, tu ${v.id}. Jesteśmy na miejscu zabezpieczenia rejonu w ${ev.city}, pozostajemy w gotowości bojowej, odbiór.`, '#ffd700', true);
                        } else {
                            logToMainRadio(`${v.id} ➔ ${currentCountyCallsign}`, `${currentCountyCallsign}, tu ${v.id}. Jesteśmy na miejscu zdarzenia w ${ev.city}${ev.street ? ' (' + ev.street + ')' : ''}, odbiór.`, '#ffa500', true);
                        }

                        if (!ev.firstArrived) ev.firstArrived = true;
                        triggerArrivalRadioReport(ev, v);
                        needsRender = true;
                    }
                }
            });

            if (ev.type !== 'PZR' && ev.firstArrived && ev.remainingSeconds > 0) {
                ev.remainingSeconds--; needsRender = true;
            } else if (ev.type !== 'PZR' && ev.firstArrived && ev.remainingSeconds === 0) {
                triggerEventFinishAndReturn(ev); needsRender = true;
            }
        }
        else if (ev.status === 'FINISHED') {
            ev.vehicles.forEach(v => {
                if (v.phase === 'RETURN') {
                    if (v.returnTime > 0) { v.returnTime--; needsRender = true; }
                    else {
                        v.phase = 'DONE';
                        const activePzr = (ev.type !== 'PZR') ? getActivePzrForVehicle(v.id) : null;

                        [...unitsPSP, ...unitsOSP].forEach(u => {
                            const veh = u.vehicles.find(vObj => vObj.id === v.id);
                            if (veh) veh.status = activePzr ? 'yellow' : 'green';
                        });

                        if (activePzr) {
                            const pzrVehObj = activePzr.vehicles.find(pv => pv.id === v.id);
                            if (pzrVehObj) pzrVehObj.phase = 'ONSITE';
                            logToMainRadio(`${v.id} ➔ ${currentCountyCallsign}`, `${currentCountyCallsign}, tu ${v.id} (${v.unitName}). Powróciliśmy na zabezpieczenie rejonu (${activePzr.city}), w gotowości bojowej, odbiór.`, '#ffd700', true);
                        } else {
                            logToMainRadio(`${v.id} ➔ ${currentCountyCallsign}`, `${currentCountyCallsign}, tu ${v.id} (${v.unitName}). Zastęp w bazie, gotowy do działań, odbiór.`, '#00ff7f', true);
                        }
                        needsRender = true;
                    }
                }
            });
        }
    });

    renderUnits(); 
    renderEvents(); 
    updateMapMarkers(); 
    saveSimulationState();

    renderSelectedEventDetails();
    ensureVersionBadgeInStatusBar();

    const clockEl = document.getElementById('clock-box');
    if (clockEl) {
        const now = new Date();
        clockEl.innerText = now.toISOString().slice(0, 10) + ' ' + now.toLocaleTimeString();
    }
}

function startSimulationLoop() {
    if (simIntervalId) clearInterval(simIntervalId);
    const intervalMs = Math.max(200, Math.round(1000 / simSpeed));
    simIntervalId = setInterval(runSimulationTick, intervalMs);
}

function scheduleNextAutoCPR() {
    if (autoCprTimeoutId) clearTimeout(autoCprTimeoutId);
    const baseRandomTime = Math.floor(Math.random() * (90000 - 45000 + 1)) + 45000;
    const scaledTime = Math.max(8000, Math.round(baseRandomTime / simSpeed));

    autoCprTimeoutId = setTimeout(() => {
        const cprModal = document.getElementById('cpr-modal');
        const launcherModal = document.getElementById('modal-launcher');
        const isLauncherOpen = launcherModal && launcherModal.style.display === 'flex';
        if (!isLauncherOpen && (!cprModal || cprModal.style.display !== 'flex')) {
            simulateIncomingCPR();
        }
        scheduleNextAutoCPR();
    }, scaledTime);
}

startSimulationLoop();
scheduleNextAutoCPR();
renderUnits();
