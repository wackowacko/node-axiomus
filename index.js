/*

*/
let md5 = require('md5'),
    http = require("http"),
    https = require("https"),
    querystring = require('querystring'),
    parser = require('xml2json');


/*  Must use this stuff, because Axiomus API
    accept only cyrillic letters for Client Name.
    Ex: getPrice(...);
*/
transliterate = (
    function() {
        var
            rus = "щ   ш  ч  ц  ю  я  ё  ж  ъ  ы  э  а б в г д е з и й к л м н о п р с т у ф х ь".split(/ +/g),
            eng = "shh sh ch cz yu ya yo zh `` y' e` a b v g d e z i j k l m n o p r s t u f x `".split(/ +/g)
        ;
        return function(text, engToRus) {
            var x;
            for(x = 0; x < rus.length; x++) {
                text = text.split(engToRus ? eng[x] : rus[x]).join(engToRus ? rus[x] : eng[x]);
                text = text.split(engToRus ? eng[x].toUpperCase() : rus[x].toUpperCase()).join(engToRus ? rus[x].toUpperCase() : eng[x].toUpperCase()); 
            }
            return text;
        }
    }
)();


/*
*/
class Axiomus {
    /*
    */
	constructor(API_KEY, API_UID) {
        this.API_URL = 'axiomus.ru';
        this.API_PATH = '/hydra/api_xml.php';
        this.API_PATH_CALC = '/calc/calc.php';

        this.API_KEY = API_KEY;
        this.API_UID = API_UID;


        // Using demo account if no API_KEY defined
        if (!API_KEY) {
            this.API_KEY = 'XXcd208495d565ef66e7dff9f98764XX';
            this.API_UID = '92';
            this.API_PATH = '/test/api_xml_test.php';
        }
	}


    /*
    */
    send_request(request_data, path, callback) {
        let output = '';
        let opts = {};
        let post_data = querystring.stringify({
            data: request_data
        });

        // Opts
        opts = {
            host: this.API_URL,
            path: path || this.API_PATH,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(post_data)
            }
        };


        // Request
        let req = https.request(opts, function(res) {
            res.setEncoding('utf8');

            res.on('data', function (chunk) {
                output += chunk;
            });

            res.on('end', function() {
                callback(false, output);
            });
        });


        // On error
        req.on('error', function(err) {
            callback(err, output);
        });


        // Send
        req.write(post_data);
        req.end();
    }


    /*
    */
    getBoxberryLocations(callback) {
        let request_data = `<?xml version='1.0' standalone='yes'?>
            <singleorder>
                <mode>get_boxberry_pickup</mode>
                <auth ukey="${this.API_KEY}" />
            </singleorder>
        `;

        return callback(false, []);

        this.send_request(request_data, this.API_PATH, (err, result) => {
            if (err) return callback(err, result);

            // Try convert xml to json
            let json = null;
            try {
                json = parser.toJson( result );
            } catch(e) {
                return callback(true, e);
            }

            // Ok
            return callback(false, json);
        });
    }


    /*
    */
    getItemsData(items) {
        let result = {
            items_string: '',
            total_count: 0
        }

        items.forEach(function(item, i) {
            // TODO
            result.items_string += `<item name="${item.title}" weight="${item.weight}" quantity="${item.quantity}" price="${item.price}" bundling="1" />`;
            result.total_count += item.quantity;
        });

        return result;
    }


    /*
    */
    getBoxberryPrice(order, callback) {
        let items = order.items,
            items_string = '',
            items_count = items.length,
            total_count = 0;

        let items_data = this.getItemsData(items);
        items_string = items_data.items_string;
        total_count = items_data.total_count;


        /*
        */
        let checksum = md5(this.API_UID+'u'+items_count+total_count);
        let request_data = `<?xml version='1.0' standalone='yes'?>
            <singleorder>
                <mode type="boxberry_pickup">get_price</mode>
                <auth ukey="${this.API_KEY}" checksum="${checksum}" />
                <order inner_id="${order.order_id}" name="${order.client.name}" d_date="${order.delivery_date}" b_time="${order.time_from}" e_time="${order.time_to}">
                    <address office_code="${order.office_code}" />
                    <contacts>${order.client.phone}</contacts>
                    <services valuation="yes" cod="no" checkup="no" part_return="no" />
                    <items>${items_string}</items>
                </order>
            </singleorder>
        `;


        /*
        */
        this.send_request(request_data, this.API_PATH, (err, result) => {
            if (err) return callback(err, result);

            // Try convert xml to json
            let json = null;
            let price = 0;
            try {
                json = JSON.parse( parser.toJson( result ) );
                price = Number(json.response.order.total_price || 0);
            } catch(e) {
                return callback(true, e);
            }

            return callback(false, price);
        });
    }


    /*
    */
    putBoxberryOrder(order, callback) {
        let items = order.items,
            items_string = '',
            items_count = items.length,
            total_count = 0;

        let items_data = this.getItemsData(items);
        items_string = items_data.items_string;
        total_count = items_data.total_count;


        /*
        */
        let checksum = md5(this.API_UID+'u'+items_count+total_count);
        let request_data = `<?xml version='1.0' standalone='yes'?>
            <singleorder>
                <mode>new_boxberry_pickup</mode>
                <auth ukey="${this.API_KEY}" checksum="${checksum}" />
                <order inner_id="${order.order_id}" name="${order.client.name}" d_date="${order.delivery_date}" b_time="${order.time_from}" e_time="${order.time_to}" site="${order.from_website}">
                    <address office_code="${order.office_code}" />
                    <contacts>${order.client.phone}</contacts>
                    <services cod="no" checkup="no" part_return="no" />
                    <items>${items_string}</items>
                </order>
            </singleorder>
        `;


        /*
        */
        this.send_request(request_data, this.API_PATH, (err, result) => {
            if (err) return callback(err, result);

            // Try convert xml to json
            let json = null;
            try {
                json = JSON.parse( parser.toJson( result ) );
            } catch(e) {
                return callback(true, e);
            }

            return callback(false, json);
        });
    }
}


/*
*/
module.exports = Axiomus;



