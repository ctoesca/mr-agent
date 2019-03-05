
import {Application} from '../../../Application'
import {TbaseParser} from './TbaseParser'
import moment = require('moment');

/* parser optimisé pour les logs IIS:
split de la ligne et recherche positionnelle des champs : beaucoup plus rapide qu'une regExp

Si plusieurs directives sont passées, c'est le nombre de champs qui détermine quelle directive sera utilisée (il n'y a pas la notion de type de champ)
*/

export class IISHttpAccessParser extends TbaseParser {

	protected directives: any[]
	constructor( masks: string[] ) {

		super();

		this.directives = [];
		let sizes: any = {};

		for (let j = 0; j < masks.length; j++) {
			let mask = masks[j];

			let format = mask.split(' ');

			if (sizes[format.length]) {
				throw 'IISHttpAccessParser: plusieurs masks ont le même nombre de champs';
			}

			sizes[format.length] = true;

			this.directives.push([]);

			for (let i = 0; i < format.length; i++) {
				this.directives[j].push(format[i].replace('$', ''));
			}
		}

		this.logger = Application.getLogger('IISHttpAccessParser');
	}

	public parse( line: string ) {

		let row: any = {
			request: null,
			clientip: null,
			auth: null,
			ident: null,
			timestamp: null,
			verb: null,
			httpversion: null,
			response: null,
			bytes: null,
			referrer: null,
			agent: null,
			time_taken: null
		};

		let data = line.split(' ');
		let directive = null;
		for (let i = 0; i < this.directives.length; i++) {
			if (data.length === this.directives[i].length) {
				directive = this.directives[i];
				break;
			}
		}

		if (!directive) {
			return null;
		}

		for (let i = 0; i < data.length; i++) {
			let key = directive[i];
			row[key] = data[i];
			if (row[key] === '-') {
				row[key] = null;
			}
		}

		row['@timestamp'] = moment(row.date + 'T' + row.time + 'Z').format();

		row.date = undefined;
		row.time = undefined;

		return row;
	}



}
