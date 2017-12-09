/*

*/
let md5 = require('md5'),
    http = require("http"),
    https = require("https"),
    querystring = require('querystring'),
    parser = require('xml2json'),
    dateFormat = require('dateformat');



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
        let request_data = `<?xml version="1.0" standalone="yes"?>
            <singleorder>
                <mode>get_boxberry_pickup</mode>
                <auth ukey="${this.API_KEY}" />
            </singleorder>
        `;

        this.send_request(request_data, this.API_PATH, (err, result) => {
            if (err) return callback(err, result);

            // Try convert xml to json
            let json = null;
            try {
                result = result.replaceAll(/\r/, '');
                result = result.replaceAll(/\n/, '');
                json = JSON.parse(parser.toJson( result ));
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
            total_count: 0,
        }

        items.forEach(function(item, i) {
            // TODO
            let title = item.title || "Ошибка наименования";
            title = title.replace(/"/g, '&quot;');

            let q = new Number(item.quantity).toFixed(0);
            result.items_string += `<item name="${title}" weight="${item.weight}" quantity="${q}" price="${item.price}" bundling="1" />`;
            result.total_count = +result.total_count + +q;
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



        // let delivery_date = new Date();
        // let isWeekend = (delivery_date.getDay() == 5) || (delivery_date.getDay() == 6) || (delivery_date.getDay() == 0);
        // if (isWeekend) delivery_date.setDate(delivery_date.getDate()+3)
        // else delivery_date.setDate(delivery_date.getDate()+1)
        // // delivery_date.setDate(delivery_date.getDate()+3)
        let delivery_date = new Date();
        let hours = delivery_date.getHours();
        let delivery_day = 1;
        if (hours > 21) delivery_day = 2;
        let isWeekend = (delivery_date.getDay() == 5) || (delivery_date.getDay() == 6) || (delivery_date.getDay() == 0);
        if (isWeekend) delivery_date.setDate(delivery_date.getDate()+4)
        else delivery_date.setDate(delivery_date.getDate() + delivery_day)
        delivery_date = dateFormat(delivery_date, 'yyyy-mm-dd');


        let checksum = md5(this.API_UID+'u'+items_count+total_count);

        console.log(`DEBUG: items_count=${items_count}, total_count=${total_count}`);

        let request_data = `<?xml version="1.0" standalone="yes"?>
            <singleorder>
                <mode type="boxberry_pickup">get_price</mode>
                <auth ukey="${this.API_KEY}" checksum="${checksum}" />
                <order inner_id="${order.order_id}" name="${order.client.name}" d_date="${delivery_date}" b_time="${order.time_from}" e_time="${order.time_to}">
                    <address office_code="${order.office_code}" />
                    <contacts>${order.client.phone}</contacts>
                    <services valuation="yes" cod="no" checkup="no" part_return="no" />
                    <items>${items_string}</items>
                </order>
            </singleorder>
        `;


        console.log(request_data);


        /*
        */
        this.send_request(request_data, this.API_PATH, (err, result) => {
            if (err) return callback(err, result);

            // Try convert xml to json
            let json = null;
            let price = 0;
            try {
                result = result.replaceAll(/\r/, '');
                result = result.replaceAll(/\n/, '');
                json = JSON.parse( parser.toJson( result ) );
                price = Number(json.response.order.total_price || 0);
            } catch(e) {
                return callback(e, result);
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


        let delivery_date = new Date();
        let hours = delivery_date.getHours();
        let delivery_day = 1;
        if (hours > 21) delivery_day = 2;
        let isWeekend = (delivery_date.getDay() == 5) || (delivery_date.getDay() == 6) || (delivery_date.getDay() == 0);
        if (isWeekend) delivery_date.setDate(delivery_date.getDate()+4)
        else delivery_date.setDate(delivery_date.getDate() + delivery_day)
        // delivery_date.setDate(delivery_date.getDate()+3)
        delivery_date = dateFormat(delivery_date, 'yyyy-mm-dd');

        let checksum = md5(this.API_UID+'u'+items_count+total_count);
        let request_data = `<?xml version="1.0" standalone="yes"?>
            <singleorder>
                <mode>new_boxberry_pickup</mode>
                <auth ukey="${this.API_KEY}" checksum="${checksum}" />
                <order inner_id="${order.order_id}" name="${order.client.name}" d_date="${delivery_date}" b_time="${order.time_from}" e_time="${order.time_to}" site="${order.from_website}">
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
                result = result.replaceAll(/\r/, '');
                result = result.replaceAll(/\n/, '');
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



