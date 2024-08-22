const fetch = require('node-fetch');
const logger = require('../util/logger');
const status = require('../util/nodeStatus');

module.exports = function (RED) {

  async function getForecast(msg, location) {
    const context = {
      message_id: msg._msgid
    }
    const control = {
      summary: msg._msgid
    }
    const result = await fetch(`https://app-prod-ws.meteoswiss-app.ch/v1/stationOverview?station=${location}`, {
      method: 'get',
      headers: {
      },
    })
      .then(response => response.json());
    return result[location]
  }

  function MeteoSwissForecastNode(config) {
    RED.nodes.createNode(this, config);
    var node = this;

    node.on('input', async function (msg) {
      try {
        status.info(node, 'processing');
        const result = await getForecast(msg, config.location)
        msg.payload = result;
        status.successRing(node, `${result.stationId} ${result.temperature}°C`);
        return node.send(msg);
      } catch (err) {
        node.error(err.message, msg);
        status.error(node, err.message);
      }
    })
  }

  RED.nodes.registerType('meteo-swiss-forecast', MeteoSwissForecastNode);

  RED.httpAdmin.get('/meteo-swiss/locations', async function (req, res) {
    res.json([
      { id: "TAE", name: 'Aadorf / Tänikon' }
      , { id: "ABE", name: 'Aarberg' }
      , { id: "COM", name: 'Acquarossa / Comprovasco' }
      , { id: "ABO", name: 'Adelboden' }
      , { id: "AIE", name: 'Affoltern i. E.' }
      , { id: "AIG", name: 'Aigle' }
      , { id: "AIR", name: 'Airolo' }
      , { id: "ALT", name: 'Altdorf' }
      , { id: "ARH", name: 'Altenrhein' }
      , { id: "ALS", name: 'Altstätten, SG' }
      , { id: "AMW", name: 'Amriswil' }
      , { id: "AND", name: 'Andeer' }
      , { id: "AFI", name: 'Andelfingen' }
      , { id: "ANT", name: 'Andermatt' }
      , { id: "VSANZ", name: 'Anzère' }
      , { id: "APP", name: 'Appenzell' }
      , { id: "VSARO", name: 'Arolla' }
      , { id: "ARO", name: 'Arosa' }
      , { id: "AGATT", name: 'Attelwil' }
      , { id: "RAG", name: 'Bad Ragaz' }
      , { id: "VSBAS", name: 'Baltschiedertal' }
      , { id: "BAN", name: 'Bantiger' }
      , { id: "BAW", name: 'Barmelweid' }
      , { id: "VSGDX", name: 'Barrage Grande Dixence' }
      , { id: "BAS", name: 'Basel / Binningen' }
      , { id: "BEY", name: 'Bellelay' }
      , { id: "BLZ", name: 'Bellinzona' }
      , { id: "BEP", name: 'Belp' }
      , { id: "DOB", name: 'Benken / Doggen' }
      , { id: "LAT", name: 'Bergün / Latsch' }
      , { id: "BER", name: 'Bern / Zollikofen' }
      , { id: "BEC", name: 'Bernina / Curtinatsch' }
      , { id: "BEX", name: 'Bex' }
      , { id: "BEZ", name: 'Beznau' }
      , { id: "BIA", name: 'Biasca' }
      , { id: "BIN", name: 'Binn' }
      , { id: "BIZ", name: 'Bischofszell / Sitterdorf' }
      , { id: "BIV", name: 'Bivio' }
      , { id: "BIE", name: 'Bière' }
      , { id: "BLA", name: 'Blatten, Lötschental' }
      , { id: "BOL", name: 'Boltigen' }
      , { id: "BOS", name: 'Bosco/Gurin' }
      , { id: "VSBSP", name: 'Bourg-St-Pierre' }
      , { id: "BOU", name: 'Bouveret' }
      , { id: "BRW", name: 'Braunwald' }
      , { id: "VSBRI", name: 'Bricola' }
      , { id: "BRZ", name: 'Brienz' }
      , { id: "BRI", name: 'Brig' }
      , { id: "BRT", name: 'Bristen' }
      , { id: "VSBRU", name: 'Bruchji' }
      , { id: "BRP", name: 'Brusio' }
      , { id: "BUS", name: 'Buchs / Aarau' }
      , { id: "BUF", name: 'Buffalora' }
      , { id: "FRE", name: 'Bullet / La Frétaz' }
      , { id: "UBB", name: 'Bözberg' }
      , { id: "BUE", name: 'Bülach' }
      , { id: "CEV", name: 'Cevio' }
      , { id: "CHZ", name: 'Cham' }
      , { id: "VSCHY", name: 'Champéry' }
      , { id: "VSCHA", name: 'Chanrion' }
      , { id: "CHA", name: 'Chasseral' }
      , { id: "CHM", name: 'Chaumont' }
      , { id: "VSCHO", name: 'Choëx' }
      , { id: "CHU", name: 'Chur' }
      , { id: "CHD", name: 'Château-d\'Oex' }
      , { id: "CIM", name: 'Cimetta' }
      , { id: "VSCLU", name: 'Clusanfe' }
      , { id: "CDM", name: 'Col des Mosses' }
      , { id: "GSB", name: 'Col du Grand St-Bernard' }
      , { id: "COL", name: 'Coldrerio' }
      , { id: "COS", name: 'Cossonay' }
      , { id: "COY", name: 'Courtelary' }
      , { id: "COU", name: 'Couvet' }
      , { id: "CMA", name: 'Crap Masegn' }
      , { id: "CRM", name: 'Cressier' }
      , { id: "DAV", name: 'Davos' }
      , { id: "DEM", name: 'Delémont' }
      , { id: "VSDER", name: 'Derborence' }
      , { id: "DIT", name: 'Dietikon' }
      , { id: "DIS", name: 'Disentis' }
      , { id: "VSDUR", name: 'Durnand' }
      , { id: "EBK", name: 'Ebnat-Kappel' }
      , { id: "EGR", name: 'Eggersriet' }
      , { id: "EGH", name: 'Eggishorn' }
      , { id: "EGO", name: 'Egolzwil' }
      , { id: "OED", name: 'Ehrendingen' }
      , { id: "EIN", name: 'Einsiedeln' }
      , { id: "ELM", name: 'Elm' }
      , { id: "VSEMO", name: 'Emosson' }
      , { id: "ENG", name: 'Engelberg' }
      , { id: "ENT", name: 'Entlebuch' }
      , { id: "VSERG", name: 'Ergisch' }
      , { id: "ESZ", name: 'Eschenz' }
      , { id: "EVI", name: 'Evionnaz' }
      , { id: "EVO", name: 'Evolène / Villa' }
      , { id: "FAH", name: 'Fahy' }
      , { id: "FAI", name: 'Faido' }
      , { id: "FIT", name: 'Fieschertal' }
      , { id: "VSFIN", name: 'Findelen' }
      , { id: "FIO", name: 'Fionnay' }
      , { id: "FLW", name: 'Flawil' }
      , { id: "FLU", name: 'Flühli, LU' }
      , { id: "GRA", name: 'Fribourg / Grangeneuve' }
      , { id: "FRU", name: 'Frutigen' }
      , { id: "GAD", name: 'Gadmen' }
      , { id: "GVE", name: 'Genève / Cointrin' }
      , { id: "GES", name: 'Gersau' }
      , { id: "GIH", name: 'Giswil' }
      , { id: "GLA", name: 'Glarus' }
      , { id: "GOR", name: 'Gornergrat' }
      , { id: "GRE", name: 'Grenchen' }
      , { id: "GRH", name: 'Grimsel Hospiz' }
      , { id: "GRO", name: 'Grono' }
      , { id: "GRC", name: 'Grächen' }
      , { id: "GSG", name: 'Gsteig, Gstaad' }
      , { id: "GTT", name: 'Guttannen' }
      , { id: "GOS", name: 'Göschenen' }
      , { id: "GOA", name: 'Göscheneralp' }
      , { id: "GOE", name: 'Gösgen' }
      , { id: "GUE", name: 'Gütsch, Andermatt' }
      , { id: "GUT", name: 'Güttingen' }
      , { id: "HLL", name: 'Hallau' }
      , { id: "HIW", name: 'Hinwil' }
      , { id: "HUT", name: 'Huttwil' }
      , { id: "HOE", name: 'Hörnli' }
      , { id: "ILZ", name: 'Ilanz' }
      , { id: "INN", name: 'Innerthal' }
      , { id: "INT", name: 'Interlaken' }
      , { id: "VSISE", name: 'Isérables' }
      , { id: "VSJEI", name: 'Jeizinen' }
      , { id: "JON", name: 'Jona' }
      , { id: "JUN", name: 'Jungfraujoch' }
      , { id: "KAI", name: 'Kaiserstuhl, AG' }
      , { id: "KAS", name: 'Kandersteg' }
      , { id: "KIE", name: 'Kiental' }
      , { id: "KIS", name: 'Kiesen' }
      , { id: "KLA", name: 'Klosters' }
      , { id: "KOP", name: 'Koppigen' }
      , { id: "KUE", name: 'Küsnacht, ZH' }
      , { id: "AUB", name: 'L\' Auberson' }
      , { id: "BRL", name: 'La Brévine' }
      , { id: "CDF", name: 'La Chaux-de-Fonds' }
      , { id: "DOL", name: 'La Dôle' }
      , { id: "VSFLY", name: 'La Fouly' }
      , { id: "VST", name: 'La Valsainte' }
      , { id: "LAC", name: 'Lachen / Galgenen' }
      , { id: "LAB", name: 'Langenbruck' }
      , { id: "LGA", name: 'Langnau am Albis' }
      , { id: "LAG", name: 'Langnau i.E.' }
      , { id: "LAP", name: 'Laupen' }
      , { id: "LSN", name: 'Lausanne' }
      , { id: "LTB", name: 'Lauterbrunnen' }
      , { id: "MLS", name: 'Le Moléson' }
      , { id: "LEI", name: 'Leibstadt' }
      , { id: "ATT", name: 'Les Attelas' }
      , { id: "AVA", name: 'Les Avants' }
      , { id: "CHB", name: 'Les Charbonnières' }
      , { id: "VSCOL", name: 'Les Collons' }
      , { id: "DIA", name: 'Les Diablerets' }
      , { id: "MAR", name: 'Les Marécottes' }
      , { id: "LEU", name: 'Leukerbad' }
      , { id: "OTL", name: 'Locarno / Monti' }
      , { id: "LOH", name: 'Lohn, SH' }
      , { id: "LON", name: 'Longirod' }
      , { id: "LUG", name: 'Lugano' }
      , { id: "LUZ", name: 'Luzern' }
      , { id: "LAE", name: 'Lägern' }
      , { id: "MAG", name: 'Magadino / Cadenazzo' }
      , { id: "MGL", name: 'Magglingen' }
      , { id: "MAL", name: 'Malbun' }
      , { id: "MAS", name: 'Marsens' }
      , { id: "MAB", name: 'Martigny' }
      , { id: "MAT", name: 'Martina' }
      , { id: "MAH", name: 'Mathod' }
      , { id: "MTR", name: 'Matro' }
      , { id: "VSMAT", name: 'Mattsand' }
      , { id: "MER", name: 'Meiringen' }
      , { id: "MEV", name: 'Mervelier' }
      , { id: "VSMOI", name: 'Moiry' }
      , { id: "MOB", name: 'Montagnier, Bagnes' }
      , { id: "MVE", name: 'Montana' }
      , { id: "GEN", name: 'Monte Generoso' }
      , { id: "MMO", name: 'Mormont' }
      , { id: "MOA", name: 'Mosen' }
      , { id: "MSG", name: 'Mosogno' }
      , { id: "MTE", name: 'Mottec' }
      , { id: "MUR", name: 'Muri, AG' }
      , { id: "MOE", name: 'Möhlin' }
      , { id: "MUB", name: 'Mühleberg' }
      , { id: "NAS", name: 'Naluns / Schlivera' }
      , { id: "NAP", name: 'Napf' }
      , { id: "VSNEN", name: 'Nendaz' }
      , { id: "NEB", name: 'Nesselboden' }
      , { id: "NEU", name: 'Neuchâtel' }
      , { id: "CGI", name: 'Nyon / Changins' }
      , { id: "OBI", name: 'Oberiberg' }
      , { id: "OBR", name: 'Oberriet / Kriessern' }
      , { id: "AEG", name: 'Oberägeri' }
      , { id: "OPF", name: 'Opfikon' }
      , { id: "ORO", name: 'Oron' }
      , { id: "ORS", name: 'Orsières' }
      , { id: "BEH", name: 'Passo del Bernina' }
      , { id: "PAY", name: 'Payerne' }
      , { id: "PFA", name: 'Pfäffikon, ZH' }
      , { id: "PIL", name: 'Pilatus' }
      , { id: "PIO", name: 'Piotta' }
      , { id: "COV", name: 'Piz Corvatsch' }
      , { id: "PMA", name: 'Piz Martegnas' }
      , { id: "PLF", name: 'Plaffeien' }
      , { id: "ROB", name: 'Poschiavo / Robbia' }
      , { id: "PUY", name: 'Pully' }
      , { id: "QUI", name: 'Quinten' }
      , { id: "REM", name: 'Rempen' }
      , { id: "WHF", name: 'Riedholz / Wallierhof' }
      , { id: "ROE", name: 'Robièi' }
      , { id: "ROM", name: 'Romont' }
      , { id: "ROG", name: 'Rossberg' }
      , { id: "ROT", name: 'Rothenbrunnen' }
      , { id: "RUE", name: 'Rünenberg' }
      , { id: "SBE", name: 'S. Bernardino' }
      , { id: "VSSAB", name: 'Saas Balen' }
      , { id: "SAP", name: 'Safien Platz' }
      , { id: "SAI", name: 'Saignelégier' }
      , { id: "VSSFE", name: 'Salanfe' }
      , { id: "VSSAL", name: 'Saleina' }
      , { id: "HAI", name: 'Salen-Reutenen' }
      , { id: "SAX", name: 'Salez / Saxerriet' }
      , { id: "SAM", name: 'Samedan' }
      , { id: "SAG", name: 'Sattel, SZ' }
      , { id: "SVG", name: 'Savognin' }
      , { id: "SUA", name: 'Schaan' }
      , { id: "SHA", name: 'Schaffhausen' }
      , { id: "SRS", name: 'Schiers' }
      , { id: "SCM", name: 'Schmerikon' }
      , { id: "SPF", name: 'Schüpfheim' }
      , { id: "SCU", name: 'Scuol' }
      , { id: "SNG", name: 'Seengen' }
      , { id: "SIA", name: 'Segl-Maria' }
      , { id: "SIE", name: 'Siebnen' }
      , { id: "VSSIE", name: 'Sierre' }
      , { id: "SIH", name: 'Sihlbrugg' }
      , { id: "SIM", name: 'Simplon-Dorf' }
      , { id: "SIO", name: 'Sion' }
      , { id: "SOG", name: 'Soglio' }
      , { id: "VSSOR", name: 'Sorniot-Lac Inférieur' }
      , { id: "PRE", name: 'St-Prex' }
      , { id: "SAN", name: 'St. Antönien' }
      , { id: "STC", name: 'St. Chrischona' }
      , { id: "STG", name: 'St. Gallen' }
      , { id: "SMM", name: 'Sta. Maria, Val Müstair' }
      , { id: "SBO", name: 'Stabio' }
      , { id: "VSSTA", name: 'Stafel' }
      , { id: "STB", name: 'Starkenbach' }
      , { id: "STK", name: 'Steckborn' }
      , { id: "AGSTE", name: 'Stetten' }
      , { id: "STP", name: 'Stöckalp' }
      , { id: "SUS", name: 'Susch' }
      , { id: "SAE", name: 'Säntis' }
      , { id: "THU", name: 'Thun' }
      , { id: "THS", name: 'Thusis' }
      , { id: "TIT", name: 'Titlis' }
      , { id: "CTO", name: 'Torricella / Crana' }
      , { id: "VSTRI", name: 'Trient' }
      , { id: "TRU", name: 'Trun' }
      , { id: "VSTSN", name: 'Tsanfleuron' }
      , { id: "TST", name: 'Tschiertschen' }
      , { id: "VSTUR", name: 'Turtmann' }
      , { id: "UEB", name: 'Uetliberg' }
      , { id: "ULR", name: 'Ulrichen' }
      , { id: "UNK", name: 'Unterkulm' }
      , { id: "URN", name: 'Urnäsch' }
      , { id: "UST", name: 'Uster' }
      , { id: "VAD", name: 'Vaduz' }
      , { id: "VAB", name: 'Valbella' }
      , { id: "VLS", name: 'Vals' }
      , { id: "VSVER", name: 'Vercorin' }
      , { id: "VEV", name: 'Vevey / Corseaux' }
      , { id: "VIO", name: 'Vicosoprano' }
      , { id: "VIT", name: 'Villars-Tiercelin' }
      , { id: "VIS", name: 'Visp' }
      , { id: "VSVIS", name: 'Visperterminen' }
      , { id: "VRI", name: 'Vrin' }
      , { id: "VAE", name: 'Vättis' }
      , { id: "WAG", name: 'Waldegg' }
      , { id: "WAR", name: 'Wartau' }
      , { id: "WEE", name: 'Weesen' }
      , { id: "WFJ", name: 'Weissfluhjoch' }
      , { id: "WIN", name: 'Winterthur / Seen' }
      , { id: "WIT", name: 'Wittnau' }
      , { id: "WYN", name: 'Wynau' }
      , { id: "WAE", name: 'Wädenswil' }
      , { id: "PSI", name: 'Würenlingen / PSI' }
      , { id: "ZER", name: 'Zermatt' }
      , { id: "ZEV", name: 'Zervreila' }
      , { id: "ZWE", name: 'Zweisimmen' }
      , { id: "ZWK", name: 'Zwillikon' }
      , { id: "REH", name: 'Zürich / Affoltern' }
      , { id: "SMA", name: 'Zürich / Fluntern' }
      , { id: "KLO", name: 'Zürich / Kloten' }
    ])
  })
}
